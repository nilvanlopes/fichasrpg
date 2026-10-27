import express from "express";
import { pipeline } from "node:stream/promises";
import { S3Client, GetObjectCommand, HeadObjectCommand, PutObjectCommand,
  DeleteObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { registerSignupRoutes } from "./signup.js";

const SYSTEMS = new Set(["mutantes", "vampiro"]);
const SYSTEM_LABELS = { mutantes: "Mutantes & Malfeitores", vampiro: "Vampiro: A Máscara" };
const DRAWING_TYPES = new Map([
  ["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"],
  ["image/gif", "gif"], ["image/avif", "avif"],
]);

function imageContentType(bytes) {
  if (!Buffer.isBuffer(bytes)) return null;
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
      bytes.toString("ascii", 12, 16) === "IHDR") return "image/png";
  if (bytes.length >= 16 && bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP" &&
      ["VP8 ", "VP8L", "VP8X"].includes(bytes.toString("ascii", 12, 16))) return "image/webp";
  if (bytes.length >= 13 && ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))) return "image/gif";
  if (bytes.length >= 16 && bytes.toString("ascii", 4, 8) === "ftyp") {
    const boxLength = bytes.readUInt32BE(0);
    if (boxLength < 16 || boxLength > 4096 || boxLength > bytes.length) return null;
    const brands = [bytes.toString("ascii", 8, 12)];
    for (let offset = 16; offset + 4 <= boxLength; offset += 4) brands.push(bytes.toString("ascii", offset, offset + 4));
    if (brands.some(brand => brand === "avif" || brand === "avis")) return "image/avif";
  }
  return null;
}

function drawingKey(sheetId, part) {
  return `drawings/${sheetId}/${part}`;
}

function drawingNotFound(error) {
  return ["NoSuchKey", "NotFound"].includes(error.name);
}

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
  const drawingBucket = process.env.FLOCI_S3_BUCKET || "fichasrpg-drawings";
  const drawingStorage = new S3Client({
    endpoint: process.env.FLOCI_S3_ENDPOINT || "http://floci:4566",
    region: process.env.FLOCI_S3_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.FLOCI_S3_ACCESS_KEY_ID || "test",
      secretAccessKey: process.env.FLOCI_S3_SECRET_ACCESS_KEY || "test",
    },
    forcePathStyle: true,
    maxAttempts: 2,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
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
  app.get(["/", "/index.html"], (req, res) => {
    // The landing page contains only public site information and link metadata.
    res.set("X-Accel-Redirect", "/_landing.html").end();
  });
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

  const drawingOwner = async (req, res, next) => {
    if (!["GET", "HEAD"].includes(req.method) && !requestAccountMatches(req, res)) return;
    if (!validSheetId(req.params.id)) return res.status(404).json({ error: "SHEET_NOT_FOUND" });
    const { rows } = await pool.query("SELECT id, system FROM sheets WHERE id = $1 AND owner_uid = $2",
      [req.params.id, req.account.uid]);
    if (!rows.length || rows[0].system !== "mutantes") return res.status(404).json({ error: "SHEET_NOT_FOUND" });
    req.drawingSheetId = rows[0].id;
    next();
  };
  const storageUnavailable = (error, res) => {
    console.error("Drawing storage request failed", { code: error.name || "STORAGE_ERROR" });
    if (res.headersSent || res.destroyed) return res.destroy();
    res.status(503).json({ error: "DRAWING_STORAGE_UNAVAILABLE" });
  };

  for (const part of ["drawing", "source"]) {
    const route = `/api/sheets/:id/drawing${part === "source" ? "/source" : ""}`;
    app.get(route, drawingOwner, async (req, res) => {
      try {
        const key = { Bucket: drawingBucket, Key: drawingKey(req.drawingSheetId, part) };
        const object = await drawingStorage.send(req.method === "HEAD"
          ? new HeadObjectCommand(key) : new GetObjectCommand(key), { abortSignal: AbortSignal.timeout(30000) });
        const contentType = (object.ContentType || "").split(";", 1)[0].trim().toLowerCase();
        if (!DRAWING_TYPES.has(contentType)) {
          object.Body?.destroy();
          return res.status(404).json({ error: "DRAWING_NOT_FOUND" });
        }
        res.set({
          "Content-Type": contentType,
          "Cache-Control": "private, no-store",
          "Content-Disposition": `inline; filename="character-${part}.${DRAWING_TYPES.get(contentType)}"`,
          "Cross-Origin-Resource-Policy": "same-origin",
          "X-Content-Type-Options": "nosniff",
        });
        if (Number.isSafeInteger(object.ContentLength) && object.ContentLength >= 0) res.set("Content-Length", String(object.ContentLength));
        if (req.method === "HEAD") return res.end();
        await pipeline(object.Body, res);
      } catch (error) {
        if (drawingNotFound(error) && !res.headersSent) return res.status(404).json({ error: "DRAWING_NOT_FOUND" });
        storageUnavailable(error, res);
      }
    });

    app.put(route, drawingOwner, express.raw({ limit: "10mb", type: () => true, inflate: false }), async (req, res) => {
      const declaredType = (req.get("Content-Type") || "").split(";", 1)[0].trim().toLowerCase();
      if (!DRAWING_TYPES.has(declaredType)) return res.status(415).json({ error: "DRAWING_INVALID_TYPE" });
      const contentType = imageContentType(req.body);
      if (!contentType || contentType !== declaredType) return res.status(400).json({ error: "DRAWING_INVALID_IMAGE" });
      try {
        await drawingStorage.send(new PutObjectCommand({
          Bucket: drawingBucket, Key: drawingKey(req.drawingSheetId, part), Body: req.body,
          ContentType: contentType, ContentLength: req.body.length, CacheControl: "private, no-store",
        }), { abortSignal: AbortSignal.timeout(30000) });
        res.json({ drawing: {
          url: `/api/sheets/${req.drawingSheetId}/drawing${part === "source" ? "/source" : ""}`,
          updatedAt: new Date().toISOString(), contentType,
        } });
      } catch (error) { storageUnavailable(error, res); }
    });

    app.delete(route, drawingOwner, async (req, res) => {
      try {
        if (part === "drawing") {
          const deleted = await drawingStorage.send(new DeleteObjectsCommand({ Bucket: drawingBucket,
            Delete: { Objects: ["drawing", "source"].map(name => ({ Key: drawingKey(req.drawingSheetId, name) })), Quiet: true },
          }), { abortSignal: AbortSignal.timeout(30000) });
          if (deleted.Errors?.length) return res.status(503).json({ error: "DRAWING_STORAGE_UNAVAILABLE" });
        } else {
          await drawingStorage.send(new DeleteObjectCommand({
            Bucket: drawingBucket, Key: drawingKey(req.drawingSheetId, part),
          }), { abortSignal: AbortSignal.timeout(30000) });
        }
        res.status(204).end();
      } catch (error) {
        if (drawingNotFound(error)) return res.status(204).end();
        storageUnavailable(error, res);
      }
    });
  }

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
    const { rowCount, rows } = await pool.query("DELETE FROM sheets WHERE id = $1 AND owner_uid = $2 RETURNING id, system", [req.params.id, req.account.uid]);
    if (!rowCount) return res.status(404).json({ error: "SHEET_NOT_FOUND" });
    if (rows[0].system === "mutantes") {
      try {
        const cleanup = await drawingStorage.send(new DeleteObjectsCommand({ Bucket: drawingBucket,
          Delete: { Objects: ["drawing", "source"].map(part => ({ Key: drawingKey(rows[0].id, part) })), Quiet: true },
        }), { abortSignal: AbortSignal.timeout(15000) });
        if (cleanup.Errors?.length) console.error("Deleted sheet drawing cleanup failed", { code: "STORAGE_DELETE_FAILED" });
      } catch (error) {
        // The missing sheet makes these private objects inaccessible even if
        // storage cleanup needs to be retried by an operator.
        console.error("Deleted sheet drawing cleanup failed", { code: error.name || "STORAGE_ERROR" });
      }
    }
    res.status(204).end();
  });

  app.use("/api", (req, res) => res.status(404).json({ error: "NOT_FOUND" }));
  app.get(/.*/, requireAccount(true), servePortal);
  app.use((req, res) => res.status(404).json({ error: "NOT_FOUND" }));
  app.use((error, req, res, next) => {
    const drawingRequest = /^\/api\/sheets\/[^/]+\/drawing(?:\/source)?\/?$/.test(req.path);
    if (error.type === "entity.too.large") return res.status(413).json({ error: drawingRequest ? "DRAWING_TOO_LARGE" : "SHEET_TOO_LARGE" });
    if (drawingRequest && error.type === "encoding.unsupported") return res.status(415).json({ error: "DRAWING_INVALID_TYPE" });
    if (error.type === "entity.parse.failed") return res.status(400).json({ error: "INVALID_JSON" });
    console.error("API request failed", { code: error.code || "INTERNAL_ERROR" });
    res.status(503).json({ error: "DATABASE_UNAVAILABLE" });
  });
  return app;
}
