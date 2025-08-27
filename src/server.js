import { createServer } from "http";
import app from "./app.js";
import config from "./config/index.js";
import logger from "./utils/logger.js";

const server = createServer(app);

server.listen(config.port, () => {
	logger.info({ port: config.port }, "BFF listening");
});

process.on("unhandledRejection", (err) => {
	logger.error({ err }, "unhandledRejection");
});
process.on("uncaughtException", (err) => {
	logger.error({ err }, "uncaughtException");
	process.exit(1);
});
