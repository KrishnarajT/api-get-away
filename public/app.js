// public/app.js
const BASE = "";
const el = (id) => document.getElementById(id);
const meBox = el("meBox");
const portfolioBox = el("portfolioBox");
const healthBox = el("healthBox");
const statusPill = el("status");
const welcome = el("welcome");
const avatar = el("avatar");
const loginBtn = el("loginBtn");
const logoutBtn = el("logoutBtn");
const refreshMeBtn = el("refreshMeBtn");
const portfolioBtn = el("portfolioBtn");
const healthBtn = el("healthBtn");

function setStatus(text, good) {
	statusPill.textContent = text;
	statusPill.className = "pill " + (good === true ? "ok" : good === false ? "bad" : "muted");
}
async function jsonOrNull(resp) {
	try {
		return await resp.json();
	} catch {
		return null;
	}
}
function setLoggedOutUI() {
	welcome.textContent = "";
	avatar.src = "";
	avatar.style.display = "none";
	loginBtn.style.display = "";
	logoutBtn.style.display = "none";
	setStatus("logged out", false);
}
function setLoggedInUI(user) {
	const name = user?.name || user?.email || user?.sub || "User";
	welcome.textContent = `Hello, ${name}`;
	if (user?.picture) {
		avatar.src = user.picture;
		avatar.style.display = "";
	} else {
		avatar.style.display = "none";
	}
	loginBtn.style.display = "none";
	logoutBtn.style.display = "";
	setStatus("logged in", true);
}
async function fetchMe() {
	meBox.textContent = "Loading…";
	try {
		const resp = await fetch(`${BASE}/api/me`, { credentials: "include" });
		if (!resp.ok) {
			meBox.textContent = `Error ${resp.status}`;
			if (resp.status === 401) setLoggedOutUI();
			return null;
		}
		const data = await resp.json();
		meBox.textContent = JSON.stringify(data, null, 2);
		setLoggedInUI(data);
		return data;
	} catch (e) {
		meBox.textContent = String(e);
		return null;
	}
}
async function fetchPortfolio() {
	portfolioBox.textContent = "Loading…";
	try {
		const resp = await fetch(`${BASE}/api/portfolio`, { credentials: "include" });
		if (!resp.ok) {
			const body = await jsonOrNull(resp);
			portfolioBox.textContent = `Error ${resp.status} ${body ? JSON.stringify(body) : ""}`;
			if (resp.status === 401) setLoggedOutUI();
			return;
		}
		const data = await resp.json();
		portfolioBox.textContent = JSON.stringify(data, null, 2);
	} catch (e) {
		portfolioBox.textContent = String(e);
	}
}
async function logout() {
	try {
		const resp = await fetch(`${BASE}/auth/logout`, { method: "POST", credentials: "include" });
		if (resp.ok || resp.status === 204) {
			setLoggedOutUI();
			meBox.textContent = "Logged out.";
		} else {
			meBox.textContent = `Logout failed ${resp.status}`;
		}
	} catch (e) {
		meBox.textContent = String(e);
	}
}
logoutBtn.addEventListener("click", logout);
refreshMeBtn.addEventListener("click", fetchMe);
portfolioBtn.addEventListener("click", fetchPortfolio);
healthBtn.addEventListener("click", async () => {
	healthBox.textContent = "Loading…";
	try {
		const resp = await fetch(`${BASE}/healthz`);
		const data = await jsonOrNull(resp);
		healthBox.textContent = resp.ok ? JSON.stringify(data, null, 2) : `Error ${resp.status}`;
	} catch (e) {
		healthBox.textContent = String(e);
	}
});
(async function init() {
	try {
		const r = await fetch(`${BASE}/healthz`);
		setStatus(r.ok ? "reachable" : "unreachable", r.ok);
	} catch {
		setStatus("unreachable", false);
	}
	const user = await fetchMe();
	if (!user) setLoggedOutUI();
})();

// ADD THIS:
loginBtn.addEventListener("click", () => {
	window.location.href = "/auth/login";
});

// (logoutBtn listener you already have)
logoutBtn.addEventListener("click", logout);
