import { randomBytes } from "node:crypto";

const pendingGoogleSignups = new Map();
const GOOGLE_STATE_TTL = 10 * 60 * 1000;

function signupConfig() {
  const appUrl = process.env.AUTHENTIK_FICHASRPG_APP_URL || "https://fichasrpg.nilvanlopes.com";
  return {
    authentikBaseUrl: process.env.AUTHENTIK_BASE_URL || "https://authentik.nilvanlopes.com",
    apiToken: process.env.AUTHENTIK_API_TOKEN || "",
    inviteFlow: process.env.AUTHENTIK_INVITE_FLOW_SLUG || "foundry-enrollment",
    rpgGroup: process.env.AUTHENTIK_FICHASRPG_GROUP_NAME || "fichasrpg-users",
    rpgUserPath: process.env.AUTHENTIK_FICHASRPG_USER_PATH || "users/fichasrpg",
    foundryGroup: process.env.AUTHENTIK_FOUNDRY_GROUP_NAME || "foundry-users",
    googleSource: process.env.AUTHENTIK_GOOGLE_SOURCE_SLUG || "google",
    appUrl,
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    googleRedirectUri: new URL("/api/oauth/google/callback", appUrl).toString(),
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

function invitationFlowMatches(invitation, slug) {
  if (!invitation.flow) return true;
  if (typeof invitation.flow === "string") {
    return invitation.flow === slug || /^[0-9a-f-]{32,36}$/i.test(invitation.flow);
  }
  return invitation.flow.slug === slug || !invitation.flow.slug;
}

async function validateInvitation(token) {
  const config = signupConfig();
  const invitation = await authentikApi(
    `/api/v3/stages/invitation/invitations/${encodeURIComponent(token)}/`,
  );
  if (invitation.expires && new Date(invitation.expires).getTime() <= Date.now()) {
    throw new Error("Invitation is expired");
  }
  if (!invitationFlowMatches(invitation, config.inviteFlow)) {
    throw new Error("Invitation is bound to a different flow");
  }
  return invitation;
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
  const basePath = `/api/v3/flows/executor/${encodeURIComponent(config.inviteFlow)}/`;
  const query = new URLSearchParams({ query: `itoken=${input.itoken}` });
  const path = `${basePath}?${query}`;
  const initial = await authentikPublicFetch(path, jar);
  const initialText = await initial.text();
  let body = parseFlowResponse(initialText);
  if (!initial.ok || flowHasErrors(body)) throw new Error(`Enrollment flow start failed with status ${initial.status}`);
  if (body.component === "ak-stage-identification") {
    body = await submitFlowStage(path, jar, {
      component: "ak-stage-identification",
      uid_field: input.username,
    });
  }
  if (body.component !== "ak-stage-prompt") throw new Error("Enrollment flow did not reach the account prompt");
  return submitFlowStage(path, jar, {
    component: "ak-stage-prompt",
    username: input.username,
    email: input.email,
    password: input.password,
    password_repeat: input.passwordRepeat,
  });
}

async function findGroup(name) {
  const query = new URLSearchParams({ search: name });
  const result = await authentikApi(`/api/v3/core/groups/?${query}`);
  const group = result.results?.find(item => item.name === name);
  if (!group) throw new Error(`Authentik group is missing: ${name}`);
  return group;
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

function groupId(group) {
  return typeof group === "string" ? group : group.pk;
}

async function ensureUserInRpgGroup(userId, { removeFoundry = false, updatePath = true } = {}) {
  const config = signupConfig();
  const [user, rpgGroup, foundryGroup] = await Promise.all([
    authentikApi(`/api/v3/core/users/${encodeURIComponent(userId)}/`),
    findGroup(config.rpgGroup),
    removeFoundry ? findGroup(config.foundryGroup).catch(() => null) : Promise.resolve(null),
  ]);
  const groups = new Set((user.groups || []).map(groupId));
  groups.add(rpgGroup.pk);
  if (removeFoundry && foundryGroup) groups.delete(foundryGroup.pk);
  const nextGroups = [...groups];
  const currentGroups = (user.groups || []).map(groupId);
  const changes = {};
  if (nextGroups.length !== currentGroups.length || nextGroups.some(id => !currentGroups.includes(id))) {
    changes.groups = nextGroups;
  }
  if (updatePath && user.path !== config.rpgUserPath) changes.path = config.rpgUserPath;
  if (Object.keys(changes).length) {
    await authentikApi(`/api/v3/core/users/${encodeURIComponent(userId)}/`, {
      method: "PATCH",
      body: JSON.stringify(changes),
    });
  }
}

async function waitForUserByEmail(email) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const user = await findUserByEmail(email);
    if (user) return user;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  return null;
}

async function createRpgUser(input) {
  const config = signupConfig();
  const group = await findGroup(config.rpgGroup);
  return authentikApi("/api/v3/core/users/", {
    method: "POST",
    body: JSON.stringify({
      username: input.username,
      name: input.name || input.username,
      email: input.email,
      is_active: true,
      groups: [group.pk],
      path: config.rpgUserPath,
    }),
  });
}

function normalizeUsername(value) {
  const result = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^[_.-]+|[_.-]+$/g, "").replace(/[_.-]{2,}/g, "-");
  return result.length >= 3 ? result : `user-${result || "google"}`;
}

async function availableUsername(value) {
  const base = normalizeUsername(value).slice(0, 48) || "user";
  if (!await findUserByUsername(base)) return base;
  for (let suffixNumber = 2; suffixNumber <= 99; suffixNumber += 1) {
    const suffix = `-${suffixNumber}`;
    const candidate = `${base.slice(0, 64 - suffix.length)}${suffix}`;
    if (!await findUserByUsername(candidate)) return candidate;
  }
  throw new Error("Could not find an available username");
}

function createGoogleAuthorization(itoken) {
  const config = signupConfig();
  if (!config.googleClientId || !config.googleRedirectUri) throw new Error("Google signup is not configured");
  const now = Date.now();
  for (const [state, signup] of pendingGoogleSignups) {
    if (now - signup.createdAt > GOOGLE_STATE_TTL) pendingGoogleSignups.delete(state);
  }
  const state = randomBytes(24).toString("base64url");
  pendingGoogleSignups.set(state, { itoken, createdAt: now });
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: config.googleRedirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

function consumeGoogleState(state) {
  const signup = pendingGoogleSignups.get(state) || null;
  pendingGoogleSignups.delete(state);
  if (!signup || Date.now() - signup.createdAt > GOOGLE_STATE_TTL) return null;
  return signup;
}

async function exchangeGoogleCode(code) {
  const config = signupConfig();
  if (!config.googleClientId || !config.googleClientSecret || !config.googleRedirectUri) {
    throw new Error("Google signup is not configured");
  }
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: config.googleRedirectUri,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) throw new Error("Google token exchange failed");
  const token = await tokenResponse.json();
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    signal: AbortSignal.timeout(10000),
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  if (!response.ok) throw new Error("Google user lookup failed");
  return { ...(await response.json()), accessToken: token.access_token };
}

async function ensureGoogleSourceConnection(input) {
  const query = new URLSearchParams({ source__slug: input.sourceSlug, search: input.identifier });
  const result = await authentikApi(`/api/v3/sources/user_connections/oauth/?${query}`);
  const existing = result.results?.find(item => item.identifier === input.identifier);
  if (existing) {
    if (String(existing.user) !== String(input.userId)) throw new Error("Google account is linked to another user");
    return;
  }
  const sources = await authentikApi(`/api/v3/sources/oauth/?${new URLSearchParams({ search: input.sourceSlug })}`);
  const source = sources.results?.find(item => item.slug === input.sourceSlug);
  if (!source) throw new Error("Authentik Google source is missing");
  await authentikApi("/api/v3/sources/user_connections/oauth/", {
    method: "POST",
    body: JSON.stringify({
      user: input.userId,
      source: source.pk,
      identifier: input.identifier,
      access_token: input.accessToken,
    }),
  });
}

async function consumeSingleUseInvitation(invitation, token) {
  if (!invitation.single_use) return;
  const id = invitation.pk || invitation.invite_uuid || token;
  await authentikApi(`/api/v3/stages/invitation/invitations/${encodeURIComponent(id)}/`, { method: "DELETE" });
}

function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function signupErrorPath(error, itoken = "") {
  const url = new URL("/cadastro", signupConfig().appUrl);
  if (itoken) url.searchParams.set("itoken", itoken);
  url.searchParams.set("error", error);
  return `${url.pathname}${url.search}`;
}

function publicPostOrigin(origin) {
  return (req, res, next) => {
    if (req.get("Origin") !== origin) return res.status(403).json({ error: "invalid_origin" });
    next();
  };
}

export function registerSignupRoutes(app, origin) {
  const checkOrigin = publicPostOrigin(origin);
  app.get("/api/signup/config", (req, res) => {
    const config = signupConfig();
    res.json({ googleEnabled: Boolean(config.googleClientId && config.googleClientSecret && config.googleRedirectUri) });
  });

  app.post("/api/signup/manual", checkOrigin, async (req, res) => {
    const { itoken, username, email, password, passwordRepeat } = req.body || {};
    if (!isUuid(itoken) || typeof username !== "string" || username.trim().length < 3 ||
        username.trim().length > 64 || !/^[a-zA-Z0-9_.-]+$/.test(username.trim()) ||
        typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        typeof password !== "string" || password.length < 10 || password.length > 256 ||
        password !== passwordRepeat) {
      return res.status(400).json({ error: "invalid_signup" });
    }
    const normalizedEmail = email.trim().toLowerCase();
    let existingUser;
    try {
      await validateInvitation(itoken);
    } catch {
      return res.status(403).json({ error: "invalid_invite" });
    }
    try {
      existingUser = await findUserByEmail(normalizedEmail);
      await submitEnrollmentFlow({
        itoken,
        username: username.trim(),
        email: normalizedEmail,
        password,
        passwordRepeat,
      });
      const user = await waitForUserByEmail(normalizedEmail);
      if (!user) throw new Error("Authentik did not create the enrolled account");
      await ensureUserInRpgGroup(user.pk, { removeFoundry: !existingUser, updatePath: !existingUser });
    } catch {
      return res.status(502).json({ error: "enrollment_flow_failed" });
    }
    return res.json({
      status: "confirmation_sent",
      message: "Conta criada. Confira seu e-mail para confirmar o cadastro e depois entre na plataforma.",
    });
  });

  app.post("/api/signup/google/start", checkOrigin, async (req, res) => {
    const { itoken } = req.body || {};
    if (!isUuid(itoken)) return res.status(400).json({ error: "invalid_signup" });
    try {
      await validateInvitation(itoken);
      return res.json({ redirectTo: createGoogleAuthorization(itoken) });
    } catch {
      return res.status(403).json({ error: "invalid_invite" });
    }
  });

  app.get("/api/oauth/google/callback", async (req, res) => {
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const pending = state && code ? consumeGoogleState(state) : null;
    if (!pending) return res.redirect(signupErrorPath("google_state_expired"));
    try {
      const invitation = await validateInvitation(pending.itoken);
      const profile = await exchangeGoogleCode(code);
      if (!profile.email_verified || !profile.email) {
        return res.redirect(signupErrorPath("google_email_not_verified", pending.itoken));
      }
      const config = signupConfig();
      const existingUser = await findUserByEmail(profile.email);
      const username = existingUser?.username || await availableUsername(profile.name?.trim() || profile.email.split("@")[0]);
      const user = existingUser || await createRpgUser({ username, email: profile.email, name: profile.name });
      await ensureUserInRpgGroup(user.pk, { updatePath: !existingUser });
      await ensureGoogleSourceConnection({
        userId: user.pk,
        sourceSlug: config.googleSource,
        identifier: profile.sub,
        accessToken: profile.accessToken,
      });
      await consumeSingleUseInvitation(invitation, pending.itoken);
      const login = new URL(`/source/oauth/login/${encodeURIComponent(config.googleSource)}/`, config.authentikBaseUrl);
      login.searchParams.set("next", config.appUrl);
      return res.redirect(login.toString());
    } catch {
      return res.redirect(signupErrorPath("google_signup_failed", pending.itoken));
    }
  });
}
