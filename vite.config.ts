import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  define: {
    // Vercel injects env vars at build time. 
    // We map process.env.API_KEY to the client bundle so the SDK works.
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
    // Polyfill process.env to avoid crashes if other libs access it
    'process.env': {
       API_KEY: process.env.API_KEY
    }
  }
});