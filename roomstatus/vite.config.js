import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import fs from 'fs'

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const isDev = command === 'serve'
  
  // Plugin to use index.dev.html for development only
  // Run BEFORE react() plugin so React plugin can inject preamble into our custom HTML
  const devHtmlPlugin = isDev ? {
    name: 'dev-html-entry',
    enforce: 'pre', // Run before react plugin
    transformIndexHtml(html) {
      const devHtmlPath = resolve(process.cwd(), 'index.dev.html')
      if (fs.existsSync(devHtmlPath)) {
        const devHtml = fs.readFileSync(devHtmlPath, 'utf-8')
        // Return the HTML string - React plugin will inject preamble after this
        return devHtml
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
      react(), // React plugin must run first to inject preamble
      ...(devHtmlPlugin ? [devHtmlPlugin] : []),
    ],
    optimizeDeps: {
      exclude: ['pdfjs-dist'],
    },
  }
})

