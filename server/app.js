import express from "express";
import { registerSignupRoutes } from "./signup.js";

const SYSTEMS = new Set(["mutantes", "vampiro"]);
const SYSTEM_LABELS = { mutantes: "Mutantes & Malfeitores", vampiro: "Vampiro: A Máscara" };

function validForm(form) {
  if (!form || typeof form !== "object" || Array.isArray(form)) return false;
  const entries = Object.entries(form);
  return entries.length <= 2000 && entries.every(([key, value]) =>
    /^[a-z][a-z0-9-]{0,119}$/.test(key) &&
    !["constructor", "prototype"].includes(key) &&
    ((typeof value === "string" && value.length <= 16000) ||
      typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))),
  );
}

function validSheetId(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id || "");
}

function safeName(value, system) {
  if (value === undefined || value === null || value === "") return `Nova ficha de ${SYSTEM_LABELS[system]}`;
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length > 0 && name.length <= 120 ? name : null;
}

function requestAccountMatches(req, res) {
  if (req.get("X-Ficha-Account") !== req.account.uid) {
    res.status(409).json({ error: "ACCOUNT_CHANGED" });
    return false;
  }
  return true;
}

export function createApp({ pool, authUrl, publicOrigin, fetchAuth = fetch }) {
  const app = express();
  const origin = new URL(publicOrigin).origin;
  const allowedOrigins = new Set([
    origin,
    ...(process.env.PUBLIC_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean)
      .map(value => new URL(value).origin),
  ]);
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({ "Cache-Control": "no-store", Vary: "Cookie", "X-Content-Type-Options": "nosniff" });
    next();
  });
  app.use(express.json({ limit: "512kb", type: "application/json" }));

  app.get("/healthz", async (req, res) => {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  });

  // Registration is intentionally public; all sheet and account APIs below
  // still require an Authentik session in the fichasrpg-users group.
  registerSignupRoutes(app, origin);

  app.get("/api/logout", (req, res) => {
    const appUrl = process.env.AUTHENTIK_FICHASRPG_APP_URL || "https://fichasrpg.nilvanlopes.com";
    res.redirect(302, new URL("/outpost.goauthentik.io/sign_out", appUrl).href);
  });

  app.use("/api", (req, res, next) => {
    if (!["GET", "HEAD"].includes(req.method) &&
        (!allowedOrigins.has(req.get("Origin")) || req.get("X-Ficha-Request") !== "1")) {
      return res.status(403).json({ error: "INVALID_ORIGIN" });
    }
    next();
  });

  const servePortal = (req, res) => {
    // Nginx delivers its own index.html only after the application allows it.
    res.set("X-Accel-Redirect", "/_portal.html").end();
  };
  app.get(/^\/cadastro(?:\/.*)?$/, servePortal);

  function requireAccount(page = false) {
    return async (req, res, next) => {
      const reject = (status, error) => {
        if (!page) return res.status(status).json({ error });
        if (status === 401) {
          const login = new URL("/outpost.goauthentik.io/start", origin);
          login.searchParams.set("rd", `${origin}${req.originalUrl}`);
          return res.redirect(302, login.href);
        }
        return res.status(status).type("text/plain").send(status === 403
          ? "Esta conta não tem acesso ao FichasRPG."
          : "Não foi possível verificar seu acesso. Tente novamente.");
      };
      const forwardedHost = req.get("X-Forwarded-Host");
      const forwardedProto = (req.get("X-Forwarded-Proto") || new URL(origin).protocol.slice(0, -1)).replace(/:$/, "");
      const forwardedOrigin = forwardedHost ? new URL(`${forwardedProto}://${forwardedHost}`).origin : origin;
      const requestOrigin = allowedOrigins.has(forwardedOrigin) ? forwardedOrigin : origin;
      if (process.env.DEV_AUTH_BYPASS === "1") {
        const username = process.env.DEV_AUTH_USERNAME || "pyu";
        const { rows } = await pool.query(
          "SELECT uid, username, display_name FROM accounts WHERE username = $1 ORDER BY last_seen DESC LIMIT 1",
          [username],
        );
        if (!rows.length) return reject(503, "DEV_ACCOUNT_NOT_FOUND");
        req.account = { uid: rows[0].uid, username: rows[0].username, name: rows[0].display_name || username };
      } else {
        if (!req.get("Cookie")) return reject(401, "LOGIN_REQUIRED");
        let auth;
        try {
          // Read identity only from a fresh session validation with the outpost.
          auth = await fetchAuth(authUrl, {
            redirect: "manual",
            signal: AbortSignal.timeout(5000),
            headers: {
              Cookie: req.get("Cookie"),
              "X-Forwarded-Host": new URL(requestOrigin).host,
              "X-Forwarded-Proto": new URL(requestOrigin).protocol.slice(0, -1),
              "X-Forwarded-Uri": req.originalUrl,
              "X-Forwarded-Method": req.method,
              "X-Original-URL": new URL(req.originalUrl, requestOrigin).href,
            },
          });
        } catch {
          return reject(503, "AUTH_UNAVAILABLE");
        }
        await auth.body?.cancel();
        if (!auth.ok) {
          const denied = auth.status === 403;
          return reject(denied ? 403 : auth.status >= 500 ? 503 : 401,
            denied ? "ACCESS_DENIED" : auth.status >= 500 ? "AUTH_UNAVAILABLE" : "LOGIN_REQUIRED");
        }
        const uid = auth.headers.get("X-authentik-uid") || "";
        const username = auth.headers.get("X-authentik-username") || "";
        const groups = (auth.headers.get("X-authentik-groups") || "").split("|");
        if (!/^[a-f0-9]{64}$/.test(uid) || !username || !groups.includes("fichasrpg-users")) {
          return reject(403, "ACCESS_DENIED");
        }
        req.account = { uid, username, name: auth.headers.get("X-authentik-name") || username };
      }
      await pool.query(`INSERT INTO accounts (uid, username, display_name) VALUES ($1, $2, $3)
        ON CONFLICT (uid) DO UPDATE SET username = EXCLUDED.username,
        display_name = EXCLUDED.display_name, last_seen = now()`, [req.account.uid, req.account.username, req.account.name]);
      next();
    };
  }

  app.use("/api", requireAccount());

  app.get("/api/session", (req, res) => res.json({ user: req.account }));

  app.get("/api/systems/vampiro/disciplines", async (req, res) => {
    const { rows } = await pool.query(`SELECT d.id, d.name, d.source_url,
      COALESCE(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'level', p.level,
        'description', p.description, 'details', p.details) ORDER BY p.level, p.name)
        FILTER (WHERE p.id IS NOT NULL), '[]'::jsonb) AS powers
      FROM vampire_disciplines d LEFT JOIN vampire_discipline_powers p ON p.discipline_id = d.id
      GROUP BY d.id ORDER BY d.name`);
    res.json({ disciplines: rows });
  });

  app.get("/api/sheets", async (req, res) => {
    const { rows } = await pool.query(`SELECT id, system, name, revision, created_at, updated_at
      FROM sheets WHERE owner_uid = $1 ORDER BY updated_at DESC, created_at DESC`, [req.account.uid]);
    res.json({ user: req.account, sheets: rows });
  });

  app.post("/api/sheets", async (req, res) => {
    if (!requestAccountMatches(req, res)) return;
    const { system, name, form = {} } = req.body || {};
    if (!SYSTEMS.has(system) || !validForm(form)) return res.status(400).json({ error: "INVALID_SHEET" });
    const sheetName = safeName(name, system);
    if (!sheetName) return res.status(400).json({ error: "INVALID_SHEET_NAME" });
    const { rows } = await pool.query(`INSERT INTO sheets (owner_uid, system, name, form)
      VALUES ($1, $2, $3, $4::jsonb)
      RETURNING id, system, name, form, revision, created_at, updated_at`,
    [req.account.uid, system, sheetName, JSON.stringify(form)]);
    res.status(201).json({ sheet: rows[0] });
  });

  app.get("/api/sheets/:id", async (req, res) => {
    if (!validSheetId(req.params.id)) return res.status(404).json({ error: "SHEET_NOT_FOUND" });
    const { rows } = await pool.query(`SELECT id, system, name, form, revision, created_at, updated_at
      FROM sheets WHERE id = $1 AND owner_uid = $2`, [req.params.id, req.account.uid]);
    if (!rows.length) return res.status(404).json({ error: "SHEET_NOT_FOUND" });
    res.json({ user: req.account, sheet: rows[0] });
  });

  app.put("/api/sheets/:id", async (req, res) => {
    if (!requestAccountMatches(req, res)) return;
    if (!validSheetId(req.params.id)) return res.status(404).json({ error: "SHEET_NOT_FOUND" });
    const { form, revision, name } = req.body || {};
    if (!validForm(form) || !Number.isInteger(revision) || revision < 1 || revision >= 2147483647 ||
        Object.keys(req.body || {}).some(key => !["form", "revision", "name"].includes(key))) {
      return res.status(400).json({ error: "INVALID_SHEET" });
    }
    const nextName = name === undefined ? null : safeName(name, "mutantes");
    if (name !== undefined && !nextName) return res.status(400).json({ error: "INVALID_SHEET_NAME" });
    const { rows } = await pool.query(`UPDATE sheets
      SET form = $3::jsonb, name = COALESCE($4, name), revision = revision + 1, updated_at = now()
      WHERE id = $1 AND owner_uid = $2 AND revision = $5
      RETURNING id, system, name, revision, updated_at`,
    [req.params.id, req.account.uid, JSON.stringify(form), nextName, revision]);
    if (!rows.length) return res.status(409).json({ error: "SHEET_CONFLICT" });
    res.json({ sheet: rows[0] });
  });

  app.delete("/api/sheets/:id", async (req, res) => {
    if (!requestAccountMatches(req, res)) return;
    if (!validSheetId(req.params.id)) return res.status(404).json({ error: "SHEET_NOT_FOUND" });
    const { rowCount } = await pool.query("DELETE FROM sheets WHERE id = $1 AND owner_uid = $2", [req.params.id, req.account.uid]);
    if (!rowCount) return res.status(404).json({ error: "SHEET_NOT_FOUND" });
    res.status(204).end();
  });

  app.use("/api", (req, res) => res.status(404).json({ error: "NOT_FOUND" }));
  app.get(/.*/, requireAccount(true), servePortal);
  app.use((req, res) => res.status(404).json({ error: "NOT_FOUND" }));
  app.use((error, req, res, next) => {
    if (error.type === "entity.too.large") return res.status(413).json({ error: "SHEET_TOO_LARGE" });
    if (error.type === "entity.parse.failed") return res.status(400).json({ error: "INVALID_JSON" });
    console.error("API request failed", { code: error.code || "INTERNAL_ERROR" });
    res.status(503).json({ error: "DATABASE_UNAVAILABLE" });
  });
  return app;
}
