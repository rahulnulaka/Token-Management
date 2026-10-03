const crypto = require("crypto");
const { Pool } = require("pg");

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_SECONDS = 60;
const MAX_DASHBOARDS_PER_USER = 2;
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
  if (!pool)
    throw Object.assign(
      new Error("PostgreSQL is not configured. Set DATABASE_URL."),
      { statusCode: 503 },
    );
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
    const a = Buffer.from(signature),
      b = Buffer.from(expected);
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

function otpHash(otp) {
  return crypto
    .createHash("sha256")
    .update(`${otp}:${V5_AUTH_SECRET}`)
    .digest("hex");
}
function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}
function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}
function checkPassword(password, stored) {
  try {
    const [salt, expected] = String(stored || "").split(":");
    if (!salt || !expected) return false;
    const actual = crypto.scryptSync(password, salt, 64).toString("hex");
    const a = Buffer.from(actual, "hex"),
      b = Buffer.from(expected, "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (_) {
    return false;
  }
}
function normalizeEmail(value) {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    throw Object.assign(new Error("Enter a valid email address."), {
      statusCode: 400,
    });
  }
  return v;
}

async function sendOtp(destination, otp) {
  const key = process.env.RESEND_API_KEY,
    from = process.env.OTP_FROM_EMAIL;
  if (!key || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[V5 DEV OTP] Email ${destination}: ${otp}`);
      return;
    }
    throw new Error(
      "Email OTP is not configured. Set RESEND_API_KEY and OTP_FROM_EMAIL.",
    );
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [destination],
      subject: "SPYA verification code",
      text: `Your SPYA verification code is ${otp}. It expires in 10 minutes.`,
    }),
  });
  if (!r.ok) throw new Error("Unable to send email OTP.");
}

module.exports = function registerV5(app) {
  app.post("/api/v5/auth/request-otp", async (req, res, next) => {
    try {
      const db = requireDb();
      const email = normalizeEmail(req.body?.email);
      const recent = await db.query(
        `SELECT created_at FROM otp_challenges WHERE email=$1 ORDER BY created_at DESC LIMIT 1`,
        [email],
      );
      if (
        recent.rows[0] &&
        Date.now() - new Date(recent.rows[0].created_at).getTime() <
          OTP_RESEND_SECONDS * 1000
      )
        return res
          .status(429)
          .json({
            error: `Please wait ${OTP_RESEND_SECONDS} seconds before requesting another OTP.`,
          });
      const otp = generateOtp();
      await db.query(
        `INSERT INTO otp_challenges(email,otp_hash,expires_at,attempts) VALUES($1,$2,$3,0)`,
        [email, otpHash(otp), new Date(Date.now() + OTP_TTL_MS)],
      );
      await sendOtp(email, otp);
      res.json({
        success: true,
        message: "OTP sent to your email.",
        expiresInSeconds: 600,
      });
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/v5/auth/verify-otp", async (req, res, next) => {
    try {
      const db = requireDb();
      const email = normalizeEmail(req.body?.email);
      const otp = String(req.body?.otp || "").trim();
      if (!/^\d{6}$/.test(otp))
        return res.status(400).json({ error: "Enter the 6-digit OTP." });
      const q = await db.query(
        `SELECT * FROM otp_challenges WHERE email=$1 AND verified_at IS NULL ORDER BY created_at DESC LIMIT 1`,
        [email],
      );
      const challenge = q.rows[0];
      if (!challenge)
        return res
          .status(401)
          .json({ error: "OTP not found. Please request a new OTP." });
      if (new Date(challenge.expires_at).getTime() <= Date.now())
        return res
          .status(401)
          .json({ error: "OTP expired. Please request a new OTP." });
      if (Number(challenge.attempts) >= OTP_MAX_ATTEMPTS)
        return res
          .status(429)
          .json({ error: "Too many OTP attempts. Please request a new OTP." });
      await db.query(
        `UPDATE otp_challenges SET attempts=attempts+1 WHERE id=$1`,
        [challenge.id],
      );
      if (otpHash(otp) !== challenge.otp_hash)
        return res.status(401).json({ error: "Invalid OTP." });
      await db.query(
        `UPDATE otp_challenges SET verified_at=NOW() WHERE id=$1`,
        [challenge.id],
      );
      let user = (
        await db.query(`SELECT * FROM users WHERE email=$1 LIMIT 1`, [email])
      ).rows[0];
      if (!user)
        user = (
          await db.query(`INSERT INTO users(email) VALUES($1) RETURNING *`, [
            email,
          ])
        ).rows[0];
      const dashboards = (
        await db.query(
          `SELECT id,association_name FROM dashboards WHERE user_id=$1 AND archived_at IS NULL ORDER BY created_at`,
          [user.id],
        )
      ).rows;
      const admin = (
        await db.query(
          `SELECT username FROM admin_accounts WHERE user_id=$1 LIMIT 1`,
          [user.id],
        )
      ).rows[0];
      res.json({
        success: true,
        token: token({
          type: "user",
          sub: user.id,
          exp: Date.now() + 7 * 86400000,
        }),
        user: { id: user.id, email: user.email },
        hasAdmin: !!admin,
        adminUsername: admin?.username || null,
        dashboards,
        dashboardLimit: MAX_DASHBOARDS_PER_USER,
      });
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/v5/me", requireUser, async (req, res, next) => {
    try {
      const db = requireDb();
      const user = (
        await db.query(`SELECT id,email,created_at FROM users WHERE id=$1`, [
          req.v5UserId,
        ])
      ).rows[0];
      if (!user) return res.status(404).json({ error: "User not found." });
      const dashboards = (
        await db.query(
          `SELECT id,association_name,contact_phone,contact_email,address,description,created_at FROM dashboards WHERE user_id=$1 AND archived_at IS NULL ORDER BY created_at`,
          [req.v5UserId],
        )
      ).rows;
      const admin = (
        await db.query(
          `SELECT username FROM admin_accounts WHERE user_id=$1 LIMIT 1`,
          [req.v5UserId],
        )
      ).rows[0];
      res.json({
        user,
        dashboards,
        adminUsername: admin?.username || null,
        dashboardLimit: MAX_DASHBOARDS_PER_USER,
      });
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/v5/admin/credentials", requireUser, async (req, res, next) => {
    try {
      const db = requireDb(),
        username = String(req.body?.username || "").trim(),
        password = String(req.body?.password || "");
      if (!/^[A-Za-z0-9_.-]{4,40}$/.test(username))
        return res
          .status(400)
          .json({ error: "Admin username must be 4-40 characters." });
      if (password.length < 8)
        return res
          .status(400)
          .json({ error: "Admin password must be at least 8 characters." });
      if (
        (
          await db.query(`SELECT id FROM admin_accounts WHERE user_id=$1`, [
            req.v5UserId,
          ])
        ).rows[0]
      )
        return res
          .status(409)
          .json({ error: "Admin credentials already exist." });
      if (
        (
          await db.query(`SELECT id FROM admin_accounts WHERE username=$1`, [
            username,
          ])
        ).rows[0]
      )
        return res
          .status(409)
          .json({ error: "That admin username is already in use." });
      const row = (
        await db.query(
          `INSERT INTO admin_accounts(user_id,username,password_hash) VALUES($1,$2,$3) RETURNING id,username`,
          [req.v5UserId, username, hashPassword(password)],
        )
      ).rows[0];
      res.status(201).json({ success: true, admin: row });
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/v5/admin/login", async (req, res, next) => {
    try {
      const db = requireDb(),
        username = String(req.body?.username || "").trim(),
        password = String(req.body?.password || "");
      const admin = (
        await db.query(
          `SELECT id,user_id,username,password_hash FROM admin_accounts WHERE username=$1 LIMIT 1`,
          [username],
        )
      ).rows[0];
      if (!admin || !checkPassword(password, admin.password_hash))
        return res.status(401).json({ error: "Invalid admin credentials." });
      const dashboards = (
        await db.query(
          `SELECT id,association_name FROM dashboards WHERE user_id=$1 AND archived_at IS NULL ORDER BY created_at`,
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
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/v5/dashboards", requireUser, async (req, res, next) => {
    try {
      const db = requireDb(),
        rows = (
          await db.query(
            `SELECT id,association_name,contact_phone,contact_email,address,description,created_at FROM dashboards WHERE user_id=$1 AND archived_at IS NULL ORDER BY created_at`,
            [req.v5UserId],
          )
        ).rows;
      res.json({
        dashboards: rows,
        limit: MAX_DASHBOARDS_PER_USER,
        remaining: MAX_DASHBOARDS_PER_USER - rows.length,
      });
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/v5/dashboards", requireUser, async (req, res, next) => {
    const db = requireDb();
    const client = await db.connect();
    try {
      const count = (
        await client.query(
          `SELECT COUNT(*)::int AS count FROM dashboards WHERE user_id=$1 AND archived_at IS NULL`,
          [req.v5UserId],
        )
      ).rows[0].count;
      if (Number(count) >= MAX_DASHBOARDS_PER_USER)
        return res
          .status(409)
          .json({
            error: `You can create a maximum of ${MAX_DASHBOARDS_PER_USER} dashboards.`,
          });
      const associationName = String(req.body?.associationName || "").trim();
      const categories = Array.isArray(req.body?.categories)
        ? req.body.categories
        : [];
      if (!associationName)
        return res.status(400).json({ error: "Association name is required." });
      if (!categories.length)
        return res
          .status(400)
          .json({ error: "Add at least one token category." });
      await client.query("BEGIN");
      const dashboard = (
        await client.query(
          `INSERT INTO dashboards(user_id,association_name,contact_phone,contact_email,address,description) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
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
        const name = String(c?.name || "").trim(),
          prefix = String(c?.prefix || "")
            .trim()
            .toUpperCase(),
          price = Number(c?.price);
        if (!name || !prefix || !Number.isFinite(price) || price < 0)
          throw Object.assign(
            new Error("Each category needs a name, prefix and valid price."),
            { statusCode: 400 },
          );
        if (seen.has(name.toLowerCase()))
          throw Object.assign(new Error(`Duplicate category: ${name}`), {
            statusCode: 400,
          });
        seen.add(name.toLowerCase());
        await client.query(
          `INSERT INTO token_categories(dashboard_id,name,prefix,price,active) VALUES($1,$2,$3,$4,true)`,
          [dashboard.id, name, prefix, price],
        );
      }
      await client.query("COMMIT");
      const cats = (
        await db.query(
          `SELECT id,name,prefix,price,active FROM token_categories WHERE dashboard_id=$1 ORDER BY created_at`,
          [dashboard.id],
        )
      ).rows;
      res
        .status(201)
        .json({ success: true, dashboard: { ...dashboard, categories: cats } });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      next(e);
    } finally {
      client.release();
    }
  });

  app.get(
    "/api/v5/dashboards/:dashboardId",
    requireUser,
    async (req, res, next) => {
      try {
        const db = requireDb();
        const dashboard = (
          await db.query(
            `SELECT * FROM dashboards WHERE id=$1 AND user_id=$2 AND archived_at IS NULL`,
            [req.params.dashboardId, req.v5UserId],
          )
        ).rows[0];
        if (!dashboard)
          return res.status(404).json({ error: "Dashboard not found." });
        const categories = (
          await db.query(
            `SELECT id,name,prefix,price,active,created_at,updated_at FROM token_categories WHERE dashboard_id=$1 ORDER BY created_at`,
            [dashboard.id],
          )
        ).rows;
        res.json({ dashboard, categories });
      } catch (e) {
        next(e);
      }
    },
  );
};
