import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteCompression from 'vite-plugin-compression'

export default defineConfig({
  plugins: [
    react(),
    // Comprimir archivos con gzip
    viteCompression({
      verbose: true,
      disable: false,
      threshold: 10240, // Comprimir archivos mayores a 10kb
      algorithm: 'gzip',
      ext: '.gz',
    })
  ],
server: {
  host: '0.0.0.0',
  port: 3001,
  strictPort: true,
  cors: true,
},
  build: {
    // Optimizaciones de build
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Eliminar console.log en producción
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Separar vendor chunks para mejor caching
          'react-vendor': ['react', 'react-dom'],
          'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
          'mui-vendor': ['@mui/material'],
          'gsap-vendor': ['gsap'],
          'lenis-vendor': ['@studio-freight/lenis'],
        },
      },
    },
    chunkSizeWarningLimit: 1000, // Aumentar límite de warning para chunks grandes
    cssCodeSplit: true, // Dividir CSS en chunks separados
    sourcemap: false, // Desactivar sourcemaps en producción para reducir tamaño
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      '@mui/material',
      'gsap',
    ],
  },
})
