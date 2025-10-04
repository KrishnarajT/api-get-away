import { Router } from "express";
import config from "../config/index.js";
import {
	buildAuthorizeUrl,
	startAuthFlow,
	exchangeCodeForTokens,
	verifyIdToken,
	revokeToken,
} from "../services/oidc.js";
import {
	createSession,
	createStateRecord,
	deleteSession,
	getAndDeleteState,
} from "../services/sessionStore.js";

const r = Router();

function normalizeCookieDomain(value) {
	if (!value) return undefined;
	// If someone accidentally set an object, bail out
	if (typeof value !== "string") return undefined;
	let v = value.trim();
	if (!v) return undefined;

	// Remove scheme if present: https://example.com -> example.com
	v = v.replace(/^https?:\/\//i, "");

	// Remove path if present: example.com/foo -> example.com
	v = v.split("/")[0];

	// Remove port if present: example.com:3000 -> example.com
	v = v.split(":")[0];

	// final sanity: only allow characters expected in hostnames (letters, digits, ., -)
	if (!/^[A-Za-z0-9.-]+$/.test(v)) return undefined;

	// Optionally make cookie available to subdomains:
	// return v.startsWith('.') ? v : `.${v}`;
	return v;
}

// Replace your function with this
function setSessionCookie(res, sid, req) {
	const cookieDomain = normalizeCookieDomain(config.cookie.domain || req?.headers?.host);
	// debug log — remove in production
	console.log("setSessionCookie -> cookieDomain:", cookieDomain);

	const opts = {
		httpOnly: true,
		secure: Boolean(config.cookie.secure),
		sameSite: config.cookie.sameSite,
		path: "/",
	};

	if (cookieDomain) opts.domain = cookieDomain;

	res.cookie(config.cookie.name, sid, opts);
}

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
const mappings = (cfg.mappings || []).map(m => {
  const frontendHost = (m.frontendHost || "").toLowerCase();
  const frontendPort = m.frontendPort || null;
  const pathPrefix = m.pathPrefix || null;    // optional: "/foo"

  // ensure backend has scheme; assume http for localhost entries, https otherwise
  let backend = m.backend || null;
  if (backend && !/^https?:\/\//i.test(backend)) {
    if (frontendHost === "localhost" || frontendHost.startsWith("127.")) {
      backend = `http://${backend.replace(/^\/+/, "")}`;
    } else {
      backend = `https://${backend.replace(/^\/+/, "")}`;
    }
  }

  return { frontendHost, frontendPort, pathPrefix, backend };
});

// Build allowed frontend origins from mappings (scheme + // + hostname)
function buildAllowedFrontendHostsFromMappings() {
  const hosts = new Set();
  for (const m of mappings) {
    if (!m.frontendHost) continue;
    // assume https for non-localhost hosts; allow http for localhost
    const scheme = (m.frontendHost === "localhost" || m.frontendHost.startsWith("127.")) ? "http" : "https";
    // canonical origin w/o trailing slash
    hosts.add(`${scheme}://${m.frontendHost}`);
  }
  // also include any explicit config.frontend.allowedHosts entries if present
  if (Array.isArray(cfg.frontend?.allowedHosts)) {
    for (const h of cfg.frontend.allowedHosts) {
      try {
        const u = new URL(h.includes("://") ? h : `https://${h}`);
        hosts.add(`${u.protocol}//${u.hostname}`);
      } catch {
        // ignore bad entries
      }
    }
  }
  return Array.from(hosts);
}

const ALLOWED_FRONTEND_HOSTS = buildAllowedFrontendHostsFromMappings();
console.log("Derived ALLOWED_FRONTEND_HOSTS:", ALLOWED_FRONTEND_HOSTS);

// Normalizer: accept either full URL or host-only; allow http for localhost
function normalizeFrontendHost(val) {
  if (!val || typeof val !== "string") return null;
  let v = val.trim();
  // If value looks like host-only (no scheme), assume https except localhost
  if (!/^https?:\/\//i.test(v)) {
    if (/^localhost(:\d+)?$/.test(v) || /^127\.\d+\.\d+\.\d+/.test(v)) {
      v = `http://${v}`;
    } else {
      v = `https://${v}`;
    }
  }
  // Remove any trailing slash
  v = v.replace(/\/$/, "");
  // Basic sanity check: scheme + hostname required
  try {
    const u = new URL(v);
    // Only allow http or https
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    // Lowercase origin
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return null;
  }
}

function isAllowedFrontendHost(host) {
  const normalized = normalizeFrontendHost(host);
  if (!normalized) return false;
  // Compare against allowlist origins (scheme + // + hostname)
  return ALLOWED_FRONTEND_HOSTS.includes(normalized);
}



r.get("/login", async (req, res, next) => {
	try {
		// Accept frontend info from:
		// 1) req.query.next (path only) and
		// 2) req.get('origin') or req.get('referer') or req.query.frontend_host
		const requestedNext = typeof req.query.next === 'string' && req.query.next.startsWith('/') ? req.query.next : '/';
		// Prefer explicit param if frontend provided it
		const rawFrontendHost = req.query.frontend_host || req.get('origin') || req.get('referer') || null;
		const normalizedHost = normalizeFrontendHost(rawFrontendHost);
		console.log("Login requestedNext:", requestedNext, "rawFrontendHost:", rawFrontendHost, "normalizedHost:", normalizedHost);
		console.log("res", req.headers);
		// if (!isAllowedFrontendHost(normalizedHost)) {
		// 	// Fallback: if not allowed, either deny or use default frontend base from config
		// 	console.warn("Blocked login request from unallowed frontend host:", rawFrontendHost);
		// 	return res.status(400).send("Disallowed frontend host");
		// }

		const { codeVerifier, codeChallenge, nonce } = startAuthFlow();
		// Save nextPath AND returnToHost in state record (server side)
		const state = await createStateRecord({
			codeVerifier,
			nonce,
			next: requestedNext,
			returnToHost: normalizedHost,
			createdAt: Date.now(),
		});

		const url = buildAuthorizeUrl({ state, nonce, codeChallenge });
		res.redirect(url);
	} catch (err) {
		next(err);
	}
});

// NOTE: this route path must match the one configured in OIDC_REDIRECT_PATH, but mounted under /auth
r.get(config.oidc.redirectPath.replace(/^\/auth/, ""), async (req, res, next) => {
	try {
		const { state, code } = req.query;
		if (!state || !code) return res.status(400).send("Missing state/code");

		const record = await getAndDeleteState(state);
		if (!record) return res.status(400).send("Invalid state");

		const tokenSet = await exchangeCodeForTokens({ code, codeVerifier: record.codeVerifier });

		var idPayload = null;		// Verify ID token & nonce when available

		if (tokenSet.id_token) {
			idPayload = await verifyIdToken(tokenSet.id_token, { expectedNonce: record.nonce });
			// build a small user object
		}
		const userInfo = {
			email: idPayload.email || idPayload.preferred_username || null,
			sub: idPayload.sub,
			name: idPayload.name || null
		};
		const sid = await createSession({
			...tokenSet,
			created_at: Date.now(),
		}, userInfo);
		console.log("SESSION CREATED:", { sid, userSnapshot: { email: userInfo.email, sub: userInfo.sub, name: userInfo.name } });

		setSessionCookie(res, sid);
		const frontendBase = record?.returnToHost;
		if (!frontendBase) {
			console.error("No returnToHost in state record and no FRONTEND_URL configured. Falling back to / on BFF.");
			return res.redirect("/");
		}

		// Ensure next is a safe path
		const nextPath = (record?.next && typeof record.next === "string" && record.next.startsWith("/")) ? record.next : "/";

		// Final safe redirect
		const redirectTo = `${frontendBase}${nextPath}`;
		console.log("Redirecting to frontend:", redirectTo);
		res.redirect(redirectTo);
	} catch (err) {
		next(err);
	}
});

r.post("/logout", async (req, res) => {
	// best-effort revocation first, then kill session & cookie
	try {
		const sid = req.cookies?.[config.cookie.name];
		if (sid) {
			// we can’t read session contents here without store; but revocation is optional
			// If you want strong revocation, load the session and revoke both tokens:
			// (kept optional to avoid extra I/O; uncomment if you want)
			// const sess = await getSession(sid);
			// if (sess?.access_token) await revokeToken(sess.access_token, 'access_token');
			// if (sess?.refresh_token) await revokeToken(sess.refresh_token, 'refresh_token');
		}
	} catch {
		/* ignore */
	}

	// Clear cookie and delete session regardless
	const sid = req.cookies?.[config.cookie.name];
	if (sid) await deleteSession(sid);

	res.clearCookie(config.cookie.name, {
		httpOnly: true,
		secure: config.cookie.secure,
		sameSite: config.cookie.sameSite,
		path: "/",
		domain: normalizeCookieDomain(config.cookie.domain || req?.headers?.host),
	});

	res.status(204).end();
});

export default r;
