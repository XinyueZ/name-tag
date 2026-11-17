import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsdown'

const id = '@deepseek-ai/dsh-client-name-tag'
const rootDir = dirname(fileURLToPath(import.meta.url))
const tfWebEntry = resolve(rootDir, 'node_modules/@huggingface/transformers/dist/transformers.web.js')

export default defineConfig([
  // Node half: lib/index.js & lib/invariant.js
  {
    entry: {
      index: 'src/index.ts',
      invariant: 'src/invariant.ts',
    },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2022',
    fixedExtension: false,
    dts: false,
    clean: false,
    deps: {
      neverBundle: ['@deepseek-ai/cordis', '@langchain/core', '@langchain/community', 'faiss-node'],
    },
  },
  // Browser client half: lib/client.js (ModuleLoader closure)
  {
    entry: {
      client: 'src/client/index.tsx',
    },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    sourcemap: true,
    clean: false,
    alias: {
      '@huggingface/transformers': tfWebEntry,
    },
    define: {
      'process.env.NODE_ENV': '"production"',
      'import.meta.url': '(typeof location !== "undefined" ? location.href : "")',
    },
    deps: {
      neverBundle: [
        'react',
        'react/jsx-runtime',
        'react-dom',
        'react-dom/client',
        '@deepseek-ai/cordis',
        '@deepseek-ai/dsh-client-ui-slots',
        '@deepseek-ai/dsh-client-ui-primitives',
      ],
      alwaysBundle: [
        /^onnxruntime-web/,
        /^@huggingface\/transformers/,
        /^@huggingface\/jinja/,
        /^@huggingface\/tokenizers/,
        /^@langchain\/core/,
      ],
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {\n`,
      footer: '\nreturn module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
