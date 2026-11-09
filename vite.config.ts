import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'MENA — Água Potável ao Alcance de Todos',
        short_name: 'MENA',
        description: 'Peça água potável por cisterna, perto de si.',
        lang: 'pt',
        start_url: '/app',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#050B18',
        theme_color: '#050B18',
        icons: [
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Só o "shell" da app é guardado em cache. Dados (Supabase) nunca são servidos de cache.
        navigateFallback: '/index.html',
        runtimeCaching: []
      }
    })
  ]
})
