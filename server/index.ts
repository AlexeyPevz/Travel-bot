import dotenv from 'dotenv';
dotenv.config();
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupSecurity, sanitizeBody } from "./middleware/security";
import { correlationIdMiddleware } from "./middleware/tracing";
import { dynamicRateLimiter } from "./middleware/rateLimiter";
import { setupMetrics } from "./monitoring/metrics";
import logger, { stream } from "./utils/logger";
import morgan from "morgan";

const app = express();
export { app };

// Security middleware
setupSecurity(app);

// Correlation ID middleware (before logging)
app.use(correlationIdMiddleware);

// HTTP request logging with correlation ID
app.use(morgan('combined', { stream }));

// Setup metrics
setupMetrics(app);

// Body parsers with sane limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(sanitizeBody);

// Apply rate limiting to all API routes
app.use('/api', dynamicRateLimiter);

app.use((req, res, next) => {
	const start = Date.now();
	const path = req.path;
	let capturedJsonResponse: Record<string, any> | undefined = undefined;

	const originalResJson = res.json;
	res.json = function (bodyJson, ...args) {
		capturedJsonResponse = bodyJson;
		return originalResJson.apply(res, [bodyJson, ...args]);
	};

	res.on("finish", () => {
		const duration = Date.now() - start;
		if (path.startsWith("/api")) {
			let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
			// Avoid serializing full JSON bodies in production
			if (process.env.NODE_ENV !== 'production' && capturedJsonResponse) {
				logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
			}

			if (logLine.length > 80) {
				logLine = logLine.slice(0, 79) + "…";
			}

			log(logLine);
		}
	});

	next();
});

let server: import('http').Server | null = null;
export { server };

(async () => {
	// Create a basic server and start listening early
	const http = await import('http');
	server = http.createServer(app);

	const port = Number(process.env.PORT ?? 5000);
	server.listen({
		port,
		host: "0.0.0.0",
		reusePort: true,
	}, () => {
		log(`serving on port ${port}`);
		logger.info(`Process ID: ${process.pid}`);
	});

	// Register routes (non-blocking bot/monitoring inside)
	await registerRoutes(app, server);

	// Conditionally start background search cron job
	if (process.env.ENABLE_BACKGROUND_SEARCH === 'true') {
		try {
			const { startBackgroundSearchJob } = await import('./jobs/background-search-job');
			startBackgroundSearchJob();
			logger.info('Background search cron job started');
		} catch (err) {
			logger.error('Failed to start background search cron job', err as any);
		}
	}

	// Error handler should be last
	const { errorHandler } = await import("./middleware/errorHandler");
	app.use(errorHandler);

	if (app.get("env") === "development") {
		await setupVite(app, server);
	} else {
		serveStatic(app);
	}

	const { gracefulShutdown } = await import("./utils/shutdown");
	gracefulShutdown.setServer(server);
})();
