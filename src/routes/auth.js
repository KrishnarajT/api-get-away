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

function setSessionCookie(res, sid) {
	const opts = {
		httpOnly: true,
		secure: config.cookie.secure,
		sameSite: config.cookie.sameSite,
		path: "/",
	};
	if (config.cookie.domain) opts.domain = config.cookie.domain;
	res.cookie(config.cookie.name, sid, opts);
}

r.get("/login", async (_req, res, next) => {
	try {
		const { codeVerifier, codeChallenge, nonce } = startAuthFlow();
		const state = await createStateRecord({ codeVerifier, nonce, createdAt: Date.now() });
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

		// Verify ID token & nonce when available
		if (tokenSet.id_token) {
			await verifyIdToken(tokenSet.id_token, { expectedNonce: record.nonce });
		}

		const sid = await createSession({
			...tokenSet,
			created_at: Date.now(),
		});
		setSessionCookie(res, sid);
		res.redirect("/");
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
		domain: config.cookie.domain || undefined,
	});

	res.status(204).end();
});

export default r;
