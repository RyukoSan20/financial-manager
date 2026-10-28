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
          // 127.0.0.1, not localhost. "localhost" resolves to an
          // IPv6 address on some machines, and the backend only
          // listens on IPv4, so the proxy answered 404 for every
          // request and the browser reported "Failed to fetch".
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
    },
  }
})
