import { createProxyMiddleware } from "http-proxy-middleware";
import config from "../config/index.js";

export function createApiProxy() {
    return createProxyMiddleware({
        target: config.upstreamApiBaseUrl,
        changeOrigin: true,
        xfwd: true,
        selfHandleResponse: false,
        pathRewrite: (path, _req) => path.replace(/^\/api/, ""),
    });
}