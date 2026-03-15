import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-markdown') || id.includes('react-syntax-highlighter')) {
            return 'markdown';
          }
          if (id.includes('framer-motion')) {
            return 'motion';
          }
          if (id.includes('lucide-react')) {
            return 'icons';
          }
          if (id.includes('react-easy-crop')) {
            return 'cropper';
          }
        },
      },
    },
  },
  server: {
    port: 3001,
    host: '0.0.0.0',
  },
})
