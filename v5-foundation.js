const crypto = require("crypto");
const { Pool } = require("pg");

const MAX_DASHBOARDS_PER_USER = 2;
const USER_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const V5_AUTH_SECRET =
  process.env.V5_AUTH_SECRET ||
  process.env.ADMIN_TOKEN_SECRET ||
  "change-me-v5-secret";

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.DATABASE_SSL === "false"
          ? false
          : { rejectUnauthorized: false },
    })
  : null;

function requireDb() {
  if (!pool) {
    throw Object.assign(
      new Error("PostgreSQL is not configured. Set DATABASE_URL."),
      { statusCode: 503 },
    );
  }
  return pool;
}

function token(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", V5_AUTH_SECRET)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyToken(value) {
  try {
    const [encoded, signature] = String(value || "").split(".");
    if (!encoded || !signature) return null;

    const expected = crypto
      .createHmac("sha256", V5_AUTH_SECRET)
      .update(encoded)
      .digest("base64url");

    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    );

    return payload.exp > Date.now() ? payload : null;
  } catch (_) {
    return null;
  }
}

function bearer(req) {
  const h = String(req.headers.authorization || "");
  return h.startsWith("Bearer ") ? h.slice(7) : "";
}

function requireUser(req, res, next) {
  const p = verifyToken(bearer(req));
  if (!p || p.type !== "user")
    return res.status(401).json({ error: "V5 authentication required." });

  req.v5UserId = p.sub;
  next();
}

function requireAdmin(req, res, next) {
  const p = verifyToken(bearer(req));
  if (!p || p.type !== "admin")
    return res.status(401).json({ error: "V5 admin authentication required." });

  req.v5AdminUserId = p.sub;
  req.v5AdminId = p.adminId;
  next();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  return `${salt}:${crypto.scryptSync(String(password), salt, 64).toString("hex")}`;
}

function checkPassword(password, stored) {
  try {
    const [salt, expected] = String(stored || "").split(":");
    if (!salt || !expected) return false;

    const actual = crypto
      .scryptSync(String(password), salt, 64)
      .toString("hex");
    const a = Buffer.from(actual, "hex");
    const b = Buffer.from(expected, "hex");

    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (_) {
    return false;
  }
}

function normalizeUsername(value) {
  const username = String(value || "")
    .trim()
    .toLowerCase();

  if (!/^[a-z0-9][a-z0-9_.-]{3,39}$/.test(username)) {
    throw Object.assign(
      new Error(
        "User ID must be 4-40 characters and use only letters, numbers, dot, underscore or hyphen.",
      ),
      { statusCode: 400 },
    );
  }

  return username;
}

function validatePassword(value) {
  const password = String(value || "");

  if (password.length < 8 || password.length > 128) {
    throw Object.assign(
      new Error("Password must be between 8 and 128 characters."),
      { statusCode: 400 },
    );
  }

  return password;
}

function asyncRoute(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = function registerV5(app) {
  // ------------------------------------------------------------
  // USER REGISTRATION
  // ------------------------------------------------------------
  app.post(
    "/api/v5/auth/register",
    asyncRoute(async (req, res) => {
      const db = requireDb();
      const username = normalizeUsername(req.body?.username);
      const password = validatePassword(req.body?.password);

      const existing = (
        await db.query(
          "SELECT id FROM users WHERE LOWER(username)=LOWER($1) LIMIT 1",
          [username],
        )
      ).rows[0];

      if (existing) {
        return res.status(409).json({
          error: "That User ID is already in use. Please choose another.",
        });
      }

      const user = (
        await db.query(
          `INSERT INTO users(username,password_hash)
         VALUES($1,$2)
         RETURNING id,username,created_at`,
          [username, hashPassword(password)],
        )
      ).rows[0];

      const userToken = token({
        type: "user",
        sub: user.id,
        exp: Date.now() + USER_TOKEN_TTL_MS,
      });

      return res.status(201).json({
        success: true,
        token: userToken,
        user,
        dashboards: [],
        hasAdmin: false,
        adminUsername: null,
        dashboardLimit: MAX_DASHBOARDS_PER_USER,
      });
    }),
  );

  // ------------------------------------------------------------
  // USER LOGIN
  // ------------------------------------------------------------
  app.post(
    "/api/v5/auth/login",
    asyncRoute(async (req, res) => {
      const db = requireDb();
      const username = normalizeUsername(req.body?.username);
      const password = String(req.body?.password || "");

      const user = (
        await db.query(
          `SELECT id,username,password_hash,created_at
         FROM users
         WHERE LOWER(username)=LOWER($1)
         LIMIT 1`,
          [username],
        )
      ).rows[0];

      if (!user || !checkPassword(password, user.password_hash)) {
        return res.status(401).json({ error: "Invalid User ID or password." });
      }

      const dashboards = (
        await db.query(
          `SELECT id,association_name
         FROM dashboards
         WHERE user_id=$1 AND archived_at IS NULL
         ORDER BY created_at`,
          [user.id],
        )
      ).rows;

      const admin = (
        await db.query(
          "SELECT username FROM admin_accounts WHERE user_id=$1 LIMIT 1",
          [user.id],
        )
      ).rows[0];

      return res.json({
        success: true,
        token: token({
          type: "user",
          sub: user.id,
          exp: Date.now() + USER_TOKEN_TTL_MS,
        }),
        user: {
          id: user.id,
          username: user.username,
          created_at: user.created_at,
        },
        hasAdmin: !!admin,
        adminUsername: admin?.username || null,
        dashboards,
        dashboardLimit: MAX_DASHBOARDS_PER_USER,
      });
    }),
  );

  // ------------------------------------------------------------
  // CURRENT USER
  // ------------------------------------------------------------
  app.get(
    "/api/v5/me",
    requireUser,
    asyncRoute(async (req, res) => {
      const db = requireDb();

      const user = (
        await db.query(
          `SELECT id,username,created_at
         FROM users
         WHERE id=$1`,
          [req.v5UserId],
        )
      ).rows[0];

      if (!user) return res.status(404).json({ error: "User not found." });

      const dashboards = (
        await db.query(
          `SELECT id,association_name,contact_phone,contact_email,address,description,created_at
         FROM dashboards
         WHERE user_id=$1 AND archived_at IS NULL
         ORDER BY created_at`,
          [req.v5UserId],
        )
      ).rows;

      const admin = (
        await db.query(
          "SELECT username FROM admin_accounts WHERE user_id=$1 LIMIT 1",
          [req.v5UserId],
        )
      ).rows[0];

      res.json({
        user,
        dashboards,
        adminUsername: admin?.username || null,
        dashboardLimit: MAX_DASHBOARDS_PER_USER,
      });
    }),
  );

  // ------------------------------------------------------------
  // ONE ADMIN ACCOUNT PER USER
  // ------------------------------------------------------------
  app.post(
    "/api/v5/admin/credentials",
    requireUser,
    asyncRoute(async (req, res) => {
      const db = requireDb();
      const username = String(req.body?.username || "").trim();
      const password = validatePassword(req.body?.password);

      if (!/^[A-Za-z0-9_.-]{4,40}$/.test(username)) {
        return res.status(400).json({
          error: "Admin username must be 4-40 characters.",
        });
      }

      const existingForUser = (
        await db.query("SELECT id FROM admin_accounts WHERE user_id=$1", [
          req.v5UserId,
        ])
      ).rows[0];

      if (existingForUser) {
        return res.status(409).json({
          error: "Admin credentials already exist.",
        });
      }

      const existingUsername = (
        await db.query("SELECT id FROM admin_accounts WHERE username=$1", [
          username,
        ])
      ).rows[0];

      if (existingUsername) {
        return res.status(409).json({
          error: "That admin username is already in use.",
        });
      }

      const row = (
        await db.query(
          `INSERT INTO admin_accounts(user_id,username,password_hash)
         VALUES($1,$2,$3)
         RETURNING id,username`,
          [req.v5UserId, username, hashPassword(password)],
        )
      ).rows[0];

      res.status(201).json({ success: true, admin: row });
    }),
  );

  app.post(
    "/api/v5/admin/login",
    asyncRoute(async (req, res) => {
      const db = requireDb();
      const username = String(req.body?.username || "").trim();
      const password = String(req.body?.password || "");

      const admin = (
        await db.query(
          `SELECT id,user_id,username,password_hash
         FROM admin_accounts
         WHERE username=$1
         LIMIT 1`,
          [username],
        )
      ).rows[0];

      if (!admin || !checkPassword(password, admin.password_hash)) {
        return res.status(401).json({ error: "Invalid admin credentials." });
      }

      const dashboards = (
        await db.query(
          `SELECT id,association_name
         FROM dashboards
         WHERE user_id=$1 AND archived_at IS NULL
         ORDER BY created_at`,
          [admin.user_id],
        )
      ).rows;

      res.json({
        success: true,
        token: token({
          type: "admin",
          sub: admin.user_id,
          adminId: admin.id,
          exp: Date.now() + 8 * 3600000,
        }),
        admin: {
          id: admin.id,
          username: admin.username,
          userId: admin.user_id,
        },
        dashboards,
      });
    }),
  );

  // ------------------------------------------------------------
  // DASHBOARDS
  // ------------------------------------------------------------
  app.get(
    "/api/v5/dashboards",
    requireUser,
    asyncRoute(async (req, res) => {
      const db = requireDb();

      const rows = (
        await db.query(
          `SELECT id,association_name,contact_phone,contact_email,address,description,created_at
         FROM dashboards
         WHERE user_id=$1 AND archived_at IS NULL
         ORDER BY created_at`,
          [req.v5UserId],
        )
      ).rows;

      res.json({
        dashboards: rows,
        limit: MAX_DASHBOARDS_PER_USER,
        remaining: MAX_DASHBOARDS_PER_USER - rows.length,
      });
    }),
  );

  app.post(
    "/api/v5/dashboards",
    requireUser,
    asyncRoute(async (req, res) => {
      const db = requireDb();
      const client = await db.connect();

      try {
        const count = (
          await client.query(
            `SELECT COUNT(*)::int AS count
           FROM dashboards
           WHERE user_id=$1 AND archived_at IS NULL`,
            [req.v5UserId],
          )
        ).rows[0].count;

        if (Number(count) >= MAX_DASHBOARDS_PER_USER) {
          return res.status(409).json({
            error: `You can create a maximum of ${MAX_DASHBOARDS_PER_USER} dashboards.`,
          });
        }

        const associationName = String(req.body?.associationName || "").trim();
        const categories = Array.isArray(req.body?.categories)
          ? req.body.categories
          : [];

        if (!associationName) {
          return res
            .status(400)
            .json({ error: "Association name is required." });
        }

        if (!categories.length) {
          return res.status(400).json({
            error: "Add at least one token category.",
          });
        }

        await client.query("BEGIN");

        const dashboard = (
          await client.query(
            `INSERT INTO dashboards(
             user_id,association_name,contact_phone,contact_email,address,description
           )
           VALUES($1,$2,$3,$4,$5,$6)
           RETURNING *`,
            [
              req.v5UserId,
              associationName,
              req.body?.contactPhone || null,
              req.body?.contactEmail || null,
              req.body?.address || null,
              req.body?.description || null,
            ],
          )
        ).rows[0];

        const seen = new Set();

        for (const c of categories) {
          const name = String(c?.name || "").trim();
          const prefix = String(c?.prefix || "")
            .trim()
            .toUpperCase();
          const price = Number(c?.price);

          if (!name || !prefix || !Number.isFinite(price) || price < 0) {
            throw Object.assign(
              new Error("Each category needs a name, prefix and valid price."),
              { statusCode: 400 },
            );
          }

          if (seen.has(name.toLowerCase())) {
            throw Object.assign(new Error(`Duplicate category: ${name}`), {
              statusCode: 400,
            });
          }

          seen.add(name.toLowerCase());

          await client.query(
            `INSERT INTO token_categories(
             dashboard_id,name,prefix,price,active
           )
           VALUES($1,$2,$3,$4,true)`,
            [dashboard.id, name, prefix, price],
          );
        }

        await client.query("COMMIT");

        const cats = (
          await db.query(
            `SELECT id,name,prefix,price,active
           FROM token_categories
           WHERE dashboard_id=$1
           ORDER BY created_at`,
            [dashboard.id],
          )
        ).rows;

        res.status(201).json({
          success: true,
          dashboard: { ...dashboard, categories: cats },
        });
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    }),
  );

  app.get(
    "/api/v5/dashboards/:dashboardId",
    requireUser,
    asyncRoute(async (req, res) => {
      const db = requireDb();

      const dashboard = (
        await db.query(
          `SELECT *
           FROM dashboards
           WHERE id=$1 AND user_id=$2 AND archived_at IS NULL`,
          [req.params.dashboardId, req.v5UserId],
        )
      ).rows[0];

      if (!dashboard) {
        return res.status(404).json({ error: "Dashboard not found." });
      }

      const categories = (
        await db.query(
          `SELECT id,name,prefix,price,active,created_at,updated_at
           FROM token_categories
           WHERE dashboard_id=$1
           ORDER BY created_at`,
          [dashboard.id],
        )
      ).rows;

      res.json({ dashboard, categories });
    }),
  );
};
