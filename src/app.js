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
import proxy_routes from "./routes/proxy_routes.js";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import { createApiProxy } from "./services/proxy.js";  // ✅ import proxy directly
import requireAuth from "./middleware/requireAuth.js";
const app = express();
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

// CORS
app.use(cors({
	origin: "https://authentic-tracker.krishnarajthadesar.in",
	credentials: true,
	methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));

app.options(/.*/, (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "https://authentic-tracker.krishnarajthadesar.in");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.sendStatus(204);
});

// ✅ Mount proxy BEFORE parsers so POST bodies are untouched
app.use(cookieParser());
app.use("/api", proxy_routes);

// parsers — everything after proxy
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true }));

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

// routes
app.use("/auth", authRoutes);
app.use("/whoami", apiRoutes);
app.use("/healthz", healthRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: "Not Found" }));

// error handler
app.use((err, req, res, _next) => {
	req.log?.error({ err }, "Unhandled error");
	res.status(err.status || 500).json({ error: "Internal Server Error" });
});

export default app;
