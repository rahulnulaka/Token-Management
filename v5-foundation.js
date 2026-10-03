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
  if (!pool) {
    throw Object.assign(
      new Error("PostgreSQL is not configured. Set DATABASE_URL."),
      { statusCode: 503 },
    );
  }

  return pool;
}

/* =========================================================
   AUTH TOKEN
========================================================= */

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

    if (!encoded || !signature) {
      return null;
    }

    const expected = crypto
      .createHmac("sha256", V5_AUTH_SECRET)
      .update(encoded)
      .digest("base64url");

    const a = Buffer.from(signature);
    const b = Buffer.from(expected);

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    );

    return payload.exp > Date.now() ? payload : null;
  } catch (_) {
    return null;
  }
}

function bearer(req) {
  const header = String(req.headers.authorization || "");

  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function requireUser(req, res, next) {
  const payload = verifyToken(bearer(req));

  if (!payload || payload.type !== "user") {
    return res.status(401).json({
      error: "V5 authentication required.",
    });
  }

  req.v5UserId = payload.sub;

  next();
}

function requireAdmin(req, res, next) {
  const payload = verifyToken(bearer(req));

  if (!payload || payload.type !== "admin") {
    return res.status(401).json({
      error: "V5 admin authentication required.",
    });
  }

  req.v5AdminUserId = payload.sub;
  req.v5AdminId = payload.adminId;

  next();
}

/* =========================================================
   PASSWORD / OTP HELPERS
========================================================= */

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

    if (!salt || !expected) {
      return false;
    }

    const actual = crypto.scryptSync(password, salt, 64).toString("hex");

    const a = Buffer.from(actual, "hex");
    const b = Buffer.from(expected, "hex");

    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (_) {
    return false;
  }
}

/* =========================================================
   CONTACT VALIDATION
========================================================= */

function contact(channel, value) {
  const v = String(value || "").trim();

  if (channel === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      throw Object.assign(new Error("Enter a valid email address."), {
        statusCode: 400,
      });
    }

    return v.toLowerCase();
  }

  if (!/^\+?[\d\s\-()]{7,15}$/.test(v)) {
    throw Object.assign(new Error("Enter a valid phone number."), {
      statusCode: 400,
    });
  }

  return v.replace(/[\s()-]/g, "");
}

/* =========================================================
   OTP DELIVERY
========================================================= */

async function sendOtp(channel, destination, otp) {
  /* -------------------------
     EMAIL
  ------------------------- */

  if (channel === "email") {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.OTP_FROM_EMAIL;

    if (!key || !from) {
      if (process.env.NODE_ENV !== "production") {
        console.log(`[V5 DEV OTP] ${destination}: ${otp}`);

        return;
      }

      throw new Error(
        "Email OTP is not configured. Set RESEND_API_KEY and OTP_FROM_EMAIL.",
      );
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",

      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        from,
        to: [destination],
        subject: "SVARA verification code",
        text: `Your SVARA verification code is ${otp}. It expires in 10 minutes.`,
      }),
    });

    if (!response.ok) {
      throw new Error("Unable to send email OTP.");
    }

    return;
  }

  /* -------------------------
     SMS
  ------------------------- */

  const authkey = process.env.MSG91_AUTH_KEY;

  const templateId = process.env.MSG91_TEMPLATE_ID;

  if (!authkey || !templateId) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[V5 DEV OTP] SMS ${destination}: ${otp}`);

      return;
    }

    throw new Error(
      "SMS OTP is not configured. Use email OTP or configure MSG91.",
    );
  }

  const response = await fetch("https://control.msg91.com/api/v5/otp", {
    method: "POST",

    headers: {
      authkey,
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      template_id: templateId,
      mobile: destination,
      otp,
    }),
  });

  if (!response.ok) {
    throw new Error("Unable to send SMS OTP.");
  }
}

/* =========================================================
   V5 ROUTES
========================================================= */

module.exports = function registerV5(app) {
  /* =======================================================
     REQUEST OTP
  ======================================================= */

  app.post("/api/v5/auth/request-otp", async (req, res, next) => {
    try {
      const db = requireDb();

      const channel = String(req.body?.channel || "").toLowerCase();

      if (!["email", "phone"].includes(channel)) {
        return res.status(400).json({
          error: "Channel must be email or phone.",
        });
      }

      const value = contact(channel, req.body?.contact);

      const recent = await db.query(
        `
              SELECT created_at
              FROM otp_challenges
              WHERE channel=$1
                AND contact=$2
              ORDER BY created_at DESC
              LIMIT 1
            `,
        [channel, value],
      );

      if (
        recent.rows[0] &&
        Date.now() - new Date(recent.rows[0].created_at).getTime() <
          OTP_RESEND_SECONDS * 1000
      ) {
        return res.status(429).json({
          error: `Please wait ${OTP_RESEND_SECONDS} seconds before requesting another OTP.`,
        });
      }

      const otp = generateOtp();

      await db.query(
        `
            INSERT INTO otp_challenges
            (
              channel,
              contact,
              otp_hash,
              expires_at,
              attempts
            )
            VALUES
            ($1,$2,$3,$4,0)
          `,
        [channel, value, otpHash(otp), new Date(Date.now() + OTP_TTL_MS)],
      );

      await sendOtp(channel, value, otp);

      res.json({
        success: true,
        message: `OTP sent to your ${channel}.`,
        expiresInSeconds: 600,
      });
    } catch (error) {
      next(error);
    }
  });

  /* =======================================================
     VERIFY OTP
  ======================================================= */

  app.post("/api/v5/auth/verify-otp", async (req, res, next) => {
    try {
      const db = requireDb();

      const channel = String(req.body?.channel || "").toLowerCase();

      if (!["email", "phone"].includes(channel)) {
        return res.status(400).json({
          error: "Channel must be email or phone.",
        });
      }

      const value = contact(channel, req.body?.contact);

      const otp = String(req.body?.otp || "").trim();

      if (!/^\d{6}$/.test(otp)) {
        return res.status(400).json({
          error: "Enter the 6-digit OTP.",
        });
      }

      const result = await db.query(
        `
              SELECT *
              FROM otp_challenges
              WHERE channel=$1
                AND contact=$2
                AND verified_at IS NULL
              ORDER BY created_at DESC
              LIMIT 1
            `,
        [channel, value],
      );

      const challenge = result.rows[0];

      if (!challenge) {
        return res.status(401).json({
          error: "OTP not found. Please request a new OTP.",
        });
      }

      if (new Date(challenge.expires_at).getTime() <= Date.now()) {
        return res.status(401).json({
          error: "OTP expired. Please request a new OTP.",
        });
      }

      if (Number(challenge.attempts) >= OTP_MAX_ATTEMPTS) {
        return res.status(429).json({
          error: "Too many OTP attempts. Please request a new OTP.",
        });
      }

      await db.query(
        `
            UPDATE otp_challenges
            SET attempts=attempts+1
            WHERE id=$1
          `,
        [challenge.id],
      );

      if (otpHash(otp) !== challenge.otp_hash) {
        return res.status(401).json({
          error: "Invalid OTP.",
        });
      }

      await db.query(
        `
            UPDATE otp_challenges
            SET verified_at=NOW()
            WHERE id=$1
          `,
        [challenge.id],
      );

      let user = (
        await db.query(
          `
              SELECT *
              FROM users
              WHERE email=$1
                 OR phone=$2
              LIMIT 1
            `,
          [
            channel === "email" ? value : null,

            channel === "phone" ? value : null,
          ],
        )
      ).rows[0];

      /* Create user */

      if (!user) {
        user = (
          await db.query(
            `
                INSERT INTO users
                (
                  email,
                  phone
                )
                VALUES
                ($1,$2)
                RETURNING *
              `,
            [
              channel === "email" ? value : null,

              channel === "phone" ? value : null,
            ],
          )
        ).rows[0];
      } else if (channel === "email" && !user.email) {

      /* Add email to existing user */
        user = (
          await db.query(
            `
                UPDATE users
                SET
                  email=$1,
                  updated_at=NOW()
                WHERE id=$2
                RETURNING *
              `,
            [value, user.id],
          )
        ).rows[0];
      } else if (channel === "phone" && !user.phone) {

      /* Add phone to existing user */
        user = (
          await db.query(
            `
                UPDATE users
                SET
                  phone=$1,
                  updated_at=NOW()
                WHERE id=$2
                RETURNING *
              `,
            [value, user.id],
          )
        ).rows[0];
      }

      const dashboards = (
        await db.query(
          `
                SELECT
                  id,
                  association_name
                FROM dashboards
                WHERE user_id=$1
                  AND archived_at IS NULL
                ORDER BY created_at
              `,
          [user.id],
        )
      ).rows;

      const admin = (
        await db.query(
          `
                SELECT username
                FROM admin_accounts
                WHERE user_id=$1
                LIMIT 1
              `,
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

        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
        },

        hasAdmin: !!admin,

        adminUsername: admin?.username || null,

        dashboards,

        dashboardLimit: MAX_DASHBOARDS_PER_USER,
      });
    } catch (error) {
      next(error);
    }
  });

  /* =======================================================
     CURRENT USER
  ======================================================= */

  app.get("/api/v5/me", requireUser, async (req, res, next) => {
    try {
      const db = requireDb();

      const user = (
        await db.query(
          `
                SELECT
                  id,
                  email,
                  phone,
                  created_at
                FROM users
                WHERE id=$1
              `,
          [req.v5UserId],
        )
      ).rows[0];

      if (!user) {
        return res.status(404).json({
          error: "User not found.",
        });
      }

      const dashboards = (
        await db.query(
          `
                SELECT
                  id,
                  association_name,
                  contact_phone,
                  contact_email,
                  address,
                  description,
                  created_at
                FROM dashboards
                WHERE user_id=$1
                  AND archived_at IS NULL
                ORDER BY created_at
              `,
          [req.v5UserId],
        )
      ).rows;

      const admin = (
        await db.query(
          `
                SELECT username
                FROM admin_accounts
                WHERE user_id=$1
                LIMIT 1
              `,
          [req.v5UserId],
        )
      ).rows[0];

      res.json({
        user,
        dashboards,
        adminUsername: admin?.username || null,
        dashboardLimit: MAX_DASHBOARDS_PER_USER,
      });
    } catch (error) {
      next(error);
    }
  });

  /* =======================================================
     CREATE ADMIN CREDENTIALS
  ======================================================= */

  app.post("/api/v5/admin/credentials", requireUser, async (req, res, next) => {
    try {
      const db = requireDb();

      const username = String(req.body?.username || "").trim();

      const password = String(req.body?.password || "");

      if (!/^[A-Za-z0-9_.-]{4,40}$/.test(username)) {
        return res.status(400).json({
          error: "Admin username must be 4-40 characters.",
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          error: "Admin password must be at least 8 characters.",
        });
      }

      const existing = (
        await db.query(
          `
                SELECT id
                FROM admin_accounts
                WHERE user_id=$1
              `,
          [req.v5UserId],
        )
      ).rows[0];

      if (existing) {
        return res.status(409).json({
          error: "Admin credentials already exist.",
        });
      }

      const usernameExists = (
        await db.query(
          `
                SELECT id
                FROM admin_accounts
                WHERE username=$1
              `,
          [username],
        )
      ).rows[0];

      if (usernameExists) {
        return res.status(409).json({
          error: "That admin username is already in use.",
        });
      }

      const admin = (
        await db.query(
          `
                INSERT INTO admin_accounts
                (
                  user_id,
                  username,
                  password_hash
                )
                VALUES
                ($1,$2,$3)
                RETURNING id,username
              `,
          [req.v5UserId, username, hashPassword(password)],
        )
      ).rows[0];

      res.status(201).json({
        success: true,
        admin,
      });
    } catch (error) {
      next(error);
    }
  });

  /* =======================================================
     ADMIN LOGIN
  ======================================================= */

  app.post("/api/v5/admin/login", async (req, res, next) => {
    try {
      const db = requireDb();

      const username = String(req.body?.username || "").trim();

      const password = String(req.body?.password || "");

      const admin = (
        await db.query(
          `
                SELECT
                  id,
                  user_id,
                  username,
                  password_hash
                FROM admin_accounts
                WHERE username=$1
                LIMIT 1
              `,
          [username],
        )
      ).rows[0];

      if (!admin || !checkPassword(password, admin.password_hash)) {
        return res.status(401).json({
          error: "Invalid admin credentials.",
        });
      }

      const dashboards = (
        await db.query(
          `
                SELECT
                  id,
                  association_name
                FROM dashboards
                WHERE user_id=$1
                  AND archived_at IS NULL
                ORDER BY created_at
              `,
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
    } catch (error) {
      next(error);
    }
  });

  /* =======================================================
     LIST DASHBOARDS
  ======================================================= */

  app.get("/api/v5/dashboards", requireUser, async (req, res, next) => {
    try {
      const db = requireDb();

      const rows = (
        await db.query(
          `
                SELECT
                  id,
                  association_name,
                  contact_phone,
                  contact_email,
                  address,
                  description,
                  created_at
                FROM dashboards
                WHERE user_id=$1
                  AND archived_at IS NULL
                ORDER BY created_at
              `,
          [req.v5UserId],
        )
      ).rows;

      res.json({
        dashboards: rows,

        limit: MAX_DASHBOARDS_PER_USER,

        remaining: MAX_DASHBOARDS_PER_USER - rows.length,
      });
    } catch (error) {
      next(error);
    }
  });

  /* =======================================================
     CREATE DASHBOARD
  ======================================================= */

  app.post("/api/v5/dashboards", requireUser, async (req, res, next) => {
    const db = requireDb();
    const client = await db.connect();

    try {
      const count = (
        await client.query(
          `
                SELECT
                  COUNT(*)::int AS count
                FROM dashboards
                WHERE user_id=$1
                  AND archived_at IS NULL
              `,
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
        return res.status(400).json({
          error: "Association name is required.",
        });
      }

      if (!categories.length) {
        return res.status(400).json({
          error: "Add at least one token category.",
        });
      }

      await client.query("BEGIN");

      const dashboard = (
        await client.query(
          `
                INSERT INTO dashboards
                (
                  user_id,
                  association_name,
                  contact_phone,
                  contact_email,
                  address,
                  description
                )
                VALUES
                ($1,$2,$3,$4,$5,$6)
                RETURNING *
              `,
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

      for (const category of categories) {
        const name = String(category?.name || "").trim();

        const prefix = String(category?.prefix || "")
          .trim()
          .toUpperCase();

        const price = Number(category?.price);

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
          `
              INSERT INTO token_categories
              (
                dashboard_id,
                name,
                prefix,
                price,
                active
              )
              VALUES
              ($1,$2,$3,$4,true)
            `,
          [dashboard.id, name, prefix, price],
        );
      }

      await client.query("COMMIT");

      const cats = (
        await db.query(
          `
                SELECT
                  id,
                  name,
                  prefix,
                  price,
                  active
                FROM token_categories
                WHERE dashboard_id=$1
                ORDER BY created_at
              `,
          [dashboard.id],
        )
      ).rows;

      res.status(201).json({
        success: true,

        dashboard: {
          ...dashboard,
          categories: cats,
        },
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});

      next(error);
    } finally {
      client.release();
    }
  });

  /* =======================================================
     GET ONE DASHBOARD
  ======================================================= */

  app.get(
    "/api/v5/dashboards/:dashboardId",
    requireUser,
    async (req, res, next) => {
      try {
        const db = requireDb();

        const dashboard = (
          await db.query(
            `
                SELECT *
                FROM dashboards
                WHERE id=$1
                  AND user_id=$2
                  AND archived_at IS NULL
              `,
            [req.params.dashboardId, req.v5UserId],
          )
        ).rows[0];

        if (!dashboard) {
          return res.status(404).json({
            error: "Dashboard not found.",
          });
        }

        const categories = (
          await db.query(
            `
                SELECT
                  id,
                  name,
                  prefix,
                  price,
                  active,
                  created_at,
                  updated_at
                FROM token_categories
                WHERE dashboard_id=$1
                ORDER BY created_at
              `,
            [dashboard.id],
          )
        ).rows;

        res.json({
          dashboard,
          categories,
        });
      } catch (error) {
        next(error);
      }
    },
  );
};
