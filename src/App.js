import { useEffect, useMemo, useState } from "react";

const API = process.env.REACT_APP_API_URL || "http://localhost:4000";

const USER_TOKEN_KEY = "spya_v5_user_token";

/* ---------- Design tokens ---------- */
const INK = "#14211c";
const GREEN = "#0f5c4d";
const GREEN_SOFT = "#e6f2ef";
const HEAD_FONT = "'Bricolage Grotesque','Public Sans',sans-serif";

const styles = {
  page: {
    minHeight: "100vh",
    background: "#eef1ee",
    fontFamily: "'Public Sans','Segoe UI',Arial,sans-serif",
    color: INK,
  },
  container: { width: "min(1180px,calc(100% - 32px))", margin: "0 auto" },
  card: {
    background: "#fff",
    border: "1px solid #dde3de",
    borderRadius: 14,
    boxShadow: "0 1px 2px rgba(20,33,28,.06)",
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    minHeight: 44,
    borderRadius: 10,
    border: "1px solid #c3ccc5",
    background: "#fff",
    fontSize: 15,
    boxSizing: "border-box",
    fontFamily: "inherit",
    color: INK,
  },
  button: {
    border: "none",
    cursor: "pointer",
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 14,
    padding: "11px 16px",
    minHeight: 40,
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 700,
    color: "#3b4a43",
    marginBottom: 6,
  },
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700;800&family=Public+Sans:wght@400;500;600;700;800&display=swap');
* { box-sizing: border-box; }
html, body, #root { margin:0; min-height:100%; width:100%; }
body { overflow-x:hidden; -webkit-font-smoothing:antialiased; }
button,input,select,textarea { font:inherit; max-width:100%; }
h1, h2 { font-family:${HEAD_FONT}; letter-spacing:-.02em; }
button { transition:filter .12s, transform .12s; }
button:not(:disabled):hover { filter:brightness(.94); }
button:not(:disabled):active { transform:translateY(1px); }
button:disabled { cursor:not-allowed; }
input:focus, select:focus, textarea:focus { border-color:${GREEN}!important; box-shadow:0 0 0 3px rgba(15,92,77,.18); outline:none; }
button:focus-visible, select:focus-visible { outline:3px solid ${GREEN}; outline-offset:2px; }
.spya-table thead th { position:sticky; top:0; z-index:1; background:#f4f6f4!important; color:#4b5a53; font-size:11px!important; letter-spacing:.04em; }
.spya-table tbody tr:hover td { background:#f7faf7; }
.spya-table td { font-size:13px; }
@media(max-width:768px) {
  .spya-container { width:100%!important; padding:12px!important; }
  .spya-grid-2 { grid-template-columns:1fr!important; }
  .spya-grid-3 { grid-template-columns:1fr!important; }
  .spya-grid-4 { grid-template-columns:repeat(2,minmax(0,1fr))!important; }
  .spya-table-wrap { overflow-x:auto!important; }
  .spya-table { min-width:1120px; table-layout:fixed; }
}
@media(max-width:480px) {
  .spya-grid-4 { grid-template-columns:1fr!important; }
  .spya-actions { flex-direction:column!important; }
}
@media(prefers-reduced-motion:reduce) { * { transition:none!important; } }
`;

/* ---------- API ---------- */
async function api(path, options = {}, token = null) {
  const headers = {
    ...(options.headers || {}),
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API}${path}`, { ...options, headers });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : await response.text();

  if (!response.ok) {
    let message = typeof data === "object" ? data.error || data.message : data;
    if (
      typeof message === "string" &&
      /<\/?html|<\/?body|<!doctype/i.test(message)
    ) {
      message = `Server error (${response.status}). Please try again.`;
    }
    throw new Error(message || `Request failed (${response.status}).`);
  }

  return data;
}

function getUserToken() {
  return sessionStorage.getItem(USER_TOKEN_KEY) || "";
}

const post = (path, body, token) =>
  api(path, { method: "POST", body: JSON.stringify(body) }, token);

async function registerUser(username, password) {
  return post("/api/v5/auth/register", { username, password });
}
async function loginUser(username, password) {
  return post("/api/v5/auth/login", { username, password });
}
async function getMe() {
  return api("/api/v5/me", {}, getUserToken());
}
async function getDashboards() {
  return api("/api/v5/dashboards", {}, getUserToken());
}
async function createDashboard(payload) {
  return post("/api/v5/dashboards", payload, getUserToken());
}
async function getDashboardDetails(dashboardId) {
  return api(`/api/v5/token/dashboards/${dashboardId}`, {}, getUserToken());
}
async function getRegistrations(dashboardId) {
  return api(
    `/api/v5/dashboards/${dashboardId}/registrations`,
    {},
    getUserToken(),
  );
}
async function getDashboardMembers(dashboardId) {
  return api(`/api/v5/dashboards/${dashboardId}/members`, {}, getUserToken());
}
async function createDashboardMember(dashboardId, username, password) {
  return post(
    `/api/v5/dashboards/${dashboardId}/members`,
    { username, password },
    getUserToken(),
  );
}
async function resetDashboardMemberPassword(dashboardId, userId, password) {
  return post(
    `/api/v5/dashboards/${dashboardId}/members/${userId}/reset-password`,
    { password },
    getUserToken(),
  );
}
async function createRegistration(dashboardId, payload) {
  return post(
    `/api/v5/dashboards/${dashboardId}/registrations`,
    payload,
    getUserToken(),
  );
}
async function updateRegistrationStatus(dashboardId, registrationId, status) {
  return post(
    `/api/v5/dashboards/${dashboardId}/registrations/${registrationId}/status`,
    { status },
    getUserToken(),
  );
}
async function cancelRegistration(dashboardId, registrationId) {
  return post(
    `/api/v5/dashboards/${dashboardId}/registrations/${registrationId}/cancel`,
    {},
    getUserToken(),
  );
}
async function markRegistrationPrinted(dashboardId, registrationId) {
  return post(
    `/api/v5/dashboards/${dashboardId}/registrations/${registrationId}/printed`,
    {},
    getUserToken(),
  );
}
async function getAdminInventory(dashboardId) {
  return api(
    `/api/v5/admin/dashboards/${dashboardId}/inventory`,
    {},
    getUserToken(),
  );
}
async function changeAdminPassword(currentPassword, newPassword) {
  return post(
    "/api/v5/account/change-password",
    { currentPassword, newPassword },
    getUserToken(),
  );
}

/* ---------- Helpers ---------- */
function tokenRange(entry) {
  if (!entry) return "";
  if (Array.isArray(entry.categoryEntries) && entry.categoryEntries.length) {
    const active = entry.categoryEntries.filter(
      (category) => category.status !== "Cancelled",
    );
    const shown = active.length ? active : entry.categoryEntries;
    return shown
      .map((category) =>
        category.tokenEnd && category.tokenEnd !== category.tokenStart
          ? `${category.tokenStart}–${category.tokenEnd}`
          : category.tokenStart,
      )
      .join(" + ");
  }
  return entry.tokenEnd && entry.tokenEnd !== entry.tokenStart
    ? `${entry.tokenStart} – ${entry.tokenEnd}`
    : entry.tokenStart;
}

function entryMatchesDateFilter(entry, dateFilter) {
  if (dateFilter === "all") return true;
  const value = entry.createdAt || entry.date;
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfEntry = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const daysAgo = Math.floor((startOfToday - startOfEntry) / 86400000);
  if (dateFilter === "today") return daysAgo === 0;
  if (dateFilter === "yesterday") return daysAgo === 1;
  if (dateFilter === "week") return daysAgo >= 0 && daysAgo < 7;
  if (dateFilter === "month")
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  return true;
}

function hasActiveCategory(entry) {
  return (
    Array.isArray(entry?.categoryEntries) &&
    entry.categoryEntries.some((category) => category.status !== "Cancelled")
  );
}

function activeCategories(entry) {
  return Array.isArray(entry.categoryEntries) && entry.categoryEntries.length
    ? entry.categoryEntries.filter(
        (category) => category.status !== "Cancelled",
      )
    : [
        {
          categoryName: entry.categoryName || entry.tokenType || "",
          prefix: entry.prefix || "",
          tokenStart: entry.tokenStart,
          tokenEnd: entry.tokenEnd,
        },
      ];
}

function serialFor(value, offset) {
  const serial = Number(String(value || "").match(/(\d+)$/)?.[1] || 0) + offset;
  const prefix = String(value || "").replace(/\d+$/, "");
  return `${prefix}${String(serial).padStart(4, "0")}`;
}

function printLabels(entry, associationName = "SPYA") {
  if (entry?.status === "Cancelled" && !hasActiveCategory(entry)) {
    alert("This token has no active categories to print.");
    return;
  }
  const categories = activeCategories(entry);
  if (!categories.length) {
    alert("This combined token has no active categories to print.");
    return;
  }
  const quantity = Math.max(1, Number(entry.quantity) || 1);
  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  const labels = Array.from({ length: quantity }, (_, index) => {
    const ids = categories.map((category) =>
      serialFor(category.tokenStart, index),
    );
    const tokenText = ids.join(" + ");
    return Array.from(
      { length: 2 },
      () => `
      <div class="label">
        <div class="brand">${escapeHtml(associationName || "SPYA")}</div>
        <div class="datetime"><span>${escapeHtml(entry.date || "")}</span><span>|</span><span>${escapeHtml(entry.time || "")}</span></div>
        <div class="divider"></div>
        <div class="category">${escapeHtml(categories.map((c) => c.categoryName).join(" + "))}</div>
        <div class="token">${escapeHtml(tokenText)}</div>
        <div class="row"><b>NAME</b><span>${escapeHtml(entry.name)}</span></div>
        <div class="row"><b>PHONE</b><span>${escapeHtml(entry.phone)}</span></div>
        <div class="row"><b>PAYMENT MODE</b><span>${escapeHtml(entry.payment)}</span></div>
        <div class="divider"></div><div class="thanks">Thank you! 🙏</div>
      </div>`,
    ).join("");
  }).join("");
  const win = window.open("", "_blank", "width=420,height=750");
  if (!win) {
    alert("Please allow pop-ups to print the labels.");
    return false;
  }
  win.document
    .write(`<!doctype html><html><head><title>SPYA Token Labels</title><style>
    *{box-sizing:border-box}@page{size:80mm auto;margin:0}body{margin:0;font-family:Arial,sans-serif;color:#111}
    .label{width:80mm;min-height:72mm;padding:6mm 5mm 5mm;display:flex;flex-direction:column;page-break-after:always}
    .brand{text-align:center;font-size:21px;font-weight:900;letter-spacing:2px}.datetime{text-align:center;margin-top:4px;font-size:10px;color:#555;display:flex;gap:7px;justify-content:center}
    .divider{border-top:1px dashed #aaa;margin:5mm 0}.category{align-self:center;border:2px solid #111;padding:2.5mm 7mm;font-size:19px;font-weight:900;text-transform:uppercase;text-align:center}
    .token{text-align:center;font-family:monospace;font-size:24px;font-weight:900;letter-spacing:1px;margin:4mm 0;overflow-wrap:anywhere}.row{display:flex;justify-content:space-between;gap:8px;font-size:11px;line-height:1.5;margin:2mm 0}.row b{font-size:9px;white-space:nowrap}.row span{text-align:right;word-break:break-word}.thanks{text-align:center;font-size:12px;font-weight:800;margin-top:auto}
    </style></head><body>${labels}<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script></body></html>`);
  win.document.close();
  return true;
}

function sendWhatsAppMessage(entry, associationName = "SPYA") {
  if (entry?.status === "Cancelled" && !hasActiveCategory(entry)) {
    alert("This token has no active categories to send.");
    return;
  }
  const rawPhone = String(entry?.phone || "").trim();
  let phone = rawPhone.replace(/\D/g, "");
  if (phone.startsWith("0")) phone = phone.slice(1);
  if (phone.length === 10) phone = `91${phone}`;
  if (!phone || phone.length < 10) {
    alert(
      "A valid customer phone number is required to send a WhatsApp message.",
    );
    return;
  }
  const categories = activeCategories(entry);
  if (!categories.length) {
    alert("This combined token has no active categories to send.");
    return;
  }
  const quantity = Math.max(1, Number(entry.quantity) || 1);
  const tokens = Array.from({ length: quantity }, (_, i) =>
    categories.map((c) => serialFor(c.tokenStart, i)).join(" + "),
  );
  const message = [
    associationName || "SPYA",
    `${entry.date || ""} | ${entry.time || ""}`,
    `Category: ${categories.map((c) => c.categoryName).join(" + ")}`,
    `Token${tokens.length > 1 ? "s" : ""}: ${tokens.join(", ")}`,
    `Name: ${entry.name || ""}`,
    `Phone: ${entry.phone || ""}`,
    `Payment Mode: ${entry.payment || ""}`,
    `Amount: ₹${Number(entry.amount || 0).toFixed(2)}`,
    "",
    "Thank you! 🙏",
  ].join("\n");
  window.open(
    `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
    "_blank",
  );
}

/* ---------- Shared UI ---------- */
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 15 }}>
      <label style={styles.label}>{label}</label>
      {children}
    </div>
  );
}

function ErrorText({ children }) {
  return (
    <div style={{ color: "#b3261e", fontSize: 13, marginTop: 6 }}>
      {children}
    </div>
  );
}

function Modal({ children }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(20,33,28,.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          ...styles.card,
          width: "min(520px,100%)",
          padding: 24,
          boxShadow: "0 20px 50px rgba(0,0,0,.25)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div style={{ ...styles.card, padding: "14px 16px" }}>
      <div style={{ fontSize: 12, color: "#5b6a63", fontWeight: 600 }}>
        {label.charAt(0) + label.slice(1).toLowerCase()}
      </div>
      <div
        style={{
          fontSize: 30,
          fontWeight: 800,
          marginTop: 4,
          color: tone === "warn" ? "#a85d00" : INK,
          fontVariantNumeric: "tabular-nums",
          fontFamily: HEAD_FONT,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const tones = {
    Cancelled: ["#fbe9e7", "#a32d1f", "#d9534a"],
    "Partially Cancelled": ["#fdf0dc", "#8a4b00", "#e8a200"],
    "Payment Not Received": ["#fdf0dc", "#8a4b00", "#e8a200"],
  };
  const [bg, fg, dot] = tones[status] || [GREEN_SOFT, "#0b4a3d", "#1b9a7e"];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 9px",
        borderRadius: 999,
        fontWeight: 700,
        fontSize: 11,
        whiteSpace: "nowrap",
        background: bg,
        color: fg,
      }}
    >
      <span
        style={{ width: 6, height: 6, borderRadius: 99, background: dot }}
      />
      {status}
    </span>
  );
}

const ghostBtn = { ...styles.button, background: "#f1f4f1", color: "#34443c" };
const inkBtn = { ...styles.button, background: INK, color: "#fff" };
const greenBtn = { ...styles.button, background: GREEN, color: "#fff" };
const dangerSoftBtn = {
  ...styles.button,
  background: "#fbe9e7",
  color: "#a32d1f",
};
const backBtn = {
  ...styles.button,
  background: "transparent",
  color: "#5b6a63",
  paddingLeft: 0,
};

/* ---------- Login ---------- */
function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function validateUsername(value) {
    return /^[a-z0-9][a-z0-9_.-]{3,39}$/.test(value.trim().toLowerCase());
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setMessage("");
  }

  async function submit() {
    const userId = username.trim().toLowerCase();

    setError("");
    setMessage("");

    if (!validateUsername(userId)) {
      setError(
        "User ID must be 4-40 characters and use only letters, numbers, dot, underscore or hyphen.",
      );
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const result =
        mode === "register"
          ? await registerUser(userId, password)
          : await loginUser(userId, password);

      sessionStorage.setItem(USER_TOKEN_KEY, result.token);
      setMessage(
        mode === "register"
          ? "Account created successfully."
          : "Login successful.",
      );
      onLogin(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const onEnter = (e) => e.key === "Enter" && submit();

  return (
    <div style={styles.page}>
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <div style={{ ...styles.card, width: "min(440px,100%)", padding: 32 }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 16,
                background: INK,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                fontWeight: 800,
                fontFamily: HEAD_FONT,
                margin: "0 auto 14px",
              }}
            >
              S
            </div>

            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 2 }}>
              SPYA
            </div>

            <h1 style={{ margin: "8px 0 5px", fontSize: 28 }}>
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h1>

            <p style={{ margin: 0, color: "#5b6a63", fontSize: 14 }}>
              {mode === "login"
                ? "Sign in with your User ID and password."
                : "Create a User ID and password to start using SPYA."}
            </p>
          </div>

          <Field label="User ID">
            <input
              autoFocus
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))
              }
              placeholder="e.g. rahul123"
              maxLength={40}
              style={styles.input}
              onKeyDown={onEnter}
            />
          </Field>

          <Field label="Password">
            <input
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              maxLength={128}
              style={styles.input}
              onKeyDown={onEnter}
            />
          </Field>

          {mode === "register" && (
            <Field label="Confirm Password">
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                maxLength={128}
                style={styles.input}
                onKeyDown={onEnter}
              />
            </Field>
          )}

          <button
            onClick={submit}
            disabled={loading}
            style={{
              ...inkBtn,
              width: "100%",
              minHeight: 46,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? mode === "login"
                ? "Signing in..."
                : "Creating account..."
              : mode === "login"
                ? "Sign In"
                : "Create Account"}
          </button>

          <div
            style={{
              marginTop: 18,
              textAlign: "center",
              color: "#5b6a63",
              fontSize: 13,
            }}
          >
            {mode === "login"
              ? "Don't have an account?"
              : "Already have an account?"}
            <button
              type="button"
              onClick={() =>
                switchMode(mode === "login" ? "register" : "login")
              }
              style={{
                ...styles.button,
                padding: 0,
                marginLeft: 6,
                background: "transparent",
                color: GREEN,
              }}
            >
              {mode === "login" ? "Create one" : "Sign in"}
            </button>
          </div>

          {message && (
            <div
              style={{
                color: "#0b4a3d",
                fontSize: 13,
                marginTop: 10,
                textAlign: "center",
              }}
            >
              {message}
            </div>
          )}

          {error && <ErrorText>{error}</ErrorText>}

          <div
            style={{
              marginTop: 22,
              color: "#8a968f",
              fontSize: 11,
              textAlign: "center",
            }}
          >
            Your account and dashboards are securely stored in PostgreSQL.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Dashboard setup ---------- */
function DashboardSetup({ onCreated, onCancel, existingCount }) {
  const [associationName, setAssociationName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState([
    { name: "", prefix: "", price: "" },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function addCategory() {
    setCategories((items) => [...items, { name: "", prefix: "", price: "" }]);
  }

  function updateCategory(index, key, value) {
    setCategories((items) =>
      items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    );
  }

  function removeCategory(index) {
    setCategories((items) => items.filter((_, i) => i !== index));
  }

  async function submit(e) {
    e.preventDefault();

    if (!associationName.trim()) {
      setError("Association name is required.");
      return;
    }

    const clean = categories.map((c) => ({
      name: c.name.trim(),
      prefix: c.prefix.trim().toUpperCase(),
      price: Number(c.price),
    }));

    if (
      !clean.length ||
      clean.some(
        (c) => !c.name || !c.prefix || !Number.isFinite(c.price) || c.price < 0,
      )
    ) {
      setError("Enter a name, prefix and valid price for every category.");
      return;
    }

    if (new Set(clean.map((c) => c.name.toLowerCase())).size !== clean.length) {
      setError("Category names must be unique.");
      return;
    }

    if (new Set(clean.map((c) => c.prefix)).size !== clean.length) {
      setError("Category prefixes must be unique.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const result = await createDashboard({
        associationName: associationName.trim(),
        contactPhone: contactPhone.trim(),
        contactEmail: contactEmail.trim(),
        address: address.trim(),
        description: description.trim(),
        categories: clean,
      });

      onCreated(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div
        className="spya-container"
        style={{ ...styles.container, paddingTop: 25, paddingBottom: 50 }}
      >
        <div style={{ ...styles.card, padding: 28 }}>
          <div style={{ fontSize: 13, color: GREEN, fontWeight: 700 }}>
            Dashboard {existingCount + 1} of 2
          </div>
          <h1 style={{ margin: "7px 0", fontSize: 30 }}>
            Create your dashboard
          </h1>
          <p style={{ color: "#5b6a63", fontSize: 14, marginTop: 0 }}>
            Define the association details and token categories for this
            dashboard.
          </p>

          <form onSubmit={submit}>
            <div
              className="spya-grid-2"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 15,
              }}
            >
              <Field label="Association Name *">
                <input
                  value={associationName}
                  onChange={(e) => setAssociationName(e.target.value)}
                  style={styles.input}
                  placeholder="SPYA Association"
                />
              </Field>
              <Field label="Contact Phone">
                <input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  style={styles.input}
                  placeholder="+91..."
                />
              </Field>
              <Field label="Contact Email">
                <input
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  style={styles.input}
                  placeholder="association@example.com"
                />
              </Field>
              <Field label="Description">
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={styles.input}
                  placeholder="Optional description"
                />
              </Field>
            </div>

            <Field label="Address">
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                style={{ ...styles.input, resize: "vertical" }}
              />
            </Field>

            <div
              style={{
                marginTop: 8,
                marginBottom: 12,
                fontSize: 17,
                fontWeight: 800,
                fontFamily: HEAD_FONT,
              }}
            >
              Token categories
            </div>

            {categories.map((category, index) => (
              <div
                key={index}
                className="spya-grid-3"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr .8fr .8fr auto",
                  gap: 10,
                  alignItems: "end",
                  padding: 13,
                  border: "1px solid #dde3de",
                  borderRadius: 12,
                  marginBottom: 10,
                }}
              >
                <Field label={`Category ${index + 1}`}>
                  <input
                    value={category.name}
                    onChange={(e) =>
                      updateCategory(index, "name", e.target.value)
                    }
                    style={styles.input}
                    placeholder="Bullet"
                  />
                </Field>
                <Field label="Prefix">
                  <input
                    value={category.prefix}
                    onChange={(e) =>
                      updateCategory(index, "prefix", e.target.value)
                    }
                    style={styles.input}
                    placeholder="BUL"
                    maxLength={8}
                  />
                </Field>
                <Field label="Price">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={category.price}
                    onChange={(e) =>
                      updateCategory(index, "price", e.target.value)
                    }
                    style={styles.input}
                    placeholder="301"
                  />
                </Field>
                <button
                  type="button"
                  onClick={() => removeCategory(index)}
                  disabled={categories.length === 1}
                  style={{
                    ...dangerSoftBtn,
                    marginBottom: 15,
                    opacity: categories.length === 1 ? 0.4 : 1,
                  }}
                >
                  Remove
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addCategory}
              style={{ ...styles.button, background: GREEN_SOFT, color: GREEN }}
            >
              + Add Category
            </button>

            {error && <ErrorText>{error}</ErrorText>}

            <div
              className="spya-actions"
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
                marginTop: 25,
              }}
            >
              {onCancel && (
                <button type="button" onClick={onCancel} style={ghostBtn}>
                  Cancel
                </button>
              )}
              <button disabled={loading} style={inkBtn}>
                {loading ? "Creating..." : "Create Dashboard"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ---------- Dashboard home ---------- */
function DashboardHome({
  dashboards,
  selected,
  onSelect,
  onCreate,
  onLogout,
  user,
  hasAdmin,
  canCreateDashboard,
  onAdmin,
}) {
  return (
    <div style={styles.page}>
      <div
        className="spya-container"
        style={{ ...styles.container, paddingTop: 20, paddingBottom: 50 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 15,
            padding: "12px 0 25px",
          }}
        >
          <div>
            <div
              style={{
                fontWeight: 800,
                letterSpacing: 1.5,
                fontFamily: HEAD_FONT,
                fontSize: 20,
              }}
            >
              SPYA
            </div>
            <div style={{ color: "#8a968f", fontSize: 11 }}>
              Token management v5
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {hasAdmin && (
              <button type="button" onClick={onAdmin} style={inkBtn}>
                Admin Portal
              </button>
            )}
            <span style={{ color: "#5b6a63", fontSize: 13 }}>
              {user?.username || user?.email || "User"}
            </span>
            <button onClick={onLogout} style={ghostBtn}>
              Logout
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 25 }}>
          <div style={{ color: GREEN, fontWeight: 700, fontSize: 13 }}>
            Your association
          </div>
          <h1 style={{ margin: "5px 0", fontSize: 36 }}>Your Dashboards</h1>
          <p style={{ margin: 0, color: "#5b6a63", fontSize: 14 }}>
            Each dashboard has its own association details, categories, prices
            and registrations.
          </p>
        </div>

        <div
          className="spya-grid-2"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2,minmax(0,1fr))",
            gap: 16,
          }}
        >
          {dashboards.map((dashboard, index) => (
            <button
              key={dashboard.id}
              onClick={() => onSelect(dashboard)}
              style={{
                ...styles.card,
                padding: 24,
                textAlign: "left",
                cursor: "pointer",
                border:
                  selected?.id === dashboard.id
                    ? `2px solid ${GREEN}`
                    : "1px solid #dde3de",
                background: "#fff",
              }}
            >
              <div style={{ color: GREEN, fontSize: 12, fontWeight: 700 }}>
                Dashboard {index + 1}
              </div>
              <h2 style={{ margin: "8px 0", fontSize: 22 }}>
                {dashboard.association_name}
              </h2>
              <div style={{ color: "#5b6a63", fontSize: 13 }}>
                {dashboard.contact_email ||
                  dashboard.contact_phone ||
                  "No contact details"}
              </div>
              <div style={{ marginTop: 18, color: INK, fontWeight: 800 }}>
                Open dashboard
              </div>
            </button>
          ))}

          {canCreateDashboard && dashboards.length < 2 && (
            <button
              onClick={onCreate}
              style={{
                ...styles.card,
                padding: 24,
                textAlign: "left",
                border: "1px dashed #8fc2b6",
                background: "#f1f7f5",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 30, color: GREEN }}>＋</div>
              <h2 style={{ margin: "8px 0", fontSize: 21 }}>
                Create Dashboard
              </h2>
              <div style={{ color: "#5b6a63", fontSize: 13 }}>
                {2 - dashboards.length} dashboard slot remaining.
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Registration form ---------- */
function RegistrationForm({ dashboard, categories, onBack, onSaved }) {
  const [selectedCategoryIds, setSelectedCategoryIds] = useState(
    categories[0]?.id ? [categories[0].id] : [],
  );
  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [payment, setPayment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const selectedCategories = categories.filter((c) =>
    selectedCategoryIds.includes(c.id),
  );
  const amountPerCustomer =
    selectedCategories.reduce((sum, c) => sum + Number(c.price || 0), 0) *
    Number(quantity || 0);
  const names = name
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const phones = phone
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const emails = email.split(",").map((v) => v.trim());

  async function submit(e) {
    e.preventDefault();
    if (!selectedCategoryIds.length) {
      setError("Select at least one token category.");
      return;
    }
    if (!names.length) {
      setError("Enter at least one customer name.");
      return;
    }
    if (names.length !== phones.length) {
      setError(
        "Enter the same number of comma-separated phone numbers as customer names, in the same order.",
      );
      return;
    }
    if (names.some((v) => !v) || phones.some((v) => !v)) {
      setError("Every customer must have a name and phone number.");
      return;
    }
    if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
      setError("Enter a valid quantity.");
      return;
    }
    if (!payment) {
      setError("Select a payment mode.");
      return;
    }
    try {
      setLoading(true);
      setError("");
      const result = await createRegistration(dashboard.id, {
        categoryIds: selectedCategoryIds,
        quantity: Number(quantity),
        customers: names.map((customerName, index) => ({
          name: customerName,
          phone: phones[index],
          email: (emails[index] || "").trim(),
        })),
        payment,
      });
      onSaved(result.entries || (result.entry ? [result.entry] : []));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const stepBtn = {
    ...styles.button,
    background: "#f4f6f4",
    border: "1px solid #c3ccc5",
    minHeight: 44,
    minWidth: 48,
  };
  const textArea = { ...styles.input, resize: "vertical" };

  return (
    <div style={styles.page}>
      <div
        className="spya-container"
        style={{ ...styles.container, paddingTop: 20, paddingBottom: 50 }}
      >
        <button onClick={onBack} style={backBtn}>
          ← {dashboard.association_name}
        </button>
        <div style={{ ...styles.card, padding: 26, marginTop: 10 }}>
          <div style={{ color: GREEN, fontSize: 13, fontWeight: 700 }}>
            New registration
          </div>
          <h1 style={{ margin: "6px 0 3px", fontSize: 29 }}>
            Create combined token
          </h1>
          <p style={{ margin: 0, color: "#5b6a63", fontSize: 14 }}>
            Select one or more categories. Each customer gets one combined
            label; each category is saved as its own registration row.
          </p>
          <form onSubmit={submit} style={{ marginTop: 25 }}>
            <Field label="Token Categories *">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
                  gap: 8,
                }}
              >
                {categories.map((item) => {
                  const selected = selectedCategoryIds.includes(item.id);
                  return (
                    <button
                      type="button"
                      key={item.id}
                      aria-pressed={selected}
                      onClick={() =>
                        setSelectedCategoryIds((current) =>
                          selected
                            ? current.filter((id) => id !== item.id)
                            : [...current, item.id],
                        )
                      }
                      style={{
                        ...styles.button,
                        padding: 14,
                        textAlign: "left",
                        background: selected ? GREEN_SOFT : "#f7f9f7",
                        color: selected ? GREEN : "#34443c",
                        border: selected
                          ? `2px solid ${GREEN}`
                          : "1px solid #dde3de",
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>
                        {selected ? "✓ " : ""}
                        {item.name}
                      </div>
                      <div style={{ fontSize: 12, marginTop: 3 }}>
                        ₹{Number(item.price).toFixed(2)} · {item.prefix}
                      </div>
                    </button>
                  );
                })}
              </div>
            </Field>
            <div
              className="spya-grid-2"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 20,
              }}
            >
              <div>
                <Field label="Quantity per Customer *">
                  <div style={{ display: "flex" }}>
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() =>
                        setQuantity((q) => Math.max(1, Number(q) - 1))
                      }
                      style={{ ...stepBtn, borderRadius: "10px 0 0 10px" }}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="9999"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      style={{
                        ...styles.input,
                        borderRadius: 0,
                        textAlign: "center",
                        fontWeight: 800,
                      }}
                    />
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() =>
                        setQuantity((q) => Math.min(9999, Number(q || 1) + 1))
                      }
                      style={{ ...stepBtn, borderRadius: "0 10px 10px 0" }}
                    >
                      +
                    </button>
                  </div>
                </Field>
                <Field label="Customer Names *">
                  <textarea
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Rahul, Priya, Kiran"
                    rows={3}
                    style={{ ...textArea, minHeight: 80 }}
                  />
                </Field>
                <Field label="Phone Numbers *">
                  <textarea
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9876543210, 9876543211, 9876543212"
                    rows={3}
                    style={{ ...textArea, minHeight: 80 }}
                  />
                  <div style={{ color: "#5b6a63", fontSize: 12, marginTop: 5 }}>
                    Match each phone number to the name in the same position.
                  </div>
                </Field>
              </div>
              <div>
                <Field label="Email Addresses (optional)">
                  <textarea
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Optional; separate emails with commas"
                    rows={2}
                    style={{ ...textArea, minHeight: 60 }}
                  />
                </Field>
                <Field label="Payment Mode *">
                  <div
                    role="group"
                    aria-label="Payment mode"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                    }}
                  >
                    {["CASH", "UPI"].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={payment === mode}
                        onClick={() => setPayment(mode)}
                        style={{
                          ...styles.button,
                          minHeight: 52,
                          border:
                            payment === mode
                              ? `2px solid ${GREEN}`
                              : "1px solid #c3ccc5",
                          background: payment === mode ? GREEN_SOFT : "#fff",
                          color: payment === mode ? GREEN : "#34443c",
                        }}
                      >
                        {payment === mode ? "✓ " : ""}
                        {mode}
                      </button>
                    ))}
                  </div>
                </Field>
                <div
                  style={{
                    background: "#f4f6f4",
                    border: "1px solid #dde3de",
                    borderRadius: 12,
                    padding: 16,
                    marginTop: 8,
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>
                    Order summary
                  </div>
                  <div style={{ color: "#5b6a63", fontSize: 13 }}>
                    Categories:{" "}
                    {selectedCategories.map((c) => c.name).join(" + ") ||
                      "None selected"}
                  </div>
                  <div style={{ color: "#5b6a63", fontSize: 13, marginTop: 5 }}>
                    Customers: {names.length}
                  </div>
                  <div style={{ color: "#5b6a63", fontSize: 13, marginTop: 5 }}>
                    Amount per customer: ₹{amountPerCustomer.toFixed(2)}
                  </div>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 800,
                      marginTop: 8,
                      fontFamily: HEAD_FONT,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    Total: ₹{(amountPerCustomer * names.length).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
            {error && (
              <div
                role="alert"
                style={{
                  color: "#a32d1f",
                  background: "#fbe9e7",
                  padding: 12,
                  borderRadius: 10,
                  marginTop: 12,
                  fontSize: 14,
                }}
              >
                {error}
              </div>
            )}
            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginTop: 22,
              }}
            >
              <button type="button" onClick={onBack} style={ghostBtn}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{ ...greenBtn, flex: 1, minHeight: 48 }}
              >
                {loading
                  ? "Creating tokens..."
                  : `Create ${names.length || 0} Customer Token${names.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ---------- Success modal ---------- */
function SuccessModal({ entry, associationName, onClose }) {
  const entries = Array.isArray(entry) ? entry : [entry];
  const row = {
    display: "flex",
    justifyContent: "space-between",
    padding: 5,
    fontSize: 14,
  };
  return (
    <Modal>
      <div
        style={{ textAlign: "center", maxHeight: "80vh", overflowY: "auto" }}
      >
        <div style={{ fontSize: 42, color: "#1b9a7e" }}>✓</div>
        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: HEAD_FONT }}>
          Tokens created
        </div>
        <p style={{ color: "#5b6a63", fontSize: 14, margin: "8px 0 18px" }}>
          {entries.length} customer token{entries.length === 1 ? "" : "s"}{" "}
          created. Print or send each customer their own combined token details.
        </p>
        {entries.map((item) => (
          <div
            key={item.groupId || item.id}
            style={{
              background: "#f4f6f4",
              border: "1px solid #dde3de",
              borderRadius: 12,
              padding: 15,
              textAlign: "left",
              margin: "12px 0",
            }}
          >
            <div
              style={{
                fontSize: 28,
                fontFamily: "monospace",
                fontWeight: 900,
                textAlign: "center",
                overflowWrap: "anywhere",
              }}
            >
              {tokenRange(item)}
            </div>
            <div
              style={{
                textAlign: "center",
                color: "#5b6a63",
                fontSize: 13,
                marginBottom: 8,
              }}
            >
              {item.categoryName} · Order {item.orderId}
            </div>
            <div style={row}>
              <span>Name</span>
              <strong>{item.name}</strong>
            </div>
            <div style={row}>
              <span>Phone</span>
              <strong>{item.phone}</strong>
            </div>
            <div style={row}>
              <span>Payment</span>
              <strong>{item.payment}</strong>
            </div>
            <div style={row}>
              <span>Amount</span>
              <strong>₹{Number(item.amount).toFixed(2)}</strong>
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 10,
              }}
            >
              <button
                type="button"
                onClick={() => printLabels(item, associationName)}
                style={{ ...inkBtn, flex: "1 1 120px" }}
              >
                🖨️ Print Labels
              </button>
              <button
                type="button"
                onClick={() => sendWhatsAppMessage(item, associationName)}
                style={{
                  ...styles.button,
                  flex: "1 1 160px",
                  background: "#1f8a4c",
                  color: "#fff",
                }}
              >
                💬 Send WhatsApp Message
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={onClose}
          style={{ ...ghostBtn, marginTop: 8 }}
        >
          Done
        </button>
      </div>
    </Modal>
  );
}

/* ---------- Dashboard users panel ---------- */
function DashboardUsersPanel({ dashboardId }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [resetPasswords, setResetPasswords] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadMembers() {
    setLoading(true);
    setError("");
    try {
      const result = await getDashboardMembers(dashboardId);
      setMembers(result.members || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function addUser(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      setLoading(true);
      await createDashboardMember(
        dashboardId,
        username.trim().toLowerCase(),
        password,
      );
      setUsername("");
      setPassword("");
      setMessage(
        "Dashboard user created. Share the User ID and password securely.",
      );
      await loadMembers();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(member) {
    const next = String(resetPasswords[member.id] || "");
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    setError("");
    setMessage("");
    try {
      setLoading(true);
      await resetDashboardMemberPassword(dashboardId, member.id, next);
      setResetPasswords((old) => ({ ...old, [member.id]: "" }));
      setMessage(`Password reset for ${member.username}.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ ...styles.card, marginBottom: 18, overflow: "hidden" }}>
      <div
        style={{
          padding: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 800 }}>Dashboard users</div>
          <div style={{ color: "#5b6a63", fontSize: 13, marginTop: 4 }}>
            Create up to 2 individual logins for this dashboard and reset their
            passwords.
          </div>
        </div>
        <button
          type="button"
          onClick={async () => {
            const next = !open;
            setOpen(next);
            if (next) await loadMembers();
          }}
          style={inkBtn}
        >
          {open ? "Hide User Management" : "＋ Manage Dashboard Users"}
        </button>
      </div>
      {open && (
        <div style={{ borderTop: "1px solid #e6ebe7", padding: 16 }}>
          <form
            onSubmit={addUser}
            className="spya-grid-2"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2,minmax(0,1fr))",
              gap: 12,
              alignItems: "end",
            }}
          >
            <Field label="New User ID">
              <input
                required
                minLength={4}
                maxLength={40}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. tokenuser01"
                style={styles.input}
                autoComplete="off"
              />
            </Field>
            <Field label="Temporary Password (min. 8 characters)">
              <input
                required
                minLength={8}
                maxLength={128}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                style={styles.input}
                autoComplete="new-password"
              />
            </Field>
            <button
              disabled={loading || members.length >= 2}
              type="submit"
              style={{
                ...styles.button,
                background: members.length >= 2 ? "#c9d1cb" : GREEN,
                color: "#fff",
                gridColumn: "1 / -1",
              }}
            >
              {members.length >= 2
                ? "Maximum 2 users reached"
                : loading
                  ? "Please wait..."
                  : "Create Dashboard User"}
            </button>
          </form>
          <div style={{ marginTop: 18, fontWeight: 800 }}>
            Assigned users ({members.length}/2)
          </div>
          {members.length === 0 && (
            <div style={{ color: "#5b6a63", fontSize: 13, marginTop: 8 }}>
              {loading ? "Loading users..." : "No dashboard users created yet."}
            </div>
          )}
          {members.map((member) => (
            <div
              key={member.id}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(120px,1fr) minmax(180px,1.5fr) auto",
                gap: 10,
                alignItems: "end",
                padding: "12px 0",
                borderBottom: "1px solid #eef1ee",
              }}
            >
              <div>
                <div style={{ fontWeight: 800 }}>{member.username}</div>
                <div style={{ color: "#5b6a63", fontSize: 12 }}>
                  {member.is_active ? "Active" : "Inactive"}
                </div>
              </div>
              <input
                type="password"
                minLength={8}
                value={resetPasswords[member.id] || ""}
                onChange={(e) =>
                  setResetPasswords((old) => ({
                    ...old,
                    [member.id]: e.target.value,
                  }))
                }
                placeholder="New password"
                style={styles.input}
                autoComplete="new-password"
              />
              <button
                type="button"
                disabled={loading}
                onClick={() => resetPassword(member)}
                style={ghostBtn}
              >
                Reset Password
              </button>
            </div>
          ))}
          {error && <ErrorText>{error}</ErrorText>}
          {message && (
            <div style={{ color: "#0b4a3d", fontSize: 13, marginTop: 10 }}>
              {message}
            </div>
          )}
          <div style={{ color: "#5b6a63", fontSize: 12, marginTop: 12 }}>
            Users sign in with their User ID and password and can access only
            this assigned dashboard.
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Registrations dashboard ---------- */
function UserDashboard({
  dashboard,
  categories,
  entries,
  onBack,
  onCreate,
  onRefresh,
  onStatusChange,
  onCancel,
  onReprint,
  isOwner,
}) {
  const [filter, setFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  // Shared table-cell styling used throughout the registrations table.
  const cell = {
    padding: "12px 10px",
    verticalAlign: "top",
    borderBottom: "1px solid #eef1ee",
    overflowWrap: "break-word",
  };

  const filtered = useMemo(
    () =>
      entries.filter((entry) => {
        const hasCancelledCategory =
          Array.isArray(entry.categoryEntries) &&
          entry.categoryEntries.some(
            (category) => category.status === "Cancelled",
          );
        if (
          filter === "cancelled" &&
          entry.status !== "Cancelled" &&
          !hasCancelledCategory
        )
          return false;
        if (filter === "payment" && entry.status !== "Payment Not Received")
          return false;
        if (!entryMatchesDateFilter(entry, dateFilter)) return false;
        return true;
      }),
    [entries, filter, dateFilter],
  );

  const activeTokens = entries
    .filter((e) => e.status !== "Cancelled")
    .reduce((sum, e) => sum + Number(e.quantity || 0), 0);

  return (
    <div style={styles.page}>
      <div
        className="spya-container"
        style={{ ...styles.container, paddingTop: 20, paddingBottom: 50 }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            paddingBottom: 22,
          }}
        >
          <button onClick={onBack} style={backBtn}>
            ← Dashboards
          </button>
          <div style={{ fontWeight: 800, fontFamily: HEAD_FONT }}>
            {dashboard.association_name}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ color: GREEN, fontSize: 13, fontWeight: 700 }}>
            Token management
          </div>
          <h1 style={{ margin: "5px 0", fontSize: 34 }}>
            {dashboard.association_name}
          </h1>
          <p style={{ margin: 0, color: "#5b6a63", fontSize: 14 }}>
            Manage registrations for this dashboard.
          </p>
        </div>

        {isOwner && <DashboardUsersPanel dashboardId={dashboard.id} />}

        <div
          className="spya-grid-4"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,minmax(0,1fr))",
            gap: 10,
            marginBottom: 18,
          }}
        >
          <Stat label="ACTIVE TOKENS" value={activeTokens} />
          <Stat label="REGISTRATIONS" value={entries.length} />
          <Stat label="CATEGORIES" value={categories.length} />
          <Stat
            tone="warn"
            label="PAYMENT PENDING"
            value={
              entries.filter((e) => e.status === "Payment Not Received").length
            }
          />
        </div>

        <div style={{ ...styles.card, overflow: "hidden" }}>
          <div
            className="spya-actions"
            style={{
              padding: 18,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              borderBottom: "1px solid #e6ebe7",
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: 17 }}>Registrations</div>
              <div style={{ color: "#8a968f", fontSize: 12, marginTop: 3 }}>
                PostgreSQL-backed data
              </div>
            </div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              <button onClick={onCreate} style={greenBtn}>
                + Create Token
              </button>
              <button onClick={onRefresh} style={ghostBtn}>
                ↻ Refresh
              </button>
            </div>
          </div>

          <div
            style={{
              padding: "10px 18px",
              display: "flex",
              gap: 7,
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {[
                ["all", "All"],
                ["payment", "Payment Pending"],
                ["cancelled", "Cancelled"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  aria-pressed={filter === value}
                  style={{
                    ...styles.button,
                    padding: "7px 12px",
                    fontSize: 13,
                    minHeight: 36,
                    background: filter === value ? INK : "#f1f4f1",
                    color: filter === value ? "#fff" : "#4b5a53",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <select
              aria-label="Filter registrations by date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{
                ...styles.input,
                width: "auto",
                minWidth: 150,
                minHeight: 38,
                padding: "8px 10px",
              }}
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">Last 7 days</option>
              <option value="month">This month</option>
              <option value="all">All days</option>
            </select>
          </div>

          {!filtered.length ? (
            <div style={{ padding: 45, textAlign: "center", color: "#8a968f" }}>
              No registrations found.
            </div>
          ) : (
            <div className="spya-table-wrap" style={{ overflowX: "auto" }}>
              <table
                className="spya-table"
                style={{
                  width: "100%",
                  minWidth: 1120,
                  tableLayout: "fixed",
                  borderCollapse: "separate",
                  borderSpacing: 0,
                  fontSize: 12,
                }}
              >
                <colgroup>
                  <col style={{ width: 145 }} />
                  <col style={{ width: 270 }} />
                  <col style={{ width: 130 }} />
                  <col style={{ width: 125 }} />
                  <col style={{ width: 55 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 145 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 185 }} />
                </colgroup>
                <thead>
                  <tr style={{ background: "#f4f6f4", color: "#4b5a53" }}>
                    {[
                      "TOKEN",
                      "CATEGORY",
                      "CUSTOMER",
                      "PHONE",
                      "QTY",
                      "AMOUNT",
                      "PAYMENT",
                      "STATUS",
                      "DATE",
                      "ACTION",
                    ].map((x) => (
                      <th
                        key={x}
                        style={{
                          padding: "12px 10px",
                          textAlign: "left",
                          whiteSpace: "nowrap",
                          borderBottom: "1px solid #dde3de",
                        }}
                      >
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry) => {
                    const category = categories.find(
                      (c) => c.id === entry.categoryId,
                    );
                    const printStatus = entry.printStatus || "Not Yet Printed";
                    return (
                      <tr key={entry.id}>
                        <td
                          style={{
                            ...cell,
                            minWidth: 0,
                            overflowWrap: "anywhere",
                          }}
                        >
                          <strong
                            style={{ fontFamily: "monospace", lineHeight: 1.6 }}
                          >
                            {tokenRange(entry)}
                          </strong>
                        </td>
                        <td style={cell}>
                          <div
                            style={{
                              display: "grid",
                              gap: 8,
                              minWidth: 0,
                              alignItems: "start",
                            }}
                          >
                            {(entry.categoryEntries?.length
                              ? entry.categoryEntries
                              : [
                                  {
                                    id: entry.id,
                                    categoryName: entry.categoryName,
                                    tokenStart: entry.tokenStart,
                                    tokenEnd: entry.tokenEnd,
                                    amount: entry.amount,
                                    status: entry.status,
                                  },
                                ]
                            ).map((categoryEntry) => (
                              <div
                                key={categoryEntry.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                  flexWrap: "wrap",
                                  minWidth: 0,
                                  lineHeight: 1.5,
                                }}
                              >
                                <span style={{ overflowWrap: "anywhere" }}>
                                  {categoryEntry.categoryName}{" "}
                                  <strong style={{ fontFamily: "monospace" }}>
                                    {categoryEntry.tokenEnd &&
                                    categoryEntry.tokenEnd !==
                                      categoryEntry.tokenStart
                                      ? `${categoryEntry.tokenStart}–${categoryEntry.tokenEnd}`
                                      : categoryEntry.tokenStart}
                                  </strong>
                                </span>
                                {categoryEntry.status !== "Complete" && (
                                  <StatusBadge status={categoryEntry.status} />
                                )}
                                {categoryEntry.status !== "Cancelled" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onCancel(entry, categoryEntry)
                                    }
                                    style={{
                                      ...dangerSoftBtn,
                                      padding: "4px 8px",
                                      minHeight: 28,
                                      fontSize: 11,
                                    }}
                                  >
                                    Cancel category
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td style={{ ...cell, overflowWrap: "anywhere" }}>
                          <strong>{entry.name}</strong>
                        </td>
                        <td style={{ ...cell, whiteSpace: "nowrap" }}>
                          {entry.phone}
                        </td>
                        <td style={{ ...cell, textAlign: "center" }}>
                          {entry.quantity}
                        </td>
                        <td
                          style={{
                            ...cell,
                            whiteSpace: "nowrap",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          ₹{Number(entry.amount).toFixed(2)}
                        </td>
                        <td style={{ ...cell, whiteSpace: "nowrap" }}>
                          {entry.payment}
                        </td>
                        <td style={cell}>
                          <StatusBadge status={entry.status} />
                        </td>
                        <td style={{ ...cell, whiteSpace: "nowrap" }}>
                          {entry.date}
                        </td>
                        <td style={{ ...cell, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-start",
                              gap: 8,
                              minWidth: 0,
                            }}
                          >
                            {entry.status !== "Cancelled" && (
                              <StatusBadge
                                status={
                                  printStatus === "Complete"
                                    ? "Printed"
                                    : printStatus
                                }
                              />
                            )}
                            <div
                              style={{
                                display: "flex",
                                gap: 6,
                                alignItems: "center",
                              }}
                            >
                              {entry.status !== "Cancelled" && (
                                <select
                                  value={
                                    entry.status === "Partially Cancelled"
                                      ? "Complete"
                                      : entry.status
                                  }
                                  onChange={(e) =>
                                    onStatusChange(entry, e.target.value)
                                  }
                                  aria-label="Payment status"
                                  style={{
                                    border: "1px solid #c3ccc5",
                                    borderRadius: 8,
                                    padding: 6,
                                    fontSize: 12,
                                    maxWidth: 130,
                                    minHeight: 34,
                                  }}
                                >
                                  <option>Complete</option>
                                  <option>Payment Not Received</option>
                                </select>
                              )}
                              {entry.status !== "Cancelled" && (
                                <button
                                  onClick={() => onReprint(entry)}
                                  title="Print / reprint labels"
                                  aria-label="Print or reprint labels"
                                  style={{
                                    ...inkBtn,
                                    padding: "7px 10px",
                                    minHeight: 34,
                                    fontSize: 12,
                                    flexShrink: 0,
                                  }}
                                >
                                  🖨️
                                </button>
                              )}
                            </div>
                          </div>
                          {category && (
                            <span style={{ display: "none" }}>
                              {category.name}
                            </span>
                          )}
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

/* ---------- Admin inventory ---------- */
function AdminDashboard({ dashboards, onBack, onLogout }) {
  const [selectedId, setSelectedId] = useState(dashboards[0]?.id || "");
  const [inventory, setInventory] = useState(null);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [inventoryError, setInventoryError] = useState("");
  const [selectedActionStatus, setSelectedActionStatus] = useState("");
  const [showNotPrintedDetails, setShowNotPrintedDetails] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadInventory() {
      if (!selectedId) {
        setInventory(null);
        return;
      }
      setLoadingInventory(true);
      setInventoryError("");
      setSelectedActionStatus("");
      setShowNotPrintedDetails(false);
      try {
        const result = await getAdminInventory(selectedId);
        if (!cancelled) setInventory(result);
      } catch (error) {
        if (!cancelled) {
          setInventory(null);
          setInventoryError(error.message || "Unable to load inventory.");
        }
      } finally {
        if (!cancelled) setLoadingInventory(false);
      }
    }
    loadInventory();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  async function submitPasswordChange(e) {
    e.preventDefault();
    setPasswordError("");
    setPasswordMessage("");
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }
    try {
      setSavingPassword(true);
      const result = await changeAdminPassword(currentPassword, newPassword);
      setPasswordMessage(
        result.message || "Account password changed successfully.",
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      alert(
        "Your account password has changed. Please log in again using your new password.",
      );
      onLogout();
    } catch (error) {
      setPasswordError(error.message);
    } finally {
      setSavingPassword(false);
    }
  }

  const summary = inventory?.summary || {};
  const actionStatuses = inventory?.actionStatuses || [];
  const statusDetails = inventory?.statusDetails || [];
  const selectedStatusRows = selectedActionStatus
    ? statusDetails.filter((row) => row.status === selectedActionStatus)
    : [];
  const notPrintedSummary = inventory?.printSummary || {};
  // Match the Registrations screen: combine category rows into one printable
  // registration, while keeping the underlying category IDs for status updates.
  const registrationGroups = new Map();
  for (const row of statusDetails) {
    const key = String(row.registration_group_id || row.id);
    if (!registrationGroups.has(key)) registrationGroups.set(key, []);
    registrationGroups.get(key).push(row);
  }
  const notPrintedRows = [...registrationGroups.values()]
    .map((groupRows) => {
      const activeRows = groupRows.filter((row) => row.status !== "Cancelled");
      if (!activeRows.length) return null;
      const needsPrinting = activeRows.some(
        (row) => (row.print_status || "Not Yet Printed") !== "Complete",
      );
      if (!needsPrinting) return null;
      const first = activeRows[0];
      const categories = activeRows.map((row) => {
        const prefix = String(row.prefix || "");
        const start = `${prefix}${String(row.token_start ?? "").padStart(4, "0")}`;
        const end = `${prefix}${String(row.token_end ?? row.token_start ?? "").padStart(4, "0")}`;
        return {
          id: row.id,
          categoryName: row.category_name || "",
          prefix,
          tokenStart: start,
          tokenEnd: end,
          status: row.status,
        };
      });
      const created = first.created_at ? new Date(first.created_at) : null;
      const printEntry = {
        id: first.id,
        groupId: first.registration_group_id || first.id,
        orderId: `ORD${String(first.order_number || "").padStart(4, "0")}`,
        categoryEntries: categories,
        categoryName: categories.map((c) => c.categoryName).join(" + "),
        tokenType: categories.map((c) => c.categoryName).join(" + "),
        quantity: Number(first.quantity) || 1,
        name: first.customer_name || "",
        phone: first.customer_phone || "",
        payment: first.payment_mode || "",
        amount: activeRows.reduce(
          (sum, row) => sum + Number(row.amount || 0),
          0,
        ),
        status: activeRows.some((row) => row.status === "Payment Not Received")
          ? "Payment Not Received"
          : "Complete",
        printStatus: "Not Yet Printed",
        date:
          created && !Number.isNaN(created.getTime())
            ? created.toLocaleDateString("en-IN")
            : "",
        time:
          created && !Number.isNaN(created.getTime())
            ? created.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "",
        createdAt: first.created_at,
      };
      return {
        ...first,
        id: first.id,
        order_number: first.order_number,
        customer_name: first.customer_name,
        customer_phone: first.customer_phone,
        category_name: categories.map((c) => c.categoryName).join(" + "),
        quantity: Number(first.quantity) || 0,
        amount: printEntry.amount,
        status: printEntry.status,
        print_status: "Not Yet Printed",
        tokenDisplay: categories
          .map((c) =>
            c.tokenStart === c.tokenEnd
              ? c.tokenStart
              : `${c.tokenStart}–${c.tokenEnd}`,
          )
          .join(" + "),
        created_by: first.created_by,
        printEntry,
      };
    })
    .filter(Boolean);
  const number = (value) => Number(value || 0).toLocaleString("en-IN");
  const th = {
    textAlign: "left",
    padding: "11px 10px",
    background: "#f4f6f4",
    color: "#4b5a53",
    fontSize: 12,
    borderBottom: "1px solid #dde3de",
    whiteSpace: "nowrap",
  };
  const td = {
    padding: "11px 10px",
    borderBottom: "1px solid #eef1ee",
    verticalAlign: "top",
  };
  const tableCard = {
    ...styles.card,
    padding: 18,
    marginBottom: 18,
    overflowX: "auto",
  };
  const mutedP = { margin: "5px 0 0", color: "#5b6a63", fontSize: 13 };
  const orderCell = (row) => (
    <td style={td}>
      <div style={{ fontWeight: 800 }}>
        ORD{String(row.order_number || "").padStart(4, "0")}
      </div>
      <div style={{ color: "#5b6a63", marginTop: 3 }}>
        {row.tokenDisplay ||
          `${row.prefix || ""}${row.token_start || ""}${row.token_end && row.token_end !== row.token_start ? `–${row.prefix || ""}${row.token_end}` : ""}`}
      </div>
    </td>
  );
  const createdAt = (row) =>
    row.created_at ? new Date(row.created_at).toLocaleString("en-IN") : "—";

  return (
    <div style={styles.page}>
      <div
        className="spya-container"
        style={{ ...styles.container, paddingTop: 20, paddingBottom: 50 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 22,
          }}
        >
          <div>
            <div style={{ color: GREEN, fontSize: 13, fontWeight: 700 }}>
              Admin only
            </div>
            <h1 style={{ margin: "5px 0", fontSize: 32 }}>
              Inventory dashboard
            </h1>
            <p style={{ margin: 0, color: "#5b6a63", fontSize: 14 }}>
              Token generation totals by dashboard, category and user.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setShowPasswordForm((v) => !v)}
              style={inkBtn}
            >
              Change Account Password
            </button>
            <button type="button" onClick={onBack} style={ghostBtn}>
              Back to Dashboards
            </button>
          </div>
        </div>

        {showPasswordForm && (
          <div
            style={{
              ...styles.card,
              padding: 20,
              marginBottom: 18,
              maxWidth: 620,
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: 21 }}>
              Change account password
            </h2>
            <form onSubmit={submitPasswordChange}>
              <Field label="Current Password">
                <input
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  style={styles.input}
                  required
                />
              </Field>
              <Field label="New Password">
                <input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={styles.input}
                  minLength={8}
                  required
                />
              </Field>
              <Field label="Confirm New Password">
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={styles.input}
                  minLength={8}
                  required
                />
              </Field>
              {passwordError && <ErrorText>{passwordError}</ErrorText>}
              {passwordMessage && (
                <div style={{ color: "#0b4a3d", fontSize: 13, marginTop: 8 }}>
                  {passwordMessage}
                </div>
              )}
              <button
                type="submit"
                disabled={savingPassword}
                style={{ ...greenBtn, marginTop: 12 }}
              >
                {savingPassword ? "Updating..." : "Update Password"}
              </button>
            </form>
          </div>
        )}

        <div style={{ ...styles.card, padding: 18, marginBottom: 18 }}>
          <Field label="Select Dashboard">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              style={styles.input}
            >
              {dashboards.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.association_name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {loadingInventory ? (
          <div style={{ ...styles.card, padding: 24 }}>
            Loading inventory...
          </div>
        ) : inventoryError ? (
          <div style={{ ...styles.card, padding: 20 }}>
            <ErrorText>{inventoryError}</ErrorText>
          </div>
        ) : (
          inventory && (
            <>
              <h2 style={{ margin: "0 0 14px", fontSize: 24 }}>
                {inventory.dashboard?.association_name}
              </h2>
              <div
                className="spya-grid-4"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4,minmax(0,1fr))",
                  gap: 10,
                  marginBottom: 20,
                }}
              >
                <Stat
                  label="TOKENS EVER GENERATED"
                  value={number(summary.tokens_ever_generated)}
                />
                <Stat
                  label="ACTIVE TOKENS"
                  value={number(summary.active_tokens)}
                />
                <Stat
                  label="CANCELLED TOKENS"
                  value={number(summary.cancelled_tokens)}
                />
                <Stat
                  label="REGISTRATIONS"
                  value={number(summary.registrations)}
                />
              </div>

              <div style={{ ...styles.card, padding: 18, marginBottom: 18 }}>
                <h2 style={{ marginTop: 0, marginBottom: 6, fontSize: 20 }}>
                  Action status breakdown
                </h2>
                <p
                  style={{ margin: "0 0 14px", color: "#5b6a63", fontSize: 13 }}
                >
                  Select any count to view the matching token records below.
                  Counts represent tokens; registrations show grouped orders.
                </p>
                <div
                  className="spya-grid-4"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4,minmax(0,1fr))",
                    gap: 10,
                  }}
                >
                  {actionStatuses.map((item) => {
                    const active = selectedActionStatus === item.status;
                    const tone =
                      item.status === "Complete"
                        ? { bg: GREEN_SOFT, fg: "#0b4a3d", border: "#1b9a7e" }
                        : item.status === "Payment Not Received"
                          ? { bg: "#fdf0dc", fg: "#8a4b00", border: "#e8a200" }
                          : item.status === "Cancelled"
                            ? {
                                bg: "#fbe9e7",
                                fg: "#a32d1f",
                                border: "#d9534a",
                              }
                            : {
                                bg: "#f1f4f1",
                                fg: "#34443c",
                                border: "#8a968f",
                              };
                    return (
                      <button
                        key={item.status}
                        type="button"
                        onClick={() => {
                          setShowNotPrintedDetails(false);
                          setSelectedActionStatus(active ? "" : item.status);
                        }}
                        aria-pressed={active}
                        style={{
                          textAlign: "left",
                          cursor: "pointer",
                          border: `2px solid ${active ? tone.border : "#dde3de"}`,
                          background: tone.bg,
                          color: tone.fg,
                          borderRadius: 12,
                          padding: 14,
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            lineHeight: 1.4,
                          }}
                        >
                          {item.status}
                        </div>
                        <div
                          style={{
                            fontSize: 28,
                            fontWeight: 800,
                            marginTop: 6,
                            fontFamily: HEAD_FONT,
                          }}
                        >
                          {number(item.token_count)}
                        </div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>
                          {number(item.registrations)} registration(s)
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            marginTop: 8,
                            fontWeight: 700,
                          }}
                        >
                          {active ? "Hide details ↑" : "View details ↓"}
                        </div>
                      </button>
                    );
                  })}
                  {!actionStatuses.length && (
                    <div style={{ color: "#5b6a63", fontSize: 13 }}>
                      No action-status data available yet.
                    </div>
                  )}
                </div>
              </div>

              <div style={{ ...styles.card, padding: 18, marginBottom: 18 }}>
                <h2 style={{ marginTop: 0, marginBottom: 6, fontSize: 20 }}>
                  Not yet printed tokens
                </h2>
                <p
                  style={{ margin: "0 0 14px", color: "#5b6a63", fontSize: 13 }}
                >
                  Select the count to view active token registrations whose
                  labels have not yet been marked as printed.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowNotPrintedDetails((value) => !value);
                    setSelectedActionStatus("");
                  }}
                  aria-pressed={showNotPrintedDetails}
                  style={{
                    textAlign: "left",
                    cursor: "pointer",
                    border: `2px solid ${showNotPrintedDetails ? "#e8a200" : "#f1d9a8"}`,
                    background: "#fdf0dc",
                    color: "#8a4b00",
                    borderRadius: 12,
                    padding: 16,
                    minWidth: 220,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700 }}>
                    Not yet printed
                  </div>
                  <div
                    style={{
                      fontSize: 30,
                      fontWeight: 800,
                      marginTop: 6,
                      fontFamily: HEAD_FONT,
                    }}
                  >
                    {number(notPrintedSummary.token_count)}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    {number(notPrintedSummary.registrations)} registration(s)
                  </div>
                  <div style={{ fontSize: 11, marginTop: 8, fontWeight: 700 }}>
                    {showNotPrintedDetails
                      ? "Hide details ↑"
                      : "View details ↓"}
                  </div>
                </button>
              </div>

              {showNotPrintedDetails && (
                <div style={tableCard}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <h2 style={{ margin: 0, fontSize: 20 }}>
                        Not yet printed tokens — details
                      </h2>
                      <p style={mutedP}>
                        {number(notPrintedSummary.token_count)} token(s) across{" "}
                        {number(notPrintedRows.length)} registration record(s)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowNotPrintedDetails(false)}
                      style={ghostBtn}
                    >
                      Close Details
                    </button>
                  </div>
                  <table
                    style={{
                      width: "100%",
                      minWidth: 1000,
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr>
                        <th style={th}>Order / Token Range</th>
                        <th style={th}>Customer</th>
                        <th style={th}>Phone</th>
                        <th style={th}>Category</th>
                        <th style={th}>Quantity</th>
                        <th style={th}>Amount</th>
                        <th style={th}>Action Status</th>
                        <th style={th}>Print Status</th>
                        <th style={th}>Created By</th>
                        <th style={th}>Created At</th>
                        <th style={th}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notPrintedRows.map((row) => (
                        <tr key={row.id}>
                          {orderCell(row)}
                          <td style={td}>{row.customer_name || "—"}</td>
                          <td style={td}>{row.customer_phone || "—"}</td>
                          <td style={td}>{row.category_name || "—"}</td>
                          <td style={td}>{number(row.quantity)}</td>
                          <td style={td}>₹{number(row.amount)}</td>
                          <td style={td}>{row.status || "Unknown"}</td>
                          <td style={td}>
                            {row.print_status || "Not Yet Printed"}
                          </td>
                          <td style={td}>{row.created_by || "—"}</td>
                          <td style={td}>{createdAt(row)}</td>
                          <td style={td}>
                            <button
                              type="button"
                              onClick={async () => {
                                const opened = printLabels(
                                  row.printEntry,
                                  inventory?.dashboard?.association_name ||
                                    "SPYA",
                                );
                                if (!opened) return;
                                try {
                                  await markRegistrationPrinted(
                                    selectedId,
                                    row.id,
                                  );
                                  const refreshed =
                                    await getAdminInventory(selectedId);
                                  setInventory(refreshed);
                                } catch (error) {
                                  alert(
                                    `Labels were opened for printing, but print status could not be saved: ${error.message}`,
                                  );
                                }
                              }}
                              style={{
                                border: "1px solid #cbd5cf",
                                background: "#ffffff",
                                color: "#26372f",
                                borderRadius: 8,
                                padding: "7px 10px",
                                cursor: "pointer",
                                fontWeight: 700,
                                whiteSpace: "nowrap",
                              }}
                            >
                              🖨️ Print
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!notPrintedRows.length && (
                        <tr>
                          <td style={td} colSpan={11}>
                            All active tokens have been marked as printed.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {selectedActionStatus && (
                <div style={tableCard}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <h2 style={{ margin: 0, fontSize: 20 }}>
                        {selectedActionStatus} — details
                      </h2>
                      <p style={mutedP}>
                        {number(selectedStatusRows.length)} matching record(s)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedActionStatus("")}
                      style={ghostBtn}
                    >
                      Close Details
                    </button>
                  </div>
                  <table
                    style={{
                      width: "100%",
                      minWidth: 900,
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr>
                        <th style={th}>Order / Token Range</th>
                        <th style={th}>Customer</th>
                        <th style={th}>Phone</th>
                        <th style={th}>Category</th>
                        <th style={th}>Quantity</th>
                        <th style={th}>Amount</th>
                        <th style={th}>Payment Mode</th>
                        <th style={th}>Created By</th>
                        <th style={th}>Created At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedStatusRows.map((row) => (
                        <tr key={row.id}>
                          {orderCell(row)}
                          <td style={td}>{row.customer_name || "—"}</td>
                          <td style={td}>{row.customer_phone || "—"}</td>
                          <td style={td}>{row.category_name || "—"}</td>
                          <td style={td}>{number(row.quantity)}</td>
                          <td style={td}>₹{number(row.amount)}</td>
                          <td style={td}>{row.payment_mode || "—"}</td>
                          <td style={td}>{row.created_by || "—"}</td>
                          <td style={td}>{createdAt(row)}</td>
                        </tr>
                      ))}
                      {!selectedStatusRows.length && (
                        <tr>
                          <td style={td} colSpan={9}>
                            No records found for this action status.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={tableCard}>
                <h2 style={{ marginTop: 0, fontSize: 20 }}>
                  Token generation by user
                </h2>
                <table
                  style={{
                    width: "100%",
                    minWidth: 720,
                    borderCollapse: "collapse",
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr>
                      <th style={th}>User</th>
                      <th style={th}>Role</th>
                      <th style={th}>Registrations</th>
                      <th style={th}>Tokens Generated</th>
                      <th style={th}>Active</th>
                      <th style={th}>Cancelled</th>
                      <th style={th}>Amount Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(inventory.byUser || []).map((row) => (
                      <tr key={row.user_id}>
                        <td style={td}>{row.username}</td>
                        <td style={td}>
                          <span
                            style={{
                              background: row.isAdmin ? "#d5e9e4" : "#f1f4f1",
                              color: row.isAdmin ? GREEN : "#4b5a53",
                              padding: "4px 8px",
                              borderRadius: 20,
                              fontWeight: 700,
                            }}
                          >
                            {row.isAdmin ? "Admin" : "User"}
                          </span>
                        </td>
                        <td style={td}>{number(row.registrations)}</td>
                        <td style={td}>{number(row.tokens_ever_generated)}</td>
                        <td style={td}>{number(row.active_tokens)}</td>
                        <td style={td}>{number(row.cancelled_tokens)}</td>
                        <td style={td}>₹{number(row.amount_received)}</td>
                      </tr>
                    ))}
                    {!(inventory.byUser || []).length && (
                      <tr>
                        <td style={td} colSpan={7}>
                          No token-generation data yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ ...tableCard, marginBottom: 0 }}>
                <h2 style={{ marginTop: 0, fontSize: 20 }}>
                  Inventory by token category
                </h2>
                <table
                  style={{
                    width: "100%",
                    minWidth: 560,
                    borderCollapse: "collapse",
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr>
                      <th style={th}>Category</th>
                      <th style={th}>Prefix</th>
                      <th style={th}>Price</th>
                      <th style={th}>Generated</th>
                      <th style={th}>Active</th>
                      <th style={th}>Cancelled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(inventory.byCategory || []).map((row) => (
                      <tr key={row.category_id}>
                        <td style={td}>{row.category_name}</td>
                        <td style={td}>{row.prefix}</td>
                        <td style={td}>₹{number(row.price)}</td>
                        <td style={td}>{number(row.tokens_ever_generated)}</td>
                        <td style={td}>{number(row.active_tokens)}</td>
                        <td style={td}>{number(row.cancelled_tokens)}</td>
                      </tr>
                    ))}
                    {!(inventory.byCategory || []).length && (
                      <tr>
                        <td style={td} colSpan={6}>
                          No categories configured.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}

/* ---------- App ---------- */
export default function App() {
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState("");
  const [dashboards, setDashboards] = useState([]);
  const [selectedDashboard, setSelectedDashboard] = useState(null);
  const [dashboardDetails, setDashboardDetails] = useState(null);
  const [entries, setEntries] = useState([]);
  const [screen, setScreen] = useState("dashboards");
  const [successEntry, setSuccessEntry] = useState(null);

  async function loadAccount() {
    try {
      setLoading(true);
      setError("");

      const me = await getMe();
      setAuth(me);

      const result = await getDashboards();
      setDashboards(result.dashboards || []);
    } catch (e) {
      sessionStorage.removeItem(USER_TOKEN_KEY);
      setAuth(null);
      setError("");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (getUserToken()) {
      loadAccount();
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auth && screen === "create-dashboard" && auth.user?.role !== "owner") {
      setScreen("dashboards");
    }
  }, [auth, screen]);

  async function openDashboard(dashboard) {
    try {
      setLoading(true);
      const [details, registrationResult] = await Promise.all([
        getDashboardDetails(dashboard.id),
        getRegistrations(dashboard.id),
      ]);

      setSelectedDashboard(dashboard);
      setDashboardDetails(details);
      setEntries(registrationResult.entries || []);
      setScreen("dashboard");
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshCurrentDashboard() {
    if (!selectedDashboard?.id) return;
    const [details, registrationResult] = await Promise.all([
      getDashboardDetails(selectedDashboard.id),
      getRegistrations(selectedDashboard.id),
    ]);
    setDashboardDetails(details);
    setEntries(registrationResult.entries || []);
  }

  function logout() {
    sessionStorage.removeItem(USER_TOKEN_KEY);
    setAuth(null);
    setDashboards([]);
    setSelectedDashboard(null);
    setDashboardDetails(null);
    setEntries([]);
    setScreen("dashboards");
  }

  if (loading) {
    return (
      <>
        <style>{css}</style>
        <div
          style={{
            ...styles.page,
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{ fontSize: 26, fontWeight: 800, fontFamily: HEAD_FONT }}
            >
              SPYA
            </div>
            <div style={{ color: "#5b6a63", marginTop: 7 }}>Loading...</div>
          </div>
        </div>
      </>
    );
  }

  if (!auth) {
    return (
      <>
        <style>{css}</style>
        <LoginScreen
          onLogin={(result) => {
            setAuth({
              user: {
                ...result.user,
                role: result.user?.role || (result.hasAdmin ? "owner" : "user"),
                dashboardId: result.user?.dashboardId,
              },
              adminUsername: result.user?.username || result.adminUsername,
            });
            setDashboards(result.dashboards || []);
            setLoading(false);
          }}
        />
      </>
    );
  }

  if (screen === "admin" && auth.user?.role === "owner") {
    return (
      <>
        <style>{css}</style>
        <AdminDashboard
          dashboards={dashboards}
          onBack={() => setScreen("dashboards")}
          onLogout={logout}
        />
      </>
    );
  }

  if (screen === "create-dashboard" && auth.user?.role === "owner") {
    return (
      <>
        <style>{css}</style>
        <DashboardSetup
          existingCount={dashboards.length}
          onCancel={() => setScreen("dashboards")}
          onCreated={async () => {
            const result = await getDashboards();
            setDashboards(result.dashboards || []);
            setScreen("dashboards");
          }}
        />
      </>
    );
  }

  if (screen === "register" && selectedDashboard && dashboardDetails) {
    return (
      <>
        <style>{css}</style>
        <RegistrationForm
          dashboard={selectedDashboard}
          categories={dashboardDetails.categories || []}
          onBack={() => setScreen("dashboard")}
          onSaved={(createdEntries) => {
            const list = Array.isArray(createdEntries)
              ? createdEntries
              : [createdEntries];
            setEntries((current) => [...list, ...current]);
            setScreen("dashboard");
            setSuccessEntry(list);
          }}
        />
        {successEntry && (
          <SuccessModal
            entry={successEntry}
            associationName={selectedDashboard.association_name}
            onClose={() => setSuccessEntry(null)}
          />
        )}
      </>
    );
  }

  if (screen === "dashboard" && selectedDashboard && dashboardDetails) {
    return (
      <>
        <style>{css}</style>
        <UserDashboard
          dashboard={selectedDashboard}
          categories={dashboardDetails.categories || []}
          entries={entries}
          onBack={() => {
            setSelectedDashboard(null);
            setDashboardDetails(null);
            setScreen("dashboards");
          }}
          onCreate={() => setScreen("register")}
          onRefresh={refreshCurrentDashboard}
          onStatusChange={async (entry, status) => {
            try {
              const result = await updateRegistrationStatus(
                selectedDashboard.id,
                entry.id,
                status,
              );
              setEntries((current) =>
                current.map((item) =>
                  item.id === result.entry.id ? result.entry : item,
                ),
              );
            } catch (e) {
              alert(e.message);
            }
          }}
          onCancel={async (entry, categoryEntry) => {
            const categoryName =
              categoryEntry?.categoryName ||
              entry.categoryName ||
              "selected category";
            const serial = categoryEntry?.tokenStart || tokenRange(entry);
            if (
              !window.confirm(
                `Cancel only ${categoryName} (${serial}) for ${entry.name}? Other categories will remain active, and this serial can be reused.`,
              )
            )
              return;
            try {
              await cancelRegistration(
                selectedDashboard.id,
                categoryEntry?.id || entry.id,
              );
              await refreshCurrentDashboard();
            } catch (e) {
              alert(e.message);
            }
          }}
          onReprint={async (entry) => {
            const opened = printLabels(
              entry,
              selectedDashboard.association_name,
            );
            if (!opened) return;
            try {
              await markRegistrationPrinted(selectedDashboard.id, entry.id);
              await refreshCurrentDashboard();
            } catch (e) {
              alert(
                `Labels were opened for printing, but print status could not be saved: ${e.message}`,
              );
            }
          }}
          isOwner={auth.user?.role === "owner"}
        />
        {successEntry && (
          <SuccessModal
            entry={successEntry}
            associationName={selectedDashboard.association_name}
            onClose={() => setSuccessEntry(null)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <style>{css}</style>

      <DashboardHome
        dashboards={dashboards}
        selected={selectedDashboard}
        user={auth.user}
        hasAdmin={auth.user?.role === "owner"}
        canCreateDashboard={auth.user?.role === "owner"}
        onAdmin={() => setScreen("admin")}
        onSelect={openDashboard}
        onCreate={() => setScreen("create-dashboard")}
        onLogout={logout}
      />
    </>
  );
}
