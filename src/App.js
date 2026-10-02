import { useEffect, useRef, useState } from "react";

const API =
  process.env.REACT_APP_API_URL ||
  "http://localhost:4000";

/* =========================================================
   TOKEN CONFIGURATION
   Keep the existing token sequence:
   Bullet -> BUL0001
   Saree  -> SAR0001
   Silver -> SLV0001
========================================================= */

const TOKEN_TYPES = {
  Bullet: {
    label: "Bullet",
    prefix: "BUL",
    icon: "🏍️",
    accent: "#7c3aed",
    light: "#f5f3ff",
    price: 301,
  },

  Saree: {
    label: "Saree",
    prefix: "SAR",
    icon: "🥻",
    accent: "#db2777",
    light: "#fdf2f8",
    price: 101,
  },

  Silver: {
    label: "Silver",
    prefix: "SLV",
    icon: "🥈",
    accent: "#475569",
    light: "#f8fafc",
    price: 201,
  },
};


/* =========================================================
   API
========================================================= */

async function loadEntries() {
  const res = await fetch(`${API}/entries`);

  if (!res.ok) {
    throw new Error("Unable to load registrations.");
  }

  return await res.json();
}

// async function clearEntries(
//   username,
//   password
// ) {
//   const res = await fetch(
//     `${API}/admin/clear`,
//     {
//       method: "POST",
//       headers: {
//         "Content-Type":
//           "application/json",
//       },
//       body: JSON.stringify({
//         username,
//         password,
//       }),
//     }
//   );

//   const payload =
//     await res.json().catch(() => ({}));

//   if (!res.ok) {
//     throw new Error(
//       payload.error ||
//         "Unable to clear registrations."
//     );
//   }

//   return payload;
// }

async function cancelEntry(
  orderId,
  password
) {
  const res = await fetch(
    `${API}/entries/${encodeURIComponent(
      orderId
    )}/cancel`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        cancelPassword: password,
      }),
    }
  );

  const payload =
    await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      payload.error ||
        "Unable to cancel token."
    );
  }

  return payload.entry;
}

async function saveEntry(entry) {
  const res = await fetch(
    `${API}/entries`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body:
        JSON.stringify(entry),
    }
  );


  if (!res.ok) {

    const payload =
      await res
        .json()
        .catch(() => ({}));


    throw new Error(
      payload.error ||
        "Unable to save registration."
    );

  }


  const payload =
    await res
      .json()
      .catch(() => ({}));


  /*
   * The backend returns:
   *
   * {
   *   success: true,
   *   entry: {...}
   * }
   *
   * Return the actual allocated
   * entry to the application.
   */

  return (
    payload.entry ||
    payload
  );
}



async function saveAdminEntry(entry) {
  const result = await adminFetch("/admin/entries", {
    method: "POST",
    body: JSON.stringify(entry),
  });

  return result.entry || result;
}


/* =========================================================
   TOKEN HELPERS
========================================================= */

function getTokenConfig(type) {
  return TOKEN_TYPES[type] || TOKEN_TYPES.Bullet;
}


function makeTokenId(type, serial) {
  const config = getTokenConfig(type);

  return `${config.prefix}${String(serial).padStart(4, "0")}`;
}


function getSerialFromToken(token) {
  if (!token) return 0;

  const match = String(token).match(/(\d+)$/);

  return match ? parseInt(match[1], 10) : 0;
}

// function downloadCentralExcel() {

//   window.open(
//     `${API}/download-excel`,
//     "_blank"
//   );

// }
async function adminLogin(username, password) {
  const res = await fetch(`${API}/admin/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      payload.error || "Invalid admin credentials."
    );
  }

  return payload;
}


async function adminFetch(path, options = {}) {
  const token =
    sessionStorage.getItem("svara_admin_token");

  const res = await fetch(`${API}${path}`, {
    ...options,

    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token || ""}`,
      "Content-Type": "application/json",
    },
  });

  const payload =
    await res.json().catch(() => ({}));

  if (res.status === 401) {
    sessionStorage.removeItem(
      "svara_admin_token"
    );

    throw new Error(
      "Admin session expired. Please log in again."
    );
  }

  if (!res.ok) {
    throw new Error(
      payload.error ||
        "Admin request failed."
    );
  }

  return payload;
}


async function clearEntries(adminToken) {
  const res = await fetch(
    `${API}/admin/clear`,
    {
      method: "POST",

      headers: {
        Authorization:
          `Bearer ${adminToken || ""}`,
        "Content-Type":
          "application/json",
      },
    }
  );

  const payload =
    await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      payload.error ||
        "Unable to clear registrations."
    );
  }

  return payload;
}


async function updateEntryStatus(orderId, status) {
  const adminToken = sessionStorage.getItem("svara_admin_token");
  const headers = { "Content-Type": "application/json" };
  if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
  const res = await fetch(`${API}/entries/${encodeURIComponent(orderId)}/status`, {
    method: "POST", headers, body: JSON.stringify({ status }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || "Unable to update status.");
  return payload.entry;
}

async function adminCancelEntry(orderId) {
  const adminToken = sessionStorage.getItem("svara_admin_token");
  if (!adminToken) throw new Error("Admin login required.");
  const res = await fetch(`${API}/entries/${encodeURIComponent(orderId)}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || "Unable to cancel token.");
  return payload.entry;
}


async function loadAdminData() {
  return adminFetch(
    "/admin/received"
  );
}


async function saveAdminNotes(
  orderId,
  notes
) {
  return adminFetch(
    `/admin/notes/${encodeURIComponent(
      orderId
    )}`,
    {
      method: "POST",

      body: JSON.stringify({
        notes,
      }),
    }
  );
}


function downloadAdminExcel() {
  const token =
    sessionStorage.getItem(
      "svara_admin_token"
    );

  if (!token) {
    alert("Admin login required.");
    return;
  }

  fetch(
    `${API}/admin/download-excel`,
    {
      headers: {
        Authorization:
          `Bearer ${token}`,
      },
    }
  )
    .then(async (res) => {
      if (!res.ok) {
        const payload =
          await res
            .json()
            .catch(() => ({}));

        throw new Error(
          payload.error ||
            "Unable to download Excel."
        );
      }

      return res.blob();
    })
    .then((blob) => {
      const blobUrl =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = blobUrl;
      link.download =
        "svara-token-registrations.xlsx";

      document.body.appendChild(link);

      link.click();

      link.remove();

      setTimeout(
        () =>
          URL.revokeObjectURL(
            blobUrl
          ),
        1000
      );
    })
    .catch((error) => {
      alert(
        error.message ||
          "Unable to download Excel."
      );
    });
}

/*
 * IMPORTANT:
 * This preserves the existing sequence behavior.
 * It looks at the highest existing token number for that category.
 */
function nextTokenSerial(entries, type, quantity = 1) {
  const used = new Set();

  entries
    .filter(
      (entry) =>
        entry.tokenType === type &&
        String(entry.status || "Active").toLowerCase() !== "cancelled"
    )
    .forEach((entry) => {
      const start = getSerialFromToken(entry.tokenStart);
      const end = getSerialFromToken(entry.tokenEnd);

      if (!start || !end) return;

      for (let i = start; i <= end; i++) {
        used.add(i);
      }
    });

  let candidate = 1;

  while (true) {
    let available = true;

    for (let i = candidate; i < candidate + Number(quantity); i++) {
      if (used.has(i)) {
        available = false;
        break;
      }
    }

    if (available) {
      return candidate;
    }

    candidate++;
  }
}


function getTokenIds(entry) {
  const quantity = Number(entry.quantity) || 1;

  const startSerial = getSerialFromToken(entry.tokenStart);

  return Array.from(
    { length: quantity },
    (_, index) => makeTokenId(entry.tokenType, startSerial + index)
  );
}


// function nextOrderNumber(entries) {
//   let max = 0;

//   entries.forEach((entry) => {
//     const value = String(entry.orderId || "");
//     const match = value.match(/(\d+)$/);

//     if (match) {
//       max = Math.max(max, parseInt(match[1], 10));
//     }
//   });

//   return max + 1;
// }


/* =========================================================
   EXCEL EXPORT
========================================================= */

// function exportToExcel(entries) {
//   if (!entries.length) return;

//   const rows = entries.map((entry) => ({
//     "Order ID": entry.orderId || "",
//     "Token Type": entry.tokenType || "",
//     Quantity: entry.quantity || "",
//     "Token Start": entry.tokenStart || "",
//     "Token End": entry.tokenEnd || "",
//     Name: entry.name || "",
//     Email: entry.email || "",
//     Phone: entry.phone || "",
//     "Payment Mode": entry.payment || "",
//     Date: entry.date || "",
//     Time: entry.time || "",
//   }));

//   const worksheet = XLSX.utils.json_to_sheet(rows);

//   worksheet["!cols"] = [
//     { wch: 14 },
//     { wch: 14 },
//     { wch: 10 },
//     { wch: 14 },
//     { wch: 14 },
//     { wch: 24 },
//     { wch: 28 },
//     { wch: 18 },
//     { wch: 16 },
//     { wch: 14 },
//     { wch: 12 },
//   ];

//   const workbook = XLSX.utils.book_new();

//   XLSX.utils.book_append_sheet(
//     workbook,
//     worksheet,
//     "Registrations"
//   );

//   try {
//     XLSX.writeFile(workbook, "SVARA-Registrations.xlsx");
//   } catch (error) {
//     alert("Excel file is open. Please close it before exporting.");
//   }
// }


/* =========================================================
   PRINT LABELS
   TWO IDENTICAL LABELS FOR EVERY TOKEN
========================================================= */

/* =========================================================
   PRINT LABELS
   TWO IDENTICAL LABELS FOR EVERY TOKEN
========================================================= */

function printLabels(entry) {
  const tokenIds = getTokenIds(entry);

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const category = escapeHtml(entry.tokenType);
  const name = escapeHtml(entry.name);
  const phone = escapeHtml(entry.phone);
  const payment = escapeHtml(entry.payment);
  const date = escapeHtml(entry.date);
  const time = escapeHtml(entry.time);

  const copiesPerToken = 2;

  const labels = tokenIds
    .map((tokenId) =>
      Array.from(
        { length: copiesPerToken },
        () =>
          createLabelHtml({
            tokenId,
            category,
            name,
            phone,
            payment,
            date,
            time,
          })
      ).join("")
    )
    .join("");

  const printWindow = window.open(
    "",
    "_blank",
    "width=420,height=750"
  );

  if (!printWindow) {
    alert("Please allow pop-ups to print the labels.");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>

      <head>

        <title>SVARA Token Labels</title>

        <style>

          * {
            box-sizing: border-box;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-family: Arial, Helvetica, sans-serif;
            color: #111111;
          }

          @page {
            size: 80mm auto;
            margin: 0;
          }

          .label {
            width: 80mm;
            min-height: 72mm;

            padding: 6mm 5mm 5mm;

            display: flex;
            flex-direction: column;

            background: #ffffff;

            page-break-after: always;
            break-after: page;
          }

          .header {
            text-align: center;
          }

          .brand {
            font-size: 23px;
            font-weight: 900;
            letter-spacing: 3px;
            margin-bottom: 5px;
          }

          .datetime {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 7px;

            font-size: 10px;
            font-weight: 600;
            color: #555555;
          }

          .separator {
            color: #aaaaaa;
          }

          .divider {
            border-top: 1px dashed #aaaaaa;
            margin: 5mm 0;
          }

          .content {
            display: flex;
            flex-direction: column;
            gap: 3.2mm;
          }

          /* CATEGORY */

          .category-field {
            width: 100%;
            text-align: center;
          }

          .category-box {
            display: inline-block;

            border: 2px solid #111111;

            padding: 2.5mm 7mm;

            font-size: 20px;
            font-weight: 900;

            letter-spacing: 1.5px;

            margin: 0 auto;
          }

          /* TOKEN NUMBER */

          .token-field {
            padding: 1.5mm 0 2mm;
          }

          .token-number {
            font-size: 31px;
            font-weight: 900;

            letter-spacing: 2px;

            text-align: center;
          }

          /* DETAILS */

          .detail-row {
            display: flex;

            align-items: center;

            justify-content: space-between;

            width: 100%;

            gap: 8px;

            font-size: 11px;

            line-height: 1.5;
          }

          .field-label {
            flex: 0 0 auto;

            font-size: 9px;

            font-weight: 800;

            letter-spacing: 0.8px;

            color: #111111;

            text-align: left;

            white-space: nowrap;
          }

          .field-value {
            flex: 1;

            min-width: 0;

            font-size: 11px;

            font-weight: 700;

            color: #111111;

            text-align: right;

            word-break: break-word;
          }

          /* FOOTER */

          .footer {
            text-align: center;

            margin-top: auto;
          }

          .thank-you {
            font-size: 12px;

            font-weight: 800;

            margin-bottom: 2px;
          }

          @media print {

            html,
            body {
              width: 80mm;
              margin: 0;
              padding: 0;
            }

            .label {
              page-break-after: always;
              break-after: page;
            }

            .label:last-child {
              page-break-after: auto;
              break-after: auto;
            }

          }

        </style>

      </head>

      <body>

        ${labels}

        <script>

          window.onload = function () {

            setTimeout(function () {

              window.print();

            }, 300);

          };

        </script>

      </body>

    </html>
  `);

  printWindow.document.close();
}


function createLabelHtml({
  tokenId,
  category,
  name,
  phone,
  payment,
  date,
  time,
}) {
  return `
    <div class="label">

      <!-- HEADER -->

      <div class="header">

        <div class="brand">
          SVARA
        </div>

        <div class="datetime">

          <span>${date}</span>

          <span class="separator">|</span>

          <span>${time}</span>

        </div>

      </div>


      <div class="divider"></div>


      <!-- CONTENT -->

      <div class="content">

        <!-- CATEGORY -->

        <div class="category-field">

          <div class="category-box">
            ${category.toUpperCase()}
          </div>

        </div>


        <!-- TOKEN NUMBER -->

        <div class="token-field">

          <div class="token-number">
            ${tokenId}
          </div>

        </div>


        <!-- NAME -->

        <div class="detail-row">

          <span class="field-label">
            NAME
          </span>

          <span class="field-value">
            ${name}
          </span>

        </div>


        <!-- PHONE -->

        <div class="detail-row">

          <span class="field-label">
            PHONE
          </span>

          <span class="field-value">
            ${phone}
          </span>

        </div>


        <!-- PAYMENT -->

        <div class="detail-row">

          <span class="field-label">
            PAYMENT MODE
          </span>

          <span class="field-value">
            ${payment}
          </span>

        </div>

      </div>


      <div class="divider"></div>


      <!-- FOOTER -->

      <div class="footer">

        <div class="thank-you">
          Thank you! 🙏
        </div>

      </div>

    </div>
  `;
}


/* =========================================================
   STYLES
========================================================= */

const S = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(135deg, #f8fafc 0%, #f5f3ff 100%)",
    fontFamily:
      "'Inter', 'Segoe UI', Arial, sans-serif",
    color: "#111827",
  },

  container: {
    width: "min(1180px, calc(100% - 40px))",
    margin: "0 auto",
  },

  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "24px 0",
  },

  logo: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  logoMark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    background:
      "linear-gradient(135deg, #111827, #4c1d95)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: 1,
  },

  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 22,
    boxShadow: "0 10px 35px rgba(15,23,42,.06)",
  },

  button: {
    border: "none",
    cursor: "pointer",
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 14,
    transition:
      "transform .15s ease, box-shadow .15s ease",
  },

  input: {
    width: "100%",
    padding: "13px 15px",
    borderRadius: 12,
    border: "1px solid #d1d5db",
    background: "#fff",
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
  },

  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    color: "#374151",
    marginBottom: 7,
  },
};

const responsiveStyles = `
  * {
    box-sizing: border-box;
  }

  html,
  body,
  #root {
    width: 100%;
    min-height: 100%;
    margin: 0;
  }

  body {
    overflow-x: hidden;
  }

  button,
  input,
  select {
    max-width: 100%;
  }

  @media (max-width: 768px) {
    .svara-container {
      width: 100% !important;
      max-width: 100% !important;
      padding: 14px !important;
    }
    .svara-stats-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
}

    .svara-topbar {
      flex-wrap: wrap !important;
      gap: 12px !important;
    }

    .svara-category-grid {
      grid-template-columns: 1fr !important;
    }

    .svara-form-grid {
      grid-template-columns: 1fr !important;
    }

    .svara-card {
      padding: 18px !important;
    }

    .svara-dashboard-table {
      overflow-x: auto !important;
      -webkit-overflow-scrolling: touch;
    }

    .svara-dashboard-table table {
      min-width: 850px;
    }
  }

  @media (max-width: 480px) {
    .svara-container {
      padding: 10px !important;
    }

    .svara-card {
      border-radius: 14px !important;
      padding: 15px !important;
    }
    
    .svara-modal-actions {
    flex-direction: column !important;
  }
    .svara-dashboard-header {
  flex-direction: column !important;
  align-items: stretch !important;
  gap: 12px !important;
}

.svara-dashboard-actions {
  width: 100% !important;
  justify-content: flex-end !important;
}

    input,
    select {
      font-size: 16px !important;
    }
  }
`;


/* =========================================================
   PAYMENT MODAL
========================================================= */

function PaymentModal({
  onSelect,
  onCancel,
}) {
  return (
    <div style={modalStyles.overlay}>

      <div
        style={{
          ...modalStyles.modal,
          maxWidth: 460,
        }}
      >

        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            background: "#f5f3ff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 25,
            margin: "0 auto 18px",
          }}
        >
          💳
        </div>

        <h2
          style={{
            margin: 0,
            textAlign: "center",
            fontSize: 23,
            fontWeight: 800,
          }}
        >
          Select Payment Mode
        </h2>

        <p
          style={{
            textAlign: "center",
            color: "#6b7280",
            fontSize: 14,
            marginTop: 8,
            marginBottom: 26,
          }}
        >
          Choose how the customer is paying
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",
            gap: 14,
          }}
        >

          <button
            onClick={() => onSelect("Cash")}
            style={{
              ...S.button,
              padding: "22px 15px",
              background: "#ecfdf5",
              color: "#047857",
              border: "1px solid #a7f3d0",
            }}
          >
            <div style={{ fontSize: 28 }}>💵</div>

            <div
              style={{
                marginTop: 8,
                fontSize: 15,
              }}
            >
              Cash
            </div>
          </button>


          <button
            onClick={() => onSelect("Online")}
            style={{
              ...S.button,
              padding: "22px 15px",
              background: "#eff6ff",
              color: "#1d4ed8",
              border: "1px solid #bfdbfe",
            }}
          >
            <div style={{ fontSize: 28 }}>📱</div>

            <div
              style={{
                marginTop: 8,
                fontSize: 15,
              }}
            >
              Online
            </div>
          </button>

        </div>


        <button
          onClick={onCancel}
          style={{
            display: "block",
            margin: "22px auto 0",
            border: "none",
            background: "transparent",
            color: "#6b7280",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          ← Go back
        </button>

      </div>

    </div>
  );
}


/* =========================================================
   REGISTRATION SUCCESS MODAL
========================================================= */

function SuccessModal({
  entry,
  onClose,
}) {
  const config = getTokenConfig(entry.tokenType);
  const tokenIds = getTokenIds(entry);

  return (
    <div style={modalStyles.overlay}>

      <div
        style={{
          ...modalStyles.modal,
          maxWidth: 520,
          textAlign: "center",
        }}
      >

        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "#ecfdf5",
            color: "#059669",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 30,
            margin: "0 auto 16px",
          }}
        >
          ✓
        </div>


        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: "#6b7280",
            letterSpacing: 1.5,
          }}
        >
          REGISTRATION COMPLETE
        </div>


        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: "#6b7280",
          }}
        >
          {config.icon} {entry.tokenType}
        </div>


        <div
          style={{
            margin: "8px 0 5px",
            fontSize: 42,
            fontWeight: 900,
            letterSpacing: 2,
            fontFamily: "monospace",
            color: config.accent,
          }}
        >
          {tokenIds.length === 1
            ? tokenIds[0]
            : `${tokenIds[0]} – ${
                tokenIds[tokenIds.length - 1]
              }`}
        </div>


        <div
          style={{
            color: "#6b7280",
            fontSize: 14,
            marginBottom: 25,
          }}
        >
          {entry.quantity} token
          {entry.quantity > 1 ? "s" : ""} generated
        </div>


        <div
          style={{
            background: "#f8fafc",
            borderRadius: 14,
            padding: "15px 18px",
            textAlign: "left",
            marginBottom: 22,
          }}
        >

          <div style={successRow}>
            <span>Name</span>
            <strong>{entry.name}</strong>
          </div>

          <div style={successRow}>
            <span>Phone</span>
            <strong>{entry.phone}</strong>
          </div>

          <div style={successRow}>
            <span>Payment</span>
            <strong>{entry.payment}</strong>
          </div>

          <div style={successRow}>
            <span>Amount</span>
            <strong>₹{Number(entry.amount || 0).toFixed(2)}</strong>
          </div>


          <div style={successRow}>
            <span>Date</span>
            <strong>{entry.date}</strong>
          </div>

          <div style={successRow}>
            <span>Time</span>
            <strong>{entry.time}</strong>
          </div>

        </div>


        <div
          className="svara-modal-actions"
          style={{
            display: "flex",
            gap: 10,
          }}
        >

          <button
            onClick={() => printLabels(entry)}
            style={{
              ...S.button,
              flex: 1,
              padding: "13px 16px",
              background: "#111827",
              color: "#fff",
            }}
          >
            🖨️ Print Labels
          </button>


          <button
            onClick={onClose}
            style={{
              ...S.button,
              padding: "13px 20px",
              background: "#f3f4f6",
              color: "#374151",
            }}
          >
            Done
          </button>

        </div>

      </div>

    </div>
  );
}


const successRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 15,
  padding: "7px 0",
  fontSize: 13,
  color: "#6b7280",
};


/* =========================================================
   REGISTRATION FORM
========================================================= */

function FormScreen({
  type,
  entries,
  onSubmit,
  onBack,
  adminMode = false,
}) {
  const [selectedType, setSelectedType] = useState(type);
  const config = getTokenConfig(selectedType);

  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [errors, setErrors] = useState({});
  const [showPayment, setShowPayment] = useState(false);

  const nameRef = useRef(null);


  useEffect(() => {
    nameRef.current?.focus();
  }, []);


 const safeQuantity =
  Number(quantity) || 1;

const nextSerial = nextTokenSerial(
  entries,
  selectedType,
  safeQuantity
);

const previewStart = makeTokenId(
  selectedType,
  nextSerial
);

const previewEnd = makeTokenId(
  selectedType,
  nextSerial + safeQuantity - 1
);


  function validate() {
    const validationErrors = {};
    
    if (
    !quantity ||
    Number(quantity) < 1 ||
    !Number.isInteger(Number(quantity))
  ) {
    validationErrors.quantity =
      "Enter at least 1 token.";
  }

    if (!name.trim()) {
      validationErrors.name =
        "Name is required.";
    }

    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
      )
    ) {
      validationErrors.email =
        "Enter a valid email address.";
    }

    if (
      phone.trim() &&
      !/^\+?[\d\s\-()]{7,15}$/.test(
        phone
      )
    ) {
      validationErrors.phone =
        "Enter a valid phone number.";
    }

    setErrors(validationErrors);

    return (
      Object.keys(validationErrors).length ===
      0
    );
  }


  function handleContinue() {
    if (validate()) {
      setShowPayment(true);
    }
  }


function handlePayment(mode) {

  /*
   * IMPORTANT:
   *
   * Do NOT generate:
   * - Order ID
   * - Token Start
   * - Token End
   * - Date
   * - Time
   *
   * here.
   *
   * The server will generate all of
   * those values from the central Excel.
   */

  const entry = {

    tokenType:
      selectedType,

    quantity:
      Number(quantity),

    name:
      name.trim(),

    email:
      email.trim(),

    phone:
      phone.trim(),

    payment:
      mode,
  };


  setShowPayment(false);


  onSubmit(entry);
}


  return (
    <div style={S.page}>

      {showPayment && (
        <PaymentModal
          onSelect={handlePayment}
          onCancel={() =>
            setShowPayment(false)
          }
        />
      )}


      <div
  className="svara-container"
  style={S.container}
>

        {/* TOP BAR */}

        <div className="svara-topbar" style={S.topBar}>

          <button
            onClick={onBack}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "#64748b",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            ← Dashboard
          </button>


          <div style={S.logo}>

            <div style={S.logoMark}>
              S
            </div>

            <div>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 17,
                  letterSpacing: 1,
                }}
              >
                SVARA
              </div>

              <div
                style={{
                  fontSize: 10,
                  color: "#94a3b8",
                  letterSpacing: 1,
                }}
              >
                TOKEN SYSTEM
              </div>
            </div>

          </div>

        </div>


        {/* FORM HEADER */}

        <div
          className="svara-card"
          style={{
            ...S.card,
            padding: 24,
            marginBottom: 18,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >

          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 17,
              background: config.light,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
            }}
          >
            {config.icon}
          </div>


          <div style={{ flex: 1 }}>

            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: config.accent,
                letterSpacing: 1.2,
              }}
            >
              NEW REGISTRATION
            </div>

            <h1
              style={{
                margin: "4px 0",
                fontSize: 24,
                fontWeight: 900,
              }}
            >
              {config.label}
            </h1>

            <div
              style={{
                fontSize: 13,
                color: "#64748b",
              }}
            >
              Next token:{" "}
              <strong
                style={{
                  color: config.accent,
                  fontFamily: "monospace",
                }}
              >
                {previewStart}
              </strong>
            </div>

          </div>

        </div>


        {/* MAIN FORM */}

        <div
          className="svara-form-grid"
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 1fr) 300px",
            gap: 18,
            paddingBottom: 40,
          }}
        >

          {/* CUSTOMER DETAILS */}

          <div
            className="svara-card"
            style={{
              ...S.card,
              padding: 28,
            }}
          >

            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                marginBottom: 4,
              }}
            >
              Customer Details
            </div>

            <div
              style={{
                fontSize: 13,
                color: "#64748b",
                marginBottom: 25,
              }}
            >
              Enter the customer's information
            </div>


            {/* NAME */}

            <div style={{ marginBottom: 18 }}>

              <label style={S.label}>
                Full Name{" "}
                <span style={{ color: "#ef4444" }}>
                  *
                </span>
              </label>

              <input
                ref={nameRef}
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleContinue();
                  }
                }}
                placeholder="Enter full name"
                style={{
                  ...S.input,
                  borderColor: errors.name
                    ? "#ef4444"
                    : "#d1d5db",
                }}
              />

              {errors.name && (
                <div style={S.error}>
                  {errors.name}
                </div>
              )}

            </div>


            {/* PHONE */}

            <div style={{ marginBottom: 18 }}>

              <label style={S.label}>
                Phone Number{" "}
                <span style={{ color: "#94a3b8" }}>
                  (optional)
                </span>
              </label>

              <input
                value={phone}
                onChange={(e) =>
                  setPhone(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleContinue();
                  }
                }}
                placeholder="+91 9876543210"
                style={{
                  ...S.input,
                  borderColor: errors.phone
                    ? "#ef4444"
                    : "#d1d5db",
                }}
              />

              {errors.phone && (
                <div style={S.error}>
                  {errors.phone}
                </div>
              )}

            </div>


            {/* EMAIL */}

            <div style={{ marginBottom: 18 }}>

              <label style={S.label}>
                Email{" "}
                <span
                  style={{
                    color: "#9ca3af",
                    fontWeight: 500,
                  }}
                >
                  (optional)
                </span>
              </label>

              <input
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                placeholder="customer@email.com"
                style={{
                  ...S.input,
                  borderColor: errors.email
                    ? "#ef4444"
                    : "#d1d5db",
                }}
              />

              {errors.email && (
                <div style={S.error}>
                  {errors.email}
                </div>
              )}

            </div>
            
            {adminMode && (
              <div style={{ marginBottom: 20 }}>
                <label style={S.label}>
                  Token Category
                </label>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(3, minmax(0, 1fr))",
                    gap: 10,
                  }}
                >
                  {Object.keys(TOKEN_TYPES).map((tokenType) => {
                    const item = TOKEN_TYPES[tokenType];
                    const active =
                      selectedType === tokenType;

                    return (
                      <button
                        key={tokenType}
                        type="button"
                        onClick={() =>
                          setSelectedType(tokenType)
                        }
                        style={{
                          ...S.button,
                          padding: "14px 10px",
                          background: active
                            ? item.light
                            : "#fff",
                          color: active
                            ? item.accent
                            : "#475569",
                          border: active
                            ? `2px solid ${item.accent}`
                            : "1px solid #d1d5db",
                        }}
                      >
                        <div style={{ fontSize: 22 }}>
                          {item.icon}
                        </div>
                        <div style={{ marginTop: 5 }}>
                          {item.label}
                        </div>
                        <div
                          style={{
                            marginTop: 3,
                            fontSize: 11,
                            fontWeight: 800,
                          }}
                        >
                          ₹{item.price}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CALCULATED AMOUNT */}

            <div
              style={{
                marginBottom: 18,
                padding: "14px 16px",
                borderRadius: 12,
                background: "#f8fafc",
                border: "1px solid #e5e7eb",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 13, color: "#64748b", fontWeight: 700 }}>
                  TOTAL AMOUNT
                </span>
                <strong style={{ fontSize: 22, color: config.accent }}>
                  ₹{((Number(config.price) || 0) * safeQuantity).toFixed(2)}
                </strong>
              </div>
              <div style={{ marginTop: 5, fontSize: 11, color: "#94a3b8" }}>
                ₹{Number(config.price) || 0} × {safeQuantity} token{safeQuantity > 1 ? "s" : ""}
              </div>
            </div>

            {/* QUANTITY */}

            <div style={{ marginBottom: 25 }}>

              <label style={S.label}>
                Number of Tokens
              </label>

              <div
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  }}
>
  <button
    type="button"
    onClick={() =>
      setQuantity(
        Math.max(
          1,
          Number(quantity) - 1
        )
      )
    }
    style={{
      width: 46,
      height: 44,
      border:
        "1px solid #d1d5db",
      borderRadius:
        "10px 0 0 10px",
      background: "#f8fafc",
      cursor: "pointer",
      fontSize: 20,
    }}
  >
    −
  </button>

  <input
    type="number"
    min="1"
    max="9999"
    inputMode="numeric"
    value={quantity}
    onChange={(e) => {
      const value =
        e.target.value;

      if (value === "") {
        setQuantity("");
        return;
      }

      const number =
        Number(value);

      if (
        Number.isInteger(number) &&
        number >= 1
      ) {
        setQuantity(
          Math.min(9999, number)
        );
      }
    }}
    style={{
      width: 120,
      height: 44,
      boxSizing: "border-box",
      border:
        "1px solid #d1d5db",
      borderLeft: "none",
      borderRight: "none",
      textAlign: "center",
      fontWeight: 800,
      fontSize: 16,
      outline: "none",
    }}
  />

  <button
    type="button"
    onClick={() =>
      setQuantity(
        Math.min(
          9999,
          Number(quantity || 1) + 1
        )
      )
    }
    style={{
      width: 46,
      height: 44,
      border:
        "1px solid #d1d5db",
      borderRadius:
        "0 10px 10px 0",
      background: "#f8fafc",
      cursor: "pointer",
      fontSize: 20,
    }}
  >
    +
  </button>
</div>

{errors.quantity && (
  <div style={S.error}>
    {errors.quantity}
  </div>
)}

            </div>


            <button
              onClick={handleContinue}
              style={{
                ...S.button,
                width: "100%",
                padding: "14px",
                background: config.accent,
                color: "#fff",
                fontSize: 15,
                boxShadow:
                  "0 8px 20px rgba(0,0,0,.12)",
              }}
            >
              Continue to Payment →
            </button>

          </div>


          {/* TOKEN PREVIEW */}

          <div
            className="svara-card"
            style={{
              ...S.card,
              padding: 22,
              height: "fit-content",
            }}
          >

            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 1,
                color: "#94a3b8",
                marginBottom: 15,
              }}
            >
              TOKEN PREVIEW
            </div>


            <div
              style={{
                background: config.light,
                borderRadius: 18,
                padding: 22,
                textAlign: "center",
              }}
            >

              <div
                style={{
                  fontSize: 30,
                  marginBottom: 8,
                }}
              >
                {config.icon}
              </div>

              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: config.accent,
                  letterSpacing: 1,
                }}
              >
                {config.label.toUpperCase()}
              </div>

              <div
                style={{
                  fontFamily: "monospace",
                  fontWeight: 900,
                  fontSize: 29,
                  margin: "10px 0",
                  color: "#111827",
                  letterSpacing: 1,
                }}
              >
                {quantity === 1
                  ? previewStart
                  : `${previewStart} – ${previewEnd}`}
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: "#64748b",
                }}
              >
                {quantity} token
                {quantity > 1 ? "s" : ""}
              </div>

            </div>


            <div
              style={{
                marginTop: 18,
                paddingTop: 18,
                borderTop:
                  "1px solid #e5e7eb",
              }}
            >

              <div style={previewRow}>
                <span>Category</span>
                <strong>{config.label}</strong>
              </div>

              <div style={previewRow}>
                <span>Quantity</span>
                <strong>{quantity}</strong>
              </div>

              <div style={previewRow}>
                <span>First Token</span>
                <strong>{previewStart}</strong>
              </div>

              <div style={previewRow}>
                <span>Last Token</span>
                <strong>{previewEnd}</strong>
              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}


const previewRow = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 12,
  padding: "7px 0",
  color: "#64748b",
};


/* =========================================================
   DASHBOARD
========================================================= */

function Dashboard({
  entries,
  onSelect,
  onClear,
  onCancel,
  onStatusChange,
  onReprint,
  onAdmin,
}) {
  const counts = {
    Bullet: 0,
    Saree: 0,
    Silver: 0,
  };

 entries.forEach((entry) => {
  if (
    String(entry.status || "Active").toLowerCase() ===
    "cancelled"
  ) {
    return;
  }

  if (counts[entry.tokenType] !== undefined) {
    counts[entry.tokenType] +=
      Number(entry.quantity) || 0;
  }
});

  const totalTokens =
    counts.Bullet +
    counts.Saree +
    counts.Silver;


  return (
    <div style={S.page}>

      <div
  className="svara-container"
  style={S.container}
>

        {/* HEADER */}

        <div
  className="svara-topbar"
  style={S.topBar}
>

          <div style={S.logo}>

            <div style={S.logoMark}>
              S
            </div>

            <div>

              <div
                style={{
                  fontWeight: 900,
                  fontSize: 18,
                  letterSpacing: 1,
                }}
              >
                SVARA
              </div>

              <div
                style={{
                  fontSize: 10,
                  color: "#94a3b8",
                  letterSpacing: 1.2,
                }}
              >
                TOKEN MANAGEMENT
              </div>

            </div>

          </div>


          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: "#ecfdf5",
              color: "#047857",
              padding: "7px 11px",
              borderRadius: 30,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#10b981",
              }}
            />
            SYSTEM ONLINE
          </div>

        </div>


        {/* HERO */}

        <div
          style={{
            marginBottom: 25,
          }}
        >

          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: "#7c3aed",
              letterSpacing: 1.5,
              marginBottom: 7,
            }}
          >
            WELCOME TO SVARA
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 34,
              fontWeight: 900,
              letterSpacing: -1,
            }}
          >
            Token Management
          </h1>

          <p
            style={{
              color: "#64748b",
              fontSize: 14,
              marginTop: 8,
            }}
          >
            Select a category to create a new token
            registration.
          </p>

        </div>


        {/* CATEGORY CARDS */}

        <div
          className="svara-category-grid"
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(3, minmax(0, 1fr))",
            gap: 16,
            marginBottom: 18,
          }}
        >

          {Object.entries(TOKEN_TYPES).map(
            ([type, config]) => (
              <button
                key={type}
                onClick={() => onSelect(type)}
                style={{
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  borderRadius: 20,
                  padding: 22,
                  textAlign: "left",
                  cursor: "pointer",
                  boxShadow:
                    "0 7px 24px rgba(15,23,42,.05)",
                  transition:
                    "transform .15s ease, box-shadow .15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform =
                    "translateY(-3px)";
                  e.currentTarget.style.boxShadow =
                    "0 14px 30px rgba(15,23,42,.10)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform =
                    "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 7px 24px rgba(15,23,42,.05)";
                }}
              >

                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems: "center",
                  }}
                >

                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 15,
                      background: config.light,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 25,
                    }}
                  >
                    {config.icon}
                  </div>

                  <span
                    style={{
                      color: "#94a3b8",
                      fontSize: 18,
                    }}
                  >
                    →
                  </span>

                </div>


                <div
                  style={{
                    marginTop: 18,
                    fontSize: 17,
                    fontWeight: 800,
                  }}
                >
                  {type}
                </div>


                <div
                  style={{
                    marginTop: 5,
                    fontSize: 12,
                    color: "#64748b",
                  }}
                >
                  Next token
                </div>


                <div
                  style={{
                    marginTop: 3,
                    fontFamily: "monospace",
                    fontSize: 18,
                    fontWeight: 900,
                    color: config.accent,
                  }}
                >
                  {makeTokenId(
                    type,
                    nextTokenSerial(
                      entries,
                      type
                    )
                  )}
                </div>


                <div
                  style={{
                    marginTop: 12,
                    fontSize: 11,
                    color: "#94a3b8",
                  }}
                >
                  {counts[type]} token
                  {counts[type] !== 1
                    ? "s"
                    : ""}{" "}
                  registered
                </div>

              </button>
            )
          )}

        </div>


        {/* STATS */}

        <div
          className="svara-card"
          style={{
            ...S.card,
            padding: 22,
            marginBottom: 18,
          }}
        >

          <div
            className="svara-stats-grid"
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(4, minmax(0, 1fr))",
              gap: 10,
            }}
          >

            <StatCard
              label="TOTAL TOKENS"
              value={totalTokens}
              icon="🎟️"
            />

            <StatCard
              label="BULLET"
              value={counts.Bullet}
              icon="🏍️"
            />

            <StatCard
              label="SAREE"
              value={counts.Saree}
              icon="🥻"
            />

            <StatCard
              label="SILVER"
              value={counts.Silver}
              icon="🥈"
            />

          </div>

        </div>


        {/* RECENT REGISTRATIONS */}

        <div
          className="svara-card"
          style={{
            ...S.card,
            marginBottom: 30,
            overflow: "hidden",
          }}
        >

          <div
            className="svara-dashboard-header"
            style={{
              padding:
                "19px 22px",
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              borderBottom:
                "1px solid #eef2f7",
            }}
          >

            <div>

              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                }}
              >
                Recent Registrations
              </div>

              <div
                style={{
                  fontSize: 11,
                  color: "#94a3b8",
                  marginTop: 3,
                }}
              >
                Latest token activity
              </div>

            </div>


            <div
              className="svara-dashboard-actions"
              style={{
                display: "flex",
                gap: 8,
              }}
            >

              <button
  onClick={onAdmin}
  style={{
    ...S.button,
    padding: "9px 13px",
    background: "#111827",
    color: "#fff",
  }}
>
  🔐 Admin Received
</button>


              <button
                onClick={onClear}
                disabled={!entries.length}
                style={{
                  ...S.button,
                  padding:
                    "9px 13px",
                  background: "#fef2f2",
                  color: "#b91c1c",
                  opacity:
                    entries.length
                      ? 1
                      : 0.5,
                }}
              >
                Clear
              </button>

            </div>

          </div>


          {!entries.length ? (
            <div
              style={{
                padding: 55,
                textAlign: "center",
                color: "#94a3b8",
              }}
            >

              <div
                style={{
                  fontSize: 35,
                  marginBottom: 10,
                }}
              >
                🎟️
              </div>

              <div
                style={{
                  fontWeight: 700,
                  color: "#64748b",
                }}
              >
                No registrations yet
              </div>

              <div
                style={{
                  fontSize: 12,
                  marginTop: 5,
                }}
              >
                Select a token category above
                to get started.
              </div>

            </div>
          ) : (
            <div
              className="svara-dashboard-table"
              style={{
                overflowX: "auto",
              }}
            >

              <table
                style={{
                  width: "100%",
                  borderCollapse:
                    "collapse",
                  fontSize: 13,
                }}
              >

                <thead>

                  <tr
                    style={{
                      background:
                        "#f8fafc",
                      color:
                        "#64748b",
                      fontSize: 10,
                      letterSpacing:
                        ".8px",
                    }}
                  >

                    <th style={tableHeader}>TOKEN</th>
<th style={tableHeader}>CATEGORY</th>
<th style={tableHeader}>CUSTOMER</th>
<th style={tableHeader}>PHONE</th>
<th style={tableHeader}>QTY</th>
<th style={tableHeader}>AMOUNT</th>
<th style={tableHeader}>PAYMENT</th>
<th style={tableHeader}>STATUS</th>
<th style={tableHeader}>DATE</th>
<th style={tableHeader}>ACTION</th>

                  </tr>

                </thead>


                <tbody>

                  {[...entries]
                    .reverse()
                    .slice(0, 8)
                    .map((entry, index) => {

                      const config =
                        getTokenConfig(
                          entry.tokenType
                        );

                      return (
                        <tr
                          key={
                            entry.orderId ||
                            index
                          }
                          style={{
                            borderTop:
                              "1px solid #f1f5f9",
                          }}
                        >

                          <td style={tableCell}>

                            <span
                              style={{
                                fontFamily:
                                  "monospace",
                                fontWeight: 800,
                                color:
                                  config.accent,
                              }}
                            >
                              {entry.tokenStart}
                            </span>

                            {Number(
                              entry.quantity
                            ) > 1 && (
                              <span
                                style={{
                                  color:
                                    "#94a3b8",
                                  fontSize: 11,
                                }}
                              >
                                {" "}
                                –
                                {" "}
                                {entry.tokenEnd}
                              </span>
                            )}

                          </td>

                          <td style={tableCell}>

                            <span
                              style={{
                                display:
                                  "inline-flex",
                                alignItems:
                                  "center",
                                gap: 5,
                                background:
                                  config.light,
                                color:
                                  config.accent,
                                padding:
                                  "5px 8px",
                                borderRadius:
                                  8,
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              {config.icon}{" "}
                              {entry.tokenType}
                            </span>

                          </td>


                          <td
                            style={{
                              ...tableCell,
                              fontWeight: 700,
                            }}
                          >
                            {entry.name}
                          </td>


                          <td style={tableCell}>
                            {entry.phone}
                          </td>


                          <td
                            style={{
                              ...tableCell,
                              textAlign:
                                "center",
                            }}
                          >
                            {entry.quantity}
                          </td>


                          <td style={tableCell}>
                            ₹{Number(entry.amount || 0).toFixed(2)}
                          </td>


                          <td style={tableCell}>
                            {entry.payment}
                          </td>

                          <td style={tableCell}>
  <span
    style={{
      display: "inline-flex",
      padding: "5px 9px",
      borderRadius: 8,
      fontSize: 10,
      fontWeight: 800,
      background:
        entry.status === "Cancelled"
          ? "#fef2f2"
          : entry.status === "Payment Not Received"
          ? "#fff7ed"
          : "#ecfdf5",
      color:
        entry.status === "Cancelled"
          ? "#b91c1c"
          : entry.status === "Payment Not Received"
          ? "#c2410c"
          : "#047857",
    }}
  >
    {entry.status || "Complete"}
  </span>
</td>


                          <td style={tableCell}>
                            {entry.date}
                          </td>

                          <td style={tableCell}>
  <div
    style={{
      display: "flex",
      gap: 6,
      flexWrap: "wrap",
    }}
  >
    {String(entry.status || "Complete").toLowerCase() !==
      "cancelled" && (
      <select
        value={
          entry.status === "Payment Not Received"
            ? "Payment Not Received"
            : "Complete"
        }
        onChange={(e) =>
          onStatusChange(
            entry,
            e.target.value
          )
        }
        style={{
          border: "1px solid #d1d5db",
          borderRadius: 8,
          padding: "6px 8px",
          fontSize: 11,
          background: "#fff",
        }}
      >
        <option value="Complete">
          Complete
        </option>

        <option value="Payment Not Received">
          Payment Not Received
        </option>
      </select>
    )}

    <button
      onClick={() => onReprint(entry)}
      style={{
        ...S.button,
        padding: "7px 10px",
        background: "#111827",
        color: "#fff",
        fontSize: 11,
      }}
    >
      🖨️ Reprint
    </button>

    {String(entry.status || "Complete").toLowerCase() ===
    "cancelled" ? (
      <span
        style={{
          display: "inline-flex",
          padding: "5px 8px",
          borderRadius: 8,
          fontSize: 10,
          fontWeight: 800,
          background: "#fef2f2",
          color: "#b91c1c",
        }}
      >
        CANCELLED
      </span>
    ) : (
      <button
        onClick={() => onCancel(entry)}
        style={{
          ...S.button,
          padding: "7px 10px",
          background: "#fef2f2",
          color: "#b91c1c",
          fontSize: 11,
        }}
      >
        Cancel
      </button>
    )}
  </div>
</td>

                        </tr>
                      );
                    })}

                </tbody>

              </table>

            </div>
          )}

        </div>

      </div>

    </div>
  );
}


/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  label,
  value,
  icon,
  onClick,
  active = false,
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        padding: "12px 14px",
        borderRadius: 15,
        background: active ? "#eef2ff" : "#f8fafc",
        border: active
          ? "1px solid #c4b5fd"
          : "1px solid transparent",
        cursor: onClick ? "pointer" : "default",
      }}
    >

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: "#64748b",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: .7,
        }}
      >
        <span>{icon}</span>
        {label}
      </div>


      <div
        style={{
          fontSize: 25,
          fontWeight: 900,
          marginTop: 8,
        }}
      >
        {value}
      </div>

    </div>
  );
}

function AdminReceived({
  adminEntries,
  adminSummary,
  onBack,
  onRefresh,
  onDownload,
  onClear,
  onLogout,
  onCreate,
  onStatusChange,
  onCancelAdmin,
}) {
  const [filter, setFilter] = useState("all");

  const filteredAdminEntries =
    (adminEntries || []).filter((entry) => {
      if (filter === "payment") {
        return entry.status === "Payment Not Received";
      }

      if (filter === "cancelled") {
        return entry.status === "Cancelled";
      }

      return true;
    });

  return (
    <div style={S.page}>
      <div
        className="svara-container"
        style={S.container}
      >

        <div
          className="svara-topbar"
          style={S.topBar}
        >
          <button
            onClick={onBack}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "#64748b",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            ← Dashboard
          </button>

          <div style={S.logo}>
            <div style={S.logoMark}>
              S
            </div>

            <div>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 17,
                  letterSpacing: 1,
                }}
              >
                SVARA
              </div>

              <div
                style={{
                  fontSize: 10,
                  color: "#94a3b8",
                  letterSpacing: 1,
                }}
              >
                ADMIN RECEIVED
              </div>
            </div>
          </div>
        </div>


        <div
          style={{
            marginBottom: 22,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: "#7c3aed",
              letterSpacing: 1.5,
            }}
          >
            ADMIN DASHBOARD
          </div>

          <h1
            style={{
              margin: "5px 0",
              fontSize: 32,
              fontWeight: 900,
            }}
          >
            Admin Received
          </h1>

          <p
            style={{
              color: "#64748b",
              fontSize: 14,
              margin: 0,
            }}
          >
            Payment and token administration
          </p>
        </div>


        <div
          className="svara-stats-grid"
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <StatCard
            label="TOTAL AMOUNT RECEIVED"
            value={`₹${Number(
              adminSummary?.totalAmountReceived || 0
            ).toFixed(2)}`}
            icon="💰"
          />

          <StatCard
            label="CANCELLED TOKENS"
            value={
              adminSummary?.cancelledTokens || 0
            }
            icon="❌"
            onClick={() =>
              setFilter(
                filter === "cancelled"
                  ? "all"
                  : "cancelled"
              )
            }
            active={filter === "cancelled"}
          />

          <StatCard
            label="PAYMENT NOT RECEIVED"
            value={
              adminSummary?.paymentNotReceivedTokens ||
              0
            }
            icon="⏳"
            onClick={() =>
              setFilter(
                filter === "payment"
                  ? "all"
                  : "payment"
              )
            }
            active={filter === "payment"}
          />

          <StatCard
            label="TOTAL ORDERS"
            value={
              adminSummary?.totalOrders || 0
            }
            icon="📋"
            onClick={() => setFilter("all")}
            active={filter === "all"}
          />
        </div>

        <div
          className="svara-stats-grid"
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(3, minmax(0, 1fr))",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <StatCard
            label="BULLET AMOUNT RECEIVED"
            value={`₹${Number(
              adminSummary?.amountReceivedByCategory?.Bullet || 0
            ).toFixed(2)}`}
            icon="🎯"
          />

          <StatCard
            label="SAREE AMOUNT RECEIVED"
            value={`₹${Number(
              adminSummary?.amountReceivedByCategory?.Saree || 0
            ).toFixed(2)}`}
            icon="🥻"
          />

          <StatCard
            label="SILVER AMOUNT RECEIVED"
            value={`₹${Number(
              adminSummary?.amountReceivedByCategory?.Silver || 0
            ).toFixed(2)}`}
            icon="🥈"
          />
        </div>

        {filter !== "all" && (
          <div
            style={{
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              fontSize: 13,
              color: "#475569",
            }}
          >
            <strong>
              Showing only{" "}
              {filter === "payment"
                ? "Payment Not Received"
                : "Cancelled"}{" "}
              records ({filteredAdminEntries.length})
            </strong>

            <button
              onClick={() => setFilter("all")}
              style={{
                ...S.button,
                padding: "7px 10px",
                background: "#f1f5f9",
                color: "#334155",
              }}
            >
              Show All
            </button>
          </div>
        )}

        <div
          className="svara-card"
          style={{
            ...S.card,
            overflow: "hidden",
          }}
        >

          <div
            className="svara-dashboard-header"
            style={{
              padding: "18px 22px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom:
                "1px solid #eef2f7",
            }}
          >

            <div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                }}
              >
                Registration Details
              </div>

              <div
                style={{
                  fontSize: 11,
                  color: "#94a3b8",
                  marginTop: 3,
                }}
              >
                Admin-only information
              </div>
            </div>


            <div
              className="svara-dashboard-actions"
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >

              <button
                onClick={onCreate}
                style={{
                  ...S.button,
                  padding: "9px 13px",
                  background: "#7c3aed",
                  color: "#fff",
                }}
              >
                ➕ Create Token
              </button>

              <button
                onClick={onRefresh}
                style={{
                  ...S.button,
                  padding: "9px 13px",
                  background: "#f1f5f9",
                  color: "#334155",
                }}
              >
                🔄 Refresh
              </button>

              <button
                onClick={onDownload}
                style={{
                  ...S.button,
                  padding: "9px 13px",
                  background: "#111827",
                  color: "#fff",
                }}
              >
                📥 Download Excel
              </button>

              <button
                onClick={onClear}
                style={{
                  ...S.button,
                  padding: "9px 13px",
                  background: "#fef2f2",
                  color: "#b91c1c",
                }}
              >
                Clear All
              </button>

              <button
                onClick={onLogout}
                style={{
                  ...S.button,
                  padding: "9px 13px",
                  background: "#f3f4f6",
                  color: "#374151",
                }}
              >
                Logout
              </button>

            </div>
          </div>


          {!adminEntries?.length ? (
            <div
              style={{
                padding: 45,
                textAlign: "center",
                color: "#94a3b8",
              }}
            >
              No registrations found.
            </div>
          ) : (
            <div
              className="svara-dashboard-table"
              style={{
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#f8fafc",
                      color: "#64748b",
                      fontSize: 10,
                      letterSpacing: ".8px",
                    }}
                  >
                    <th style={tableHeader}>
                      TOKEN
                    </th>
                    <th style={tableHeader}>
                      CATEGORY
                    </th>
                    <th style={tableHeader}>
                      CUSTOMER
                    </th>
                    <th style={tableHeader}>
                      PHONE
                    </th>
                    <th style={tableHeader}>
                      QTY
                    </th>
                    <th style={tableHeader}>
                      AMOUNT
                    </th>
                    <th style={tableHeader}>
                      PAYMENT
                    </th>
                    <th style={tableHeader}>
                      STATUS
                    </th>
                    <th style={tableHeader}>
                      DATE
                    </th>
                    <th style={tableHeader}>
                      ADMIN NOTES
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAdminEntries.map((entry) => (
                    <tr
                      key={entry.orderId}
                      style={{
                        borderTop:
                          "1px solid #f1f5f9",
                      }}
                    >
                      <td style={tableCell}>
                        {entry.tokenStart}
                        {entry.tokenEnd &&
                        entry.tokenEnd !==
                          entry.tokenStart
                          ? ` – ${entry.tokenEnd}`
                          : ""}
                      </td>

                      <td style={tableCell}>
                        {entry.tokenType}
                      </td>

                      <td style={tableCell}>
                        {entry.name}
                      </td>

                      <td style={tableCell}>
                        {entry.phone}
                      </td>

                      <td
                        style={{
                          ...tableCell,
                          textAlign: "center",
                        }}
                      >
                        {entry.quantity}
                      </td>

                      <td style={tableCell}>
                        ₹{Number(
                          entry.amount || 0
                        ).toFixed(2)}
                      </td>

                      <td style={tableCell}>
                        {entry.payment}
                      </td>

                      <td style={tableCell}>
                        <select
                          value={
                            entry.status === "Payment Not Received"
                              ? "Payment Not Received"
                              : entry.status === "Cancelled"
                              ? "Cancelled"
                              : "Complete"
                          }
                          disabled={entry.status === "Cancelled"}
                          onChange={(e) =>
                            onStatusChange(
                              entry,
                              e.target.value
                            )
                          }
                          style={{
                            border: "1px solid #d1d5db",
                            borderRadius: 8,
                            padding: "6px 8px",
                            fontSize: 11,
                            background:
                              entry.status === "Cancelled"
                                ? "#fef2f2"
                                : "#fff",
                            color:
                              entry.status === "Cancelled"
                                ? "#b91c1c"
                                : "#334155",
                          }}
                        >
                          <option value="Complete">
                            Complete
                          </option>
                          <option value="Payment Not Received">
                            Payment Not Received
                          </option>
                        </select>

                        <button
                          onClick={() => onCancelAdmin(entry)}
                          disabled={entry.status === "Cancelled"}
                          style={{
                            marginLeft: 6, border: "1px solid #fecaca", borderRadius: 8,
                            padding: "6px 8px", fontSize: 11, background: "#fef2f2",
                            color: "#b91c1c", cursor: entry.status === "Cancelled" ? "not-allowed" : "pointer",
                            opacity: entry.status === "Cancelled" ? 0.5 : 1,
                          }}
                        >Cancel</button>

                      </td>

                      <td style={tableCell}>
                        {entry.date}
                      </td>

                      <td style={tableCell}>
                        <input
                          defaultValue={
                            entry.adminNotes || ""
                          }
                          onBlur={(e) =>
                            saveAdminNotes(
                              entry.orderId,
                              e.target.value
                            )
                          }
                          placeholder="Add note"
                          style={{
                            ...S.input,
                            minWidth: 160,
                            padding: "8px 10px",
                            fontSize: 12,
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}

/* =========================================================
   COMMON STYLES
========================================================= */

const modalStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background:
      "rgba(15,23,42,.55)",
    backdropFilter: "blur(5px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 100,
  },

  modal: {
    width: "min(520px, 100%)",
    background: "#fff",
    borderRadius: 24,
    padding: 30,
    boxShadow:
      "0 30px 80px rgba(0,0,0,.22)",
  },
};
function AdminLoginModal({ onClose, onSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!username.trim() || !password) {
      setError("Username and password are required.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const payload = await adminLogin(
        username.trim(),
        password
      );

      sessionStorage.setItem(
        "svara_admin_token",
        payload.token
      );

      onSuccess();
    } catch (error) {
      setError(
        error.message ||
        "Invalid admin credentials."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={modalStyles.overlay}>
      <div
        style={{
          ...modalStyles.modal,
          maxWidth: 420,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 900,
          }}
        >
          Admin Login
        </h2>

        <p
          style={{
            color: "#64748b",
            fontSize: 13,
            marginTop: 7,
            marginBottom: 22,
          }}
        >
          Enter admin credentials to access Admin Received.
        </p>

        <label style={S.label}>
          Username
        </label>

        <input
          value={username}
          onChange={(e) =>
            setUsername(e.target.value)
          }
          placeholder="Admin username"
          style={{
            ...S.input,
            marginBottom: 15,
          }}
        />

        <label style={S.label}>
          Password
        </label>

        <input
          type="password"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
          placeholder="Admin password"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleLogin();
            }
          }}
          style={S.input}
        />

        {error && (
          <div
            style={{
              color: "#dc2626",
              fontSize: 12,
              marginTop: 8,
            }}
          >
            {error}
          </div>
        )}

        <div
          className="svara-modal-actions"
          style={{
            display: "flex",
            gap: 10,
            marginTop: 22,
          }}
        >
          <button
            onClick={onClose}
            style={{
              ...S.button,
              flex: 1,
              padding: "12px",
              background: "#f3f4f6",
              color: "#374151",
            }}
          >
            Cancel
          </button>

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              ...S.button,
              flex: 1,
              padding: "12px",
              background: "#111827",
              color: "#fff",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Checking..." : "Login"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CancelTokenModal({ entry, onCancel, onConfirm }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCancel() {
    if (!password) {
      setError("Please enter the cancellation password.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await onConfirm(password);
    } catch (error) {
      setError(error.message || "Unable to cancel token.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={modalStyles.overlay}>
      <div
        style={{
          ...modalStyles.modal,
          maxWidth: 430,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 21,
            fontWeight: 900,
          }}
        >
          Cancel Token
        </h2>

        <p
          style={{
            color: "#64748b",
            fontSize: 13,
            marginTop: 8,
            lineHeight: 1.5,
          }}
        >
          Enter the cancellation password to confirm this cancellation.
        </p>

        <div
          style={{
            background: "#f8fafc",
            borderRadius: 12,
            padding: 14,
            margin: "18px 0",
          }}
        >
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Order ID
          </div>

          <strong>{entry.orderId}</strong>

          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              color: "#64748b",
            }}
          >
            Token
          </div>

          <strong>
            {entry.tokenStart}
            {entry.tokenEnd &&
            entry.tokenEnd !== entry.tokenStart
              ? ` – ${entry.tokenEnd}`
              : ""}
          </strong>
        </div>

        <label style={S.label}>
          Cancellation Password
        </label>

        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter cancellation password"
          type="password"
          autoFocus
          style={S.input}
        />

        {error && (
          <div
            style={{
              color: "#dc2626",
              fontSize: 12,
              marginTop: 7,
            }}
          >
            {error}
          </div>
        )}

        <div
          className="svara-modal-actions"
          style={{
            display: "flex",
            gap: 10,
            marginTop: 22,
          }}
        >
          <button
            onClick={onCancel}
            style={{
              ...S.button,
              flex: 1,
              padding: "12px",
              background: "#f3f4f6",
              color: "#374151",
            }}
          >
            Go Back
          </button>

          <button
            onClick={handleCancel}
            disabled={loading}
            style={{
              ...S.button,
              flex: 1,
              padding: "12px",
              background: "#dc2626",
              color: "#fff",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Cancelling..." : "Cancel Token"}
          </button>
        </div>
      </div>
    </div>
  );
}


const tableHeader = {
  textAlign: "left",
  padding: "12px 16px",
  fontWeight: 800,
};


const tableCell = {
  padding: "13px 16px",
  color: "#475569",
};


/* =========================================================
   ERROR STYLE
========================================================= */

S.error = {
  color: "#dc2626",
  fontSize: 11,
  marginTop: 5,
};


/* =========================================================
   ROOT APP
========================================================= */

export default function App() {
  const [screen, setScreen] =
    useState("dashboard");

  const [activeType, setActiveType] =
    useState(null);

  const [entries, setEntries] =
    useState([]);

  const [successEntry, setSuccessEntry] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [loadError, setLoadError] =
    useState("");
  const [showAdminLogin, setShowAdminLogin] =
    useState(false);

  const [cancelTarget, setCancelTarget] =
    useState(null);

  const [adminEntries, setAdminEntries] =
  useState([]);

const [adminSummary, setAdminSummary] =
  useState(null);

  const [, setAdminCreate] =
    useState(false);


  useEffect(() => {
    loadEntries()
      .then((data) => {
        setEntries(
          Array.isArray(data)
            ? data
            : []
        );
      })
      .catch((error) => {
        console.error(error);
        setLoadError(
          "Unable to connect to the SVARA server."
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);
  useEffect(() => {

  if (
    loading ||
    loadError
  ) {
    return;
  }


  const refreshEntries =
    async () => {

      try {

        const data =
          await loadEntries();


        setEntries(
          Array.isArray(data)
            ? data
            : []
        );

      } catch (error) {

        console.error(
          "Background refresh failed:",
          error
        );

      }

    };


  /*
   * Every browser gets the
   * latest central Excel data
   * every 5 seconds.
   */

  const intervalId =
    setInterval(
      refreshEntries,
      5000
    );


  return () => {

    clearInterval(
      intervalId
    );

  };

}, [
  loading,
  loadError,
]);

const [saving, setSaving] = useState(false);
async function handleSubmit(entry) {
  if (saving) return;

  try {
    setSaving(true);

    const savedEntry = await saveEntry(entry);

    setEntries((current) => [
      ...current,
      savedEntry,
    ]);

    setScreen("dashboard");
    setSuccessEntry(savedEntry);

  } catch (error) {
    alert(
      error.message ||
        "Unable to save registration. Please try again."
    );
  } finally {
    setSaving(false);
  }
}


async function handleAdminCreate(entry) {
  if (saving) return;

  try {
    setSaving(true);

    const savedEntry = await saveAdminEntry(entry);

    setEntries((current) => [
      ...current,
      savedEntry,
    ]);

    setAdminCreate(false);
    setScreen("admin");
    setSuccessEntry(savedEntry);
    await refreshAdmin();
  } catch (error) {
    alert(
      error.message ||
        "Unable to create token."
    );
  } finally {
    setSaving(false);
  }
}

function handleClear() {
  if (!entries.length) {
    return;
  }

  openAdmin();
}

async function refreshAdmin() {
  try {
    const data = await loadAdminData();

    setAdminEntries(
      Array.isArray(data.entries)
        ? data.entries
        : []
    );

    setAdminSummary(
      data.summary || null
    );
  } catch (error) {
    alert(
      error.message ||
      "Unable to load admin data."
    );

    setScreen("dashboard");
  }
}


function openAdmin() {
  const token =
    sessionStorage.getItem(
      "svara_admin_token"
    );

  if (!token) {
    setShowAdminLogin(true);
    return;
  }

  setScreen("admin");
  refreshAdmin();
}


function handleAdminLoginSuccess() {
  setShowAdminLogin(false);
  setScreen("admin");
  refreshAdmin();
}


function logoutAdmin() {
  sessionStorage.removeItem(
    "svara_admin_token"
  );

  setAdminEntries([]);
  setAdminSummary(null);
  setScreen("dashboard");
}


async function handleStatusChange(
  entry,
  status
) {
  try {
    const updatedEntry =
      await updateEntryStatus(
        entry.orderId,
        status
      );

    setEntries((current) =>
      current.map((item) =>
        item.orderId ===
        updatedEntry.orderId
          ? updatedEntry
          : item
      )
    );

    setAdminEntries((current) =>
      current.map((item) =>
        item.orderId ===
        updatedEntry.orderId
          ? updatedEntry
          : item
      )
    );

    if (sessionStorage.getItem("svara_admin_token")) {
      await refreshAdmin();
    }
  } catch (error) {
    alert(
      error.message ||
      "Unable to update status."
    );
  }
}


async function handleAdminClear() {
  if (!adminEntries.length) {
    return;
  }

  const confirmed =
    window.confirm(
      "Are you sure you want to clear all registrations?"
    );

  if (!confirmed) {
    return;
  }

  try {
    const token =
      sessionStorage.getItem(
        "svara_admin_token"
      );

    await clearEntries(token);

    setEntries([]);
    setAdminEntries([]);
    setAdminSummary(null);

    alert(
      "All registrations have been cleared."
    );

    setScreen("dashboard");

  } catch (error) {
    alert(
      error.message ||
      "Unable to clear registrations."
    );
  }
}

async function handleAdminCancel(entry) {
  const tokenText = entry.tokenEnd && entry.tokenEnd !== entry.tokenStart
    ? `${entry.tokenStart} – ${entry.tokenEnd}` : entry.tokenStart;
  if (!window.confirm(`Cancel token ${tokenText}?\n\nAdmin cancellation does not require the cancellation password.`)) return;
  try {
    const updatedEntry = await adminCancelEntry(entry.orderId);
    setEntries((current) => current.map((item) => item.orderId === updatedEntry.orderId ? updatedEntry : item));
    await refreshAdmin();
  } catch (error) {
    alert(error.message || "Unable to cancel token.");
  }
}


async function handleCancel(entry, password) {
  const updatedEntry = await cancelEntry(
    entry.orderId,
    password
  );

  setEntries((current) =>
    current.map((item) =>
      item.orderId === updatedEntry.orderId
        ? updatedEntry
        : item
    )
  );

  setCancelTarget(null);

 const tokenMessage =
  updatedEntry.tokenEnd &&
  updatedEntry.tokenEnd !== updatedEntry.tokenStart
    ? `${updatedEntry.tokenStart} – ${updatedEntry.tokenEnd}`
    : updatedEntry.tokenStart;

alert(
  `Token${Number(updatedEntry.quantity) > 1 ? "s" : ""} ${tokenMessage} cancelled successfully.`
);
}




  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg,#f8fafc,#f5f3ff)",
          fontFamily:
            "'Inter','Segoe UI',sans-serif",
        }}
      >

        <div style={{ textAlign: "center" }}>

          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 18,
              background:
                "linear-gradient(135deg,#111827,#4c1d95)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 22,
              margin: "0 auto 15px",
            }}
          >
            S
          </div>

          <div
            style={{
              fontWeight: 800,
              color: "#334155",
            }}
          >
            Loading SVARA...
          </div>

        </div>

      </div>
    );
  }


  if (loadError) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          fontFamily:
            "'Inter','Segoe UI',sans-serif",
        }}
      >

        <div
          style={{
            background: "#fff",
            padding: 35,
            borderRadius: 20,
            textAlign: "center",
            boxShadow:
              "0 10px 40px rgba(0,0,0,.08)",
          }}
        >

          <div
            style={{
              fontSize: 40,
              marginBottom: 12,
            }}
          >
            ⚠️
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: 20,
            }}
          >
            Server Connection Error
          </h2>

          <p
            style={{
              color: "#64748b",
              fontSize: 13,
              marginTop: 8,
            }}
          >
            {loadError}
          </p>

          <button
            onClick={() =>
              window.location.reload()
            }
            style={{
              ...S.button,
              marginTop: 12,
              padding: "11px 20px",
              background: "#111827",
              color: "#fff",
            }}
          >
            Retry
          </button>

        </div>

      </div>
    );
  }


 return (
  <>
    <style>{responsiveStyles}</style>
    {showAdminLogin && (
  <AdminLoginModal
    onClose={() =>
      setShowAdminLogin(false)
    }
    onSuccess={
      handleAdminLoginSuccess
    }
  />
)}

    {cancelTarget && (
      <CancelTokenModal
        entry={cancelTarget}
        onCancel={() =>
          setCancelTarget(null)
        }
        onConfirm={(password) =>
          handleCancel(
            cancelTarget,
            password
          )
        }
      />
    )}

    {successEntry && (
      <SuccessModal
          entry={successEntry}
          onClose={() =>
            setSuccessEntry(null)
          }
        />
      )}


      {screen === "dashboard" ? (
  <Dashboard
    entries={entries}

    onSelect={(type) => {
      setActiveType(type);
      setScreen("form");
    }}

    onClear={handleClear}

    onCancel={(entry) =>
      setCancelTarget(entry)
    }

    onStatusChange={
      handleStatusChange
    }

    onReprint={printLabels}

    onAdmin={openAdmin}
  />

) : screen === "admin" ? (

  <AdminReceived
    adminEntries={adminEntries}
    adminSummary={adminSummary}

    onBack={() =>
      setScreen("dashboard")
    }

    onRefresh={refreshAdmin}

    onDownload={
      downloadAdminExcel
    }

    onClear={
      handleAdminClear
    }

    onLogout={
      logoutAdmin
    }

    onCreate={() => {
      setActiveType("Bullet");
      setAdminCreate(true);
      setScreen("admin-create");
    }}

    onStatusChange={
      handleStatusChange
    }

    onCancelAdmin={
      handleAdminCancel
    }
  />

) : screen === "admin-create" ? (

  <FormScreen
    type={activeType}
    entries={entries}
    onSubmit={handleAdminCreate}
    onBack={() => {
      setAdminCreate(false);
      setScreen("admin");
    }}
    adminMode
  />

) : (

  <FormScreen
    type={activeType}
    entries={entries}
    onSubmit={handleSubmit}
    onBack={() =>
      setScreen("dashboard")
    }
  />

)}

    </>
  );
}