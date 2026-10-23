import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Vite loads .env.local for EVERY mode, so the local Supabase placeholder
  // keys ended up in the production bundle. The app then believed Supabase
  // was configured and every login failed with "Invalid API key".
  //
  // The production build therefore reads its variables from a directory
  // that holds nothing but the production values, and the dev build keeps
  // reading the project root.
  const envDir = mode === 'production' ? 'env-production' : '.'

  return {
    plugins: [react()],
    envDir,
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
  }
})
