import { Router } from "express";
import csrfCheck from "../middleware/csrfCheck.js";
import requireAuth from "../middleware/requireAuth.js";
import { fetchUserinfo } from "../services/oidc.js";
import { createApiProxy } from "../services/proxy.js";

const r = Router();

// Public-ish (but will require a session to return data)
r.get("/me", requireAuth, async (req, res) => {
	const { tokenSet } = req.auth;
	const userinfo = await fetchUserinfo(tokenSet.access_token);
	if (!userinfo) return res.status(502).json({ error: "Failed to fetch userinfo" });

	// Return a minimal, stable shape
	res.json({
		sub: userinfo.sub,
		name: userinfo.name || userinfo.preferred_username || null,
		email: userinfo.email || null,
		picture: userinfo.picture || null,
	});
});

// Proxy everything else to your resource server
r.use("/", requireAuth, csrfCheck, createApiProxy());

export default r;
