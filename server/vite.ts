import { Express } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Server } from "http";

export function log(...args: any[]) {
  console.log(...args);
}

export async function setupVite(app: Express, server: Server) {
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: { server }
    },
    appType: "spa",
    root: path.resolve(process.cwd(), "client")
  });

  app.use(vite.middlewares);
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "client/dist");
  const publicPath = path.resolve(process.cwd(), "public");

  app.use(express.static(distPath));
  app.use(express.static(publicPath));
}