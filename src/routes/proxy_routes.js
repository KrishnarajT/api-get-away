import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import { createApiProxy } from "../services/proxy.js";
import { getSession } from "../services/sessionStore.js"; // <-- add this import
import config from "../config/index.js"; // to read cookie name (optional)

const r = Router();

/*
  DEVELOPMENT DEBUG MIDDLEWARE
  - Put this BEFORE the proxy so you can confirm the gateway receives the cookie
  - It also calls getSession(sid) and logs a small snapshot (no secrets).
  Remove or silence this in production.
*/
// router or middleware file (same file you already edited)
r.use("/", async (req, res, next) => {
  try {
    const cookieName = config?.cookie?.name ?? "sid";
    console.log(">>> PRE-PROXY MIDDLEWARE: checking for session cookie:", cookieName);
    console.log("all cookies:", req.cookies);
    const sid = req.cookies?.[cookieName] ?? null;

    console.log(">>> PRE-PROXY REQUEST:", { method: req.method, url: req.originalUrl, sid });

    // Attempt to fetch a session snapshot for debugging
    let sess = null;
    try {
      if (sid) sess = await getSession(sid);
    } catch (err) {
      console.error(">>> getSession threw:", err);
    }

    // Log a small, safe session summary (do NOT log tokens)
    console.log(">>> SESSION SNAPSHOT:", {
      hasSession: !!sess,
      hasAccessToken: !!sess?.access_token,
      hasUser: !!sess?.user,
      userEmail: sess?.user?.email ?? null,
    });

    // store for proxy use (so your proxy can read it synchronously)
    req._debug_session = sess;

    // **CRUCIAL**: set header synchronously on the incoming request object so
    // http-proxy-middleware will include it when proxying.
    if (sess?.user?.email) {
      // Express normalises header keys to lowercase
      req.headers["x-user-email"] = sess.user.email;
      req.headers["x-user-sub"] = sess.user.sub; // also set sub if you want
      req.headers["x-user-name"] = sess.user.name || ""; // also set name if you want
      // also stash explicit field if you prefer
      req._x_user_email = sess.user.email;
      console.log("PRE-PROXY: set req.headers['x-user-email'] ->", sess.user.email);
    } else {
      console.log("PRE-PROXY: no email available to set on headers");
    }
  } catch (err) {
    console.error(">>> PRE-PROXY MIDDLEWARE ERROR:", err);
  }
  next();
});


// Proxy everything else to your resource server
// keep requireAuth, csrfCheck if you need them; they run before the proxy
r.use("/", requireAuth, createApiProxy());

export default r;
