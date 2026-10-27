import { defineConfig } from "vite";

export default defineConfig({
  plugins: [{
    name: "landing-background-dev-entry",
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        if (request.url?.split("?", 1)[0] === "/assets/portal/landing-background.js") {
          request.url = "/src/features/portal/landing-background.js";
        }
        next();
      });
    },
  }],
  server: {
    host: "0.0.0.0",
    allowedHosts: ["fichasrpg.localnetwork"],
    proxy: {
      "/api": "http://fichasrpg_dev_api:3000",
    },
  },
  build: {
    rollupOptions: {
      input: {
        app: "index.html",
        landingBackground: "src/features/portal/landing-background.js",
      },
      output: {
        entryFileNames: chunk => chunk.name === "landingBackground"
          ? "assets/portal/landing-background.js"
          : "assets/[name]-[hash].js",
      },
    },
  },
});
