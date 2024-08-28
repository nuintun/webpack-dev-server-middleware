/**
 * @module events
 */

import { Options } from './client';
import { HashMessage, InvalidMessage, IssuesMessage, OkMessage, ProgressMessage } from './message';

type Listeners = {
  [E in keyof Events]: Events[E][];
};

export interface Messages {
  ok: OkMessage['payload'];
  hash: HashMessage['payload'];
  issues: IssuesMessage['payload'];
  invalid: InvalidMessage['payload'];
  progress: ProgressMessage['payload'];
}

export interface Events {
  ok(message: Messages['ok'], options: Options): void;
  hash(message: Messages['hash'], options: Options): void;
  issues(message: Messages['issues'], options: Options): void;
  invalid(message: Messages['invalid'], options: Options): void;
  progress(message: Messages['progress'], options: Options): void;
}

const events: Listeners = {
  ok: [],
  hash: [],
  issues: [],
  invalid: [],
  progress: []
};

/**
 * @function on
 * @description Add an event listener callback.
 * @param event Event name.
 * @param callback Event listener callback.
 */
export function on<E extends keyof Events>(event: E, callback: Events[E]): void {
  const callbacks = events[event];

  if (callbacks) {
    callbacks.push(callback);
  }
}

/**
 * @function off
 * @description Remove an event listener callback.
 * @param event Event name.
 * @param callback Event listener callback.
 */
export function off<E extends keyof Events>(event: E, callback?: Events[E]): void {
  const callbacks = events[event];

  if (callbacks) {
    if (callback) {
      const index = callbacks.indexOf(callback);

      if (index >= 0) {
        callbacks.splice(index, 1);
      }
    } else {
      events[event] = [];
    }
  }
}

export function emit<E extends keyof Events>(event: E, message: Messages[E], options: Options): void {
  const callbacks = events[event];

  if (callbacks && callbacks.length > 0) {
    for (const callback of callbacks) {
      callback(message as any, options);
    }
  }
}
