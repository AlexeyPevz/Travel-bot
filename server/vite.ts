import { Express } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Server } from "http";
import express from "express";

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
  const distPath = path.resolve(process.cwd(), "dist/public");
  const staticPath = path.resolve(process.cwd(), "public");

  // Middleware to set cache headers
  const setCacheHeaders = (res: any, filePath: string) => {
    const ext = path.extname(filePath);
    
    // Long cache for immutable assets
    if (filePath.includes('[hash]') || filePath.includes('-')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    // Short cache for HTML
    else if (ext === '.html') {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
    // Medium cache for other static assets
    else if (['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2'].includes(ext)) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
    }
    
    // Enable compression headers
    if (['.js', '.css', '.html', '.json', '.xml', '.svg'].includes(ext)) {
      res.setHeader('Vary', 'Accept-Encoding');
    }
  };

  // Serve pre-compressed files if available
  app.use(
    express.static(distPath, {
      setHeaders: setCacheHeaders,
      // Try serving .br and .gz versions first
      extensions: ['br', 'gz'],
    })
  );

  app.use(
    express.static(staticPath, {
      setHeaders: setCacheHeaders,
    })
  );

  // HTML5 History API fallback
  app.get("/*", (_req, res, next) => {
    if (_req.accepts("html")) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      res.sendFile(path.join(distPath, "index.html"), (err) => {
        if (err) {
          next();
        }
      });
    } else {
      next();
    }
  });
}