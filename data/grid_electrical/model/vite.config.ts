import { defineConfig, type Plugin } from "vite"
import { fileURLToPath } from "node:url"

const demo_html = fileURLToPath(new URL("./demo/grid_power_flow.html", import.meta.url))

// By default, the dev server serves the ./demo/grid_power_flow.html page
const serve_demo_at_root: Plugin = {
    name: "serve-demo-at-root",
    configureServer(server) {
        server.middlewares.use((req, _res, next) => {
            if (req.url === "/") req.url = "/grid_power_flow.html"
            next()
        })
    },
}

export default defineConfig({
    root: "demo",
    plugins: [serve_demo_at_root],
    // Relative asset paths let the built demo be served from any folder
    base: "./",
    server: {
        // Allow serving the solver WASM and src/ modules that live outside demo/
        fs: { allow: [fileURLToPath(new URL(".", import.meta.url))] },
    },
    build: {
        outDir: "../dist",
        emptyOutDir: true,
        sourcemap: true, // Add sourcemap
        target: "es2022",
        rollupOptions: {
            input: demo_html,
            output:
            {
                entryFileNames: "[name].js",
                assetFileNames: "[name][extname]",
                manualChunks(id) {
                    if (id.includes("node_modules")) return "vendor"
                },
            },
        },
    },
})
