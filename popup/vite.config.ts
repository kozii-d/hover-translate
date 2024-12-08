import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, "../.env") });

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __API_URL__: JSON.stringify(process.env.API_URL),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
