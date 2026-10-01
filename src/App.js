import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";

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
  },

  Saree: {
    label: "Saree",
    prefix: "SAR",
    icon: "🥻",
    accent: "#db2777",
    light: "#fdf2f8",
  },

  Silver: {
    label: "Silver",
    prefix: "SLV",
    icon: "🥈",
    accent: "#475569",
    light: "#f8fafc",
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

function downloadCentralExcel() {

  window.open(
    `${API}/download-excel`,
    "_blank"
  );

}


/*
 * IMPORTANT:
 * This preserves the existing sequence behavior.
 * It looks at the highest existing token number for that category.
 */
function nextTokenSerial(entries, type) {
  const config = getTokenConfig(type);

  let maxSerial = 0;

  entries.forEach((entry) => {
    if (entry.tokenType !== type) return;

    const startSerial = getSerialFromToken(entry.tokenStart);
    const endSerial = getSerialFromToken(entry.tokenEnd);

    maxSerial = Math.max(maxSerial, startSerial, endSerial);

    // Also support older ticketId-style data if present
    if (entry.ticketId) {
      const serial = getSerialFromToken(entry.ticketId);
      maxSerial = Math.max(maxSerial, serial);
    }
  });

  return maxSerial + 1;
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

  /*
   * Create TWO identical labels for every token.
   *
   * Example:
   *
   * BUL0016
   * BUL0016
   *
   * BUL0017
   * BUL0017
   *
   * BUL0018
   * BUL0018
   */

  const labels = tokenIds
    .map(
      (tokenId) => `
        ${createLabelHtml({
          tokenId,
          category,
          name,
          phone,
          payment,
          date,
          time,
        })}

        ${createLabelHtml({
          tokenId,
          category,
          name,
          phone,
          payment,
          date,
          time,
        })}
      `
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
            <span>Date</span>
            <strong>{entry.date}</strong>
          </div>

          <div style={successRow}>
            <span>Time</span>
            <strong>{entry.time}</strong>
          </div>

        </div>


        <div
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
}) {
  const config = getTokenConfig(type);

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


  const nextSerial = nextTokenSerial(
    entries,
    type
  );

  const previewStart = makeTokenId(
    type,
    nextSerial
  );

  const previewEnd = makeTokenId(
    type,
    nextSerial + quantity - 1
  );


  function validate() {
    const validationErrors = {};

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

    if (!phone.trim()) {
      validationErrors.phone =
        "Phone number is required.";
    } else if (
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
      type,

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


      <div style={S.container}>

        {/* TOP BAR */}

        <div style={S.topBar}>

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
                <span style={{ color: "#ef4444" }}>
                  *
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


            {/* QUANTITY */}

            <div style={{ marginBottom: 25 }}>

              <label style={S.label}>
                Number of Tokens
              </label>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0,
                  width: 170,
                }}
              >

                <button
                  onClick={() =>
                    setQuantity(
                      Math.max(1, quantity - 1)
                    )
                  }
                  style={{
                    width: 46,
                    height: 44,
                    border: "1px solid #d1d5db",
                    borderRadius:
                      "10px 0 0 10px",
                    background: "#f8fafc",
                    cursor: "pointer",
                    fontSize: 20,
                  }}
                >
                  −
                </button>


                <div
                  style={{
                    width: 78,
                    height: 44,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderTop:
                      "1px solid #d1d5db",
                    borderBottom:
                      "1px solid #d1d5db",
                    fontWeight: 800,
                    fontSize: 16,
                  }}
                >
                  {quantity}
                </div>


                <button
                  onClick={() =>
                    setQuantity(
                      Math.min(
                        100,
                        quantity + 1
                      )
                    )
                  }
                  style={{
                    width: 46,
                    height: 44,
                    border: "1px solid #d1d5db",
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
  onExport,
  onClear,
}) {
  const counts = {
    Bullet: 0,
    Saree: 0,
    Silver: 0,
  };

  entries.forEach((entry) => {
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

      <div style={S.container}>

        {/* HEADER */}

        <div style={S.topBar}>

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
          style={{
            ...S.card,
            padding: 22,
            marginBottom: 18,
          }}
        >

          <div
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
          style={{
            ...S.card,
            marginBottom: 30,
            overflow: "hidden",
          }}
        >

          <div
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
              style={{
                display: "flex",
                gap: 8,
              }}
            >

              <button
                onClick={onExport}
                disabled={!entries.length}
                style={{
                  ...S.button,
                  padding:
                    "9px 13px",
                  background: "#ecfdf5",
                  color: "#047857",
                  opacity:
                    entries.length
                      ? 1
                      : 0.5,
                }}
              >
                📊 Export
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
                      PAYMENT
                    </th>

                    <th style={tableHeader}>
                      DATE
                    </th>

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
                            {entry.payment}
                          </td>


                          <td style={tableCell}>
                            {entry.date}
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
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 15,
        background: "#f8fafc",
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


async function handleSubmit(entry) {

  try {

    /*
     * Server is the authority.
     *
     * It returns the actual token
     * and order ID allocated from Excel.
     */

    const savedEntry =
      await saveEntry(entry);


    /*
     * Add the server-generated
     * entry to the dashboard.
     */

    setEntries(
      (current) => [
        ...current,
        savedEntry,
      ]
    );


    setScreen(
      "dashboard"
    );


    /*
     * Show the actual server-generated
     * token in the success popup.
     */

    setSuccessEntry(
      savedEntry
    );

  } catch (error) {

    alert(
      error.message ||
        "Unable to save registration. Please try again."
    );

  }
}


  async function handleClear() {
    if (
      !window.confirm(
        "Clear all registrations? This cannot be undone."
      )
    ) {
      return;
    }

    try {
      const res = await fetch(
        `${API}/entries`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        const payload =
          await res
            .json()
            .catch(() => ({}));

        throw new Error(
          payload.error ||
            "Unable to clear registrations."
        );
      }

      setEntries([]);
    } catch (error) {
      alert(
        error.message ||
          "Unable to clear registrations."
      );
    }
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
          onExport={downloadCentralExcel}
          onClear={handleClear}
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