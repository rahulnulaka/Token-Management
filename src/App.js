import { useEffect, useMemo, useState } from "react";

const API = process.env.REACT_APP_API_URL || "http://localhost:4000";

const USER_TOKEN_KEY = "spya_v5_user_token";

const DEFAULT_ICONS = ["🎯", "🥻", "🥈", "🎟️", "⭐", "🎁"];

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg,#f8fafc 0%,#f5f3ff 100%)",
    fontFamily: "'Inter','Segoe UI',Arial,sans-serif",
    color: "#111827",
  },
  container: {
    width: "min(1180px,calc(100% - 32px))",
    margin: "0 auto",
  },
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 20,
    boxShadow: "0 10px 35px rgba(15,23,42,.06)",
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 11,
    border: "1px solid #d1d5db",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  button: {
    border: "none",
    cursor: "pointer",
    borderRadius: 11,
    fontWeight: 700,
    fontSize: 14,
    padding: "11px 15px",
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 800,
    color: "#374151",
    marginBottom: 7,
  },
};

const css = `
* { box-sizing: border-box; }
html, body, #root { margin:0; min-height:100%; width:100%; }
body { overflow-x:hidden; }
button,input,select,textarea { font:inherit; max-width:100%; }
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
`;

async function api(path, options = {}, token = null) {
  const headers = {
    ...(options.headers || {}),
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers,
  });

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

async function registerUser(username, password) {
  return api("/api/v5/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

async function loginUser(username, password) {
  return api("/api/v5/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

async function getMe() {
  return api("/api/v5/me", {}, getUserToken());
}

async function getDashboards() {
  return api("/api/v5/dashboards", {}, getUserToken());
}

async function createDashboard(payload) {
  return api(
    "/api/v5/dashboards",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    getUserToken(),
  );
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
  return api(
    `/api/v5/dashboards/${dashboardId}/members`,
    {
      method: "POST",
      body: JSON.stringify({ username, password }),
    },
    getUserToken(),
  );
}

async function resetDashboardMemberPassword(dashboardId, userId, password) {
  return api(
    `/api/v5/dashboards/${dashboardId}/members/${userId}/reset-password`,
    {
      method: "POST",
      body: JSON.stringify({ password }),
    },
    getUserToken(),
  );
}

async function createRegistration(dashboardId, payload) {
  return api(
    `/api/v5/dashboards/${dashboardId}/registrations`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    getUserToken(),
  );
}

async function updateRegistrationStatus(dashboardId, registrationId, status) {
  return api(
    `/api/v5/dashboards/${dashboardId}/registrations/${registrationId}/status`,
    {
      method: "POST",
      body: JSON.stringify({ status }),
    },
    getUserToken(),
  );
}

async function cancelRegistration(dashboardId, registrationId) {
  return api(
    `/api/v5/dashboards/${dashboardId}/registrations/${registrationId}/cancel`,
    { method: "POST", body: JSON.stringify({}) },
    getUserToken(),
  );
}

async function markRegistrationPrinted(dashboardId, registrationId) {
  return api(
    `/api/v5/dashboards/${dashboardId}/registrations/${registrationId}/printed`,
    { method: "POST", body: JSON.stringify({}) },
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
  return api(
    "/api/v5/account/change-password",
    {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    },
    getUserToken(),
  );
}
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

function printLabels(entry, associationName = "SPYA") {
  if (
    entry?.status === "Cancelled" &&
    !(
      Array.isArray(entry.categoryEntries) &&
      entry.categoryEntries.some((category) => category.status !== "Cancelled")
    )
  ) {
    alert("This token has no active categories to print.");
    return;
  }
  const categories =
    Array.isArray(entry.categoryEntries) && entry.categoryEntries.length
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
  const serialFor = (value, offset) => {
    const serial =
      Number(String(value || "").match(/(\d+)$/)?.[1] || 0) + offset;
    const prefix = String(value || "").replace(/\d+$/, "");
    return `${prefix}${String(serial).padStart(4, "0")}`;
  };
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
  if (
    entry?.status === "Cancelled" &&
    !(
      Array.isArray(entry.categoryEntries) &&
      entry.categoryEntries.some((category) => category.status !== "Cancelled")
    )
  ) {
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
  const categories =
    Array.isArray(entry.categoryEntries) && entry.categoryEntries.length
      ? entry.categoryEntries.filter(
          (category) => category.status !== "Cancelled",
        )
      : [
          {
            categoryName: entry.categoryName || entry.tokenType || "",
            tokenStart: entry.tokenStart,
            prefix: entry.prefix || "",
          },
        ];
  if (!categories.length) {
    alert("This combined token has no active categories to send.");
    return;
  }
  const quantity = Math.max(1, Number(entry.quantity) || 1);
  const serialFor = (value, offset) => {
    const serial =
      Number(String(value || "").match(/(\d+)$/)?.[1] || 0) + offset;
    const prefix = String(value || "").replace(/\d+$/, "");
    return `${prefix}${String(serial).padStart(4, "0")}`;
  };
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
    <div style={{ color: "#dc2626", fontSize: 12, marginTop: 6 }}>
      {children}
    </div>
  );
}

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
                borderRadius: 18,
                background: "linear-gradient(135deg,#111827,#4c1d95)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                fontWeight: 900,
                margin: "0 auto 14px",
              }}
            >
              S
            </div>

            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 2 }}>
              SPYA
            </div>

            <h1 style={{ margin: "8px 0 5px", fontSize: 27 }}>
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h1>

            <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
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
              onKeyDown={(e) => e.key === "Enter" && submit()}
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
              onKeyDown={(e) => e.key === "Enter" && submit()}
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
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </Field>
          )}

          <button
            onClick={submit}
            disabled={loading}
            style={{
              ...styles.button,
              width: "100%",
              background: "#111827",
              color: "#fff",
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
              color: "#64748b",
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
                color: "#4c1d95",
              }}
            >
              {mode === "login" ? "Create one" : "Sign in"}
            </button>
          </div>

          {message && (
            <div
              style={{
                color: "#047857",
                fontSize: 12,
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
              color: "#94a3b8",
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
          <div
            style={{
              fontSize: 12,
              color: "#7c3aed",
              fontWeight: 900,
              letterSpacing: 1.3,
            }}
          >
            DASHBOARD {existingCount + 1} OF 2
          </div>
          <h1 style={{ margin: "7px 0", fontSize: 28 }}>
            Create your dashboard
          </h1>
          <p style={{ color: "#64748b", fontSize: 13, marginTop: 0 }}>
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
                fontSize: 16,
                fontWeight: 900,
              }}
            >
              Token Categories
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
                  border: "1px solid #e5e7eb",
                  borderRadius: 14,
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
                    ...styles.button,
                    background: "#fef2f2",
                    color: "#b91c1c",
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
              style={{
                ...styles.button,
                background: "#f5f3ff",
                color: "#6d28d9",
              }}
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
                <button
                  type="button"
                  onClick={onCancel}
                  style={{
                    ...styles.button,
                    background: "#f3f4f6",
                    color: "#374151",
                  }}
                >
                  Cancel
                </button>
              )}
              <button
                disabled={loading}
                style={{
                  ...styles.button,
                  background: "#111827",
                  color: "#fff",
                }}
              >
                {loading ? "Creating..." : "Create Dashboard"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function Modal({ children }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(15,23,42,.55)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div style={{ ...styles.card, width: "min(520px,100%)", padding: 28 }}>
        {children}
      </div>
    </div>
  );
}

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
            <div style={{ fontWeight: 900, letterSpacing: 1.5 }}>SPYA</div>
            <div style={{ color: "#94a3b8", fontSize: 10, letterSpacing: 1 }}>
              TOKEN MANAGEMENT V5
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
              <>
                <button
                  type="button"
                  onClick={onAdmin}
                  style={{
                    ...styles.button,
                    background: "#111827",
                    color: "#fff",
                  }}
                >
                  Admin Portal
                </button>
              </>
            )}
            <span style={{ color: "#64748b", fontSize: 12 }}>
              {user?.username || user?.email || "User"}
            </span>
            <button
              onClick={onLogout}
              style={{
                ...styles.button,
                background: "#f3f4f6",
                color: "#374151",
              }}
            >
              Logout
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 25 }}>
          <div
            style={{
              color: "#7c3aed",
              fontWeight: 900,
              fontSize: 12,
              letterSpacing: 1.5,
            }}
          >
            WELCOME TO SPYA
          </div>
          <h1 style={{ margin: "5px 0", fontSize: 34 }}>Your Dashboards</h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
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
                    ? "2px solid #7c3aed"
                    : "1px solid #e5e7eb",
                background: "#fff",
              }}
            >
              <div
                style={{
                  color: "#7c3aed",
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: 1,
                }}
              >
                DASHBOARD {index + 1}
              </div>
              <h2 style={{ margin: "8px 0", fontSize: 21 }}>
                {dashboard.association_name}
              </h2>
              <div style={{ color: "#64748b", fontSize: 12 }}>
                {dashboard.contact_email ||
                  dashboard.contact_phone ||
                  "No contact details"}
              </div>
              <div style={{ marginTop: 18, color: "#111827", fontWeight: 800 }}>
                Open Dashboard →
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
                border: "1px dashed #c4b5fd",
                background: "#faf5ff",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 30 }}>＋</div>
              <h2 style={{ margin: "8px 0", fontSize: 20 }}>
                Create Dashboard
              </h2>
              <div style={{ color: "#64748b", fontSize: 12 }}>
                {2 - dashboards.length} dashboard slot remaining.
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

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

  return (
    <div style={styles.page}>
      <div
        className="spya-container"
        style={{ ...styles.container, paddingTop: 20, paddingBottom: 50 }}
      >
        <button
          onClick={onBack}
          style={{
            ...styles.button,
            background: "transparent",
            color: "#64748b",
            paddingLeft: 0,
          }}
        >
          ← {dashboard.association_name}
        </button>
        <div style={{ ...styles.card, padding: 26, marginTop: 10 }}>
          <div
            style={{
              color: "#7c3aed",
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: 1.3,
            }}
          >
            NEW REGISTRATION
          </div>
          <h1 style={{ margin: "6px 0 3px", fontSize: 27 }}>
            Create Combined Token
          </h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
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
                {categories.map((item, index) => {
                  const selected = selectedCategoryIds.includes(item.id);
                  return (
                    <button
                      type="button"
                      key={item.id}
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
                        background: selected ? "#f5f3ff" : "#f8fafc",
                        color: selected ? "#6d28d9" : "#334155",
                        border: selected
                          ? "2px solid #a78bfa"
                          : "1px solid #e5e7eb",
                      }}
                    >
                      <div style={{ fontSize: 20 }}>
                        {DEFAULT_ICONS[index % DEFAULT_ICONS.length]}
                      </div>
                      <div style={{ marginTop: 5, fontWeight: 800 }}>
                        {selected ? "✓ " : ""}
                        {item.name}
                      </div>
                      <div style={{ fontSize: 11, marginTop: 3 }}>
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
                      onClick={() =>
                        setQuantity((q) => Math.max(1, Number(q) - 1))
                      }
                      style={{
                        ...styles.button,
                        borderRadius: "10px 0 0 10px",
                        background: "#f8fafc",
                        border: "1px solid #d1d5db",
                      }}
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
                      onClick={() =>
                        setQuantity((q) => Math.min(9999, Number(q || 1) + 1))
                      }
                      style={{
                        ...styles.button,
                        borderRadius: "0 10px 10px 0",
                        background: "#f8fafc",
                        border: "1px solid #d1d5db",
                      }}
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
                    style={{
                      ...styles.input,
                      minHeight: 80,
                      resize: "vertical",
                    }}
                  />
                </Field>
                <Field label="Phone Numbers *">
                  <textarea
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9876543210, 9876543211, 9876543212"
                    rows={3}
                    style={{
                      ...styles.input,
                      minHeight: 80,
                      resize: "vertical",
                    }}
                  />
                  <div style={{ color: "#64748b", fontSize: 11, marginTop: 5 }}>
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
                    style={{
                      ...styles.input,
                      minHeight: 60,
                      resize: "vertical",
                    }}
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
                          minHeight: 48,
                          border:
                            payment === mode
                              ? "2px solid #7c3aed"
                              : "1px solid #d1d5db",
                          background: payment === mode ? "#f5f3ff" : "#fff",
                          color: payment === mode ? "#6d28d9" : "#334155",
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
                    background: "#f8fafc",
                    borderRadius: 13,
                    padding: 16,
                    marginTop: 8,
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>
                    Order Summary
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    Categories:{" "}
                    {selectedCategories.map((c) => c.name).join(" + ") ||
                      "None selected"}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13, marginTop: 5 }}>
                    Customers: {names.length}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13, marginTop: 5 }}>
                    Amount per customer: ₹{amountPerCustomer.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, marginTop: 8 }}>
                    Total: ₹{(amountPerCustomer * names.length).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
            {error && (
              <div
                style={{
                  color: "#b91c1c",
                  background: "#fef2f2",
                  padding: 12,
                  borderRadius: 10,
                  marginTop: 12,
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
              <button
                type="button"
                onClick={onBack}
                style={{
                  ...styles.button,
                  background: "#f3f4f6",
                  color: "#374151",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  ...styles.button,
                  background: "#6d28d9",
                  color: "#fff",
                  flex: 1,
                }}
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

function SuccessModal({ entry, associationName, onClose }) {
  const entries = Array.isArray(entry) ? entry : [entry];
  return (
    <Modal>
      <div
        style={{ textAlign: "center", maxHeight: "80vh", overflowY: "auto" }}
      >
        <div style={{ fontSize: 42, color: "#059669" }}>✓</div>
        <div
          style={{
            color: "#64748b",
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 1.2,
          }}
        >
          REGISTRATION COMPLETE
        </div>
        <p style={{ color: "#64748b", fontSize: 13, margin: "8px 0 18px" }}>
          {entries.length} customer token{entries.length === 1 ? "" : "s"}{" "}
          created. Print or send each customer their own combined token details.
        </p>
        {entries.map((item) => (
          <div
            key={item.groupId || item.id}
            style={{
              background: "#f8fafc",
              borderRadius: 13,
              padding: 15,
              textAlign: "left",
              margin: "12px 0",
            }}
          >
            <div
              style={{
                fontSize: 20,
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
                color: "#64748b",
                fontSize: 12,
                marginBottom: 8,
              }}
            >
              {item.categoryName} · Order {item.orderId}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: 5,
              }}
            >
              <span>Name</span>
              <strong>{item.name}</strong>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: 5,
              }}
            >
              <span>Phone</span>
              <strong>{item.phone}</strong>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: 5,
              }}
            >
              <span>Payment</span>
              <strong>{item.payment}</strong>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: 5,
              }}
            >
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
                style={{
                  ...styles.button,
                  flex: "1 1 120px",
                  background: "#111827",
                  color: "#fff",
                }}
              >
                🖨️ Print Labels
              </button>
              <button
                type="button"
                onClick={() => sendWhatsAppMessage(item, associationName)}
                style={{
                  ...styles.button,
                  flex: "1 1 160px",
                  background: "#16a34a",
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
          style={{
            ...styles.button,
            background: "#f3f4f6",
            color: "#374151",
            marginTop: 8,
          }}
        >
          Done
        </button>
      </div>
    </Modal>
  );
}

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
          <div style={{ fontWeight: 900 }}>Dashboard Users</div>
          <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
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
          style={{ ...styles.button, background: "#111827", color: "#fff" }}
        >
          {open ? "Hide User Management" : "＋ Manage Dashboard Users"}
        </button>
      </div>
      {open && (
        <div style={{ borderTop: "1px solid #eef2f7", padding: 16 }}>
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
                background: members.length >= 2 ? "#cbd5e1" : "#7c3aed",
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
            <div style={{ color: "#64748b", fontSize: 13, marginTop: 8 }}>
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
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <div>
                <div style={{ fontWeight: 800 }}>{member.username}</div>
                <div style={{ color: "#64748b", fontSize: 11 }}>
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
                style={{
                  ...styles.button,
                  background: "#f1f5f9",
                  color: "#334155",
                }}
              >
                Reset Password
              </button>
            </div>
          ))}
          {error && <ErrorText>{error}</ErrorText>}
          {message && (
            <div style={{ color: "#15803d", fontSize: 13, marginTop: 10 }}>
              {message}
            </div>
          )}
          <div style={{ color: "#64748b", fontSize: 11, marginTop: 12 }}>
            Users sign in with their User ID and password and can access only
            this assigned dashboard.
          </div>
        </div>
      )}
    </div>
  );
}

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
    borderBottom: "1px solid #f1f5f9",
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
          <button
            onClick={onBack}
            style={{
              ...styles.button,
              background: "transparent",
              color: "#64748b",
              paddingLeft: 0,
            }}
          >
            ← Dashboards
          </button>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontWeight: 900, letterSpacing: 1.2 }}>
              {dashboard.association_name}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              color: "#7c3aed",
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: 1.4,
            }}
          >
            TOKEN MANAGEMENT
          </div>
          <h1 style={{ margin: "5px 0", fontSize: 32 }}>
            {dashboard.association_name}
          </h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
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
              borderBottom: "1px solid #eef2f7",
            }}
          >
            <div>
              <div style={{ fontWeight: 900 }}>Registrations</div>
              <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 3 }}>
                PostgreSQL-backed data
              </div>
            </div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              <button
                onClick={onCreate}
                style={{
                  ...styles.button,
                  background: "#7c3aed",
                  color: "#fff",
                }}
              >
                + Create Token
              </button>
              <button
                onClick={onRefresh}
                style={{
                  ...styles.button,
                  background: "#f1f5f9",
                  color: "#334155",
                }}
              >
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
                  style={{
                    ...styles.button,
                    padding: "7px 10px",
                    fontSize: 12,
                    background: filter === value ? "#111827" : "#f1f5f9",
                    color: filter === value ? "#fff" : "#475569",
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
            <div style={{ padding: 45, textAlign: "center", color: "#94a3b8" }}>
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
                  <tr
                    style={{
                      background: "#f8fafc",
                      color: "#64748b",
                      fontSize: 10,
                    }}
                  >
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
                          borderBottom: "1px solid #e2e8f0",
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
                    return (
                      <tr
                        key={entry.id}
                        style={{ borderTop: "1px solid #f1f5f9" }}
                      >
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
                                      ...styles.button,
                                      padding: "4px 7px",
                                      background: "#fef2f2",
                                      color: "#b91c1c",
                                      fontSize: 10,
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
                        <td style={{ ...cell, whiteSpace: "nowrap" }}>
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
                            {entry.status !== "Complete" && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  borderRadius: 999,
                                  padding: "5px 9px",
                                  fontSize: 10,
                                  fontWeight: 800,
                                  whiteSpace: "nowrap",
                                  color:
                                    (entry.printStatus || "Not Yet Printed") ===
                                    "Complete"
                                      ? "#047857"
                                      : "#b45309",
                                  background:
                                    (entry.printStatus || "Not Yet Printed") ===
                                    "Complete"
                                      ? "#d1fae5"
                                      : "#fef3c7",
                                }}
                              >
                                {entry.printStatus || "Not Yet Printed"}
                              </span>
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
                                    border: "1px solid #d1d5db",
                                    borderRadius: 8,
                                    padding: 6,
                                    fontSize: 11,
                                    maxWidth: 130,
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
                                    ...styles.button,
                                    padding: "7px 9px",
                                    background: "#111827",
                                    color: "#fff",
                                    fontSize: 11,
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

function Stat({ label, value }) {
  return (
    <div style={{ ...styles.card, padding: 15 }}>
      <div
        style={{
          fontSize: 10,
          color: "#64748b",
          fontWeight: 900,
          letterSpacing: 0.7,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, marginTop: 7 }}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const cancelled = status === "Cancelled";
  const partial = status === "Partially Cancelled";
  const pending = status === "Payment Not Received";
  return (
    <span
      style={{
        display: "inline-flex",
        padding: "5px 8px",
        borderRadius: 8,
        fontWeight: 800,
        fontSize: 10,
        whiteSpace: "nowrap",
        background: cancelled
          ? "#fef2f2"
          : partial
            ? "#fff7ed"
            : pending
              ? "#fff7ed"
              : "#ecfdf5",
        color: cancelled
          ? "#b91c1c"
          : partial
            ? "#9a3412"
            : pending
              ? "#c2410c"
              : "#047857",
      }}
    >
      {status}
    </span>
  );
}

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
  const notPrintedRows = statusDetails.filter(
    (row) =>
      (row.print_status || "Not Yet Printed") === "Not Yet Printed" &&
      row.status !== "Cancelled",
  );
  const number = (value) => Number(value || 0).toLocaleString("en-IN");
  const th = {
    textAlign: "left",
    padding: "11px 10px",
    background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
  };
  const td = {
    padding: "11px 10px",
    borderBottom: "1px solid #eef2f7",
    verticalAlign: "top",
  };

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
            <div
              style={{
                color: "#7c3aed",
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: 1.3,
              }}
            >
              ADMIN ONLY
            </div>
            <h1 style={{ margin: "5px 0", fontSize: 30 }}>
              Inventory Dashboard
            </h1>
            <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
              Token generation totals by dashboard, category and user.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setShowPasswordForm((v) => !v)}
              style={{ ...styles.button, background: "#111827", color: "#fff" }}
            >
              Change Account Password
            </button>
            <button
              type="button"
              onClick={onBack}
              style={{
                ...styles.button,
                background: "#f1f5f9",
                color: "#334155",
              }}
            >
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
            <h2 style={{ marginTop: 0, fontSize: 20 }}>
              Change Account Password
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
                <div style={{ color: "#047857", fontSize: 13, marginTop: 8 }}>
                  {passwordMessage}
                </div>
              )}
              <button
                type="submit"
                disabled={savingPassword}
                style={{
                  ...styles.button,
                  background: "#7c3aed",
                  color: "#fff",
                  marginTop: 12,
                }}
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
              <h2 style={{ margin: "0 0 14px", fontSize: 22 }}>
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
                <h2 style={{ marginTop: 0, marginBottom: 6, fontSize: 19 }}>
                  Action Status Breakdown
                </h2>
                <p
                  style={{ margin: "0 0 14px", color: "#64748b", fontSize: 12 }}
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
                        ? { bg: "#ecfdf5", fg: "#047857", border: "#10b981" }
                        : item.status === "Payment Not Received"
                          ? { bg: "#fff7ed", fg: "#c2410c", border: "#fb923c" }
                          : item.status === "Cancelled"
                            ? {
                                bg: "#fef2f2",
                                fg: "#b91c1c",
                                border: "#f87171",
                              }
                            : {
                                bg: "#f1f5f9",
                                fg: "#334155",
                                border: "#94a3b8",
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
                          border: `2px solid ${active ? tone.border : "#e2e8f0"}`,
                          background: tone.bg,
                          color: tone.fg,
                          borderRadius: 12,
                          padding: 14,
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            lineHeight: 1.4,
                          }}
                        >
                          {item.status}
                        </div>
                        <div
                          style={{
                            fontSize: 25,
                            fontWeight: 900,
                            marginTop: 6,
                          }}
                        >
                          {number(item.token_count)}
                        </div>
                        <div style={{ fontSize: 11, marginTop: 4 }}>
                          {number(item.registrations)} registration(s)
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            marginTop: 8,
                            fontWeight: 800,
                          }}
                        >
                          {active ? "Hide details ↑" : "View details ↓"}
                        </div>
                      </button>
                    );
                  })}
                  {!actionStatuses.length && (
                    <div style={{ color: "#64748b", fontSize: 13 }}>
                      No action-status data available yet.
                    </div>
                  )}
                </div>
              </div>

              <div style={{ ...styles.card, padding: 18, marginBottom: 18 }}>
                <h2 style={{ marginTop: 0, marginBottom: 6, fontSize: 19 }}>
                  Not Yet Printed Tokens
                </h2>
                <p
                  style={{ margin: "0 0 14px", color: "#64748b", fontSize: 12 }}
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
                    border: `2px solid ${showNotPrintedDetails ? "#f59e0b" : "#fed7aa"}`,
                    background: "#fff7ed",
                    color: "#9a3412",
                    borderRadius: 12,
                    padding: 16,
                    minWidth: 220,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800 }}>
                    NOT YET PRINTED
                  </div>
                  <div style={{ fontSize: 27, fontWeight: 900, marginTop: 6 }}>
                    {number(notPrintedSummary.token_count)}
                  </div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>
                    {number(notPrintedSummary.registrations)} registration(s)
                  </div>
                  <div style={{ fontSize: 10, marginTop: 8, fontWeight: 800 }}>
                    {showNotPrintedDetails
                      ? "Hide details ↑"
                      : "View details ↓"}
                  </div>
                </button>
              </div>

              {showNotPrintedDetails && (
                <div
                  style={{
                    ...styles.card,
                    padding: 18,
                    marginBottom: 18,
                    overflowX: "auto",
                  }}
                >
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
                      <h2 style={{ margin: 0, fontSize: 19 }}>
                        Not Yet Printed Tokens — Details
                      </h2>
                      <p
                        style={{
                          margin: "5px 0 0",
                          color: "#64748b",
                          fontSize: 12,
                        }}
                      >
                        {number(notPrintedSummary.token_count)} token(s) across{" "}
                        {number(notPrintedRows.length)} registration record(s)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowNotPrintedDetails(false)}
                      style={{
                        ...styles.button,
                        background: "#f1f5f9",
                        color: "#334155",
                      }}
                    >
                      Close Details
                    </button>
                  </div>
                  <table
                    style={{
                      width: "100%",
                      minWidth: 1000,
                      borderCollapse: "collapse",
                      fontSize: 12,
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
                      </tr>
                    </thead>
                    <tbody>
                      {notPrintedRows.map((row) => (
                        <tr key={row.id}>
                          <td style={td}>
                            <div style={{ fontWeight: 800 }}>
                              ORD
                              {String(row.order_number || "").padStart(4, "0")}
                            </div>
                            <div style={{ color: "#64748b", marginTop: 3 }}>
                              {row.prefix || ""}
                              {row.token_start || ""}
                              {row.token_end &&
                              row.token_end !== row.token_start
                                ? `–${row.prefix || ""}${row.token_end}`
                                : ""}
                            </div>
                          </td>
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
                          <td style={td}>
                            {row.created_at
                              ? new Date(row.created_at).toLocaleString("en-IN")
                              : "—"}
                          </td>
                        </tr>
                      ))}
                      {!notPrintedRows.length && (
                        <tr>
                          <td style={td} colSpan={10}>
                            All active tokens have been marked as printed.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {selectedActionStatus && (
                <div
                  style={{
                    ...styles.card,
                    padding: 18,
                    marginBottom: 18,
                    overflowX: "auto",
                  }}
                >
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
                      <h2 style={{ margin: 0, fontSize: 19 }}>
                        {selectedActionStatus} — Details
                      </h2>
                      <p
                        style={{
                          margin: "5px 0 0",
                          color: "#64748b",
                          fontSize: 12,
                        }}
                      >
                        {number(selectedStatusRows.length)} matching record(s)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedActionStatus("")}
                      style={{
                        ...styles.button,
                        background: "#f1f5f9",
                        color: "#334155",
                      }}
                    >
                      Close Details
                    </button>
                  </div>
                  <table
                    style={{
                      width: "100%",
                      minWidth: 900,
                      borderCollapse: "collapse",
                      fontSize: 12,
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
                          <td style={td}>
                            <div style={{ fontWeight: 800 }}>
                              ORD
                              {String(row.order_number || "").padStart(4, "0")}
                            </div>
                            <div style={{ color: "#64748b", marginTop: 3 }}>
                              {row.prefix || ""}
                              {row.token_start || ""}
                              {row.token_end &&
                              row.token_end !== row.token_start
                                ? `–${row.prefix || ""}${row.token_end}`
                                : ""}
                            </div>
                          </td>
                          <td style={td}>{row.customer_name || "—"}</td>
                          <td style={td}>{row.customer_phone || "—"}</td>
                          <td style={td}>{row.category_name || "—"}</td>
                          <td style={td}>{number(row.quantity)}</td>
                          <td style={td}>₹{number(row.amount)}</td>
                          <td style={td}>{row.payment_mode || "—"}</td>
                          <td style={td}>{row.created_by || "—"}</td>
                          <td style={td}>
                            {row.created_at
                              ? new Date(row.created_at).toLocaleString("en-IN")
                              : "—"}
                          </td>
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

              <div
                style={{
                  ...styles.card,
                  padding: 18,
                  marginBottom: 18,
                  overflowX: "auto",
                }}
              >
                <h2 style={{ marginTop: 0, fontSize: 19 }}>
                  Token Generation by User
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
                              background: row.isAdmin ? "#ede9fe" : "#f1f5f9",
                              color: row.isAdmin ? "#6d28d9" : "#475569",
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

              <div style={{ ...styles.card, padding: 18, overflowX: "auto" }}>
                <h2 style={{ marginTop: 0, fontSize: 19 }}>
                  Inventory by Token Category
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

/* Legacy standalone Admin Received component removed; admin tools belong inside dashboard. */

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
            <div style={{ fontSize: 25, fontWeight: 900 }}>SPYA</div>
            <div style={{ color: "#64748b", marginTop: 7 }}>Loading...</div>
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
