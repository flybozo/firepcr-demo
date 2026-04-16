import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Fix: trim-canvas CJS→ESM interop broken in rolldown (Vite 8)
      // react-signature-canvas imports trim-canvas which is UMD with __esModule + .default
      // rolldown wraps it so .default is an object, not the trim function
      'trim-canvas': path.resolve(__dirname, './src/lib/shims/trim-canvas.ts'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'vendor-react'
          }
          if (id.includes('node_modules/@supabase')) {
            return 'vendor-supabase'
          }
        },
      },
    },
  },
})
// Vite migration complete - Sat Apr 11 10:17:29 PDT 2026
