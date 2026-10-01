const express = require("express");
const cors = require("cors");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────────────────────────────────────
// Excel configuration
// ─────────────────────────────────────────────────────────────────────────────

const FILE_PATH = path.join(__dirname, "registrations.xlsx");
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
  "Date",
  "Time",
];

// Available SVARA token types
const ALLOWED_TOKEN_TYPES = [
  "Bullet",
  "Saree",
  "Silver",
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Check whether Excel file is locked
// ─────────────────────────────────────────────────────────────────────────────

function isLockedFileError(err) {
  return (
    err &&
    (
      err.code === "EBUSY" ||
      err.code === "EACCES" ||
      err.code === "EPERM" ||
      /being used by another process|locked|permission denied/i.test(
        err.message
      )
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Make sure Excel is writable
// ─────────────────────────────────────────────────────────────────────────────

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
        new Error(
          "Excel file is open. Please close it before continuing."
        ),
        {
          statusCode: 409,
          code: err.code || "LOCKED",
        }
      );
    }

    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Normalize Excel row
// ─────────────────────────────────────────────────────────────────────────────

function normalizeRow(row = {}) {
  return {
    "Order ID":
      row["Order ID"] ??
      row["Order Id"] ??
      row["OrderID"] ??
      "",

    "Token Type":
      row["Token Type"] ??
      row["Token type"] ??
      "",

    Quantity:
      Number(row["Quantity"] ?? 0),

    "Token Start":
      row["Token Start"] ??
      "",

    "Token End":
      row["Token End"] ??
      "",

    Name:
      row["Name"] ??
      "",

    Email:
      row["Email"] ??
      "",

    Phone:
      row["Phone"] ??
      "",

    Payment:
      row["Payment"] ??
      "",

    Date:
      row["Date"] ??
      "",

    Time:
      row["Time"] ??
      "",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Read Excel
// ─────────────────────────────────────────────────────────────────────────────

function readExcel() {
  if (!fs.existsSync(FILE_PATH)) {
    console.log("📋 No Excel file found, starting fresh.");
    return [];
  }

  try {
    const workbook = XLSX.readFile(FILE_PATH);

    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      console.log("⚠️ No worksheet found.");
      return [];
    }

    console.log(`📖 Found sheet: "${firstSheetName}"`);

    const worksheet = workbook.Sheets[firstSheetName];

    if (!worksheet) {
      console.log("⚠️ Worksheet is empty.");
      return [];
    }

    const rows = XLSX.utils
      .sheet_to_json(worksheet, {
        defval: "",
      })
      .map(normalizeRow);

    console.log(`📖 Read ${rows.length} existing orders.`);

    return rows;

  } catch (err) {
    console.error(
      "❌ Error reading Excel:",
      err.message
    );

    throw err;
  }
}

function getTokenPrefix(tokenType) {
  const prefixes = {
    Bullet: "BUL",
    Saree: "SAR",
    Silver: "SLV",
  };

  return prefixes[tokenType];
}


function getSerialFromToken(token) {
  if (!token) {
    return 0;
  }

  const match =
    String(token).match(/(\d+)$/);

  return match
    ? parseInt(match[1], 10)
    : 0;
}


function makeTokenId(
  tokenType,
  serial
) {
  const prefix =
    getTokenPrefix(tokenType);

  return `${prefix}${String(
    serial
  ).padStart(4, "0")}`;
}


function getNextTokenSerial(
  rows,
  tokenType
) {
  let maxSerial = 0;

  rows.forEach((row) => {
    if (
      row["Token Type"] !==
      tokenType
    ) {
      return;
    }

    const startSerial =
      getSerialFromToken(
        row["Token Start"]
      );

    const endSerial =
      getSerialFromToken(
        row["Token End"]
      );

    maxSerial = Math.max(
      maxSerial,
      startSerial,
      endSerial
    );
  });

  return maxSerial + 1;
}


function getNextOrderNumber(rows) {
  let maxOrder = 0;

  rows.forEach((row) => {
    const value = String(
      row["Order ID"] || ""
    );

    const match =
      value.match(/(\d+)$/);

    if (match) {
      maxOrder = Math.max(
        maxOrder,
        parseInt(match[1], 10)
      );
    }
  });

  return maxOrder + 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Write Excel
// ─────────────────────────────────────────────────────────────────────────────

function writeExcel(rows) {
  try {
    assertExcelIsWritable();

    console.log(
      `✏️ Writing ${rows.length} orders to Excel...`
    );

    const worksheet = XLSX.utils.json_to_sheet(
      rows,
      {
        header: HEADERS,
      }
    );

    // Excel column widths
    worksheet["!cols"] = [
      16, // Order ID
      14, // Token Type
      10, // Quantity
      14, // Token Start
      14, // Token End
      22, // Name
      28, // Email
      16, // Phone
      12, // Payment
      12, // Date
      12, // Time
    ].map((width) => ({
      wch: width,
    }));

    let workbook;

    // If Excel already exists, preserve workbook
    if (fs.existsSync(FILE_PATH)) {

      workbook = XLSX.readFile(FILE_PATH);

      const firstSheetName =
        workbook.SheetNames[0];

      if (firstSheetName) {

        delete workbook.Sheets[firstSheetName];

        workbook.SheetNames[0] =
          SHEET_NAME;

        workbook.Sheets[SHEET_NAME] =
          worksheet;

      } else {

        XLSX.utils.book_append_sheet(
          workbook,
          worksheet,
          SHEET_NAME
        );
      }

    } else {

      workbook =
        XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        SHEET_NAME
      );
    }

    XLSX.writeFile(
      workbook,
      FILE_PATH
    );

    console.log(
      `✅ Excel updated successfully.`
    );

  } catch (err) {

    if (isLockedFileError(err)) {

      const message =
        "Excel file is open. Please close it before continuing.";

      console.error(
        `❌ ${message}`
      );

      throw Object.assign(
        new Error(message),
        {
          statusCode: 409,
          code: err.code || "LOCKED",
        }
      );
    }

    console.error(
      "❌ Error writing Excel:",
      err.message
    );

    throw err;
  }
}

function getTokenPrefix(tokenType) {
  const prefixes = {
    Bullet: "BUL",
    Saree: "SAR",
    Silver: "SLV",
  };

  return prefixes[tokenType];
}

function getSerialFromToken(token) {
  if (!token) return 0;

  const match = String(token).match(/(\d+)$/);

  return match ? parseInt(match[1], 10) : 0;
}

function makeTokenId(tokenType, serial) {
  const prefix = getTokenPrefix(tokenType);

  return `${prefix}${String(serial).padStart(4, "0")}`;
}

function getNextTokenSerial(rows, tokenType) {
  let maxSerial = 0;

  rows.forEach((row) => {
    if (row["Token Type"] !== tokenType) return;

    const startSerial = getSerialFromToken(row["Token Start"]);
    const endSerial = getSerialFromToken(row["Token End"]);

    maxSerial = Math.max(
      maxSerial,
      startSerial,
      endSerial
    );
  });

  return maxSerial + 1;
}

function getNextOrderNumber(rows) {
  let maxOrder = 0;

  rows.forEach((row) => {
    const value = String(row["Order ID"] || "");

    const match = value.match(/(\d+)$/);

    if (match) {
      maxOrder = Math.max(
        maxOrder,
        parseInt(match[1], 10)
      );
    }
  });

  return maxOrder + 1;
}

/*
 * Ensures token/order allocation is processed
 * one request at a time within this Node server.
 */
let excelAllocationQueue = Promise.resolve();

function withExcelAllocationLock(work) {
  const result = excelAllocationQueue.then(
    work,
    work
  );

  excelAllocationQueue = result.catch(() => {});

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /entries
// ─────────────────────────────────────────────────────────────────────────────

app.get("/entries", (req, res) => {

  try {

    const rows = readExcel();

    const entries = rows.map((row) => ({

      orderId:
        row["Order ID"] || "",

      tokenType:
        row["Token Type"] || "",

      quantity:
        Number(row["Quantity"]) || 0,

      tokenStart:
        row["Token Start"] || "",

      tokenEnd:
        row["Token End"] || "",

      name:
        row["Name"] || "",

      email:
        row["Email"] || "",

      phone:
        row["Phone"] || "",

      payment:
        row["Payment"] || "",

      date:
        row["Date"] || "",

      time:
        row["Time"] || "",
    }));

    res.json(entries);

  } catch (err) {

    console.error(
      "❌ GET /entries error:",
      err.message
    );

    res.status(500).json({
      error:
        "Failed to read token entries.",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /download-excel
// ─────────────────────────────────────────────────────────────────────────────

app.get(
  "/download-excel",
  (req, res) => {

    try {

      if (!fs.existsSync(FILE_PATH)) {

        return res.status(404).json({
          error:
            "No Excel file has been created yet.",
        });
      }

      res.download(
        FILE_PATH,
        "svara-token-registrations.xlsx"
      );

    } catch (err) {

      console.error(
        "❌ Download error:",
        err.message
      );

      res.status(500).json({
        error:
          "Failed to download Excel file.",
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /entries
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// POST /entries
// CENTRALIZED TOKEN ALLOCATION
// ─────────────────────────────────────────────────────────────────────────────

app.post("/entries", async (req, res) => {
  try {
    console.log(
      "📥 Received token order:",
      req.body
    );

    const entry = req.body || {};


    // ─────────────────────────────────────
    // Validate token type
    // ─────────────────────────────────────

    if (!entry.tokenType) {
      return res.status(400).json({
        error:
          "Token type is required.",
      });
    }


    if (
      !ALLOWED_TOKEN_TYPES.includes(
        entry.tokenType
      )
    ) {
      return res.status(400).json({
        error:
          "Invalid token type. Allowed values are Bullet, Saree and Silver.",
      });
    }


    // ─────────────────────────────────────
    // Validate quantity
    // ─────────────────────────────────────

    const quantity =
      Number(entry.quantity);

    if (
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      return res.status(400).json({
        error:
          "Quantity must be a whole number greater than 0.",
      });
    }


    // ─────────────────────────────────────
    // Validate customer details
    // ─────────────────────────────────────

    if (
      !entry.name ||
      !String(entry.name).trim()
    ) {
      return res.status(400).json({
        error:
          "Customer name is required.",
      });
    }


    if (
      !entry.phone ||
      !String(entry.phone).trim()
    ) {
      return res.status(400).json({
        error:
          "Customer phone number is required.",
      });
    }


    // ─────────────────────────────────────
    // CENTRAL ALLOCATION
    // ─────────────────────────────────────

    const newRow =
      await withExcelAllocationLock(
        () => {

          /*
           * IMPORTANT:
           * Read Excel INSIDE the lock.
           *
           * This means the second request
           * sees the Excel update made by
           * the first request.
           */
          const rows =
            readExcel();


          // ───────────────────────────────
          // Generate Order ID
          // ───────────────────────────────

          const nextOrder =
            getNextOrderNumber(rows);

          const orderId =
            `ORD${String(
              nextOrder
            ).padStart(4, "0")}`;


          // ───────────────────────────────
          // Generate Token Range
          // ───────────────────────────────

          const nextSerial =
            getNextTokenSerial(
              rows,
              entry.tokenType
            );


          const tokenStart =
            makeTokenId(
              entry.tokenType,
              nextSerial
            );


          const tokenEnd =
            makeTokenId(
              entry.tokenType,
              nextSerial +
                quantity -
                1
            );


          // ───────────────────────────────
          // Server Date / Time
          // ───────────────────────────────

          const now =
            new Date();


          const date =
            now.toLocaleDateString(
              "en-IN"
            );


          const time =
            now.toLocaleTimeString(
              "en-IN",
              {
                hour: "2-digit",
                minute: "2-digit",
              }
            );


          // ───────────────────────────────
          // Create Excel Row
          // ───────────────────────────────

          const row = {

            "Order ID":
              orderId,

            "Token Type":
              entry.tokenType,

            "Quantity":
              quantity,

            "Token Start":
              tokenStart,

            "Token End":
              tokenEnd,

            Name:
              String(
                entry.name
              ).trim(),

            Email:
              String(
                entry.email || ""
              ).trim(),

            Phone:
              String(
                entry.phone
              ).trim(),

            Payment:
              entry.payment || "",

            Date:
              date,

            Time:
              time,
          };


          console.log(
            "📝 Centrally allocated token order:",
            row
          );


          // ───────────────────────────────
          // Save to central Excel
          // ───────────────────────────────

          rows.push(row);

          writeExcel(rows);


          /*
           * Return the row that was actually
           * allocated by the server.
           */
          return row;
        }
      );


    // ─────────────────────────────────────
    // Return authoritative server result
    // ─────────────────────────────────────

    res.json({

      success: true,

      entry: {

        orderId:
          newRow["Order ID"],

        tokenType:
          newRow["Token Type"],

        quantity:
          newRow["Quantity"],

        tokenStart:
          newRow["Token Start"],

        tokenEnd:
          newRow["Token End"],

        name:
          newRow.Name,

        email:
          newRow.Email,

        phone:
          newRow.Phone,

        payment:
          newRow.Payment,

        date:
          newRow.Date,

        time:
          newRow.Time,
      },

    });

  } catch (err) {

    console.error(
      "❌ POST /entries error:",
      err.message
    );


    const status =
      err.statusCode || 500;


    res.status(status).json({

      error:
        err.message ||
        "Failed to save token order.",

    });

  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /entries
// ─────────────────────────────────────────────────────────────────────────────

app.delete(
  "/entries",
  (req, res) => {

    try {

      if (fs.existsSync(FILE_PATH)) {

        assertExcelIsWritable();

        fs.unlinkSync(
          FILE_PATH
        );

        console.log(
          "🗑️ Deleted registrations.xlsx"
        );
      }

      res.json({
        success: true,
      });

    } catch (err) {

      console.error(
        "❌ DELETE /entries error:",
        err.message
      );

      const status =
        err.statusCode || 500;

      res.status(status).json({

        error:
          err.message ||
          "Failed to clear token entries.",
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────────────────────────────

app.get("/test", (req, res) => {

  res.json({
    success: true,
    message:
      "SVARA Token System backend is running.",
    availableTokens:
      ALLOWED_TOKEN_TYPES,
    excelFile:
      FILE_PATH,
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("==============================================");
  console.log("✅ SVARA Token Server is running");
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`📂 Excel file: ${FILE_PATH}`);
  console.log(
    `🎟️ Available tokens: ${ALLOWED_TOKEN_TYPES.join(", ")}`
  );
  console.log("==============================================");
});