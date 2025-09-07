import { createProxyMiddleware } from "http-proxy-middleware";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";

const cfgPath = path.resolve(process.cwd(), "config.yml");

let cfg = { defaultBackend: undefined, mappings: [] };
try {
  const raw = fs.readFileSync(cfgPath, "utf8");
  cfg = { ...cfg, ...yaml.load(raw) };
  console.log("Loaded proxy config:", cfg);
} catch (err) {
  console.error("Failed to load config.yml:", err);
}

// Normalize mapping entries for fast lookup
// keep as array because we support pathPrefix and port matching
const mappings = (cfg.mappings || []).map(m => ({
  frontendHost: (m.frontendHost || "").toLowerCase(),
  frontendPort: m.frontendPort || null,
  pathPrefix: m.pathPrefix || null,    // optional: "/foo"
  backend: m.backend,
}));

function normalizeHost(hostHeader) {
  if (!hostHeader) return "";
  // hostHeader may include port, e.g. "localhost:8080"
  return hostHeader.split(":")[0].toLowerCase();
}
function parsePort(hostHeader) {
  if (!hostHeader) return null;
  const parts = hostHeader.split(":");
  return parts.length > 1 ? Number(parts[1]) : null;
}

export function createApiProxy() {
  console.log("createApiProxy() initialized; defaultBackend:", cfg.defaultBackend);

  return createProxyMiddleware({
    changeOrigin: true,
    xfwd: true,
    selfHandleResponse: false,
    pathRewrite: (path, _req) => path.replace(/^\/api/, ""),

    timeout: 30_000,
    proxyTimeout: 30_000,

    router: (req) => {
      const hostHeader = req.headers?.host || "";
      const host = normalizeHost(hostHeader);
      const port = parsePort(hostHeader);
      const reqPath = req.originalUrl || req.url || "/";

      // First: try exact host+port mappings (if user configured frontendPort)
      for (const m of mappings) {
        if (!m.frontendHost) continue;
        if (m.frontendHost !== host) continue;
        if (m.frontendPort && m.frontendPort !== port) continue;
        if (m.pathPrefix) {
          if (reqPath.startsWith(m.pathPrefix)) return m.backend;
          continue; // pathPrefix didn't match — continue searching
        }
        // host matches, no pathPrefix required
        return m.backend;
      }

      // Second: try host-only mappings but prefer those with matching pathPrefix
      // (This allows multiple mappings for the same host distinguished by pathPrefix)
      // Collect candidates for this host
      const candidates = mappings.filter(m => m.frontendHost === host);
      if (candidates.length > 0) {
        // prefer the one where pathPrefix matches the request path
        const withPrefix = candidates.find(m => m.pathPrefix && reqPath.startsWith(m.pathPrefix));
        if (withPrefix) return withPrefix.backend;
        // else first candidate without prefix
        const noPrefix = candidates.find(m => !m.pathPrefix);
        if (noPrefix) return noPrefix.backend;
      }

      // Nothing matched
      console.warn(`Proxy router: no mapping found for host="${hostHeader}" normalized="${host}" path="${reqPath}". Using defaultBackend.`);
      return cfg.defaultBackend;
    },

    onProxyReq: (proxyReq, req, res) => {
      try {
        console.log("onProxyReq: host:", req.headers.host, "-> forwarding to backend. x-user-email:", req.headers["x-user-email"] || null);
      } catch (err) {
        console.error("onProxyReq error:", err);
      }
    },

    onProxyRes: (proxyRes, req, res) => {
      console.log(`onProxyRes: upstream ${proxyRes.statusCode} for ${req.originalUrl}`);
    },

    onError: (err, req, res) => {
      console.error("Proxy error:", err && (err.stack || err.message || err));
      if (!res.headersSent) {
        res.writeHead(502, { "Content-Type": "application/json" });
      }
      res.end(JSON.stringify({ error: "bad_gateway", message: err?.message || "proxy error" }));
    },
  });
}
