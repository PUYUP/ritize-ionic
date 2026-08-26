/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import swc from 'unplugin-swc';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy(),
    tailwindcss(),
    swc.vite({
      exclude: [], //Default would exclude all file from ``node_modules``
      jsc: {
        minify: {
          compress: true,
          mangle: true,
          //Suggested by ``capacitor-sqlite``
          keep_classnames: true,
          keep_fnames: true,
        },
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  }
})
