import { build, defineConfig, type LibraryOptions } from 'vite'
import { dirname, resolve } from 'node:path'
import react from '@vitejs/plugin-react-swc'
import { fileURLToPath } from 'node:url'
const __dirname = dirname(fileURLToPath(import.meta.url))
const watch = process.argv.includes('--watch') ? {} : false

// https://vite.dev/config/
export default defineConfig({
  build: {
    sourcemap: 'inline',
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
{
  const libraries: LibraryOptions[] = [
  {
    entry: resolve(__dirname, 'src/extension/page.ts'),
    name: 'page',
    fileName: (_format, entryName) => `extension/${entryName}.js`,
    formats: ['iife'],
    cssFileName: 'extension/bilibili'
  },
];
// build
libraries.forEach(async (libItem) => {
  await build({
    configFile: false,
    build: {
      sourcemap: 'inline',
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
    plugins: [
      react(),
    ],
  });
});
}
{
  const libraries: LibraryOptions[] = [
  {
    entry: resolve(__dirname, 'src/inject/index.ts'),
    name: 'index',
    fileName: (_format, entryName) => `inject/${entryName}.js`,
    formats: ['cjs'], // 改为CommonJS格式
  },
];
// build
libraries.forEach(async (libItem) => {
  await build({
    configFile: false,
    build: {
      sourcemap: 'inline',
      lib: libItem,
      emptyOutDir: false,
      rollupOptions: {
        // 使用函数动态判断哪些模块应该被视为外部依赖
        external: (id) => {
          // 处理所有Node.js内置模块
          const builtinModules = [
            'electron', 'fs', 'path', 'os', 'http', 'https', 'net', 'events', 
            'stream', 'util', 'crypto', 'buffer', 'querystring', 'url', 'zlib',
            'child_process', 'cluster', 'dgram', 'dns', 'domain', 'http2', 
            'https', 'module', 'net', 'os', 'path', 'perf_hooks', 'punycode', 
            'querystring', 'readline', 'repl', 'stream', 'string_decoder', 
            'timers', 'tls', 'tty', 'url', 'util', 'v8', 'vm', 'zlib'
          ];
          
          // 检查是否为Node.js内置模块或以node:前缀开头的模块
          return builtinModules.includes(id) || 
                 id.startsWith('node:') || 
                 /^[a-z][a-z0-9-_]*$/.test(id); // 简单的npm包名匹配
        },
        output: {
          // 使用IIFE格式但保持外部依赖通过require引入
          format: 'commonjs',
          inlineDynamicImports: false,
          globals: {}
        },
      },
      watch,
    },
    define: {
      // 'process.env.NODE_ENV': '"production"'
    },
    plugins: [
      {
        name: 'replace',
        async closeBundle() {
          try {
            // eslint-disable-next-line no-console
            console.info('copy index.js')
            const targetPath = resolve(__dirname, 'app/app/index.js')
            await this.fs.copyFile(resolve(__dirname, 'dist/inject/index.js'), targetPath);
          }
          catch(_e){ /* empty */ }
        }
      }
    ],
  });
});
}