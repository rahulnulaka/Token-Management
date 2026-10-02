const express = require("express");

const cors = require("cors");

const XLSX = require("xlsx");

const fs = require("fs");

const path = require("path");

const crypto = require("crypto");



const app = express();



app.use(cors());

app.use(express.json());



const DATA_DIR =

  process.env.DATA_DIR || path.join(__dirname, "data");



if (!fs.existsSync(DATA_DIR)) {

  fs.mkdirSync(DATA_DIR, { recursive: true });

}



const FILE_PATH = path.join(

  DATA_DIR,

  "registrations.xlsx"

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



const ALLOWED_TOKEN_TYPES = [

  "Bullet",

  "Saree",

  "Silver",

];



const ALLOWED_STATUSES = [

  "Complete",

  "Payment Not Received",

  "Cancelled",

];



const MAX_QUANTITY = 9999;

const TOKEN_PRICES = {
  Bullet: 301,
  Saree: 101,
  Silver: 201,
};

const WHATSAPP_GRAPH_VERSION =
  process.env.WHATSAPP_GRAPH_VERSION || "v23.0";

const WHATSAPP_PHONE_NUMBER_ID =
  process.env.WHATSAPP_PHONE_NUMBER_ID || "";

const WHATSAPP_ACCESS_TOKEN =
  process.env.WHATSAPP_ACCESS_TOKEN || "";

const WHATSAPP_VERIFY_TOKEN =
  process.env.WHATSAPP_VERIFY_TOKEN || "";

const WHATSAPP_TEMPLATE_NAME =
  process.env.WHATSAPP_TEMPLATE_NAME || "";

const WHATSAPP_TEMPLATE_LANGUAGE =
  process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US";

const DEFAULT_PHONE_COUNTRY_CODE =
  process.env.DEFAULT_PHONE_COUNTRY_CODE || "91";

const WHATSAPP_DELIVERY_WAIT_MS = 30000;






/* =========================================================

   STATUS

========================================================= */



function normalizeStatus(value) {

  const status = String(value || "").trim();



  if (status === "Cancelled") {

    return "Cancelled";

  }



  if (status === "Payment Not Received") {

    return "Payment Not Received";

  }



  // V2 / legacy "Active" records become Complete.

  return "Complete";

}





/* =========================================================

   NORMALIZE EXCEL ROW

========================================================= */



function normalizeRow(row = {}) {

  return {

    "Order ID":

      row["Order ID"] ??

      row["Order Id"] ??

      row.OrderID ??

      "",



    "Token Type":

      row["Token Type"] ??

      row["Token type"] ??

      "",



    Quantity:

      Number(row.Quantity ?? 0),



    "Token Start":

      row["Token Start"] ?? "",



    "Token End":

      row["Token End"] ?? "",



    Name:

      row.Name ?? "",



    Email:

      row.Email ?? "",



    Phone:

      row.Phone ?? "",



    Payment:

      row.Payment ??

      row["Payment Mode"] ??

      "",



    Amount:

      Number(row.Amount ?? 0) || 0,



    Date:

      row.Date ?? "",



    Time:

      row.Time ?? "",



    Status:

      normalizeStatus(row.Status),



    "Cancelled At":

      row["Cancelled At"] ?? "",



    "Admin Notes":

      row["Admin Notes"] ?? "",

    "WhatsApp Status":

      row["WhatsApp Status"] ?? "",

    "WhatsApp Message ID":

      row["WhatsApp Message ID"] ?? "",

  };

}





/* =========================================================

   CONVERT ROW → CLIENT ENTRY

========================================================= */



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

    whatsappStatus: String(
      r["WhatsApp Status"] || ""
    ),

    whatsappMessageId: String(
      r["WhatsApp Message ID"] || ""
    ),

    whatsappDelivered:
      ["Delivered", "Read"].includes(
        String(r["WhatsApp Status"] || "")
      ),

  };

}





/* =========================================================

   EXCEL LOCK CHECK

========================================================= */



function isLockedFileError(err) {

  return !!(

    err &&

    (

      err.code === "EBUSY" ||

      err.code === "EACCES" ||

      err.code === "EPERM" ||

      /being used by another process|locked|permission denied/i.test(

        err.message || ""

      )

    )

  );

}





/* =========================================================

   EXCEL WRITE CHECK

========================================================= */



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





/* =========================================================

   READ EXCEL

========================================================= */



function readExcel() {

  if (!fs.existsSync(FILE_PATH)) {

    return [];

  }



  const workbook = XLSX.readFile(FILE_PATH);



  const sheet =

    workbook.Sheets[SHEET_NAME] ||

    workbook.Sheets[workbook.SheetNames[0]];



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

========================================================= */



function writeExcel(rows) {

  assertExcelIsWritable();



  const normalized =

    rows.map(normalizeRow);



  const worksheet =

    XLSX.utils.json_to_sheet(

      normalized,

      {

        header: HEADERS,

      }

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



  const workbook =

    XLSX.utils.book_new();



  XLSX.utils.book_append_sheet(

    workbook,

    worksheet,

    SHEET_NAME

  );



  const tempPath =

    `${FILE_PATH}.tmp-${process.pid}-${Date.now()}`;



  try {

    XLSX.writeFile(

      workbook,

      tempPath

    );



    fs.renameSync(

      tempPath,

      FILE_PATH

    );

  } catch (err) {

    try {

      if (fs.existsSync(tempPath)) {

        fs.unlinkSync(tempPath);

      }

    } catch (_) {}



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






/* =========================================================
   WHATSAPP
========================================================= */

function normalizeWhatsAppPhone(phone) {
  const raw = String(phone || "").trim();

  if (!raw) return "";

  let digits = raw.replace(/\D/g, "");

  if (!digits) return "";

  if (digits.length === 10) {
    digits = `${DEFAULT_PHONE_COUNTRY_CODE}${digits}`;
  }

  return digits;
}

function getTokenRangeText(entry) {
  const start = String(entry["Token Start"] || "");
  const end = String(entry["Token End"] || "");

  return end && end !== start
    ? `${start} - ${end}`
    : start;
}

async function sendWhatsAppMessage(row) {
  const phone = normalizeWhatsAppPhone(row.Phone);

  if (!phone) {
    return {
      status: "No Phone",
      messageId: "",
    };
  }

  if (
    !WHATSAPP_PHONE_NUMBER_ID ||
    !WHATSAPP_ACCESS_TOKEN ||
    !WHATSAPP_TEMPLATE_NAME
  ) {
    console.warn(
      "WhatsApp is not configured. The order will require two printed labels."
    );

    return {
      status: "Not Configured",
      messageId: "",
    };
  }

  const url =
    `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/` +
    `${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization:
        `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: WHATSAPP_TEMPLATE_NAME,
        language: {
          code: WHATSAPP_TEMPLATE_LANGUAGE,
        },
        components: [
          {
            type: "body",
            parameters: [
              {
                type: "text",
                text: String(row.Name || ""),
              },
              {
                type: "text",
                text: getTokenRangeText(row),
              },
              {
                type: "text",
                text: String(row["Token Type"] || ""),
              },
              {
                type: "text",
                text: String(row.Quantity || ""),
              },
              {
                type: "text",
                text:
                  `₹${Number(row.Amount || 0).toFixed(2)}`,
              },
              {
                type: "text",
                text: String(row.Payment || ""),
              },
            ],
          },
        ],
      },
    }),
  });

  const payload =
    await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error(
      "WhatsApp send failed:",
      payload
    );

    return {
      status: "Failed",
      messageId: "",
    };
  }

  return {
    status: "Pending",
    messageId:
      payload?.messages?.[0]?.id || "",
  };
}

async function updateWhatsAppStatusByMessageId(
  messageId,
  status
) {
  if (!messageId) return;

  await withExcelAllocationLock(() => {
    const rows = readExcel();

    const index = rows.findIndex(
      (raw) =>
        String(
          normalizeRow(raw)["WhatsApp Message ID"] || ""
        ) === String(messageId)
    );

    if (index < 0) return;

    const row = normalizeRow(rows[index]);

    row["WhatsApp Status"] = status;

    rows[index] = row;

    writeExcel(rows);
  });
}

/* =========================================================

   TOKEN HELPERS

========================================================= */



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

  const match =

    String(token || "").match(/(\d+)$/);



  return match

    ? Number(match[1])

    : 0;

}





function makeTokenId(

  tokenType,

  serial

) {

  return (

    `${getTokenPrefix(tokenType)}${String(serial).padStart(4, "0")}`

  );

}





/* =========================================================

   TOKEN ALLOCATION



   Cancelled tokens are NOT considered used.

   Therefore they can be reused.

========================================================= */



function getNextTokenSerial(

  rows,

  tokenType,

  quantity

) {

  const used = new Set();



  for (const raw of rows) {

    const row =

      normalizeRow(raw);



    if (

      row["Token Type"] !== tokenType ||

      row.Status === "Cancelled"

    ) {

      continue;

    }



    const start =

      getSerialFromToken(

        row["Token Start"]

      );



    const qty =

      Number(row.Quantity) || 0;



    if (start > 0 && qty > 0) {

      for (

        let i = 0;

        i < qty;

        i++

      ) {

        used.add(start + i);

      }

    } else {

      const end =

        getSerialFromToken(

          row["Token End"]

        );



      if (

        start > 0 &&

        end >= start

      ) {

        for (

          let i = start;

          i <= end;

          i++

        ) {

          used.add(i);

        }

      }

    }

  }



  let candidate = 1;



  while (true) {

    let free = true;



    for (

      let i = 0;

      i < quantity;

      i++

    ) {

      if (

        used.has(

          candidate + i

        )

      ) {

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

========================================================= */



function getNextOrderNumber(rows) {

  let max = 0;



  for (const raw of rows) {

    const match =

      String(

        normalizeRow(raw)["Order ID"] || ""

      ).match(/(\d+)$/);



    if (match) {

      max =

        Math.max(

          max,

          Number(match[1])

        );

    }

  }



  return max + 1;

}





/* =========================================================

   EXCEL ALLOCATION LOCK



   Prevents two users from receiving

   the same token/order.

========================================================= */



let excelAllocationQueue =

  Promise.resolve();



function withExcelAllocationLock(

  work

) {

  const run =

    excelAllocationQueue.then(

      work,

      work

    );



  excelAllocationQueue =

    run.catch(() => {});



  return run;

}





/* =========================================================

   ADMIN AUTHENTICATION

========================================================= */



const ADMIN_TOKEN_TTL_MS =

  8 * 60 * 60 * 1000;



const ADMIN_TOKEN_SECRET =

  process.env.ADMIN_TOKEN_SECRET ||

  crypto

    .createHash("sha256")

    .update(

      `${process.env.ADMIN_USERNAME || ""}:${process.env.ADMIN_PASSWORD || ""}:SVARA-V3`

    )

    .digest("hex");





function base64url(value) {

  return Buffer

    .from(value)

    .toString("base64")

    .replace(/=/g, "")

    .replace(/\\+/g, "-")

    .replace(/\\//g, "_");

}





function signAdminPayload(

  payload

) {

  const encoded =

    base64url(

      JSON.stringify(payload)

    );



  const signature =

    crypto

      .createHmac(

        "sha256",

        ADMIN_TOKEN_SECRET

      )

      .update(encoded)

      .digest("base64url");



  return `${encoded}.${signature}`;

}





function createAdminToken(

  username

) {

  return signAdminPayload({

    sub: username,

    exp:

      Date.now() +

      ADMIN_TOKEN_TTL_MS,

  });

}





function verifyAdminToken(

  token

) {

  try {

    const [

      encoded,

      signature,

    ] =

      String(token || "")

        .split(".");



    if (

      !encoded ||

      !signature

    ) {

      return false;

    }



    const expected =

      crypto

        .createHmac(

          "sha256",

          ADMIN_TOKEN_SECRET

        )

        .update(encoded)

        .digest("base64url");



    const a =

      Buffer.from(signature);



    const b =

      Buffer.from(expected);



    if (

      a.length !== b.length ||

      !crypto.timingSafeEqual(

        a,

        b

      )

    ) {

      return false;

    }



    const payload =

      JSON.parse(

        Buffer

          .from(

            encoded,

            "base64url"

          )

          .toString("utf8")

      );



    return (

      payload.sub ===

        process.env.ADMIN_USERNAME &&

      Number(payload.exp) >

        Date.now()

    );

  } catch (_) {

    return false;

  }

}





function requireAdmin(

  req,

  res,

  next

) {

  const header =

    String(

      req.headers.authorization ||

        ""

    );



  const token =

    header.startsWith(

      "Bearer "

    )

      ? header.slice(7)

      : "";



  if (

    !verifyAdminToken(token)

  ) {

    return res

      .status(401)

      .json({

        error:

          "Admin authentication required.",

      });

  }



  next();

}





/* =========================================================

   GET PUBLIC ENTRIES

========================================================= */



app.get(

  "/entries",

  (req, res) => {

    try {

      res.json(

        readExcel()

          .map(toClientEntry)

      );

    } catch (err) {

      console.error(

        "GET /entries error:",

        err.message

      );



      res

        .status(500)

        .json({

          error:

            "Failed to read token entries.",

        });

    }

  }

);





/* =========================================================

   CREATE ORDER

========================================================= */




async function createOrder(entry) {
  if (
    !entry ||
    !ALLOWED_TOKEN_TYPES.includes(entry.tokenType)
  ) {
    throw Object.assign(
      new Error(
        "Invalid token type. Allowed values are Bullet, Saree and Silver."
      ),
      { statusCode: 400 }
    );
  }

  const quantity = Number(entry.quantity);

  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_QUANTITY
  ) {
    throw Object.assign(
      new Error(
        `Quantity must be a whole number between 1 and ${MAX_QUANTITY}.`
      ),
      { statusCode: 400 }
    );
  }

  if (!String(entry.name || "").trim()) {
    throw Object.assign(
      new Error("Customer name is required."),
      { statusCode: 400 }
    );
  }

  const phone = String(entry.phone || "").trim();

  if (
    phone &&
    !/^\+?[\d\s\-()]{7,15}$/.test(phone)
  ) {
    throw Object.assign(
      new Error("Enter a valid phone number."),
      { statusCode: 400 }
    );
  }

  const amount =
    TOKEN_PRICES[entry.tokenType] * quantity;

  const newRow =
    await withExcelAllocationLock(() => {
      const rows = readExcel();

      const nextOrder =
        getNextOrderNumber(rows);

      const orderId =
        `ORD${String(nextOrder).padStart(4, "0")}`;

      const nextSerial =
        getNextTokenSerial(
          rows,
          entry.tokenType,
          quantity
        );

      const now = new Date();

      const row = {
        "Order ID": orderId,
        "Token Type": entry.tokenType,
        Quantity: quantity,

        "Token Start":
          makeTokenId(
            entry.tokenType,
            nextSerial
          ),

        "Token End":
          makeTokenId(
            entry.tokenType,
            nextSerial + quantity - 1
          ),

        Name:
          String(entry.name).trim(),

        Email:
          String(entry.email || "").trim(),

        Phone: phone,

        Payment:
          String(entry.payment || ""),

        Amount: amount,

        Date:
          now.toLocaleDateString("en-IN"),

        Time:
          now.toLocaleTimeString(
            "en-IN",
            {
              hour: "2-digit",
              minute: "2-digit",
            }
          ),

        Status: "Complete",

        "Cancelled At": "",

        "Admin Notes": "",

        "WhatsApp Status":
          phone ? "Pending" : "No Phone",

        "WhatsApp Message ID": "",
      };

      rows.push(row);

      writeExcel(rows);

      return row;
    });

  const whatsapp =
    await sendWhatsAppMessage(newRow);

  newRow["WhatsApp Status"] =
    whatsapp.status;

  newRow["WhatsApp Message ID"] =
    whatsapp.messageId || "";

  await withExcelAllocationLock(() => {
    const rows = readExcel();

    const index = rows.findIndex(
      (raw) =>
        String(
          normalizeRow(raw)["Order ID"]
        ) === String(newRow["Order ID"])
    );

    if (index >= 0) {
      const row = normalizeRow(rows[index]);

      row["WhatsApp Status"] =
        whatsapp.status;

      row["WhatsApp Message ID"] =
        whatsapp.messageId || "";

      rows[index] = row;

      writeExcel(rows);
    }
  });

  return toClientEntry(newRow);
}

app.post(
  "/entries",
  async (req, res) => {
    try {
      const entry =
        await createOrder(req.body || {});

      res.json({
        success: true,
        entry,
      });
    } catch (err) {
      console.error(
        "POST /entries error:",
        err.message
      );

      res
        .status(err.statusCode || 500)
        .json({
          error:
            err.message ||
            "Failed to save token order.",
        });
    }
  }
);

/* =========================================================
   ADMIN CREATE ORDER
========================================================= */

app.post(
  "/admin/entries",
  requireAdmin,
  async (req, res) => {
    try {
      const entry =
        await createOrder(req.body || {});

      res.json({
        success: true,
        entry,
      });
    } catch (err) {
      console.error(
        "POST /admin/entries error:",
        err.message
      );

      res
        .status(err.statusCode || 500)
        .json({
          error:
            err.message ||
            "Failed to create admin token.",
        });
    }
  }
);

/* =========================================================
   WHATSAPP STATUS
========================================================= */

app.get(
  "/whatsapp/status/:orderId",
  async (req, res) => {
    try {
      const orderId =
        String(req.params.orderId || "");

      const rows = readExcel();

      const row = rows.find(
        (raw) =>
          String(
            normalizeRow(raw)["Order ID"]
          ) === orderId
      );

      if (!row) {
        return res
          .status(404)
          .json({
            error: "Registration not found.",
          });
      }

      const normalized =
        normalizeRow(row);

      res.json({
        orderId,
        status:
          normalized["WhatsApp Status"] ||
          "Not Configured",
        delivered:
          ["Delivered", "Read"].includes(
            normalized["WhatsApp Status"]
          ),
      });
    } catch (err) {
      res
        .status(500)
        .json({
          error:
            "Unable to read WhatsApp status.",
        });
    }
  }
);

/* =========================================================
   WHATSAPP WEBHOOK
========================================================= */

app.get(
  "/webhooks/whatsapp",
  (req, res) => {
    const mode =
      String(req.query["hub.mode"] || "");

    const token =
      String(
        req.query["hub.verify_token"] || ""
      );

    const challenge =
      String(
        req.query["hub.challenge"] || ""
      );

    if (
      mode === "subscribe" &&
      token === WHATSAPP_VERIFY_TOKEN
    ) {
      return res
        .status(200)
        .send(challenge);
    }

    return res.sendStatus(403);
  }
);

app.post(
  "/webhooks/whatsapp",
  async (req, res) => {
    try {
      const body = req.body || {};

      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value || {};

          for (
            const statusItem of
            value.statuses || []
          ) {
            const status =
              String(
                statusItem.status || ""
              ).toLowerCase();

            let mappedStatus = "";

            if (status === "sent") {
              mappedStatus = "Sent";
            } else if (
              status === "delivered"
            ) {
              mappedStatus = "Delivered";
            } else if (status === "read") {
              mappedStatus = "Read";
            } else if (
              status === "failed"
            ) {
              mappedStatus = "Failed";
            }

            if (mappedStatus) {
              await updateWhatsAppStatusByMessageId(
                statusItem.id,
                mappedStatus
              );
            }
          }
        }
      }

      res.sendStatus(200);
    } catch (err) {
      console.error(
        "WhatsApp webhook error:",
        err.message
      );

      res.sendStatus(200);
    }
  }
);

/* =========================================================

   UPDATE STATUS



   Complete ↔ Payment Not Received



   Cancelled cannot be changed.

========================================================= */



app.post(

  "/entries/:orderId/status",

  async (req, res) => {

    try {

      const orderId =

        String(

          req.params.orderId ||

            ""

        );



      const requested =

        String(

          req.body?.status ||

            ""

        ).trim();



      if (

        ![

          "Complete",

          "Payment Not Received",

        ].includes(requested)

      ) {

        return res

          .status(400)

          .json({

            error:

              "Status must be Complete or Payment Not Received.",

          });

      }



      const updated =

        await withExcelAllocationLock(

          () => {

            const rows =

              readExcel();



            const index =

              rows.findIndex(

                (r) =>

                  String(

                    r["Order ID"]

                  ) === orderId

              );



            if (index < 0) {

              throw Object.assign(

                new Error(

                  "Registration not found."

                ),

                {

                  statusCode: 404,

                }

              );

            }



            const row =

              normalizeRow(

                rows[index]

              );



            if (

              row.Status ===

              "Cancelled"

            ) {

              throw Object.assign(

                new Error(

                  "Cancelled registrations cannot be changed."

                ),

                {

                  statusCode: 400,

                }

              );

            }



            row.Status =

              requested;



            rows[index] =

              row;



            writeExcel(

              rows

            );



            return row;

          }

        );



      res.json({

        success: true,

        entry:

          toClientEntry(

            updated

          ),

      });

    } catch (err) {

      res

        .status(

          err.statusCode ||

            500

        )

        .json({

          error:

            err.message ||

            "Failed to update status.",

        });

    }

  }

);





/* =========================================================

   CANCEL ORDER



   Cancelled is permanent.

========================================================= */



app.post(

  "/entries/:orderId/cancel",

  async (req, res) => {

    try {

      const orderId =

        String(

          req.params.orderId ||

            ""

        );



      const phone =

        String(

          req.body?.phone ||

            ""

        ).trim();



      if (!phone) {

        return res

          .status(400)

          .json({

            error:

              "Phone number is required.",

          });

      }



      const updated =

        await withExcelAllocationLock(

          () => {

            const rows =

              readExcel();



            const index =

              rows.findIndex(

                (r) =>

                  String(

                    r["Order ID"]

                  ) === orderId

              );



            if (index < 0) {

              throw Object.assign(

                new Error(

                  "Registration not found."

                ),

                {

                  statusCode: 404,

                }

              );

            }



            const row =

              normalizeRow(

                rows[index]

              );



            if (

              row.Status ===

              "Cancelled"

            ) {

              throw Object.assign(

                new Error(

                  "This registration is already cancelled."

                ),

                {

                  statusCode: 400,

                }

              );

            }



            if (

              String(

                row.Phone

              ).trim() !== phone

            ) {

              throw Object.assign(

                new Error(

                  "Phone number does not match this registration."

                ),

                {

                  statusCode: 401,

                }

              );

            }



            row.Status =

              "Cancelled";



            row["Cancelled At"] =

              new Date().toLocaleString(

                "en-IN"

              );



            rows[index] =

              row;



            writeExcel(

              rows

            );



            return row;

          }

        );



      res.json({

        success: true,

        entry:

          toClientEntry(

            updated

          ),

      });

    } catch (err) {

      res

        .status(

          err.statusCode ||

            500

        )

        .json({

          error:

            err.message ||

            "Failed to cancel token.",

        });

    }

  }

);





/* =========================================================

   ADMIN LOGIN

========================================================= */



app.post(

  "/admin/login",

  (req, res) => {

    const username =

      String(

        req.body?.username ||

          ""

      ).trim();



    const password =

      String(

        req.body?.password ||

          ""

      );



    const expectedUsername =

      process.env.ADMIN_USERNAME;



    const expectedPassword =

      process.env.ADMIN_PASSWORD;



    if (

      !expectedUsername ||

      !expectedPassword

    ) {

      return res

        .status(500)

        .json({

          error:

            "Admin credentials are not configured on the server.",

        });

    }



    if (

      username !==

        expectedUsername ||

      password !==

        expectedPassword

    ) {

      return res

        .status(401)

        .json({

          error:

            "Invalid admin credentials.",

        });

    }



    res.json({

      success: true,

      token:

        createAdminToken(

          username

        ),

      expiresIn:

        ADMIN_TOKEN_TTL_MS,

    });

  }

);





/* =========================================================

   ADMIN RECEIVED DASHBOARD

========================================================= */



app.get(

  "/admin/received",

  requireAdmin,

  (req, res) => {

    try {

      const entries =

        readExcel()

          .map(

            toClientEntry

          );



      const summary =

        entries.reduce(

          (acc, e) => {

            const qty =

              Number(

                e.quantity

              ) || 0;



            acc.totalOrders += 1;



            acc.totalTokens +=

              qty;



            if (

              e.status ===

              "Complete"

            ) {

              acc.completedOrders +=

                1;



              acc.completedTokens +=

                qty;



              acc.totalAmountReceived +=

                Number(

                  e.amount

                ) || 0;

            } else if (

              e.status ===

              "Payment Not Received"

            ) {

              acc.paymentNotReceivedOrders +=

                1;



              acc.paymentNotReceivedTokens +=

                qty;

            } else if (

              e.status ===

              "Cancelled"

            ) {

              acc.cancelledOrders +=

                1;



              acc.cancelledTokens +=

                qty;

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

          }

        );



      res.json({

        summary,

        entries,

      });

    } catch (err) {

      res

        .status(500)

        .json({

          error:

            "Failed to load admin data.",

        });

    }

  }

);





/* =========================================================

   ADMIN NOTES

========================================================= */



app.post(

  "/admin/notes/:orderId",

  requireAdmin,

  async (req, res) => {

    try {

      const orderId =

        String(

          req.params.orderId ||

            ""

        );



      const notes =

        String(

          req.body?.notes ||

            ""

        ).trim();



      const updated =

        await withExcelAllocationLock(

          () => {

            const rows =

              readExcel();



            const index =

              rows.findIndex(

                (r) =>

                  String(

                    r["Order ID"]

                  ) === orderId

              );



            if (index < 0) {

              throw Object.assign(

                new Error(

                  "Registration not found."

                ),

                {

                  statusCode: 404,

                }

              );

            }



            const row =

              normalizeRow(

                rows[index]

              );



            row["Admin Notes"] =

              notes;



            rows[index] =

              row;



            writeExcel(

              rows

            );



            return row;

          }

        );



      res.json({

        success: true,

        entry:

          toClientEntry(

            updated

          ),

      });

    } catch (err) {

      res

        .status(

          err.statusCode ||

            500

        )

        .json({

          error:

            err.message ||

            "Failed to save admin notes.",

        });

    }

  }

);





/* =========================================================

   ADMIN-ONLY EXCEL DOWNLOAD

========================================================= */



app.get(

  "/admin/download-excel",

  requireAdmin,

  (req, res) => {

    if (

      !fs.existsSync(

        FILE_PATH

      )

    ) {

      return res

        .status(404)

        .json({

          error:

            "No Excel file has been created yet.",

        });

    }



    res.download(

      FILE_PATH,

      "svara-token-registrations.xlsx",

      (err) => {

        if (err) {

          console.error(

            "Admin download error:",

            err.message

          );

        }

      }

    );

  }

);





/* =========================================================

   ADMIN-ONLY CLEAR

========================================================= */



app.post(

  "/admin/clear",

  requireAdmin,

  async (req, res) => {

    try {

      await withExcelAllocationLock(

        () => writeExcel([])

      );



      res.json({

        success: true,

        message:

          "All registrations have been cleared.",

      });

    } catch (err) {

      res

        .status(

          err.statusCode ||

            500

        )

        .json({

          error:

            err.message ||

            "Failed to clear registrations.",

        });

    }

  }

);





/* =========================================================

   TEST

========================================================= */



app.get(

  "/test",

  (req, res) =>

    res.json({

      ok: true,

      message:

        "SVARA server is running.",

    })

);





/* =========================================================

   START SERVER

========================================================= */



const PORT =

  process.env.PORT || 4000;



app.listen(

  PORT,

  "0.0.0.0",

  () => {

    console.log(

      "=============================================="

    );



    console.log(

      "SVARA V3 Token Server is running"

    );



    console.log(

      `Port: ${PORT}`

    );



    console.log(

      `Excel file: ${FILE_PATH}`

    );



    console.log(

      `Tokens: ${ALLOWED_TOKEN_TYPES.join(", ")}`

    );



    console.log(

      "=============================================="

    );

  }

);