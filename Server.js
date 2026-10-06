require("dotenv").config();

const express = require("express");

const cors = require("cors");

const XLSX = require("xlsx");

const fs = require("fs");

const path = require("path");

const crypto = require("crypto");

const { Pool } = require("pg");

/* =========================================================



   SPYA V5 - POSTGRESQL / MULTI-USER FOUNDATION



   The existing Excel routes remain available during migration.



   V5 routes are namespaced under /api/v5.



\========================================================= */

const DATABASE_URL = process.env.DATABASE_URL || "";

const V5_AUTH_SECRET =
  process.env.V5_AUTH_SECRET ||
  process.env.ADMIN_TOKEN_SECRET ||
  crypto.randomBytes(32).toString("hex");

const MAX_DASHBOARDS_PER_USER = 2;

const pgPool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl:
        process.env.DATABASE_SSL === "false"
          ? false
          : { rejectUnauthorized: false },
    })
  : null;

function requirePg() {
  if (!pgPool) {
    throw Object.assign(
      new Error("PostgreSQL is not configured. Set DATABASE_URL."),
      { statusCode: 503 },
    );
  }
  return pgPool;
}

function hashAdminPassword(
  password,

  salt = crypto.randomBytes(16).toString("hex"),
) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");

  return `${salt}:${hash}`;
}

function verifyAdminPassword(password, stored) {
  try {
    const [salt, expectedHex] = String(stored || "").split(":");

    if (!salt || !expectedHex) return false;

    const actual = crypto

      .scryptSync(String(password), salt, 64)

      .toString("hex");

    const a = Buffer.from(actual, "hex");

    const b = Buffer.from(expectedHex, "hex");

    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (_) {
    return false;
  }
}

function asyncRoute(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const app = express();

app.use(cors());

app.use(express.json());

// V5 PostgreSQL/auth/dashboard foundation. Legacy Excel routes remain below during migration.

require("./v5-foundation")(app);

/* =========================================================



   V5 DATABASE CONNECTION TEST



   Open http\://localhost:4000/api/v5/db-test while the



   backend is running to verify PostgreSQL connectivity.



\========================================================= */

app.get("/api/v5/db-test", async (req, res) => {
  try {
    if (!pgPool) {
      return res.status(503).json({
        success: false,

        error: "PostgreSQL is not configured. Check DATABASE_URL in .env.",
      });
    }

    const result = await pgPool.query("SELECT NOW() AS current_time");

    res.json({
      success: true,

      message: "PostgreSQL connection successful.",

      databaseTime: result.rows[0].current_time,
    });
  } catch (error) {
    console.error("[V5 DB TEST ERROR]", error);

    res.status(500).json({
      success: false,

      error: "Unable to connect to PostgreSQL.",

      details:
        process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
});

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const FILE_PATH = path.join(
  DATA_DIR,

  "registrations.xlsx",
);

const SHEET_NAME = "Registrations";

const HEADERS = [
  "Order ID",

  "Token Type",

  "Quantity",

  "Token Start",

  "Token End",

  "Name",

  "Email",

  "Phone",

  "Payment",

  "Amount",

  "Date",

  "Time",

  "Status",

  "Cancelled At",

  "Admin Notes",
];

const ALLOWED_TOKEN_TYPES = ["Bullet", "Saree", "Silver"];

const ALLOWED_STATUSES = ["Complete", "Payment Not Received", "Cancelled"];

const MAX_QUANTITY = 9999;

const TOKEN_PRICES = {
  Bullet: 301,

  Saree: 101,

  Silver: 201,
};

/* =========================================================















   STATUS















\========================================================= */

function normalizeStatus(value) {
  const status = String(value || "").trim();

  if (status === "Cancelled") {
    return "Cancelled";
  }

  if (status === "Payment Not Received") {
    return "Payment Not Received";
  } // V2 / legacy "Active" records become Complete.

  return "Complete";
}

/* =========================================================















   NORMALIZE EXCEL ROW















\========================================================= */

function normalizeRow(row = {}) {
  return {
    "Order ID": row["Order ID"] ?? row["Order Id"] ?? rowOrderID ?? "",

    "Token Type": row["Token Type"] ?? row["Token type"] ?? "",

    Quantity: Number(rowQuantity ?? 0),

    "Token Start": row["Token Start"] ?? "",

    "Token End": row["Token End"] ?? "",

    Name: rowName ?? "",

    Email: rowEmail ?? "",

    Phone: rowPhone ?? "",

    Payment: rowPayment ?? row["Payment Mode"] ?? "",

    Amount: Number(rowAmount ?? 0) || 0,

    Date: rowDate ?? "",

    Time: rowTime ?? "",

    Status: normalizeStatus(rowStatus),

    "Cancelled At": row["Cancelled At"] ?? "",

    "Admin Notes": row["Admin Notes"] ?? "",
  };
}

/* =========================================================















   CONVERT ROW → CLIENT ENTRY















\========================================================= */

function toClientEntry(row) {
  const r = normalizeRow(row);

  return {
    orderId: String(r["Order ID"] || ""),

    tokenType: String(r["Token Type"] || ""),

    quantity: Number(r.Quantity) || 0,

    tokenStart: String(r["Token Start"] || ""),

    tokenEnd: String(r["Token End"] || ""),

    name: String(r.Name || ""),

    email: String(r.Email || ""),

    phone: String(r.Phone || ""),

    payment: String(r.Payment || ""),

    amount: Number(r.Amount) || 0,

    date: String(r.Date || ""),

    time: String(r.Time || ""),

    status: normalizeStatus(r.Status),

    cancelledAt: String(r["Cancelled At"] || ""),

    adminNotes: String(r["Admin Notes"] || ""),
  };
}

/* =========================================================















   EXCEL LOCK CHECK















\========================================================= */

function isLockedFileError(err) {
  return !!(
    err &&
    (err.code === "EBUSY" ||
      err.code === "EACCES" ||
      err.code === "EPERM" ||
      /being used by another process|locked|permission denied/i.test(
        err.message || "",
      ))
  );
}

/* =========================================================















   EXCEL WRITE CHECK















\========================================================= */

function assertExcelIsWritable() {
  if (!fs.existsSync(FILE_PATH)) {
    return;
  }

  try {
    const fd = fs.openSync(FILE_PATH, "r+");

    fs.closeSync(fd);
  } catch (err) {
    if (isLockedFileError(err)) {
      throw Object.assign(
        new Error("Excel file is open. Please close it before continuing."),

        {
          statusCode: 409,

          code: err.code || "LOCKED",
        },
      );
    }

    throw err;
  }
}

/* =========================================================















   READ EXCEL















\========================================================= */

function readExcel() {
  if (!fs.existsSync(FILE_PATH)) {
    return [];
  }

  const workbook = XLSX.readFile(FILE_PATH);

  const sheet =
    workbook.Sheets[SHEET_NAME] || workbook.Sheets[workbook.SheetNames[0]];

  if (!sheet) {
    return [];
  }

  return XLSX.utils

    .sheet_to_json(sheet, {
      defval: "",
    })

    .map(normalizeRow);
}

/* =========================================================















   WRITE EXCEL















\========================================================= */

function writeExcel(rows) {
  assertExcelIsWritable();

  const normalized = rows.map(normalizeRow);

  const worksheet = XLSX.utils.json_to_sheet(
    normalized,

    {
      header: HEADERS,
    },
  );

  worksheet["!cols"] = [
    { wch: 14 },

    { wch: 14 },

    { wch: 10 },

    { wch: 14 },

    { wch: 14 },

    { wch: 24 },

    { wch: 30 },

    { wch: 18 },

    { wch: 18 },

    { wch: 12 },

    { wch: 14 },

    { wch: 12 },

    { wch: 24 },

    { wch: 24 },

    { wch: 35 },

    { wch: 18 },

    { wch: 28 },
  ];

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,

    worksheet,

    SHEET_NAME,
  );

  const tempPath = `${FILE_PATH}.tmp-${process.pid}-${Date.now()}`;

  try {
    XLSX.writeFile(
      workbook,

      tempPath,
    );

    fs.renameSync(
      tempPath,

      FILE_PATH,
    );
  } catch (err) {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch (_) {}

    if (isLockedFileError(err)) {
      throw Object.assign(
        new Error("Excel file is open. Please close it before continuing."),

        {
          statusCode: 409,

          code: err.code || "LOCKED",
        },
      );
    }

    throw err;
  }
}

/* =========================================================















   TOKEN HELPERS















\========================================================= */

function getTokenPrefix(tokenType) {
  if (tokenType === "Bullet") {
    return "BUL";
  }

  if (tokenType === "Saree") {
    return "SAR";
  }

  return "SLV";
}

function getSerialFromToken(token) {
  const match = String(token || "").match(/(\d+)$/);

  return match ? Number(match[1]) : 0;
}

function makeTokenId(
  tokenType,

  serial,
) {
  return `${getTokenPrefix(tokenType)}${String(serial).padStart(4, "0")}`;
}

/* =========================================================















   TOKEN ALLOCATION































   Cancelled tokens are NOT considered used.















   Therefore they can be reused.















\========================================================= */

function getNextTokenSerial(
  rows,

  tokenType,

  quantity,
) {
  const used = new Set();

  for (const raw of rows) {
    const row = normalizeRow(raw);

    if (row["Token Type"] !== tokenType || rowStatus === "Cancelled") {
      continue;
    }

    const start = getSerialFromToken(row["Token Start"]);

    const qty = Number(rowQuantity) || 0;

    if (start > 0 && qty > 0) {
      for (let i = 0; i < qty; i++) {
        used.add(start + i);
      }
    } else {
      const end = getSerialFromToken(row["Token End"]);

      if (start > 0 && end >= start) {
        for (let i = start; i <= end; i++) {
          used.add(i);
        }
      }
    }
  }

  let candidate = 1;

  while (true) {
    let free = true;

    for (let i = 0; i < quantity; i++) {
      if (used.has(candidate + i)) {
        free = false;

        break;
      }
    }

    if (free) {
      return candidate;
    }

    candidate++;
  }
}

/* =========================================================















   ORDER NUMBER















\========================================================= */

function getNextOrderNumber(rows) {
  let max = 0;

  for (const raw of rows) {
    const match = String(normalizeRow(raw)["Order ID"] || "").match(/(\d+)$/);

    if (match) {
      max = Math.max(
        max,

        Number(match[1]),
      );
    }
  }

  return max + 1;
}

/* =========================================================















   EXCEL ALLOCATION LOCK































   Prevents two users from receiving















   the same token/order.















\========================================================= */

let excelAllocationQueue = Promise.resolve();

function withExcelAllocationLock(work) {
  const run = excelAllocationQueue.then(
    work,

    work,
  );

  excelAllocationQueue = run.catch(() => {});

  return run;
}

/* =========================================================















   ADMIN AUTHENTICATION















\========================================================= */

const ADMIN_TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

const ADMIN_TOKEN_SECRET =
  process.env.ADMIN_TOKEN_SECRET ||
  crypto

    .createHash("sha256")

    .update(
      `${process.env.ADMIN_USERNAME || ""}:${process.env.ADMIN_PASSWORD || ""}:SPYA-V3`,
    )

    .digest("hex");

function base64url(value) {
  return Buffer.from(value)

    .toString("base64")

    .replace(/=/g, "")

    .replace(/\+/g, "-")

    .replace(/\//g, "_");
}

function signAdminPayload(payload) {
  const encoded = base64url(JSON.stringify(payload));

  const signature = crypto

    .createHmac(
      "sha256",

      ADMIN_TOKEN_SECRET,
    )

    .update(encoded)

    .digest("base64url");

  return `${encoded}.${signature}`;
}

function createAdminToken(username) {
  return signAdminPayload({
    sub: username,

    exp: Date.now() + ADMIN_TOKEN_TTL_MS,
  });
}

function verifyAdminToken(token) {
  try {
    const [encoded, signature] = String(token || "").split(".");

    if (!encoded || !signature) {
      return false;
    }

    const expected = crypto

      .createHmac(
        "sha256",

        ADMIN_TOKEN_SECRET,
      )

      .update(encoded)

      .digest("base64url");

    const a = Buffer.from(signature);

    const b = Buffer.from(expected);

    if (
      a.length !== b.length ||
      !crypto.timingSafeEqual(
        a,

        b,
      )
    ) {
      return false;
    }

    const payload = JSON.parse(
      Buffer.from(
        encoded,

        "base64url",
      )

        .toString("utf8"),
    );

    return (
      payload.sub === process.env.ADMIN_USERNAME &&
      Number(payload.exp) > Date.now()
    );
  } catch (_) {
    return false;
  }
}

function requireAdmin(
  req,

  res,

  next,
) {
  const header = String(req.headers.authorization || "");

  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!verifyAdminToken(token)) {
    return res

      .status(401)

      .json({
        error: "Admin authentication required.",
      });
  }

  next();
}

/* =========================================================















   GET PUBLIC ENTRIES















\========================================================= */

app.get(
  "/entries",

  (req, res) => {
    try {
      res.json(readExcel().map(toClientEntry));
    } catch (err) {
      console.error(
        "GET /entries error:",

        err.message,
      );

      res

        .status(500)

        .json({
          error: "Failed to read token entries.",
        });
    }
  },
);

/* =========================================================















   CREATE ORDER















\========================================================= */

async function createOrder(entry) {
  if (!entry || !ALLOWED_TOKEN_TYPES.includes(entry.tokenType)) {
    throw Object.assign(
      new Error(
        "Invalid token type. Allowed values are Bullet, Saree and Silver.",
      ),

      { statusCode: 400 },
    );
  }

  const quantity = Number(entry.quantity);

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    throw Object.assign(
      new Error(
        `Quantity must be a whole number between 1 and ${MAX_QUANTITY}.`,
      ),

      { statusCode: 400 },
    );
  }

  if (!String(entry.name || "").trim()) {
    throw Object.assign(
      new Error("Customer name is required."),

      { statusCode: 400 },
    );
  }

  const phone = String(entry.phone || "").trim();

  if (phone && !/^\+?[\d\s\-()]{7,15}$/.test(phone)) {
    throw Object.assign(
      new Error("Enter a valid phone number."),

      { statusCode: 400 },
    );
  }

  const amount = TOKEN_PRICES[entry.tokenType] * quantity;

  const newRow = await withExcelAllocationLock(() => {
    const rows = readExcel();

    const nextOrder = getNextOrderNumber(rows);

    const orderId = `ORD${String(nextOrder).padStart(4, "0")}`;

    const nextSerial = getNextTokenSerial(
      rows,

      entry.tokenType,

      quantity,
    );

    const now = new Date();

    const row = {
      "Order ID": orderId,

      "Token Type": entry.tokenType,

      Quantity: quantity,

      "Token Start": makeTokenId(
        entry.tokenType,

        nextSerial,
      ),

      "Token End": makeTokenId(
        entry.tokenType,

        nextSerial + quantity - 1,
      ),

      Name: String(entry.name).trim(),

      Email: String(entry.email || "").trim(),

      Phone: phone,

      Payment: String(entry.payment || ""),

      Amount: amount,

      Date: nowtoLocaleDateString("en-IN"),

      Time: nowtoLocaleTimeString(
        "en-IN",

        {
          hour: "2-digit",

          minute: "2-digit",
        },
      ),

      Status: "Complete",

      "Cancelled At": "",

      "Admin Notes": "",
    };

    rows.push(row);

    writeExcel(rows);

    return row;
  });

  return toClientEntry(newRow);
}

app.post(
  "/entries",

  async (req, res) => {
    try {
      const entry = await createOrder(req.body || {});

      res.json({
        success: true,

        entry,
      });
    } catch (err) {
      console.error(
        "POST /entries error:",

        err.message,
      );

      res

        .status(err.statusCode || 500)

        .json({
          error: err.message || "Failed to save token order.",
        });
    }
  },
);

/* =========================================================







   ADMIN CREATE ORDER







\========================================================= */

app.post(
  "/admin/entries",

  requireAdmin,

  async (req, res) => {
    try {
      const entry = await createOrder(req.body || {});

      res.json({
        success: true,

        entry,
      });
    } catch (err) {
      console.error(
        "POST /admin/entries error:",

        err.message,
      );

      res

        .status(err.statusCode || 500)

        .json({
          error: err.message || "Failed to create admin token.",
        });
    }
  },
);

/* =========================================================















   UPDATE STATUS































   Complete ↔ Payment Not Received































   Cancelled cannot be changed.















\========================================================= */

app.post(
  "/entries/:orderId/status",

  async (req, res) => {
    try {
      const orderId = String(req.params.orderId || "");

      const requested = String(req.body?.status || "").trim();

      if (!["Complete", "Payment Not Received"].includes(requested)) {
        return res

          .status(400)

          .json({
            error: "Status must be Complete or Payment Not Received.",
          });
      }

      const updated = await withExcelAllocationLock(() => {
        const rows = readExcel();

        const index = rows.findIndex((r) => String(r["Order ID"]) === orderId);

        if (index < 0) {
          throw Object.assign(
            new Error("Registration not found."),

            {
              statusCode: 404,
            },
          );
        }

        const row = normalizeRow(rows[index]);

        if (rowStatus === "Cancelled") {
          throw Object.assign(
            new Error("Cancelled registrations cannot be changed."),

            {
              statusCode: 400,
            },
          );
        }

        rowStatus = requested;

        rows[index] = row;

        writeExcel(rows);

        return row;
      });

      res.json({
        success: true,

        entry: toClientEntry(updated),
      });
    } catch (err) {
      res

        .status(err.statusCode || 500)

        .json({
          error: err.message || "Failed to update status.",
        });
    }
  },
);

/* =========================================================















   CANCEL ORDER































   Cancelled is permanent.















\========================================================= */

app.post(
  "/entries/:orderId/cancel",

  async (req, res) => {
    try {
      const orderId = String(req.params.orderId || "");

      const cancelPassword = String(req.body?.cancelPassword || ""); // Admin users can cancel directly from Admin Received.

      // Public users must provide the separate cancellation password.

      const header = String(req.headers.authorization || "");

      const adminToken = header.startsWith("Bearer ") ? header.slice(7) : "";

      const isAdmin = verifyAdminToken(adminToken);

      if (!isAdmin) {
        const configuredCancelPassword = process.env.CANCEL_PASSWORD || "";

        if (!configuredCancelPassword) {
          return res

            .status(500)

            .json({
              error: "Cancellation password is not configured on the server.",
            });
        }

        if (!cancelPassword || cancelPassword !== configuredCancelPassword) {
          return res

            .status(401)

            .json({
              error: "Invalid cancellation password.",
            });
        }
      }

      const updated = await withExcelAllocationLock(() => {
        const rows = readExcel();

        const index = rows.findIndex((r) => String(r["Order ID"]) === orderId);

        if (index < 0) {
          throw Object.assign(
            new Error("Registration not found."),

            {
              statusCode: 404,
            },
          );
        }

        const row = normalizeRow(rows[index]);

        if (rowStatus === "Cancelled") {
          throw Object.assign(
            new Error("This registration is already cancelled."),

            {
              statusCode: 400,
            },
          );
        }

        rowStatus = "Cancelled";

        row["Cancelled At"] = new Date().toLocaleString("en-IN");

        rows[index] = row;

        writeExcel(rows);

        return row;
      });

      res.json({
        success: true,

        entry: toClientEntry(updated),
      });
    } catch (err) {
      res

        .status(err.statusCode || 500)

        .json({
          error: err.message || "Failed to cancel token.",
        });
    }
  },
);

/* =========================================================















   ADMIN LOGIN















\========================================================= */

app.post(
  "/admin/login",

  (req, res) => {
    const username = String(req.body?.username || "").trim();

    const password = String(req.body?.password || "");

    const expectedUsername = process.env.ADMIN_USERNAME;

    const expectedPassword = process.env.ADMIN_PASSWORD;

    if (!expectedUsername || !expectedPassword) {
      return res

        .status(500)

        .json({
          error: "Admin credentials are not configured on the server.",
        });
    }

    if (username !== expectedUsername || password !== expectedPassword) {
      return res

        .status(401)

        .json({
          error: "Invalid admin credentials.",
        });
    }

    res.json({
      success: true,

      token: createAdminToken(username),

      expiresIn: ADMIN_TOKEN_TTL_MS,
    });
  },
);

/* =========================================================















   ADMIN RECEIVED DASHBOARD















\========================================================= */

app.get(
  "/admin/received",

  requireAdmin,

  (req, res) => {
    try {
      const entries = readExcel().map(toClientEntry);

      const summary = entries.reduce(
        (acc, e) => {
          const qty = Number(e.quantity) || 0;

          acc.totalOrders += 1;

          acc.totalTokens += qty;

          if (e.status === "Complete") {
            acc.completedOrders += 1;

            acc.completedTokens += qty;

            const amount = Number(e.amount) || 0;

            acc.totalAmountReceived += amount;

            if (
              Object.prototype.hasOwnProperty.call(
                acc.amountReceivedByCategory,

                e.tokenType,
              )
            ) {
              acc.amountReceivedByCategory[e.tokenType] += amount;
            }
          } else if (e.status === "Payment Not Received") {
            acc.paymentNotReceivedOrders += 1;

            acc.paymentNotReceivedTokens += qty;
          } else if (e.status === "Cancelled") {
            acc.cancelledOrders += 1;

            acc.cancelledTokens += qty;
          }

          return acc;
        },

        {
          totalOrders: 0,

          totalTokens: 0,

          completedOrders: 0,

          completedTokens: 0,

          paymentNotReceivedOrders: 0,

          paymentNotReceivedTokens: 0,

          cancelledOrders: 0,

          cancelledTokens: 0,

          totalAmountReceived: 0,

          amountReceivedByCategory: {
            Bullet: 0,

            Saree: 0,

            Silver: 0,
          },
        },
      );

      res.json({
        summary,

        entries,
      });
    } catch (err) {
      res

        .status(500)

        .json({
          error: "Failed to load admin data.",
        });
    }
  },
);

/* =========================================================















   ADMIN NOTES















\========================================================= */

app.post(
  "/admin/notes/:orderId",

  requireAdmin,

  async (req, res) => {
    try {
      const orderId = String(req.params.orderId || "");

      const notes = String(req.body?.notes || "").trim();

      const updated = await withExcelAllocationLock(() => {
        const rows = readExcel();

        const index = rows.findIndex((r) => String(r["Order ID"]) === orderId);

        if (index < 0) {
          throw Object.assign(
            new Error("Registration not found."),

            {
              statusCode: 404,
            },
          );
        }

        const row = normalizeRow(rows[index]);

        row["Admin Notes"] = notes;

        rows[index] = row;

        writeExcel(rows);

        return row;
      });

      res.json({
        success: true,

        entry: toClientEntry(updated),
      });
    } catch (err) {
      res

        .status(err.statusCode || 500)

        .json({
          error: err.message || "Failed to save admin notes.",
        });
    }
  },
);

/* =========================================================















   ADMIN-ONLY EXCEL DOWNLOAD















\========================================================= */

app.get(
  "/admin/download-excel",

  requireAdmin,

  (req, res) => {
    if (!fs.existsSync(FILE_PATH)) {
      return res

        .status(404)

        .json({
          error: "No Excel file has been created yet.",
        });
    }

    res.download(
      FILE_PATH,

      "spya-token-registrations.xlsx",

      (err) => {
        if (err) {
          console.error(
            "Admin download error:",

            err.message,
          );
        }
      },
    );
  },
);

/* =========================================================















   ADMIN-ONLY CLEAR















\========================================================= */

app.post(
  "/admin/clear",

  requireAdmin,

  async (req, res) => {
    try {
      await withExcelAllocationLock(() => writeExcel([]));

      res.json({
        success: true,

        message: "All registrations have been cleared.",
      });
    } catch (err) {
      res

        .status(err.statusCode || 500)

        .json({
          error: err.message || "Failed to clear registrations.",
        });
    }
  },
);

/* =========================================================















   TEST















\========================================================= */

app.get(
  "/test",

  (req, res) =>
    res.json({
      ok: true,

      message: "SPYA server is running.",
    }),
);

/* =========================================================















   START SERVER















\========================================================= */

/* =========================================================

   SPYA V5 - POSTGRESQL TOKEN / REGISTRATION ROUTES

   These routes are the V5 source-of-truth APIs.

   Legacy Excel routes below remain unchanged.

\========================================================= */

function getV5Bearer(req) {
  const header = String(req.headers.authorization || "");

  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function verifyV5Token(token) {
  try {
    const [encoded, signature] = String(token || "").split(".");
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
    return payload.exp && Number(payload.exp) > Date.now() ? payload : null;
  } catch (_) {
    return null;
  }
}

function requireV5UserRoute(req, res, next) {
  const payload = verifyV5Token(getV5Bearer(req));

  if (!payload || payload.type !== "user" || !payload.sub) {
    return res.status(401).json({ error: "V5 user authentication required." });
  }

  req.v5UserId = payload.sub;

  next();
}

function requireV5AdminRoute(req, res, next) {
  const payload = verifyV5Token(getV5Bearer(req));

  if (
    !payload ||
    payload.type !== "admin" ||
    !payload.sub ||
    !payload.adminId
  ) {
    return res.status(401).json({ error: "V5 admin authentication required." });
  }

  req.v5AdminUserId = payload.sub;

  req.v5AdminId = payload.adminId;

  next();
}

function positiveInteger(value, fieldName, max = 9999) {
  const n = Number(value);

  if (!Number.isInteger(n) || n < 1 || n > max) {
    throw Object.assign(
      new Error(`${fieldName} must be a whole number between 1 and ${max}.`),

      { statusCode: 400 },
    );
  }

  return n;
}

function normalizeV5RegistrationInput(body = {}) {
  const categoryId = String(body.categoryId || "").trim();

  const name = String(body.name || body.customerName || "").trim();

  const email = String(body.email || body.customerEmail || "").trim();

  const phone = String(body.phone || body.customerPhone || "").trim();

  const payment = String(body.payment || body.paymentMode || "").trim();

  if (!categoryId) {
    throw Object.assign(new Error("Category is required."), {
      statusCode: 400,
    });
  }

  if (!name) {
    throw Object.assign(new Error("Customer name is required."), {
      statusCode: 400,
    });
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error("Enter a valid email address."), {
      statusCode: 400,
    });
  }

  if (phone && !/^\+?[\d\s\-()]{7,15}$/.test(phone)) {
    throw Object.assign(new Error("Enter a valid phone number."), {
      statusCode: 400,
    });
  }

  return {
    categoryId,

    quantity: positiveInteger(body.quantity, "Quantity"),

    name,

    email,

    phone,

    payment,
  };
}

async function getOwnedDashboard(db, dashboardId, userId) {
  return (
    await db.query(
      `SELECT *

         FROM dashboards

        WHERE id=$1

          AND user_id=$2

          AND archived_at IS NULL

        LIMIT 1`,

      [dashboardId, userId],
    )
  ).rows[0];
}

async function getOwnedCategory(db, dashboardId, categoryId) {
  return (
    await db.query(
      `SELECT id,dashboard_id,name,prefix,price,active

         FROM token_categories

        WHERE id=$1

          AND dashboard_id=$2

        LIMIT 1`,

      [categoryId, dashboardId],
    )
  ).rows[0];
}

/*

 * Returns the smallest contiguous range of available serial numbers.

 * Only tokens whose status is Allocated are considered occupied.

 * Cancelled tokens therefore become reusable.

 */

async function findV5AvailableSerials(
  client,

  dashboardId,

  categoryId,

  quantity,
) {
  const result = await client.query(
    `SELECT serial

       FROM tokens

      WHERE dashboard_id=$1

        AND category_id=$2

        AND status='Allocated'

      ORDER BY serial`,

    [dashboardId, categoryId],
  );

  const used = new Set(result.rows.map((r) => Number(r.serial)));

  let candidate = 1;

  while (true) {
    let available = true;

    for (let i = 0; i < quantity; i += 1) {
      if (used.has(candidate + i)) {
        available = false;

        break;
      }
    }

    if (available) return candidate;

    candidate += 1;
  }
}

async function createV5Registration({ dashboardId, userId, input }) {
  const db = requirePg();

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // Serialize allocations per dashboard so two simultaneous requests

    // cannot receive the same order number or token range.

    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `SPYA-V5-DASHBOARD:${dashboardId}`,
    ]);

    const dashboard = await getOwnedDashboard(client, dashboardId, userId);

    if (!dashboard) {
      throw Object.assign(new Error("Dashboard not found."), {
        statusCode: 404,
      });
    }

    const category = await getOwnedCategory(
      client,

      dashboardId,

      input.categoryId,
    );

    if (!category || !category.active) {
      throw Object.assign(new Error("Token category not found or inactive."), {
        statusCode: 404,
      });
    }

    const nextOrderResult = await client.query(
      `SELECT COALESCE(MAX(order_number),0)+1 AS next_order

         FROM registrations

        WHERE dashboard_id=$1`,

      [dashboardId],
    );

    const orderNumber = Number(nextOrderResult.rows[0].next_order);

    const quantity = input.quantity;

    const tokenStart = await findV5AvailableSerials(
      client,

      dashboardId,

      category.id,

      quantity,
    );

    const tokenEnd = tokenStart + quantity - 1;

    const amount = Number(category.price) * quantity;

    const registrationResult = await client.query(
      `INSERT INTO registrations

        (dashboard_id,category_id,order_number,customer_name,customer_email,

         customer_phone,quantity,token_start,token_end,amount,payment_mode,status)

       VALUES

        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Complete')

       RETURNING *`,

      [
        dashboardId,

        category.id,

        orderNumber,

        input.name,

        input.email || null,

        input.phone || null,

        quantity,

        tokenStart,

        tokenEnd,

        amount,

        input.payment || null,
      ],
    );

    const registration = registrationResult.rows[0];

    // Reuse cancelled token rows where possible; otherwise create new rows.

    for (let serial = tokenStart; serial <= tokenEnd; serial += 1) {
      const existing = (
        await client.query(
          `SELECT id

             FROM tokens

            WHERE dashboard_id=$1

              AND category_id=$2

              AND serial=$3

            LIMIT 1`,

          [dashboardId, category.id, serial],
        )
      ).rows[0];

      if (existing) {
        await client.query(
          `UPDATE tokens

              SET registration_id=$1,

                  status='Allocated',

                  created_at=NOW()

            WHERE id=$2`,

          [registration.id, existing.id],
        );
      } else {
        await client.query(
          `INSERT INTO tokens

            (dashboard_id,category_id,serial,registration_id,status)

           VALUES ($1,$2,$3,$4,'Allocated')`,

          [dashboardId, category.id, serial, registration.id],
        );
      }
    }

    await client.query("COMMIT");

    return {
      id: registration.id,

      orderId: `ORD${String(orderNumber).padStart(4, "0")}`,

      orderNumber,

      dashboardId,

      categoryId: category.id,

      tokenType: category.name,

      categoryName: category.name,

      prefix: category.prefix,

      quantity,

      tokenStart: `${category.prefix}${String(tokenStart).padStart(4, "0")}`,

      tokenEnd: `${category.prefix}${String(tokenEnd).padStart(4, "0")}`,

      name: registration.customer_name,

      email: registration.customer_email || "",

      phone: registration.customer_phone || "",

      payment: registration.payment_mode || "",

      amount: Number(registration.amount),

      status: registration.status,

      cancelledAt: registration.cancelled_at,

      adminNotes: registration.admin_notes || "",

      date: new Date(registration.created_at).toLocaleDateString("en-IN"),

      time: new Date(registration.created_at).toLocaleTimeString("en-IN", {
        hour: "2-digit",

        minute: "2-digit",
      }),

      createdAt: registration.created_at,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    throw error;
  } finally {
    client.release();
  }
}

async function mapV5Registration(db, row) {
  const category = (
    await db.query(
      `SELECT name,prefix

         FROM token_categories

        WHERE id=$1

        LIMIT 1`,

      [rowcategory_id],
    )
  ).rows[0];

  const prefix = category?.prefix || "";

  return {
    id: rowid,

    orderId: `ORD${String(roworder_number).padStart(4, "0")}`,

    orderNumber: Number(roworder_number),

    dashboardId: rowdashboard_id,

    categoryId: rowcategory_id,

    tokenType: category?.name || "",

    categoryName: category?.name || "",

    prefix,

    quantity: Number(rowquantity),

    tokenStart: `${prefix}${String(rowtoken_start).padStart(4, "0")}`,

    tokenEnd: `${prefix}${String(rowtoken_end).padStart(4, "0")}`,

    name: rowcustomer_name,

    email: rowcustomer_email || "",

    phone: rowcustomer_phone || "",

    payment: rowpayment_mode || "",

    amount: Number(rowamount),

    status: rowstatus,

    cancelledAt: rowcancelled_at,

    adminNotes: rowadmin_notes || "",

    date: new Date(rowcreated_at).toLocaleDateString("en-IN"),

    time: new Date(rowcreated_at).toLocaleTimeString("en-IN", {
      hour: "2-digit",

      minute: "2-digit",
    }),

    createdAt: rowcreated_at,
  };
}

/* ---------------------------------------------------------

   GET DASHBOARD DETAILS + CATEGORIES

\--------------------------------------------------------- */

app.get(
  "/api/v5/token/dashboards/:dashboardId",

  requireV5UserRoute,

  async (req, res) => {
    try {
      const db = requirePg();

      const dashboard = await getOwnedDashboard(
        db,

        req.params.dashboardId,

        req.v5UserId,
      );

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

      res.json({ success: true, dashboard, categories });
    } catch (error) {
      console.error("V5 dashboard details error:", error);

      res.status(error.statusCode || 500).json({
        error: error.message || "Failed to load dashboard.",
      });
    }
  },
);

/* ---------------------------------------------------------

   GET USER REGISTRATIONS

\--------------------------------------------------------- */

app.get(
  "/api/v5/dashboards/:dashboardId/registrations",

  requireV5UserRoute,

  async (req, res) => {
    try {
      const db = requirePg();

      const dashboard = await getOwnedDashboard(
        db,

        req.params.dashboardId,

        req.v5UserId,
      );

      if (!dashboard) {
        return res.status(404).json({ error: "Dashboard not found." });
      }

      const rows = (
        await db.query(
          `SELECT *

             FROM registrations

            WHERE dashboard_id=$1

            ORDER BY created_at DESC`,

          [dashboard.id],
        )
      ).rows;

      const entries = [];

      for (const row of rows) {
        entries.push(await mapV5Registration(db, row));
      }

      res.json({ success: true, entries });
    } catch (error) {
      console.error("V5 registrations list error:", error);

      res.status(error.statusCode || 500).json({
        error: error.message || "Failed to load registrations.",
      });
    }
  },
);

/* ---------------------------------------------------------

   CREATE USER REGISTRATION

\--------------------------------------------------------- */

app.post(
  "/api/v5/dashboards/:dashboardId/registrations",

  requireV5UserRoute,

  async (req, res) => {
    try {
      const input = normalizeV5RegistrationInput(req.body || {});

      const entry = await createV5Registration({
        dashboardId: req.params.dashboardId,

        userId: req.v5UserId,

        input,
      });

      res.status(201).json({ success: true, entry });
    } catch (error) {
      console.error("V5 create registration error:", error);

      res.status(error.statusCode || 500).json({
        error: error.message || "Failed to create registration.",
      });
    }
  },
);

/* ---------------------------------------------------------

   UPDATE STATUS

   Complete <-> Payment Not Received

   Cancelled is permanent.

\--------------------------------------------------------- */

app.post(
  "/api/v5/dashboards/:dashboardId/registrations/:registrationId/status",

  requireV5UserRoute,

  async (req, res) => {
    try {
      const requested = String(req.body?.status || "").trim();

      if (!["Complete", "Payment Not Received"].includes(requested)) {
        return res.status(400).json({
          error: "Status must be Complete or Payment Not Received.",
        });
      }

      const db = requirePg();

      const dashboard = await getOwnedDashboard(
        db,

        req.params.dashboardId,

        req.v5UserId,
      );

      if (!dashboard) {
        return res.status(404).json({ error: "Dashboard not found." });
      }

      const result = await db.query(
        `UPDATE registrations

            SET status=$1

          WHERE id=$2

            AND dashboard_id=$3

            AND status <> 'Cancelled'

        RETURNING *`,

        [requested, req.params.registrationId, dashboard.id],
      );

      if (!result.rows[0]) {
        return res.status(404).json({
          error: "Registration not found or it is already cancelled.",
        });
      }

      res.json({
        success: true,

        entry: await mapV5Registration(db, result.rows[0]),
      });
    } catch (error) {
      console.error("V5 status update error:", error);

      res.status(error.statusCode || 500).json({
        error: error.message || "Failed to update status.",
      });
    }
  },
);

/* ---------------------------------------------------------

   CANCEL REGISTRATION

   Cancellation makes its token numbers reusable.

\--------------------------------------------------------- */

app.post(
  "/api/v5/dashboards/:dashboardId/registrations/:registrationId/cancel",

  requireV5UserRoute,

  async (req, res) => {
    const db = requirePg();

    const client = await db.connect();

    try {
      await client.query("BEGIN");

      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `SPYA-V5-DASHBOARD:${req.params.dashboardId}`,
      ]);

      const dashboard = await getOwnedDashboard(
        client,

        req.params.dashboardId,

        req.v5UserId,
      );

      if (!dashboard) {
        await client.query("ROLLBACK");

        return res.status(404).json({ error: "Dashboard not found." });
      }

      const registration = (
        await client.query(
          `SELECT *

             FROM registrations

            WHERE id=$1

              AND dashboard_id=$2

            LIMIT 1`,

          [req.params.registrationId, dashboard.id],
        )
      ).rows[0];

      if (!registration) {
        await client.query("ROLLBACK");

        return res.status(404).json({ error: "Registration not found." });
      }

      if (registration.status === "Cancelled") {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error: "This registration is already cancelled.",
        });
      }

      const updated = (
        await client.query(
          `UPDATE registrations

              SET status='Cancelled',

                  cancelled_at=NOW()

            WHERE id=$1

            RETURNING *`,

          [registration.id],
        )
      ).rows[0];

      await client.query(
        `UPDATE tokens

            SET status='Cancelled'

          WHERE registration_id=$1`,

        [registration.id],
      );

      await client.query("COMMIT");

      res.json({
        success: true,

        message: "Registration cancelled. Its token numbers are now reusable.",

        entry: await mapV5Registration(db, updated),
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});

      console.error("V5 cancellation error:", error);

      res.status(error.statusCode || 500).json({
        error: error.message || "Failed to cancel registration.",
      });
    } finally {
      client.release();
    }
  },
);

/* ---------------------------------------------------------

   ADMIN REGISTRATIONS

\--------------------------------------------------------- */

app.get(
  "/api/v5/admin/dashboards/:dashboardId/registrations",

  requireV5AdminRoute,

  async (req, res) => {
    try {
      const db = requirePg();

      const dashboard = (
        await db.query(
          `SELECT *

             FROM dashboards

            WHERE id=$1

              AND user_id=$2

              AND archived_at IS NULL

            LIMIT 1`,

          [req.params.dashboardId, req.v5AdminUserId],
        )
      ).rows[0];

      if (!dashboard) {
        return res.status(404).json({ error: "Dashboard not found." });
      }

      const rows = (
        await db.query(
          `SELECT *

             FROM registrations

            WHERE dashboard_id=$1

            ORDER BY created_at DESC`,

          [dashboard.id],
        )
      ).rows;

      const entries = [];

      for (const row of rows) {
        entries.push(await mapV5Registration(db, row));
      }

      const summary = {
        totalOrders: entries.length,

        totalTokens: entries.reduce((sum, e) => sum + e.quantity, 0),

        completedOrders: entries.filter((e) => e.status === "Complete").length,

        completedTokens: entries

          .filter((e) => e.status === "Complete")

          .reduce((sum, e) => sum + e.quantity, 0),

        paymentNotReceivedOrders: entries.filter(
          (e) => e.status === "Payment Not Received",
        ).length,

        paymentNotReceivedTokens: entries

          .filter((e) => e.status === "Payment Not Received")

          .reduce((sum, e) => sum + e.quantity, 0),

        cancelledOrders: entries.filter((e) => e.status === "Cancelled").length,

        cancelledTokens: entries

          .filter((e) => e.status === "Cancelled")

          .reduce((sum, e) => sum + e.quantity, 0),

        totalAmountReceived: entries

          .filter((e) => e.status === "Complete")

          .reduce((sum, e) => sum + e.amount, 0),

        amountReceivedByCategory: {},
      };

      for (const entry of entries) {
        if (entry.status !== "Complete") continue;

        summary.amountReceivedByCategory[entry.categoryName] =
          (summary.amountReceivedByCategory[entry.categoryName] || 0) +
          entry.amount;
      }

      res.json({
        success: true,

        dashboard,

        summary,

        entries,
      });
    } catch (error) {
      console.error("V5 admin registrations error:", error);

      res.status(error.statusCode || 500).json({
        error: error.message || "Failed to load admin registrations.",
      });
    }
  },
);

/* ---------------------------------------------------------

   ADMIN STATUS

\--------------------------------------------------------- */

app.post(
  "/api/v5/admin/dashboards/:dashboardId/registrations/:registrationId/status",

  requireV5AdminRoute,

  async (req, res) => {
    try {
      const requested = String(req.body?.status || "").trim();

      if (!["Complete", "Payment Not Received"].includes(requested)) {
        return res.status(400).json({
          error: "Status must be Complete or Payment Not Received.",
        });
      }

      const db = requirePg();

      const result = await db.query(
        `UPDATE registrations r

            SET status=$1

           FROM dashboards d

          WHERE r.id=$2

            AND r.dashboard_id=$3

            AND d.id=r.dashboard_id

            AND d.user_id=$4

            AND d.archived_at IS NULL

            AND r.status <> 'Cancelled'

        RETURNING r.*`,

        [
          requested,

          req.params.registrationId,

          req.params.dashboardId,

          req.v5AdminUserId,
        ],
      );

      if (!result.rows[0]) {
        return res.status(404).json({
          error: "Registration not found or it is already cancelled.",
        });
      }

      res.json({
        success: true,

        entry: await mapV5Registration(db, result.rows[0]),
      });
    } catch (error) {
      console.error("V5 admin status error:", error);

      res.status(error.statusCode || 500).json({
        error: error.message || "Failed to update status.",
      });
    }
  },
);

/* ---------------------------------------------------------

   ADMIN CANCEL

\--------------------------------------------------------- */

app.post(
  "/api/v5/admin/dashboards/:dashboardId/registrations/:registrationId/cancel",

  requireV5AdminRoute,

  async (req, res) => {
    const db = requirePg();

    const client = await db.connect();

    try {
      await client.query("BEGIN");

      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `SPYA-V5-DASHBOARD:${req.params.dashboardId}`,
      ]);

      const registration = (
        await client.query(
          `SELECT r.*

             FROM registrations r

             JOIN dashboards d ON d.id=r.dashboard_id

            WHERE r.id=$1

              AND r.dashboard_id=$2

              AND d.user_id=$3

              AND d.archived_at IS NULL

            LIMIT 1`,

          [
            req.params.registrationId,

            req.params.dashboardId,

            req.v5AdminUserId,
          ],
        )
      ).rows[0];

      if (!registration) {
        await client.query("ROLLBACK");

        return res.status(404).json({ error: "Registration not found." });
      }

      if (registration.status === "Cancelled") {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error: "This registration is already cancelled.",
        });
      }

      const updated = (
        await client.query(
          `UPDATE registrations

              SET status='Cancelled',

                  cancelled_at=NOW()

            WHERE id=$1

            RETURNING *`,

          [registration.id],
        )
      ).rows[0];

      await client.query(
        `UPDATE tokens

            SET status='Cancelled'

          WHERE registration_id=$1`,

        [registration.id],
      );

      await client.query("COMMIT");

      res.json({
        success: true,

        message: "Registration cancelled. Its token numbers are now reusable.",

        entry: await mapV5Registration(db, updated),
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});

      console.error("V5 admin cancellation error:", error);

      res.status(error.statusCode || 500).json({
        error: error.message || "Failed to cancel registration.",
      });
    } finally {
      client.release();
    }
  },
);

/* ---------------------------------------------------------

   ADMIN NOTES

\--------------------------------------------------------- */

app.post(
  "/api/v5/admin/dashboards/:dashboardId/registrations/:registrationId/notes",

  requireV5AdminRoute,

  async (req, res) => {
    try {
      const db = requirePg();

      const notes = String(req.body?.notes || "").trim();

      const result = await db.query(
        `UPDATE registrations r

            SET admin_notes=$1

           FROM dashboards d

          WHERE r.id=$2

            AND r.dashboard_id=$3

            AND d.id=r.dashboard_id

            AND d.user_id=$4

            AND d.archived_at IS NULL

        RETURNING r.*`,

        [
          notes,

          req.params.registrationId,

          req.params.dashboardId,

          req.v5AdminUserId,
        ],
      );

      if (!result.rows[0]) {
        return res.status(404).json({ error: "Registration not found." });
      }

      res.json({
        success: true,

        entry: await mapV5Registration(db, result.rows[0]),
      });
    } catch (error) {
      console.error("V5 admin notes error:", error);

      res.status(error.statusCode || 500).json({
        error: error.message || "Failed to save admin notes.",
      });
    }
  },
);

/* ---------------------------------------------------------

   ADMIN EXCEL EXPORT

   PostgreSQL remains the source of truth.

   Excel is only an export.

\--------------------------------------------------------- */

app.get(
  "/api/v5/admin/dashboards/:dashboardId/export-excel",

  requireV5AdminRoute,

  async (req, res) => {
    try {
      const db = requirePg();

      const dashboard = (
        await db.query(
          `SELECT id,association_name

             FROM dashboards

            WHERE id=$1

              AND user_id=$2

              AND archived_at IS NULL

            LIMIT 1`,

          [req.params.dashboardId, req.v5AdminUserId],
        )
      ).rows[0];

      if (!dashboard) {
        return res.status(404).json({ error: "Dashboard not found." });
      }

      const rows = (
        await db.query(
          `SELECT

             r.order_number,

             c.name AS category_name,

             c.prefix,

             r.quantity,

             r.token_start,

             r.token_end,

             r.customer_name,

             r.customer_email,

             r.customer_phone,

             r.payment_mode,

             r.amount,

             r.status,

             r.cancelled_at,

             r.admin_notes,

             r.created_at

           FROM registrations r

           JOIN token_categories c ON c.id=r.category_id

          WHERE r.dashboard_id=$1

          ORDER BY r.created_at DESC`,

          [dashboard.id],
        )
      ).rows;

      const exportRows = rows.map((r) => ({
        "Order ID": `ORD${String(r.order_number).padStart(4, "0")}`,

        "Token Type": r.category_name,

        Prefix: r.prefix,

        Quantity: Number(r.quantity),

        "Token Start": `${r.prefix}${String(r.token_start).padStart(4, "0")}`,

        "Token End": `${r.prefix}${String(r.token_end).padStart(4, "0")}`,

        Name: r.customer_name,

        Email: r.customer_email || "",

        Phone: r.customer_phone || "",

        "Payment Mode": r.payment_mode || "",

        Amount: Number(r.amount),

        Status: r.status,

        "Cancelled At": r.cancelled_at || "",

        "Admin Notes": r.admin_notes || "",

        Date: new Date(r.created_at).toLocaleDateString("en-IN"),

        Time: new Date(r.created_at).toLocaleTimeString("en-IN", {
          hour: "2-digit",

          minute: "2-digit",
        }),
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportRows);

      worksheet["!cols"] = [
        { wch: 14 },

        { wch: 20 },

        { wch: 10 },

        { wch: 10 },

        { wch: 15 },

        { wch: 15 },

        { wch: 24 },

        { wch: 30 },

        { wch: 18 },

        { wch: 18 },

        { wch: 14 },

        { wch: 24 },

        { wch: 24 },

        { wch: 35 },

        { wch: 14 },

        { wch: 12 },
      ];

      const workbook = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(workbook, worksheet, "Registrations");

      const buffer = XLSX.write(workbook, {
        type: "buffer",

        bookType: "xlsx",
      });

      const safeName = String(dashboard.association_name || "SPYA")
        .replace(/[^a-zA-Z0-9_-]+/g, "_")

        .slice(0, 60);

      res.setHeader(
        "Content-Type",

        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );

      res.setHeader(
        "Content-Disposition",

        `attachment; filename="${safeName}-registrations.xlsx"`,
      );

      res.send(buffer);
    } catch (error) {
      console.error("V5 Excel export error:", error);

      res.status(error.statusCode || 500).json({
        error: error.message || "Failed to export Excel.",
      });
    }
  },
);

const PORT = process.env.PORT || 4000;

app.listen(
  PORT,

  "0.0.0.0",

  () => {
    console.log("==============================================");

    console.log("SPYA V5 Token Server is running (V4 Excel routes retained)");

    console.log(`Port: ${PORT}`);

    console.log(`Excel file: ${FILE_PATH}`);

    console.log(`Tokens: ${ALLOWED_TOKEN_TYPES.join(", ")}`);

    console.log("==============================================");
  },
);
