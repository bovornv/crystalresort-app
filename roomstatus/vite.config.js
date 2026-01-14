import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import fs from 'fs'

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const isDev = command === 'serve'
  
  // Plugin to use index.dev.html for development only
  const devHtmlPlugin = isDev ? {
    name: 'dev-html-entry',
    transformIndexHtml(html) {
      const devHtmlPath = resolve(process.cwd(), 'index.dev.html')
      if (fs.existsSync(devHtmlPath)) {
        return fs.readFileSync(devHtmlPath, 'utf-8')
      }
      return html
    },
  } : null
  
  return {
    base: '/roomstatus/',
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
    },
    plugins: [
      react(),
      ...(devHtmlPlugin ? [devHtmlPlugin] : []),
    ],
    optimizeDeps: {
      exclude: ['pdfjs-dist'],
    },
  }
})

