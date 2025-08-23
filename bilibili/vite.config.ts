import { defineConfig } from 'vite'
import { dirname, resolve } from 'node:path'
import react from '@vitejs/plugin-react-swc'
import { fileURLToPath } from 'node:url'
const __dirname = dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  build: {
    lib: {
      entry: {
        content: resolve(__dirname, 'src/content.ts')
      },
      formats: ['es'],
    },
    rollupOptions: {
    },
    watch: {}
  },
  plugins: [react()],
})
