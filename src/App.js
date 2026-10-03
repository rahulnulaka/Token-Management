import { useCallback, useEffect, useMemo, useState } from "react";

const API = process.env.REACT_APP_API_URL || "http://localhost:4000";

const USER_TOKEN_KEY = "svara_v5_user_token";
const ADMIN_TOKEN_KEY = "svara_v5_admin_token";

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
  .svara-container { width:100%!important; padding:12px!important; }
  .svara-grid-2 { grid-template-columns:1fr!important; }
  .svara-grid-3 { grid-template-columns:1fr!important; }
  .svara-grid-4 { grid-template-columns:repeat(2,minmax(0,1fr))!important; }
  .svara-table-wrap { overflow-x:auto!important; }
  .svara-table { min-width:950px; }
}
@media(max-width:480px) {
  .svara-grid-4 { grid-template-columns:1fr!important; }
  .svara-actions { flex-direction:column!important; }
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
    const message =
      typeof data === "object" ? data.error || data.message : data;
    throw new Error(message || `Request failed (${response.status}).`);
  }

  return data;
}

function getUserToken() {
  return sessionStorage.getItem(USER_TOKEN_KEY) || "";
}

function getAdminToken() {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

async function requestOtp(channel, contact) {
  return api("/api/v5/auth/request-otp", {
    method: "POST",
    body: JSON.stringify({ channel, contact }),
  });
}

async function verifyOtp(channel, contact, otp) {
  return api("/api/v5/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ channel, contact, otp }),
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

async function createAdminCredentials(username, password) {
  return api(
    "/api/v5/admin/credentials",
    {
      method: "POST",
      body: JSON.stringify({ username, password }),
    },
    getUserToken(),
  );
}

async function adminLogin(username, password) {
  return api("/api/v5/admin/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
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

async function getAdminRegistrations(dashboardId) {
  return api(
    `/api/v5/admin/dashboards/${dashboardId}/registrations`,
    {},
    getAdminToken(),
  );
}

async function updateAdminStatus(dashboardId, registrationId, status) {
  return api(
    `/api/v5/admin/dashboards/${dashboardId}/registrations/${registrationId}/status`,
    {
      method: "POST",
      body: JSON.stringify({ status }),
    },
    getAdminToken(),
  );
}

async function cancelAdminRegistration(dashboardId, registrationId) {
  return api(
    `/api/v5/admin/dashboards/${dashboardId}/registrations/${registrationId}/cancel`,
    { method: "POST", body: JSON.stringify({}) },
    getAdminToken(),
  );
}

async function saveAdminNotes(dashboardId, registrationId, notes) {
  return api(
    `/api/v5/admin/dashboards/${dashboardId}/registrations/${registrationId}/notes`,
    {
      method: "POST",
      body: JSON.stringify({ notes }),
    },
    getAdminToken(),
  );
}

function downloadAdminExcel(dashboardId) {
  const token = getAdminToken();
  if (!token) {
    alert("Admin login required.");
    return;
  }

  fetch(`${API}/api/v5/admin/dashboards/${dashboardId}/export-excel`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(async (res) => {
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Unable to download Excel.");
      }
      return res.blob();
    })
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "svara-token-registrations.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    })
    .catch((error) => alert(error.message));
}

function makeTokenId(prefix, serial) {
  return `${prefix}${String(serial).padStart(4, "0")}`;
}

function tokenRange(entry) {
  if (!entry) return "";
  return entry.tokenEnd && entry.tokenEnd !== entry.tokenStart
    ? `${entry.tokenStart} – ${entry.tokenEnd}`
    : entry.tokenStart;
}

function printLabels(entry, associationName = "SVARA") {
  const quantity = Number(entry.quantity) || 1;
  const start = Number(
    String(entry.tokenStart || "").match(/(\d+)$/)?.[1] || 0,
  );
  const ids = Array.from({ length: quantity }, (_, i) =>
    makeTokenId(entry.prefix || "", start + i),
  );

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const labels = ids
    .map((id) =>
      Array.from(
        { length: 2 },
        () => `
      <div class="label">
        <div class="brand">${escapeHtml(associationName || "SVARA")}</div>
        <div class="datetime">
          <span>${escapeHtml(entry.date || "")}</span>
          <span>|</span>
          <span>${escapeHtml(entry.time || "")}</span>
        </div>
        <div class="divider"></div>
        <div class="category">${escapeHtml(entry.categoryName || entry.tokenType || "")}</div>
        <div class="token">${escapeHtml(id)}</div>
        <div class="row"><b>NAME</b><span>${escapeHtml(entry.name)}</span></div>
        <div class="row"><b>PHONE</b><span>${escapeHtml(entry.phone)}</span></div>
        <div class="row"><b>PAYMENT MODE</b><span>${escapeHtml(entry.payment)}</span></div>
        <div class="divider"></div>
        <div class="thanks">Thank you! 🙏</div>
      </div>
    `,
      ).join(""),
    )
    .join("");

  const win = window.open("", "_blank", "width=420,height=750");
  if (!win) {
    alert("Please allow pop-ups to print the labels.");
    return;
  }

  win.document.write(`
    <!doctype html>
    <html>
    <head>
      <title>SVARA Token Labels</title>
      <style>
        *{box-sizing:border-box}
        @page{size:80mm auto;margin:0}
        body{margin:0;font-family:Arial,sans-serif;color:#111}
        .label{width:80mm;min-height:72mm;padding:6mm 5mm 5mm;
          display:flex;flex-direction:column;page-break-after:always}
        .brand{text-align:center;font-size:21px;font-weight:900;letter-spacing:2px}
        .datetime{text-align:center;margin-top:4px;font-size:10px;color:#555;display:flex;gap:7px;justify-content:center}
        .divider{border-top:1px dashed #aaa;margin:5mm 0}
        .category{align-self:center;border:2px solid #111;padding:2.5mm 7mm;font-size:19px;font-weight:900;text-transform:uppercase}
        .token{text-align:center;font-family:monospace;font-size:31px;font-weight:900;letter-spacing:2px;margin:4mm 0}
        .row{display:flex;justify-content:space-between;gap:8px;font-size:11px;line-height:1.5;margin:2mm 0}
        .row b{font-size:9px;white-space:nowrap}
        .row span{text-align:right;word-break:break-word}
        .thanks{text-align:center;font-size:12px;font-weight:800;margin-top:auto}
      </style>
    </head>
    <body>
      ${labels}
      <script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
    </body>
    </html>
  `);
  win.document.close();
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
  const [channel, setChannel] = useState("email");
  const [contact, setContact] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("contact");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function sendOtp() {
    if (!contact.trim()) {
      setError(`Enter your ${channel}.`);
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");
      await requestOtp(channel, contact.trim());
      setStep("otp");
      setMessage(`OTP sent to your ${channel}.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Enter the 6-digit OTP.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const result = await verifyOtp(channel, contact.trim(), otp.trim());

      sessionStorage.setItem(USER_TOKEN_KEY, result.token);
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
          <div style={{ textAlign: "center", marginBottom: 28 }}>
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
              SVARA
            </div>
            <h1 style={{ margin: "8px 0 5px", fontSize: 27 }}>
              {step === "contact" ? "Welcome back" : "Verify OTP"}
            </h1>
            <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
              {step === "contact"
                ? "Sign in with your email or phone number."
                : `Enter the OTP sent to ${contact}.`}
            </p>
          </div>

          {step === "contact" ? (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  marginBottom: 17,
                }}
              >
                {["email", "phone"].map((item) => (
                  <button
                    key={item}
                    onClick={() => setChannel(item)}
                    style={{
                      ...styles.button,
                      background: channel === item ? "#f5f3ff" : "#f8fafc",
                      color: channel === item ? "#6d28d9" : "#64748b",
                      border:
                        channel === item
                          ? "1px solid #c4b5fd"
                          : "1px solid #e5e7eb",
                    }}
                  >
                    {item === "email" ? "✉️ Email" : "📱 Phone"}
                  </button>
                ))}
              </div>

              <Field label={channel === "email" ? "Email" : "Phone Number"}>
                <input
                  autoFocus
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder={
                    channel === "email" ? "you@example.com" : "+91 9876543210"
                  }
                  style={styles.input}
                  onKeyDown={(e) => e.key === "Enter" && sendOtp()}
                />
              </Field>

              <button
                onClick={sendOtp}
                disabled={loading}
                style={{
                  ...styles.button,
                  width: "100%",
                  background: "#111827",
                  color: "#fff",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Sending..." : "Send OTP"}
              </button>
            </>
          ) : (
            <>
              <Field label="6-digit OTP">
                <input
                  autoFocus
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  style={{
                    ...styles.input,
                    textAlign: "center",
                    letterSpacing: 6,
                    fontSize: 20,
                  }}
                  onKeyDown={(e) => e.key === "Enter" && verify()}
                />
              </Field>

              <button
                onClick={verify}
                disabled={loading}
                style={{
                  ...styles.button,
                  width: "100%",
                  background: "#111827",
                  color: "#fff",
                }}
              >
                {loading ? "Verifying..." : "Verify & Continue"}
              </button>

              <button
                onClick={() => {
                  setStep("contact");
                  setOtp("");
                  setError("");
                  setMessage("");
                }}
                style={{
                  ...styles.button,
                  width: "100%",
                  background: "transparent",
                  color: "#64748b",
                  marginTop: 8,
                }}
              >
                ← Change email / phone
              </button>
            </>
          )}

          {message && (
            <div style={{ color: "#047857", fontSize: 12, marginTop: 10 }}>
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
            Your account and dashboards are stored in PostgreSQL.
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
        className="svara-container"
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
              className="svara-grid-2"
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
                  placeholder="SVARA Association"
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
                className="svara-grid-3"
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
              className="svara-actions"
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

function AdminCredentialsSetup({ onDone, onSkip }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!username.trim() || password.length < 8) {
      setError(
        "Username is required and password must be at least 8 characters.",
      );
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await createAdminCredentials(username.trim(), password);
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal>
      <h2 style={{ margin: 0 }}>Set Admin Credentials</h2>
      <p style={{ color: "#64748b", fontSize: 13 }}>
        One admin account is shared across all dashboards under your account.
      </p>

      <Field label="Admin Username">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={styles.input}
          placeholder="admin"
        />
      </Field>
      <Field label="Password">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
        />
      </Field>
      <Field label="Confirm Password">
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          style={styles.input}
        />
      </Field>

      {error && <ErrorText>{error}</ErrorText>}

      <div
        className="svara-actions"
        style={{ display: "flex", gap: 10, marginTop: 20 }}
      >
        <button
          onClick={onSkip}
          style={{
            ...styles.button,
            flex: 1,
            background: "#f3f4f6",
            color: "#374151",
          }}
        >
          Later
        </button>
        <button
          onClick={submit}
          disabled={loading}
          style={{
            ...styles.button,
            flex: 1,
            background: "#111827",
            color: "#fff",
          }}
        >
          {loading ? "Saving..." : "Create Admin"}
        </button>
      </div>
    </Modal>
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
  onAdmin,
  onLogout,
  user,
  hasAdmin,
}) {
  return (
    <div style={styles.page}>
      <div
        className="svara-container"
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
            <div style={{ fontWeight: 900, letterSpacing: 1.5 }}>SVARA</div>
            <div style={{ color: "#94a3b8", fontSize: 10, letterSpacing: 1 }}>
              TOKEN MANAGEMENT V5
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: "#64748b", fontSize: 12 }}>
              {user?.email || user?.phone || "User"}
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
            WELCOME TO SVARA
          </div>
          <h1 style={{ margin: "5px 0", fontSize: 34 }}>Your Dashboards</h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
            Each dashboard has its own association details, categories, prices
            and registrations.
          </p>
        </div>

        <div
          className="svara-grid-2"
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

          {dashboards.length < 2 && (
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

        <div
          style={{
            ...styles.card,
            marginTop: 18,
            padding: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 15,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontWeight: 800 }}>Administration</div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
              {hasAdmin
                ? "Admin credentials are configured."
                : "Create one admin account for all your dashboards."}
            </div>
          </div>
          <button
            onClick={onAdmin}
            style={{ ...styles.button, background: "#111827", color: "#fff" }}
          >
            🔐 Admin Received
          </button>
        </div>
      </div>
    </div>
  );
}

function RegistrationForm({ dashboard, categories, onBack, onSaved }) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [payment, setPayment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const category = categories.find((item) => item.id === categoryId);
  const amount = Number(category?.price || 0) * Number(quantity || 0);

  async function submit(e) {
    e.preventDefault();

    if (
      !categoryId ||
      !name.trim() ||
      !Number.isInteger(Number(quantity)) ||
      Number(quantity) < 1
    ) {
      setError(
        "Select a category, enter the customer name and a valid quantity.",
      );
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
        categoryId,
        quantity: Number(quantity),
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        payment,
      });

      onSaved(result.entry);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div
        className="svara-container"
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
          <h1 style={{ margin: "6px 0 3px", fontSize: 27 }}>Create Token</h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
            Token numbers are allocated by PostgreSQL and cancelled numbers are
            automatically reusable.
          </p>

          <form onSubmit={submit} style={{ marginTop: 25 }}>
            <div
              className="svara-grid-2"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 20,
              }}
            >
              <div>
                <Field label="Token Category *">
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2,minmax(0,1fr))",
                      gap: 8,
                    }}
                  >
                    {categories.map((item, index) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => setCategoryId(item.id)}
                        style={{
                          ...styles.button,
                          padding: 14,
                          textAlign: "left",
                          background:
                            categoryId === item.id ? "#f5f3ff" : "#f8fafc",
                          color: categoryId === item.id ? "#6d28d9" : "#334155",
                          border:
                            categoryId === item.id
                              ? "2px solid #a78bfa"
                              : "1px solid #e5e7eb",
                        }}
                      >
                        <div style={{ fontSize: 20 }}>
                          {DEFAULT_ICONS[index % DEFAULT_ICONS.length]}
                        </div>
                        <div style={{ marginTop: 5, fontWeight: 800 }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: 11, marginTop: 3 }}>
                          ₹{Number(item.price).toFixed(2)} · {item.prefix}
                        </div>
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Number of Tokens *">
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

                <div
                  style={{
                    background: "#f8fafc",
                    borderRadius: 14,
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <span style={{ color: "#64748b", fontSize: 13 }}>
                      TOTAL AMOUNT
                    </span>
                    <strong style={{ fontSize: 23 }}>
                      ₹{amount.toFixed(2)}
                    </strong>
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>
                    ₹{Number(category?.price || 0).toFixed(2)} ×{" "}
                    {Number(quantity) || 0}
                  </div>
                </div>

                <Field label="Payment Mode *">
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                    }}
                  >
                    {["Cash", "Online"].map((mode) => (
                      <button
                        type="button"
                        key={mode}
                        onClick={() => setPayment(mode)}
                        style={{
                          ...styles.button,
                          background: payment === mode ? "#ecfdf5" : "#f8fafc",
                          color: payment === mode ? "#047857" : "#475569",
                          border:
                            payment === mode
                              ? "1px solid #6ee7b7"
                              : "1px solid #e5e7eb",
                        }}
                      >
                        {mode === "Cash" ? "💵" : "📱"} {mode}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              <div>
                <Field label="Customer Name *">
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={styles.input}
                    placeholder="Full name"
                  />
                </Field>
                <Field label="Phone">
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={styles.input}
                    placeholder="+91..."
                  />
                </Field>
                <Field label="Email">
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={styles.input}
                    placeholder="customer@example.com"
                  />
                </Field>

                <div
                  style={{
                    ...styles.card,
                    background: "#faf5ff",
                    border: "1px solid #e9d5ff",
                    padding: 20,
                    marginTop: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "#7c3aed",
                      fontWeight: 900,
                      letterSpacing: 1,
                    }}
                  >
                    TOKEN PREVIEW
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 900, marginTop: 12 }}>
                    {category?.prefix || "TOK"}####
                  </div>
                  <div style={{ color: "#64748b", fontSize: 12, marginTop: 5 }}>
                    PostgreSQL assigns the actual next available number when you
                    save.
                  </div>
                </div>
              </div>
            </div>

            {error && <ErrorText>{error}</ErrorText>}

            <div
              className="svara-actions"
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
                marginTop: 24,
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
                disabled={loading}
                style={{
                  ...styles.button,
                  background: "#111827",
                  color: "#fff",
                }}
              >
                {loading ? "Creating..." : "Create Registration"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function SuccessModal({ entry, associationName, onClose }) {
  return (
    <Modal>
      <div style={{ textAlign: "center" }}>
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
        <div
          style={{
            fontSize: 40,
            fontFamily: "monospace",
            fontWeight: 900,
            margin: "8px 0",
          }}
        >
          {tokenRange(entry)}
        </div>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Order {entry.orderId} · {entry.quantity} token
          {Number(entry.quantity) > 1 ? "s" : ""}
        </div>

        <div
          style={{
            background: "#f8fafc",
            borderRadius: 13,
            padding: 15,
            textAlign: "left",
            margin: "20px 0",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: 5,
            }}
          >
            <span>Name</span>
            <strong>{entry.name}</strong>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: 5,
            }}
          >
            <span>Payment</span>
            <strong>{entry.payment}</strong>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: 5,
            }}
          >
            <span>Amount</span>
            <strong>₹{Number(entry.amount).toFixed(2)}</strong>
          </div>
        </div>

        <div className="svara-actions" style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => printLabels(entry, associationName)}
            style={{
              ...styles.button,
              flex: 1,
              background: "#111827",
              color: "#fff",
            }}
          >
            🖨️ Print Labels
          </button>
          <button
            onClick={onClose}
            style={{
              ...styles.button,
              background: "#f3f4f6",
              color: "#374151",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
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
}) {
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(() => {
    if (filter === "cancelled")
      return entries.filter((e) => e.status === "Cancelled");
    if (filter === "payment")
      return entries.filter((e) => e.status === "Payment Not Received");
    return entries;
  }, [entries, filter]);

  const activeTokens = entries
    .filter((e) => e.status !== "Cancelled")
    .reduce((sum, e) => sum + Number(e.quantity || 0), 0);

  return (
    <div style={styles.page}>
      <div
        className="svara-container"
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
          <div style={{ fontWeight: 900, letterSpacing: 1.2 }}>
            {dashboard.association_name}
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

        <div
          className="svara-grid-4"
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
            className="svara-actions"
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

          <div style={{ padding: "10px 18px", display: "flex", gap: 7 }}>
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

          {!filtered.length ? (
            <div style={{ padding: 45, textAlign: "center", color: "#94a3b8" }}>
              No registrations found.
            </div>
          ) : (
            <div className="svara-table-wrap" style={{ overflowX: "auto" }}>
              <table
                className="svara-table"
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12,
                }}
              >
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
                        style={{ padding: "11px 13px", textAlign: "left" }}
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
                        <td style={cell}>
                          <strong style={{ fontFamily: "monospace" }}>
                            {tokenRange(entry)}
                          </strong>
                        </td>
                        <td style={cell}>{entry.categoryName}</td>
                        <td style={cell}>
                          <strong>{entry.name}</strong>
                        </td>
                        <td style={cell}>{entry.phone}</td>
                        <td style={cell}>{entry.quantity}</td>
                        <td style={cell}>₹{Number(entry.amount).toFixed(2)}</td>
                        <td style={cell}>{entry.payment}</td>
                        <td style={cell}>
                          <StatusBadge status={entry.status} />
                        </td>
                        <td style={cell}>{entry.date}</td>
                        <td style={cell}>
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              flexWrap: "wrap",
                            }}
                          >
                            {entry.status !== "Cancelled" && (
                              <select
                                value={entry.status}
                                onChange={(e) =>
                                  onStatusChange(entry, e.target.value)
                                }
                                style={{
                                  border: "1px solid #d1d5db",
                                  borderRadius: 8,
                                  padding: 6,
                                  fontSize: 11,
                                }}
                              >
                                <option>Complete</option>
                                <option>Payment Not Received</option>
                              </select>
                            )}
                            <button
                              onClick={() => onReprint(entry)}
                              style={{
                                ...styles.button,
                                padding: "7px 9px",
                                background: "#111827",
                                color: "#fff",
                                fontSize: 11,
                              }}
                            >
                              🖨️
                            </button>
                            {entry.status !== "Cancelled" && (
                              <button
                                onClick={() => onCancel(entry)}
                                style={{
                                  ...styles.button,
                                  padding: "7px 9px",
                                  background: "#fef2f2",
                                  color: "#b91c1c",
                                  fontSize: 11,
                                }}
                              >
                                Cancel
                              </button>
                            )}
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
        background: cancelled ? "#fef2f2" : pending ? "#fff7ed" : "#ecfdf5",
        color: cancelled ? "#b91c1c" : pending ? "#c2410c" : "#047857",
      }}
    >
      {status}
    </span>
  );
}

function AdminLoginModal({ onClose, onSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    try {
      setLoading(true);
      setError("");
      const result = await adminLogin(username.trim(), password);
      sessionStorage.setItem(ADMIN_TOKEN_KEY, result.token);
      onSuccess(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal>
      <h2 style={{ margin: 0 }}>Admin Login</h2>
      <p style={{ color: "#64748b", fontSize: 13 }}>
        Access Admin Received for all dashboards under your account.
      </p>
      <Field label="Username">
        <input
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={styles.input}
        />
      </Field>
      <Field label="Password">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </Field>
      {error && <ErrorText>{error}</ErrorText>}
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button
          onClick={onClose}
          style={{
            ...styles.button,
            flex: 1,
            background: "#f3f4f6",
            color: "#374151",
          }}
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={loading}
          style={{
            ...styles.button,
            flex: 1,
            background: "#111827",
            color: "#fff",
          }}
        >
          {loading ? "Checking..." : "Login"}
        </button>
      </div>
    </Modal>
  );
}

function AdminReceived({
  dashboard,
  dashboards,
  onBack,
  onRefresh,
  onDownload,
  onCreate,
  onLogout,
  onStatusChange,
  onCancel,
  onReprint,
}) {
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedDashboardId, setSelectedDashboardId] = useState(
    dashboard?.id || "",
  );
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  const activeDashboard =
    dashboards.find((d) => d.id === selectedDashboardId) || dashboard;

  const load = useCallback(async () => {
    if (!activeDashboard?.id) return;
    try {
      setError("");
      const result = await getAdminRegistrations(activeDashboard.id);
      setEntries(result.entries || []);
      setSummary(result.summary || null);
    } catch (e) {
      setError(e.message);
    }
  }, [activeDashboard?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = entries.filter((entry) => {
    if (filter === "payment") return entry.status === "Payment Not Received";
    if (filter === "cancelled") return entry.status === "Cancelled";
    return true;
  });

  async function changeStatus(entry, status) {
    try {
      await onStatusChange(activeDashboard.id, entry, status);
      await load();
    } catch (e) {
      alert(e.message);
    }
  }

  async function cancel(entry) {
    if (!window.confirm(`Cancel ${tokenRange(entry)}?`)) return;
    try {
      await onCancel(activeDashboard.id, entry);
      await load();
    } catch (e) {
      alert(e.message);
    }
  }

  async function note(entry, notes) {
    try {
      await saveAdminNotes(activeDashboard.id, entry.id, notes);
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div style={styles.page}>
      <div
        className="svara-container"
        style={{ ...styles.container, paddingTop: 20, paddingBottom: 50 }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 22,
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
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onLogout}
              style={{
                ...styles.button,
                background: "#f3f4f6",
                color: "#374151",
              }}
            >
              Admin Logout
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              color: "#7c3aed",
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: 1.3,
            }}
          >
            ADMIN DASHBOARD
          </div>
          <h1 style={{ margin: "5px 0" }}>Admin Received</h1>
          <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>
            Admin access is shared across your dashboards.
          </p>
        </div>

        <div style={{ marginBottom: 15 }}>
          <label style={styles.label}>Dashboard</label>
          <select
            value={selectedDashboardId}
            onChange={(e) => setSelectedDashboardId(e.target.value)}
            style={styles.input}
          >
            {dashboards.map((d) => (
              <option key={d.id} value={d.id}>
                {d.association_name}
              </option>
            ))}
          </select>
        </div>

        <div
          className="svara-grid-4"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,minmax(0,1fr))",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <Stat
            label="TOTAL RECEIVED"
            value={`₹${Number(summary?.totalAmountReceived || 0).toFixed(2)}`}
          />
          <Stat label="TOTAL ORDERS" value={summary?.totalOrders || 0} />
          <Stat
            label="PENDING TOKENS"
            value={summary?.paymentNotReceivedTokens || 0}
          />
          <Stat
            label="CANCELLED TOKENS"
            value={summary?.cancelledTokens || 0}
          />
        </div>

        <div
          className="svara-grid-3"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,minmax(0,1fr))",
            gap: 10,
            marginBottom: 18,
          }}
        >
          {Object.entries(summary?.amountReceivedByCategory || {}).map(
            ([name, value]) => (
              <Stat
                key={name}
                label={`${name.toUpperCase()} RECEIVED`}
                value={`₹${Number(value || 0).toFixed(2)}`}
              />
            ),
          )}
        </div>

        {error && <ErrorText>{error}</ErrorText>}

        <div style={{ ...styles.card, overflow: "hidden" }}>
          <div
            className="svara-actions"
            style={{
              padding: 18,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              borderBottom: "1px solid #eef2f7",
            }}
          >
            <div style={{ display: "flex", gap: 7 }}>
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
                    fontSize: 11,
                    background: filter === value ? "#111827" : "#f1f5f9",
                    color: filter === value ? "#fff" : "#475569",
                  }}
                >
                  {label}
                </button>
              ))}
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
                onClick={load}
                style={{
                  ...styles.button,
                  background: "#f1f5f9",
                  color: "#334155",
                }}
              >
                ↻ Refresh
              </button>
              <button
                onClick={() => onDownload(activeDashboard.id)}
                style={{
                  ...styles.button,
                  background: "#111827",
                  color: "#fff",
                }}
              >
                📥 Excel
              </button>
            </div>
          </div>

          {!filtered.length ? (
            <div style={{ padding: 45, textAlign: "center", color: "#94a3b8" }}>
              No registrations found.
            </div>
          ) : (
            <div className="svara-table-wrap" style={{ overflowX: "auto" }}>
              <table
                className="svara-table"
                style={{
                  width: "100%",
                  minWidth: 1150,
                  borderCollapse: "collapse",
                  fontSize: 12,
                }}
              >
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
                      "NOTES",
                      "ACTION",
                    ].map((x) => (
                      <th
                        key={x}
                        style={{ padding: "11px 12px", textAlign: "left" }}
                      >
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry) => (
                    <tr
                      key={entry.id}
                      style={{ borderTop: "1px solid #f1f5f9" }}
                    >
                      <td style={cell}>{tokenRange(entry)}</td>
                      <td style={cell}>{entry.categoryName}</td>
                      <td style={{ ...cell, fontWeight: 800 }}>{entry.name}</td>
                      <td style={cell}>{entry.phone}</td>
                      <td style={cell}>{entry.quantity}</td>
                      <td style={cell}>₹{Number(entry.amount).toFixed(2)}</td>
                      <td style={cell}>{entry.payment}</td>
                      <td style={cell}>
                        <StatusBadge status={entry.status} />
                      </td>
                      <td style={cell}>{entry.date}</td>
                      <td style={cell}>
                        <input
                          defaultValue={entry.adminNotes || ""}
                          onBlur={(e) => note(entry, e.target.value)}
                          style={{
                            ...styles.input,
                            width: 150,
                            padding: "7px 8px",
                            fontSize: 11,
                          }}
                          placeholder="Admin note"
                        />
                      </td>
                      <td style={cell}>
                        <div
                          style={{ display: "flex", gap: 5, flexWrap: "wrap" }}
                        >
                          {entry.status !== "Cancelled" && (
                            <select
                              value={entry.status}
                              onChange={(e) =>
                                changeStatus(entry, e.target.value)
                              }
                              style={{
                                border: "1px solid #d1d5db",
                                borderRadius: 7,
                                padding: 5,
                                fontSize: 10,
                              }}
                            >
                              <option>Complete</option>
                              <option>Payment Not Received</option>
                            </select>
                          )}
                          <button
                            onClick={() =>
                              onReprint(entry, activeDashboard.association_name)
                            }
                            style={{
                              ...styles.button,
                              padding: "6px 8px",
                              background: "#111827",
                              color: "#fff",
                              fontSize: 10,
                            }}
                          >
                            🖨️
                          </button>
                          {entry.status !== "Cancelled" && (
                            <button
                              onClick={() => cancel(entry)}
                              style={{
                                ...styles.button,
                                padding: "6px 8px",
                                background: "#fef2f2",
                                color: "#b91c1c",
                                fontSize: 10,
                              }}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
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

const cell = {
  padding: "12px",
  color: "#475569",
  verticalAlign: "middle",
};

export default function App() {
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState("");
  const [dashboards, setDashboards] = useState([]);
  const [selectedDashboard, setSelectedDashboard] = useState(null);
  const [dashboardDetails, setDashboardDetails] = useState(null);
  const [entries, setEntries] = useState([]);
  const [screen, setScreen] = useState("dashboards");
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showAdminSetup, setShowAdminSetup] = useState(false);
  const [successEntry, setSuccessEntry] = useState(null);

  async function loadAccount() {
    try {
      setLoading(true);
      setError("");

      const me = await getMe();
      setAuth(me);

      const result = await getDashboards();
      setDashboards(result.dashboards || []);

      if (
        !me.adminUsername &&
        !sessionStorage.getItem("svara_v5_admin_setup_seen")
      ) {
        setShowAdminSetup(true);
      }
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
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
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
            <div style={{ fontSize: 25, fontWeight: 900 }}>SVARA</div>
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
              user: result.user,
              adminUsername: result.adminUsername,
            });
            setDashboards(result.dashboards || []);
            setLoading(false);
          }}
        />
      </>
    );
  }

  if (screen === "create-dashboard") {
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
          onSaved={(entry) => {
            setEntries((current) => [entry, ...current]);
            setScreen("dashboard");
            setSuccessEntry(entry);
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
          onCancel={async (entry) => {
            if (
              !window.confirm(
                `Cancel ${tokenRange(entry)}? Cancelled token numbers will become reusable.`,
              )
            )
              return;
            try {
              const result = await cancelRegistration(
                selectedDashboard.id,
                entry.id,
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
          onReprint={(entry) =>
            printLabels(entry, selectedDashboard.association_name)
          }
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

  if (screen === "admin") {
    return (
      <>
        <style>{css}</style>
        <AdminReceived
          dashboard={dashboards[0]}
          dashboards={dashboards}
          onBack={() => setScreen("dashboards")}
          onRefresh={() => {}}
          onDownload={downloadAdminExcel}
          onCreate={() => {
            const first = dashboards[0];
            if (first) {
              openDashboard(first).then(() => setScreen("register"));
            }
          }}
          onLogout={() => {
            sessionStorage.removeItem(ADMIN_TOKEN_KEY);
            setScreen("dashboards");
          }}
          onStatusChange={async (dashboardId, entry, status) => {
            await updateAdminStatus(dashboardId, entry.id, status);
          }}
          onCancel={async (dashboardId, entry) => {
            await cancelAdminRegistration(dashboardId, entry.id);
          }}
          onReprint={printLabels}
        />
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
        hasAdmin={!!auth.adminUsername}
        onSelect={openDashboard}
        onCreate={() => setScreen("create-dashboard")}
        onAdmin={() => {
          if (!auth.adminUsername) {
            setShowAdminSetup(true);
          } else if (getAdminToken()) {
            setScreen("admin");
          } else {
            setShowAdminLogin(true);
          }
        }}
        onLogout={logout}
      />

      {showAdminLogin && (
        <AdminLoginModal
          onClose={() => setShowAdminLogin(false)}
          onSuccess={() => {
            setShowAdminLogin(false);
            setScreen("admin");
          }}
        />
      )}

      {showAdminSetup && (
        <AdminCredentialsSetup
          onDone={() => {
            sessionStorage.setItem("svara_v5_admin_setup_seen", "1");
            setShowAdminSetup(false);
            loadAccount();
          }}
          onSkip={() => {
            sessionStorage.setItem("svara_v5_admin_setup_seen", "1");
            setShowAdminSetup(false);
          }}
        />
      )}
    </>
  );
}
