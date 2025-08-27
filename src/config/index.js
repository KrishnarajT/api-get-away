import "dotenv/config";

const must = (k) => {
	const v = process.env[k];
	if (!v) throw new Error(`Missing env: ${k}`);
	return v;
};
const bool = (k, def = false) =>
	process.env[k] == null
		? def
		: ["1", "true", "yes"].includes(String(process.env[k]).toLowerCase());
const num = (k, def) => (process.env[k] == null ? def : Number(process.env[k]));
const parseList = (v) =>
	v
		? v
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean)
		: [];

const config = {
	nodeEnv: process.env.NODE_ENV || "development",
	port: Number(process.env.PORT || 8080),
	baseUrl: must("APP_BASE_URL"),

	cookie: {
		name: process.env.SESSION_COOKIE_NAME || "sid",
		domain: process.env.SESSION_COOKIE_DOMAIN || undefined,
		secure: bool("SESSION_COOKIE_SECURE", true),
		sameSite: process.env.SESSION_COOKIE_SAMESITE || "Lax",
	},

	redisUrl: must("REDIS_URL"),

	oidc: {
		issuer: must("OIDC_ISSUER"),
		authorizeUrl: must("OIDC_AUTHORIZATION_ENDPOINT"),
		tokenUrl: must("OIDC_TOKEN_ENDPOINT"),
		revocationUrl: process.env.OIDC_REVOCATION_ENDPOINT || null,
		userinfoUrl: must("OIDC_USERINFO_ENDPOINT"),
		clientId: must("OIDC_CLIENT_ID"),
		clientSecret: must("OIDC_CLIENT_SECRET"),
		redirectPath: must("OIDC_REDIRECT_PATH"),
		scopes: process.env.OIDC_SCOPES || "openid profile email offline_access",
		idTokenMaxAge: num("ID_TOKEN_MAX_AGE_SECONDS", 0), // 0 = disabled
	},

	refreshSkewSeconds: num("TOKEN_REFRESH_SKEW_SECONDS", 60),

	upstreamApiBaseUrl: must("UPSTREAM_API_BASE_URL"),
	allowedOrigins: parseList(process.env.ALLOWED_ORIGINS || ""),
};

export default config;
