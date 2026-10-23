function signupConfig() {
  const appUrl = process.env.AUTHENTIK_FICHASRPG_APP_URL || "https://fichasrpg.nilvanlopes.com";
  return {
    authentikBaseUrl: process.env.AUTHENTIK_BASE_URL || "https://login-fichasrpg.nilvanlopes.com",
    apiToken: process.env.AUTHENTIK_API_TOKEN || "",
    enrollmentFlow: process.env.AUTHENTIK_FICHASRPG_ENROLLMENT_FLOW_SLUG || "fichasrpg-enrollment",
    appUrl,
  };
}

function requireApiToken(config) {
  if (!config.apiToken) throw new Error("Authentik API token is not configured");
}

async function authentikApi(path, init = {}) {
  const config = signupConfig();
  requireApiToken(config);
  const response = await fetch(new URL(path, config.authentikBaseUrl), {
    ...init,
    signal: init.signal || AbortSignal.timeout(10000),
    headers: {
      authorization: `Bearer ${config.apiToken}`,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Authentik API returned ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function authentikPublicFetch(path, jar, init = {}) {
  const config = signupConfig();
  let nextPath = path;
  let nextInit = init;
  let redirects = 0;
  while (true) {
    const headers = {
      "content-type": "application/json",
      ...Object.fromEntries(new Headers(nextInit.headers).entries()),
    };
    const cookie = [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
    if (cookie) headers.cookie = cookie;
    const response = await fetch(new URL(nextPath, config.authentikBaseUrl), {
      ...nextInit,
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
      headers,
    });
    const setCookies = typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);
    for (const setCookie of setCookies) {
      const firstPart = setCookie.split(";")[0];
      const separator = firstPart.indexOf("=");
      if (separator > 0) jar.set(firstPart.slice(0, separator), firstPart.slice(separator + 1));
    }
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location) return response;
    if (++redirects > 10) throw new Error("Too many redirects while submitting the enrollment flow");
    const nextUrl = new URL(location, config.authentikBaseUrl);
    if (nextUrl.origin !== new URL(config.authentikBaseUrl).origin) {
      throw new Error("Enrollment flow redirected outside Authentik");
    }
    nextPath = `${nextUrl.pathname}${nextUrl.search}`;
    if ([301, 302, 303].includes(response.status)) nextInit = { method: "GET" };
  }
}

function parseFlowResponse(value) {
  if (!value) return {};
  try { return JSON.parse(value); }
  catch { return { component: "ak-stage-error", non_field_errors: [value] }; }
}

function flowHasErrors(body) {
  return Boolean(body.non_field_errors?.length ||
    (body.response_errors && Object.keys(body.response_errors).length) ||
    body.component === "ak-stage-access-denied");
}

async function submitFlowStage(path, jar, payload) {
  const csrf = jar.get("authentik_csrf") || jar.get("csrftoken");
  const headers = csrf ? { "x-csrftoken": csrf } : {};
  const response = await authentikPublicFetch(path, jar, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  const body = parseFlowResponse(text);
  if (!response.ok || flowHasErrors(body)) throw new Error(`Enrollment stage failed with status ${response.status}`);
  return body;
}

async function submitEnrollmentFlow(input) {
  const config = signupConfig();
  const jar = new Map();
  const basePath = `/api/v3/flows/executor/${encodeURIComponent(config.enrollmentFlow)}/`;
  const path = basePath;
  const initial = await authentikPublicFetch(path, jar);
  const initialText = await initial.text();
  let body = parseFlowResponse(initialText);
  if (!initial.ok || flowHasErrors(body)) throw new Error(`Enrollment flow start failed with status ${initial.status}`);
  if (body.component !== "ak-stage-prompt") throw new Error("Enrollment flow did not reach the account prompt");
  body = await submitFlowStage(path, jar, {
    component: "ak-stage-prompt",
    username: input.username,
    email: input.email,
    password: input.password,
    password_repeat: input.passwordRepeat,
  });
  if (body.component !== "ak-stage-email") throw new Error("Enrollment did not reach email confirmation");
}

async function findUserByEmail(email) {
  const query = new URLSearchParams({ search: email });
  const result = await authentikApi(`/api/v3/core/users/?${query}`);
  return result.results?.find(user => user.email?.toLowerCase() === email.toLowerCase()) || null;
}

async function findUserByUsername(username) {
  const query = new URLSearchParams({ search: username });
  const result = await authentikApi(`/api/v3/core/users/?${query}`);
  return result.results?.find(user => user.username?.toLowerCase() === username.toLowerCase()) || null;
}

function publicPostOrigin(origin) {
  return (req, res, next) => {
    if (req.get("Origin") !== origin) return res.status(403).json({ error: "invalid_origin" });
    next();
  };
}

function googleLoginUrl() {
  const config = signupConfig();
  const url = new URL("/if/flow/fichasrpg-google-start/", config.authentikBaseUrl);
  url.searchParams.set("next", config.appUrl);
  return url.toString();
}

export function registerSignupRoutes(app, origin) {
  const checkOrigin = publicPostOrigin(origin);
  app.get("/api/signup/config", (req, res) => {
    // OAuth credentials and browser state belong to the Authentik Google source.
    res.json({ googleEnabled: true });
  });

  app.post("/api/signup/manual", checkOrigin, async (req, res) => {
    const { username, email, password, passwordRepeat } = req.body || {};
    if (typeof username !== "string" || username.trim().length < 3 ||
        username.trim().length > 64 || !/^[a-zA-Z0-9_.-]+$/.test(username.trim()) ||
        typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        typeof password !== "string" || password.length < 10 || password.length > 256 ||
        password !== passwordRepeat) {
      return res.status(400).json({ error: "invalid_signup" });
    }
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const [emailOwner, usernameOwner] = await Promise.all([
        findUserByEmail(normalizedEmail), findUserByUsername(username.trim()),
      ]);
      if (emailOwner || usernameOwner) return res.status(409).json({ error: "account_exists" });
      // Only this dedicated flow can create the account and assign its group.
      // No request-supplied group, path, invitation or flow is forwarded.
      await submitEnrollmentFlow({ username: username.trim(), email: normalizedEmail, password, passwordRepeat });
    } catch {
      return res.status(502).json({ error: "enrollment_flow_failed" });
    }
    return res.json({
      status: "confirmation_sent",
      message: "Conta criada. Confira seu e-mail para confirmar o cadastro e depois entre na plataforma.",
    });
  });

  app.post("/api/signup/google/start", checkOrigin, (req, res) => {
    res.json({ redirectTo: googleLoginUrl() });
  });

}
