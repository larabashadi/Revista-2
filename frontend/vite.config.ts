import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const apiBaseRaw =
    process.env.VITE_API_BASE ||
    env.VITE_API_BASE ||
    "https://revista-2-1.onrender.com";

  const apiBase = String(apiBaseRaw).replace(/\/+$/, "");

  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_API_BASE": JSON.stringify(apiBase),
    },
  };
});
