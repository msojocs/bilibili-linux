import { build, defineConfig, type LibraryOptions } from 'vite'
import { dirname, resolve } from 'node:path'
import react from '@vitejs/plugin-react-swc'
import { fileURLToPath } from 'node:url'
const __dirname = dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  build: {
    lib: {
      entry: {
        content: resolve(__dirname, 'src/content.ts'),
      },
      formats: ['es'],
    },
    emptyOutDir: false,
    watch: {}
  },
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  plugins: [react()],
})

// page libraries
const libraries: LibraryOptions[] = [
  {
    entry: resolve(__dirname, 'src/page/login.ts'),
    name: 'login',
    fileName: 'page/login',
    formats: ['es'],
  },
  {
    entry: resolve(__dirname, 'src/page/home.ts'),
    name: 'home',
    fileName: 'page/home',
    formats: ['es'],
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
      watch: {}
    },
    define: {
      'process.env.NODE_ENV': '"production"'
    },
    plugins: [react()],
  });
});