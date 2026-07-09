import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// custom domain mumbai-lakes.himanshupatil.dev serves at root
export default defineConfig({
  base: '/',
  plugins: [react()],
})
