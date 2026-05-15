import { defineConfig } from "vite";
  import react from "@vitejs/plugin-react";
  import tailwindcss from "@tailwindcss/vite";
  import path from "path";

  const isBuild = process.env.NODE_ENV === "production" || process.argv.includes("build");
  const rawPort = process.env.PORT;
  const port = rawPort ? Number(rawPort) : 3000;
  const basePath = process.env.BASE_PATH ?? "/";

  export default defineConfig(async () => {
    const devPlugins =
      !isBuild && process.env.REPL_ID
        ? await Promise.all([
            import("@replit/vite-plugin-runtime-error-modal").then((m) => m.default()),
            import("@replit/vite-plugin-cartographer").then((m) =>
              m.cartographer({ root: path.resolve(import.meta.dirname, "..") })
            ),
            import("@replit/vite-plugin-dev-banner").then((m) => m.devBanner()),
          ])
        : [];
    return {
      base: basePath,
      plugins: [react(), tailwindcss(), ...devPlugins],
      resolve: {
        alias: { "@": path.resolve(import.meta.dirname, "src") },
        dedupe: ["react", "react-dom"],
      },
      root: path.resolve(import.meta.dirname),
      build: {
        outDir: path.resolve(import.meta.dirname, "dist/public"),
        emptyOutDir: true,
      },
      server: {
        port: isBuild ? 3000 : port,
        strictPort: !isBuild,
        host: "0.0.0.0",
        allowedHosts: true,
        fs: { strict: false },
      },
      preview: {
        port: isBuild ? 3000 : port,
        host: "0.0.0.0",
        allowedHosts: true,
      },
    };
  });
  