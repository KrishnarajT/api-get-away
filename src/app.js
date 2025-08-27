import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import config from "./config/index.js";
import logger from "./utils/logger.js";
import authRoutes from "./routes/auth.js";
import apiRoutes from "./routes/api.js";
import healthRoutes from "./routes/health.js";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

// trust proxy for secure cookies behind reverse proxies
app.set("trust proxy", 1);

// security headers
app.use(
	helmet({
		crossOriginOpenerPolicy: { policy: "same-origin" },
		crossOriginResourcePolicy: { policy: "same-site" },
	})
);

// logging
app.use(pinoHttp({ logger }));
if (process.env.NODE_ENV === "development") app.use(morgan("dev"));

// parsers
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// coarse rate limit on auth endpoints
const authLimiter = rateLimit({
	windowMs: 60_000,
	max: 60,
	standardHeaders: true,
	legacyHeaders: false,
});

app.use("/auth/", authLimiter);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(
	express.static(path.join(__dirname, "..", "public"), {
		index: "index.html",
		extensions: ["html"],
	})
);
// basic CORS only if you truly need cross-origin frontend during dev
// In prod, keep same-origin and skip this.
// Example shown but disabled by default.
// import cors from 'cors';
// app.use(cors({ origin: config.allowedOrigins, credentials: true }));

// routes
app.use("/auth", authRoutes);
app.use("/api", apiRoutes);
app.use("/healthz", healthRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: "Not Found" }));

// error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
	req.log?.error({ err }, "Unhandled error");
	res.status(err.status || 500).json({ error: "Internal Server Error" });
});

export default app;
