import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

// After build, reads dist/.vite/manifest.json and writes dist/asset-manifest.json
// so the SW can pre-cache all hashed JS/CSS chunks on install.
function generateAssetManifest(): Plugin {
  return {
    name: 'generate-asset-manifest',
    apply: 'build',
    closeBundle() {
      const viteManifestPath = path.resolve(__dirname, 'dist/.vite/manifest.json')
      if (!fs.existsSync(viteManifestPath)) return
      const viteManifest = JSON.parse(fs.readFileSync(viteManifestPath, 'utf-8')) as Record<
        string,
        { file?: string; css?: string[] }
      >
      const seen = new Set<string>()
      const assets: string[] = []
      for (const entry of Object.values(viteManifest)) {
        if (entry.file) {
          const url = '/' + entry.file
          if (!seen.has(url)) { seen.add(url); assets.push(url) }
        }
        for (const css of (entry.css ?? [])) {
          const url = '/' + css
          if (!seen.has(url)) { seen.add(url); assets.push(url) }
        }
      }
      fs.writeFileSync(
        path.resolve(__dirname, 'dist/asset-manifest.json'),
        JSON.stringify({ assets })
      )
      console.log(`[asset-manifest] wrote ${assets.length} entries → dist/asset-manifest.json`)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), generateAssetManifest()],
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
    manifest: true,
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
