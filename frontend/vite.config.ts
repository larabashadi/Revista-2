import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        timeout: 120000,
        proxyTimeout: 120000,
      },
    }}
})
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // carga .env*, pero además permite usar process.env si Render lo pasa
  const env = loadEnv(mode, process.cwd(), "");

  const apiBaseRaw =
    process.env.VITE_API_BASE ||
    env.VITE_API_BASE ||
    "https://revista-2-1.onrender.com";

  const apiBase = String(apiBaseRaw).replace(/\/+$/, "");

  return {
    plugins: [react()],
    // 👇 fuerza el valor en el bundle (aunque Render no lo inyecte)
    define: {
      "import.meta.env.VITE_API_BASE": JSON.stringify(apiBase),
    },
    server: {
      proxy: {
        "/api": {
          target: "http://127.0.0.1:8000",
          changeOrigin: true,
          timeout: 120000,
          proxyTimeout: 120000,
        },
      },
    },
  };
});
