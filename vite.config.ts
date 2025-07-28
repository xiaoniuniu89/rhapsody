import { defineConfig } from 'vite';

export default defineConfig({
  base: "/modules/rhapsody/",
  server: {
    port: 3001,
    proxy: {
      "^(?!/modules/rhapsody)": "http://localhost:8080/",
      "/socket.io": {
        target: "ws://localhost:8080",
        ws: true,
      },
    }
  },
  build: {
    outDir: "dist",
    lib: {
      entry: "src/main.ts",
      formats: ["es"],
      fileName: "main"
    },
    rollupOptions: {
    output: {
      assetFileNames: "[name][extname]"
    }
  }
  }
});