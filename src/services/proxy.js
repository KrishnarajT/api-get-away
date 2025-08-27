import { createProxyMiddleware } from "http-proxy-middleware";
import config from "../config/index.js";
import { getSession } from "./sessionStore.js";

export function createApiProxy() {
	return createProxyMiddleware({
		target: config.upstreamApiBaseUrl,
		changeOrigin: true,
		xfwd: true,
		selfHandleResponse: false,
		onProxyReq: async (proxyReq, req, _res) => {
			// Inject access token
			const sid = req.cookies?.[config.cookie.name];
			const sess = await getSession(sid);
			if (sess?.access_token) {
				proxyReq.setHeader("authorization", `Bearer ${sess.access_token}`);
			}
			// Drop any browser-provided Authorization
			if (proxyReq.getHeader("authorization") == null) {
				// no-op
			}
		},
		pathRewrite: (path, _req) => path.replace(/^\/api/, ""),
	});
}
