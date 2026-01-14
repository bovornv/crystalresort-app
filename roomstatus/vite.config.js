import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import fs from 'fs'

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const isDev = command === 'serve'
  
  // Plugin to use index.dev.html for development
  const devHtmlPlugin = {
    name: 'dev-html-entry',
    configureServer(server) {
      return () => {
        server.middlewares.use((req, res, next) => {
          // Intercept requests for index.html in dev mode
          if (isDev && (req.url === '/index.html' || req.url === '/roomstatus/index.html')) {
            const devHtmlPath = resolve(process.cwd(), 'index.dev.html')
            if (fs.existsSync(devHtmlPath)) {
              const html = fs.readFileSync(devHtmlPath, 'utf-8')
              res.setHeader('Content-Type', 'text/html')
              res.end(html)
              return
            }
          }
          next()
        })
      }
    },
    transformIndexHtml(html) {
      if (isDev) {
        const devHtmlPath = resolve(process.cwd(), 'index.dev.html')
        if (fs.existsSync(devHtmlPath)) {
          return fs.readFileSync(devHtmlPath, 'utf-8')
        }
      }
      return html
    },
  }
  
  return {
    base: '/roomstatus/',
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
      rollupOptions: {
        input: resolve(__dirname, 'index.html'),
      },
    },
    plugins: [
      react(),
      ...(isDev ? [devHtmlPlugin] : []),
    ],
    optimizeDeps: {
      exclude: ['pdfjs-dist'],
    },
  }
})

