"use client";

import { useEffect, useState } from "react";
import { useToast } from "../components/ToastProvider";

export default function SettingsPage() {
  const toast = useToast();
  const [recipients, setRecipients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New recipient form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [role, setRole] = useState("CEO");
  const [saving, setSaving] = useState(false);

  const role_user = typeof window !== "undefined" ? localStorage.getItem("user_role") ?? "admin" : "admin";
  const canEdit = role_user === "dm_leader" || role_user === "admin";

  const fetchRecipients = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/settings/recipients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setRecipients(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecipients(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/settings/recipients`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, whatsapp, role }),
      });
      if (res.ok) {
        toast.success(`${name} added to recipient list.`);
        setName(""); setEmail(""); setWhatsapp(""); setRole("CEO");
        fetchRecipients();
      } else {
        const err = await res.json();
        toast.error(err.detail || "Failed to add recipient.");
      }
    } catch (e) { toast.error("Network error."); }
    finally { setSaving(false); }
  };

  const handleRemove = async (id: string, recipName: string) => {
    if (!confirm(`Remove ${recipName} from the recipient list?`)) return;
    const token = localStorage.getItem("access_token");
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/settings/recipients/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setRecipients(r => r.filter(x => x._id !== id));
      toast.success(`${recipName} removed.`);
    } else {
      toast.error("Failed to remove recipient.");
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: 720 }}>
      <style>{`
        @media (max-width: 768px) {
          .settings-h1 { font-size: 28px !important; }
          .settings-card-header { flex-wrap: wrap !important; gap: 8px !important; }
          .settings-form-row { flex-direction: column !important; }
          .settings-form-row > div { flex: 1 1 100% !important; min-width: 0 !important; }
        }
      `}</style>
      <h1 className="font-serif settings-h1" style={{ fontSize: "36px", fontWeight: 500, marginBottom: "8px", color: "var(--ink)", letterSpacing: "-0.5px" }}>
        Settings
      </h1>
      <p style={{ color: "var(--muted)", marginBottom: "40px", fontSize: "15px" }}>
        Manage who receives reports and notifications.
      </p>

      {/* Recipient list */}
      <div style={{ background: "#fff", borderRadius: "16px", border: "1px solid var(--hairline)", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", overflow: "hidden", marginBottom: "32px" }}>
        <div className="settings-card-header" style={{ padding: "24px 28px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: "17px", fontWeight: 600, color: "var(--ink)", margin: 0, marginBottom: "4px" }}>Report Recipients</h2>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
              These people receive generated reports via email and WhatsApp.
            </p>
          </div>
          <span style={{ fontSize: "13px", color: "var(--muted)" }}>
            {recipients.length} contact{recipients.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {[1, 2].map(i => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div className="skeleton" style={{ width: "160px", height: "16px", marginBottom: "8px" }} />
                  <div className="skeleton" style={{ width: "200px", height: "13px" }} />
                </div>
                <div className="skeleton" style={{ width: "70px", height: "30px", borderRadius: "8px" }} />
              </div>
            ))}
          </div>
        ) : recipients.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center" }}>
            <p style={{ color: "var(--muted)", fontSize: "14px" }}>No recipients yet. Add one below.</p>
          </div>
        ) : (
          <div>
            {recipients.map((r, idx) => (
              <div key={r._id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "16px 28px",
                borderBottom: idx < recipients.length - 1 ? "1px solid var(--hairline)" : "none",
                gap: "16px",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--ink)" }}>{r.name}</span>
                    <span style={{
                      fontSize: "11px", fontWeight: 600, padding: "2px 8px",
                      background: "var(--surface-soft)", color: "var(--primary-active)",
                      borderRadius: "20px", textTransform: "uppercase", letterSpacing: "0.4px",
                    }}>
                      {r.role}
                    </span>
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--muted)", display: "flex", gap: "16px", flexWrap: "wrap" }}>
                    <span>✉ {r.email}</span>
                    {r.whatsapp && <span>📱 {r.whatsapp}</span>}
                  </div>
                </div>
                {canEdit && (
                  <button
                    onClick={() => handleRemove(r._id, r.name)}
                    className="btn-ghost"
                    style={{ flexShrink: 0, padding: "6px 14px", fontSize: "13px", color: "var(--error)", borderColor: "rgba(198,69,69,0.2)" }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add recipient form — only for DM Leader / Admin */}
      {canEdit ? (
        <div style={{ background: "#fff", borderRadius: "16px", border: "1px solid var(--hairline)", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", padding: "24px 28px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: 600, color: "var(--ink)", marginBottom: "20px" }}>Add Recipient</h2>
          <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div className="settings-form-row" style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 200px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Full Name</label>
                <input required className="input-field" type="text" placeholder="Sanwar Harshwal" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div style={{ flex: "1 1 200px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Role</label>
                <select className="input-field" value={role} onChange={e => setRole(e.target.value)}>
                  <option value="CEO">CEO</option>
                  <option value="Partner">Partner</option>
                  <option value="Advisor">Advisor</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            <div className="settings-form-row" style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 200px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Email Address</label>
                <input required className="input-field" type="email" placeholder="sanwar@harshwal.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div style={{ flex: "1 1 200px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>WhatsApp Number</label>
                <input className="input-field" type="text" placeholder="+919876543210" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className="btn-primary" disabled={saving} style={{ padding: "10px 32px" }}>
                {saving ? "Adding…" : "Add Recipient"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div style={{ padding: "20px 24px", background: "var(--surface-soft)", borderRadius: "12px", border: "1px solid var(--hairline)", fontSize: "14px", color: "var(--muted)" }}>
          Only the DM Leader can add or remove recipients.
        </div>
      )}
    </div>
  );
}
