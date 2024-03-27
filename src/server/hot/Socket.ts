/**
 * @module Socket
 */

import { Context } from 'koa';
import WebSocket, { WebSocketServer } from 'ws';
import webpack, { StatsCompilation } from 'webpack';
import { Options, PluginFactory } from './interface';
import { getCompilers, PLUGIN_NAME } from '/server/utils';
import { ICompiler, ILogger, IStats } from '/server/interface';
import { getOptions, getStatsOptions, getTimestamp, hasIssues, isUpgradable, WEBSOCKET_RE } from './utils';

export class Socket {
  private readonly logger: ILogger;
  private readonly compiler: ICompiler;
  private readonly server: WebSocketServer;
  private readonly options: Required<Options>;

  private stats: StatsCompilation | null = null;

  constructor(compiler: ICompiler, options: Options) {
    this.compiler = compiler;
    this.options = getOptions(options);
    this.server = new WebSocketServer({
      noServer: true,
      path: this.options.path
    });
    this.logger = compiler.getInfrastructureLogger(PLUGIN_NAME);

    this.setupWss();
    this.setupHooks();
    this.setupPlugins();
  }

  setupWss(): void {
    const { server, logger } = this;

    server.on('connection', client => {
      if (this.stats) {
        this.broadcastStats([client], this.stats);
      }

      logger.log('client connected');
    });

    server.on('error', error => {
      logger.error(error);
    });

    server.on('close', function () {
      logger.log('client disconnected');
    });
  }

  setupHooks(): void {
    const { compiler } = this;
    const { hooks } = compiler;
    const statsOptions = getStatsOptions(compiler);

    hooks.done.tap(PLUGIN_NAME, (stats: IStats) => {
      // Get json stats.
      const jsonStats = stats.toJson(statsOptions);

      // Hack builtAt.
      if (jsonStats.builtAt == null) {
        jsonStats.builtAt = getTimestamp(jsonStats);
      }

      // Cache stats.
      this.stats = jsonStats;

      // Do the stuff in nextTick, because bundle may be invalidated if a change happened while compiling.
      process.nextTick(() => {
        const { stats } = this;

        // Broadcast stats.
        if (stats) {
          this.broadcastStats(this.clients(), stats);
        }
      });
    });

    hooks.invalid.tap(PLUGIN_NAME, (path, timestamp) => {
      // Set stats to null.
      this.stats = null;

      // Broadcast invalid.
      this.broadcast(this.clients(), 'invalid', { path, timestamp });
    });
  }

  setupPlugins(): void {
    const { options, compiler } = this;
    const compilers = getCompilers(compiler);
    const plugins: PluginFactory[] = [
      () => {
        return new webpack.NoEmitOnErrorsPlugin();
      },
      () => {
        return new webpack.HotModuleReplacementPlugin();
      },
      ({ name, context }) => {
        const params = new URLSearchParams();

        params.set('name', name || 'webpack');
        params.set('path', options.path || '/hot');
        params.set('wss', options.wss === true ? 'true' : 'false');
        params.set('hmr', options.hmr !== false ? 'true' : 'false');
        params.set('reload', options.reload !== false ? 'true' : 'false');
        params.set('overlay', options.overlay !== false ? 'true' : 'false');
        params.set('progress', options.progress !== false ? 'true' : 'false');

        // Auto add hot client to entry.
        return new webpack.EntryPlugin(context, `webpack-dev-service/client?${params}`, {
          // Don't create runtime.
          runtime: false
        });
      }
    ];

    for (const compiler of compilers) {
      for (const plugin of plugins) {
        plugin(compiler).apply(compiler);
      }
    }

    if (options.progress) {
      let value = 0;

      new webpack.ProgressPlugin((percentage, status, message) => {
        const nextValue = Math.floor(percentage * 100);

        if (nextValue > value || nextValue === 0) {
          value = nextValue;

          switch (value) {
            case 0:
              status = 'start';
              message = 'end idle';
              break;
            case 100:
              status = 'finish';
              message = 'begin idle';
              break;
          }

          this.broadcast(this.clients(), 'progress', { status, message, value });
        }
      }).apply(compiler);
    }
  }

  clients(): Set<WebSocket> {
    return this.server.clients;
  }

  upgrade(context: Context): boolean {
    const { server } = this;
    const { req: request } = context;

    if (isUpgradable(context, WEBSOCKET_RE) && server.shouldHandle(request)) {
      context.respond = false;

      const { socket } = context;
      const head = Buffer.alloc(0);

      server.handleUpgrade(request, socket, head, client => {
        server.emit('connection', client, request);
      });

      return true;
    }

    return false;
  }

  broadcast<T>(clients: Set<WebSocket> | WebSocket[], action: string, payload: T): void {
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ action, payload }));
      }
    }
  }

  broadcastStats(clients: Set<WebSocket> | WebSocket[], stats: StatsCompilation): void {
    if ((clients as Set<WebSocket>).size > 0 || (clients as WebSocket[]).length > 0) {
      const { hash, errors, warnings, builtAt: timestamp } = stats;

      this.broadcast(clients, 'hash', { hash, timestamp });

      if (hasIssues(errors) || hasIssues(warnings)) {
        this.broadcast(clients, 'issues', { errors, warnings, timestamp });
      } else {
        this.broadcast(clients, 'ok', { timestamp });
      }
    }
  }
}
