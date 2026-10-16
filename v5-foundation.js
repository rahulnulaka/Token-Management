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
  req.v5Role = p.role || "owner";
  req.v5DashboardId = p.dashboardId || null;

  next();
}

function requireOwner(req, res, next) {
  const p = verifyToken(bearer(req));

  if (!p || p.type !== "user" || !p.sub || (p.role && p.role === "user")) {
    return res
      .status(401)
      .json({ error: "Owner account authentication required." });
  }

  // The existing main account is the owner/admin. No separate admin token is used.
  req.v5UserId = p.sub;
  req.v5Role = p.role || "owner";
  req.v5AdminUserId = p.sub;
  req.v5AdminId = null;
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
        role: "owner",
        sub: user.id,
        exp: Date.now() + USER_TOKEN_TTL_MS,
      });

      return res.status(201).json({
        success: true,

        token: userToken,

        user,

        dashboards: [],

        hasAdmin: true,

        adminUsername: user.username,

        dashboardLimit: MAX_DASHBOARDS_PER_USER,
      });
    }),
  ); // ------------------------------------------------------------
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

      const ownedDashboards = (
        await db.query(
          `SELECT id,association_name FROM dashboards
            WHERE user_id=$1 AND archived_at IS NULL ORDER BY created_at`,
          [user.id],
        )
      ).rows;
      const memberDashboards = ownedDashboards.length
        ? []
        : (
            await db.query(
              `SELECT d.id,d.association_name FROM dashboard_members dm
             JOIN dashboards d ON d.id=dm.dashboard_id
            WHERE dm.user_id=$1 AND dm.is_active=TRUE AND d.archived_at IS NULL
            ORDER BY d.created_at`,
              [user.id],
            )
          ).rows;
      const dashboards = ownedDashboards.length
        ? ownedDashboards
        : memberDashboards;
      const isDashboardUser =
        !ownedDashboards.length && memberDashboards.length > 0;

      return res.json({
        success: true,

        token: token({
          type: "user",
          role: isDashboardUser ? "user" : "owner",
          ...(isDashboardUser && memberDashboards.length === 1
            ? { dashboardId: memberDashboards[0].id }
            : {}),
          sub: user.id,
          exp: Date.now() + USER_TOKEN_TTL_MS,
        }),

        user: {
          id: user.id,

          username: user.username,

          created_at: user.created_at,
        },

        hasAdmin: !isDashboardUser,

        adminUsername: isDashboardUser ? null : user.username,

        dashboards,

        dashboardLimit: isDashboardUser ? 0 : MAX_DASHBOARDS_PER_USER,
      });
    }),
  ); // ------------------------------------------------------------
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

FROM dashboards d

WHERE (d.user_id=$1 OR EXISTS (
  SELECT 1 FROM dashboard_members dm
   WHERE dm.dashboard_id=d.id AND dm.user_id=$1 AND dm.is_active=TRUE
)) AND d.archived_at IS NULL

ORDER BY d.created_at`,

          [req.v5UserId],
        )
      ).rows;

      const owner = true;

      res.json({
        user: {
          ...user,
          role: req.v5Role || "owner",
          dashboardId: req.v5DashboardId || null,
        },

        dashboards,

        adminUsername: req.v5Role === "user" ? null : user.username,

        dashboardLimit: req.v5Role === "user" ? 0 : MAX_DASHBOARDS_PER_USER,
      });
    }),
  ); // ------------------------------------------------------------
  // The main user account is the owner/admin; no separate admin account is created.

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

FROM dashboards d

WHERE (d.user_id=$1 OR EXISTS (
  SELECT 1 FROM dashboard_members dm
   WHERE dm.dashboard_id=d.id AND dm.user_id=$1 AND dm.is_active=TRUE
)) AND d.archived_at IS NULL

ORDER BY d.created_at`,

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
      if (req.v5Role === "user")
        return res
          .status(403)
          .json({ error: "Dashboard users cannot create dashboards." });
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

 WHERE id=$1 AND archived_at IS NULL
 AND (user_id=$2 OR EXISTS (
   SELECT 1 FROM dashboard_members dm
    WHERE dm.dashboard_id=dashboards.id AND dm.user_id=$2 AND dm.is_active=TRUE
 ))`,

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

  // V6: change the current user's password. Passwords are always stored as scrypt hashes.
  app.post(
    "/api/v5/account/change-password",
    requireUser,
    asyncRoute(async (req, res) => {
      const db = requireDb();
      const current = String(req.body?.currentPassword || "");
      const next = validatePassword(req.body?.newPassword);
      const row = (
        await db.query("SELECT password_hash FROM users WHERE id=$1", [
          req.v5UserId,
        ])
      ).rows[0];
      if (!row || !checkPassword(current, row.password_hash)) {
        return res
          .status(400)
          .json({ error: "Current password is incorrect." });
      }
      if (current === next) {
        return res.status(400).json({
          error: "New password must be different from the current password.",
        });
      }
      await db.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
        hashPassword(next),
        req.v5UserId,
      ]);
      res.json({
        success: true,
        message: "Password changed. Please log in again.",
      });
    }),
  );

  // V6: owner can create up to two regular users per dashboard.
  app.get(
    "/api/v5/dashboards/:dashboardId/members",
    requireUser,
    asyncRoute(async (req, res) => {
      const db = requireDb();
      const dashboard = (
        await db.query(
          "SELECT id FROM dashboards WHERE id=$1 AND user_id=$2 AND archived_at IS NULL",
          [req.params.dashboardId, req.v5UserId],
        )
      ).rows[0];
      if (!dashboard)
        return res
          .status(403)
          .json({ error: "Only the owner can manage dashboard users." });
      const members = (
        await db.query(
          `SELECT u.id,u.username,dm.is_active,dm.created_at
         FROM dashboard_members dm JOIN users u ON u.id=dm.user_id
        WHERE dm.dashboard_id=$1 ORDER BY dm.created_at`,
          [dashboard.id],
        )
      ).rows;
      res.json({
        members,
        limit: 2,
        remaining: Math.max(0, 2 - members.length),
      });
    }),
  );

  app.post(
    "/api/v5/dashboards/:dashboardId/members",
    requireUser,
    asyncRoute(async (req, res) => {
      const db = requireDb();
      const dashboardId = req.params.dashboardId;
      const username = normalizeUsername(req.body?.username);
      const password = validatePassword(req.body?.password);
      const owner = (
        await db.query(
          "SELECT id FROM dashboards WHERE id=$1 AND user_id=$2 AND archived_at IS NULL",
          [dashboardId, req.v5UserId],
        )
      ).rows[0];
      if (!owner)
        return res
          .status(403)
          .json({ error: "Only the owner can add dashboard users." });
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          `SPYA-V6-MEMBERS:${dashboardId}`,
        ]);
        const count = Number(
          (
            await client.query(
              "SELECT COUNT(*)::int AS count FROM dashboard_members WHERE dashboard_id=$1 AND is_active=TRUE",
              [dashboardId],
            )
          ).rows[0].count,
        );
        if (count >= 2) {
          await client.query("ROLLBACK");
          return res.status(409).json({
            error: "A dashboard can have a maximum of two regular users.",
          });
        }
        let user = (
          await client.query(
            "SELECT id,username FROM users WHERE LOWER(username)=LOWER($1)",
            [username],
          )
        ).rows[0];
        if (user) {
          await client.query("ROLLBACK");
          return res.status(409).json({
            error: "That User ID already exists. Choose a unique User ID.",
          });
        }
        user = (
          await client.query(
            "INSERT INTO users(username,password_hash) VALUES($1,$2) RETURNING id,username",
            [username, hashPassword(password)],
          )
        ).rows[0];
        await client.query(
          "INSERT INTO dashboard_members(dashboard_id,user_id,role,is_active) VALUES($1,$2,'user',TRUE)",
          [dashboardId, user.id],
        );
        await client.query("COMMIT");
        res.status(201).json({ success: true, member: user });
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    }),
  );

  app.post(
    "/api/v5/dashboards/:dashboardId/members/:userId/reset-password",
    requireUser,
    asyncRoute(async (req, res) => {
      const db = requireDb();
      const owner = (
        await db.query(
          "SELECT id FROM dashboards WHERE id=$1 AND user_id=$2 AND archived_at IS NULL",
          [req.params.dashboardId, req.v5UserId],
        )
      ).rows[0];
      if (!owner)
        return res.status(403).json({
          error: "Only the owner can reset dashboard-user passwords.",
        });
      const password = validatePassword(req.body?.password);
      const member = (
        await db.query(
          "SELECT user_id FROM dashboard_members WHERE dashboard_id=$1 AND user_id=$2",
          [req.params.dashboardId, req.params.userId],
        )
      ).rows[0];
      if (!member)
        return res.status(404).json({ error: "Dashboard user not found." });
      await db.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
        hashPassword(password),
        member.user_id,
      ]);
      res.json({ success: true, message: "Dashboard-user password reset." });
    }),
  );

  // ADMIN INVENTORY / TOKEN GENERATION REPORT
  // Only authenticated admins can access this endpoint.
  app.get(
    "/api/v5/admin/dashboards/:dashboardId/inventory",
    requireOwner,
    asyncRoute(async (req, res) => {
      const db = requireDb();
      const dashboardId = req.params.dashboardId;
      const dashboard = (
        await db.query(
          `SELECT id,association_name,user_id
             FROM dashboards
            WHERE id=$1 AND user_id=$2 AND archived_at IS NULL
            LIMIT 1`,
          [dashboardId, req.v5AdminUserId],
        )
      ).rows[0];

      if (!dashboard) {
        return res.status(404).json({ error: "Dashboard not found." });
      }

      const summaryResult = await db.query(
        `SELECT
           COUNT(DISTINCT COALESCE(r.registration_group_id::text,r.id::text))::int AS registrations,
           COALESCE(SUM(CASE WHEN r.status <> 'Cancelled' THEN r.quantity ELSE 0 END),0)::int AS active_tokens,
           COALESCE(SUM(r.quantity),0)::int AS tokens_ever_generated,
           COALESCE(SUM(CASE WHEN r.status = 'Cancelled' THEN r.quantity ELSE 0 END),0)::int AS cancelled_tokens,
           COUNT(*)::int AS registration_rows
         FROM registrations r
        WHERE r.dashboard_id=$1`,
        [dashboardId],
      );

      const byUserResult = await db.query(
        `SELECT
           u.id AS user_id,
           u.username,
           COUNT(r.id)::int AS registration_rows,
           COUNT(DISTINCT COALESCE(r.registration_group_id::text,r.id::text))::int AS registrations,
           COALESCE(SUM(r.quantity),0)::int AS tokens_ever_generated,
           COALESCE(SUM(CASE WHEN r.status <> 'Cancelled' THEN r.quantity ELSE 0 END),0)::int AS active_tokens,
           COALESCE(SUM(CASE WHEN r.status = 'Cancelled' THEN r.quantity ELSE 0 END),0)::int AS cancelled_tokens,
           COALESCE(SUM(CASE WHEN r.status = 'Complete' THEN r.amount ELSE 0 END),0)::numeric AS amount_received
         FROM users u
         LEFT JOIN registrations r
           ON r.created_by_user_id=u.id AND r.dashboard_id=$1
        WHERE u.id=$2
           OR EXISTS (
             SELECT 1 FROM dashboard_members dm
              WHERE dm.dashboard_id=$1 AND dm.user_id=u.id AND dm.is_active=TRUE
           )
        GROUP BY u.id,u.username
        ORDER BY CASE WHEN u.id=$2 THEN 0 ELSE 1 END,u.username`,
        [dashboardId, req.v5AdminUserId],
      );

      const actionStatusResult = await db.query(
        `SELECT
           COALESCE(NULLIF(TRIM(r.status),''),'Unknown') AS status,
           COUNT(DISTINCT COALESCE(r.registration_group_id::text,r.id::text))::int AS registrations,
           COALESCE(SUM(r.quantity),0)::int AS token_count,
           COALESCE(SUM(r.amount),0)::numeric AS total_amount
         FROM registrations r
         WHERE r.dashboard_id=$1
         GROUP BY COALESCE(NULLIF(TRIM(r.status),''),'Unknown')
         ORDER BY CASE COALESCE(NULLIF(TRIM(r.status),''),'Unknown')
           WHEN 'Complete' THEN 1
           WHEN 'Payment Not Received' THEN 2
           WHEN 'Cancelled' THEN 3
           ELSE 4 END, status`,
        [dashboardId],
      );

      const statusDetailsResult = await db.query(
        `SELECT
           r.id,
           r.order_number,
           r.registration_group_id,
           c.name AS category_name,
           c.prefix,
           r.quantity,
           r.token_start,
           r.token_end,
           r.customer_name,
           r.customer_phone,
           r.customer_email,
           r.payment_mode,
           r.amount,
           COALESCE(NULLIF(TRIM(r.status),''),'Unknown') AS status,
           r.created_at,
           u.username AS created_by
         FROM registrations r
         LEFT JOIN token_categories c ON c.id=r.category_id
         LEFT JOIN users u ON u.id=r.created_by_user_id
         WHERE r.dashboard_id=$1
         ORDER BY r.created_at DESC, r.order_number DESC`,
        [dashboardId],
      );

      const categoryResult = await db.query(
        `SELECT
           c.id AS category_id,
           c.name AS category_name,
           c.prefix,
           c.price,
           COALESCE(SUM(r.quantity),0)::int AS tokens_ever_generated,
           COALESCE(SUM(CASE WHEN r.status <> 'Cancelled' THEN r.quantity ELSE 0 END),0)::int AS active_tokens,
           COALESCE(SUM(CASE WHEN r.status = 'Cancelled' THEN r.quantity ELSE 0 END),0)::int AS cancelled_tokens
         FROM token_categories c
         LEFT JOIN registrations r ON r.category_id=c.id AND r.dashboard_id=c.dashboard_id
        WHERE c.dashboard_id=$1
        GROUP BY c.id,c.name,c.prefix,c.price,c.created_at
        ORDER BY c.created_at`,
        [dashboardId],
      );

      res.json({
        success: true,
        dashboard: {
          id: dashboard.id,
          association_name: dashboard.association_name,
        },
        summary: summaryResult.rows[0] || {},
        actionStatuses: actionStatusResult.rows,
        statusDetails: statusDetailsResult.rows,
        byUser: byUserResult.rows.map((row) => ({
          ...row,
          isAdmin: String(row.user_id) === String(req.v5AdminUserId),
        })),
        byCategory: categoryResult.rows,
      });
    }),
  );

  // Dashboard users log in with their assigned dashboard's User ID and password.
  app.post(
    "/api/v5/auth/dashboard-login",
    asyncRoute(async (req, res) => {
      const db = requireDb();
      const username = normalizeUsername(req.body?.username);
      const password = String(req.body?.password || "");
      const dashboardId = String(req.body?.dashboardId || "");
      const user = (
        await db.query(
          "SELECT id,username,password_hash,created_at FROM users WHERE LOWER(username)=LOWER($1) LIMIT 1",
          [username],
        )
      ).rows[0];
      if (!user || !checkPassword(password, user.password_hash)) {
        return res.status(401).json({ error: "Invalid User ID or password." });
      }
      const membership = (
        await db.query(
          `SELECT d.id,d.association_name FROM dashboard_members dm
         JOIN dashboards d ON d.id=dm.dashboard_id
        WHERE dm.user_id=$1 AND dm.dashboard_id=$2 AND dm.is_active=TRUE AND d.archived_at IS NULL`,
          [user.id, dashboardId],
        )
      ).rows[0];
      if (!membership)
        return res
          .status(403)
          .json({ error: "This user is not assigned to that dashboard." });
      res.json({
        success: true,
        token: token({
          type: "user",
          role: "user",
          sub: user.id,
          dashboardId,
          exp: Date.now() + USER_TOKEN_TTL_MS,
        }),
        user: {
          id: user.id,
          username: user.username,
          created_at: user.created_at,
          role: "user",
          dashboardId,
        },
        dashboards: [membership],
        hasAdmin: false,
        adminUsername: null,
        dashboardLimit: 0,
      });
    }),
  );
};
