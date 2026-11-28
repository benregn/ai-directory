import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // GitHub Pages serves this repository under /ai-directory/; production
  // preview uses the same mode, so the deployed path shape is testable locally.
  base: mode === 'production' ? '/ai-directory/' : '/',
  devtools: {
    // Remove this `apply` property to enable devtools for build as well
    apply: 'serve',
  },
  plugins: [react()],
}))
