import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      input: {
        cockpit: fileURLToPath(new URL("./index.html", import.meta.url)),
        rotas: fileURLToPath(new URL("./rotas.html", import.meta.url)),
      },
    },
  },
});
