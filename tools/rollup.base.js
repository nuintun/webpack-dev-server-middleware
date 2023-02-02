/**
 * @module rollup.base
 */

import { createRequire } from 'module';
import treeShake from './plugins/tree-shake.js';
import typescript from '@rollup/plugin-typescript';

const pkg = createRequire(import.meta.url)('../package.json');

const banner = `/**
  * @package ${pkg.name}
  * @license ${pkg.license}
  * @version ${pkg.version}
  * @author ${pkg.author.name} <${pkg.author.email}>
  * @description ${pkg.description}
  * @see ${pkg.homepage}
  */
 `;

/**
 * @function rollup
 * @param esnext
 * @param development
 * @return {import('rollup').RollupOptions}
 */
export default function rollup(esnext) {
  return [
    {
      input: 'src/client/index.ts',
      output: {
        banner,
        dir: 'client',
        format: 'esm',
        interop: 'auto',
        exports: 'auto',
        esModule: false,
        preserveModules: true,
        generatedCode: { constBindings: true }
      },
      plugins: [typescript(), treeShake()],
      onwarn(error, warn) {
        if (error.code !== 'CIRCULAR_DEPENDENCY') {
          warn(error);
        }
      },
      external: ['tslib']
    },
    {
      input: 'src/server/index.ts',
      output: {
        banner,
        esModule: false,
        exports: 'auto',
        interop: 'auto',
        preserveModules: true,
        format: esnext ? 'esm' : 'cjs',
        generatedCode: { constBindings: true },
        dir: esnext ? 'server/esm' : 'server/cjs',
        entryFileNames: `[name].${esnext ? 'js' : 'cjs'}`,
        chunkFileNames: `[name].${esnext ? 'js' : 'cjs'}`
      },
      plugins: [typescript(), treeShake()],
      onwarn(error, warn) {
        if (error.code !== 'CIRCULAR_DEPENDENCY') {
          warn(error);
        }
      },
      external: ['ws', 'tslib', 'webpack', 'koa-compose', 'webpack-dev-middleware']
    }
  ];
}
