import { build, defineConfig, type LibraryOptions } from 'vite'
import { dirname, resolve } from 'node:path'
import react from '@vitejs/plugin-react-swc'
import { fileURLToPath } from 'node:url'
const __dirname = dirname(fileURLToPath(import.meta.url))
const watch = process.argv.includes('--watch') ? {} : false

// https://vite.dev/config/
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/extension/content.ts'),
      fileName: (_format, entryName) => `extension/${entryName}.js`,
      formats: ['iife'],
      name: 'content'
    },
    emptyOutDir: false,
    watch,
  },
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  plugins: [react()],
})

/**
 * 为什么不合并在content.js里面？
 * 权限不够：
 * 1. content.js里面访问不到danmakuMange
 * 2. content.js里面访问不到webview.isDevToolsOpened
 * 3. content.js里面访问不到biliBridgePc
 * 4. 方便测试开发content.js需要重启App(有无方法不需要重启？)
 */
// page libraries
const libraries: LibraryOptions[] = [
  {
    entry: resolve(__dirname, 'src/extension/page.ts'),
    name: 'page',
    fileName: (_format, entryName) => `extension/${entryName}.js`,
    formats: ['iife'],
    cssFileName: 'extension/bilibili'
  },
  {
    entry: resolve(__dirname, 'src/inject/index.ts'),
    name: 'index',
    fileName: (_format, entryName) => `inject/${entryName}.js`,
    formats: ['iife'],
  },
];
// build
libraries.forEach(async (libItem) => {
  await build({
    configFile: false,
    build: {
      lib: libItem,
      emptyOutDir: false,
      rollupOptions: {
        // other options
      },
      watch,
    },
    define: {
      'process.env.NODE_ENV': '"production"'
    },
    plugins: [react()],
  });
});