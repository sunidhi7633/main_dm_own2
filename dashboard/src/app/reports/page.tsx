"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "../components/ToastProvider";

// Live countdown: returns "47h 58m 32s" or "Expired"
function useCountdown(expiresAt: Date | null): string {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!expiresAt) { setLabel(""); return; }
    const tick = () => {
      const diff = expiresAt.getTime() - Date.now();
      if (diff <= 0) { setLabel("Expired"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLabel(`${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return label;
}

export default function ShareReports() {
  const toast = useToast();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Generate
  const [genType, setGenType] = useState("weekly");
  const [genBrand, setGenBrand] = useState("all");
  const [generating, setGenerating] = useState(false);

  // Recipients
  const [recipients, setRecipients] = useState<any[]>([]);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState("CEO");

  // Share modal
  const [shareModal, setShareModal] = useState<any>(null);
  const [shareTab, setShareTab] = useState<"email" | "whatsapp" | "link">("email");
  const [toEmails, setToEmails] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const [toPhones, setToPhones] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [linkExpiresAt, setLinkExpiresAt] = useState<Date | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  const countdown = useCountdown(linkExpiresAt);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const [r1, r2] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/reports/recent`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/settings/recipients`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (r1.ok) setReports(await r1.json());
      if (r2.ok) setRecipients(await r2.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/reports/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ report_type: genType, brand: genBrand, format: "html" }),
      });
      if (res.ok) { toast.success("Report generated!"); fetchData(); }
      else toast.error("Generation failed.");
    } catch (e) { console.error(e); }
    finally { setGenerating(false); }
  };

  const handleDownload = (report: any) => {
    const url = report.pdf_s3_path || report.pdf_url;
    if (url) {
      window.open(url, "_blank");
    } else {
      // Download as the HTML report viewer
      const viewerUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/reports/view/${report._id}`;
      window.open(viewerUrl, "_blank");
    }
  };

  const handleOpenShare = (report: any) => {
    setShareModal(report);
    setShareTab("email");
    setShareLink("");
    setLinkExpiresAt(null);
    setPersonalNote("");
    const defaultEmails = recipients.map(r => r.email).join(", ");
    setToEmails(defaultEmails);
    setToPhones("");
  };

  const handleShareWhatsapp = async () => {
    setSendingWhatsapp(true);
    const token = localStorage.getItem("access_token");
    const phones = toPhones.split(",").map(p => p.trim()).filter(Boolean);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/reports/share/whatsapp`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ report_id: shareModal._id, to_phones: phones }),
      });
      if (res.ok) { toast.success("WhatsApp message sent!"); setShareModal(null); }
      else toast.error("Failed to send WhatsApp message.");
    } catch (e) { console.error(e); }
    finally { setSendingWhatsapp(false); }
  };

  const handleShareEmail = async () => {
    setSendingEmail(true);
    const token = localStorage.getItem("access_token");
    const emails = toEmails.split(",").map(e => e.trim()).filter(Boolean);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/reports/share/email`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ report_id: shareModal._id, to_emails: emails, personal_note: personalNote }),
      });
      if (res.ok) { toast.success("Email sent!"); setShareModal(null); }
      else toast.error("Failed to send email.");
    } catch (e) { console.error(e); }
    finally { setSendingEmail(false); }
  };

  const handleGenerateLink = async () => {
    setGeneratingLink(true);
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/reports/share/link`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ report_id: shareModal._id }),
      });
      if (res.ok) {
        const data = await res.json();
        setShareLink(data.url);
        // Backend sets 48h expiry; set countdown from now
        const expiresAt = data.expires_at ? new Date(data.expires_at) : new Date(Date.now() + 48 * 3600 * 1000);
        setLinkExpiresAt(expiresAt);
      } else {
        toast.error("Failed to generate link.");
      }
    } catch (e) { console.error(e); }
    finally { setGeneratingLink(false); }
  };

  const handleAddRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("access_token");
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/settings/recipients`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, email: newEmail, whatsapp: newPhone, role: newRole }),
    });
    if (res.ok) {
      toast.success("Recipient added.");
      setNewName(""); setNewEmail(""); setNewPhone("");
      fetchData();
    } else {
      toast.error("Failed to add recipient.");
    }
  };

  const handleRemoveRecipient = async (id: string) => {
    if (!confirm("Remove this recipient?")) return;
    const token = localStorage.getItem("access_token");
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/settings/recipients/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setRecipients(r => r.filter(x => x._id !== id));
      toast.success("Recipient removed.");
    } else {
      toast.error("Failed to remove.");
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: 1100 }}>
      <h1 className="font-serif" style={{ fontSize: "36px", fontWeight: 500, marginBottom: "8px", color: "var(--ink)", letterSpacing: "-0.5px" }}>
        Reports &amp; Sharing
      </h1>
      <p style={{ color: "var(--muted)", marginBottom: "32px", fontSize: "15px" }}>
        Generate and securely share performance reports with management.
      </p>

      {/* Generate bar */}
      <div style={{ background: "#fff", padding: "24px 28px", borderRadius: "14px", border: "1px solid var(--hairline)", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", marginBottom: "32px", display: "flex", gap: "16px", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Report Type</label>
          <select className="input-field" value={genType} onChange={e => setGenType(e.target.value)} style={{ height: "38px", minWidth: "180px" }}>
            <option value="weekly">Weekly Summary</option>
            <option value="monthly">Monthly Executive</option>
            <option value="seo">SEO Snapshot</option>
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Brand</label>
          <select className="input-field" value={genBrand} onChange={e => setGenBrand(e.target.value)} style={{ height: "38px", minWidth: "160px" }}>
            <option value="all">All Brands</option>
            <option value="hcllp">HCLLP</option>
            <option value="blue_arrow_cpa">Blue Arrow CPA</option>
            <option value="advisory">Advisory</option>
          </select>
        </div>
        <button onClick={handleGenerate} disabled={generating} className="btn-primary" style={{ height: "38px", padding: "0 28px" }}>
          {generating ? "Generating…" : "Generate Report"}
        </button>
      </div>

      <div style={{ display: "flex", gap: "28px", flexWrap: "wrap", alignItems: "flex-start" }}>

        {/* ── Left: Recent Reports ── */}
        <div style={{ flex: 2, minWidth: "320px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: 600, marginBottom: "16px", color: "var(--ink)" }}>Recent Reports</h2>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ background: "#fff", padding: "20px 24px", borderRadius: "12px", border: "1px solid var(--hairline)", display: "flex", justifyContent: "space-between" }}>
                  <div><div className="skeleton" style={{ width: "200px", height: "18px", marginBottom: "8px" }} /><div className="skeleton" style={{ width: "130px", height: "13px" }} /></div>
                  <div style={{ display: "flex", gap: "8px" }}><div className="skeleton" style={{ width: "90px", height: "34px", borderRadius: "8px" }} /><div className="skeleton" style={{ width: "90px", height: "34px", borderRadius: "8px" }} /></div>
                </div>
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center", background: "#fff", borderRadius: "12px", border: "1px solid var(--hairline)" }}>
              <p style={{ color: "var(--muted)" }}>No reports generated yet.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[...reports].sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime()).map(report => (
                <div key={report._id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "#fff", padding: "18px 24px", borderRadius: "12px",
                  border: "1px solid var(--hairline)", boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
                  gap: "16px", flexWrap: "wrap",
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "15px", color: "var(--ink)", marginBottom: "4px" }}>
                      {(report.type || "report").toUpperCase()} — {report.brand}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                      {new Date(report.generated_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                    <button className="btn-ghost" style={{ padding: "7px 16px", fontSize: "13px" }} onClick={() => handleDownload(report)}>
                      ⬇ Download
                    </button>
                    <button className="btn-primary" style={{ padding: "7px 16px", fontSize: "13px" }} onClick={() => handleOpenShare(report)}>
                      📤 Share
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Management List ── */}
        <div style={{ flex: 1, minWidth: "260px" }}>
          <div style={{ background: "#fff", padding: "24px 28px", borderRadius: "14px", border: "1px solid var(--hairline)", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
            <h2 style={{ fontSize: "17px", fontWeight: 600, marginBottom: "16px", color: "var(--ink)" }}>Management List</h2>

            <div style={{ marginBottom: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {recipients.map(r => (
                <div key={r._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--canvas)", borderRadius: "8px", border: "1px solid var(--hairline)" }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: "13px", color: "var(--ink)" }}>{r.name}</span>
                    <span style={{ fontSize: "11px", color: "var(--primary-active)", fontWeight: 600, marginLeft: "6px" }}>{r.role}</span>
                    <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>{r.email}</div>
                  </div>
                  <button
                    onClick={() => handleRemoveRecipient(r._id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "16px", padding: "4px", lineHeight: 1 }}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
              {recipients.length === 0 && <p style={{ fontSize: "13px", color: "var(--muted)" }}>No recipients yet.</p>}
            </div>

            <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: "16px" }}>
              <h3 style={{ fontSize: "13px", fontWeight: 700, marginBottom: "12px", color: "var(--ink)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Add Recipient</h3>
              <form onSubmit={handleAddRecipient} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <input required className="input-field" type="text" placeholder="Full name" value={newName} onChange={e => setNewName(e.target.value)} />
                <input required className="input-field" type="email" placeholder="Email address" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                <input className="input-field" type="text" placeholder="WhatsApp (optional)" value={newPhone} onChange={e => setNewPhone(e.target.value)} />
                <select className="input-field" value={newRole} onChange={e => setNewRole(e.target.value)}>
                  <option value="CEO">CEO</option>
                  <option value="Partner">Partner</option>
                  <option value="Advisor">Advisor</option>
                </select>
                <button type="submit" className="btn-ghost">Add</button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* ── Share Modal ── */}
      {shareModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(20,20,19,0.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#fff", borderRadius: "20px", width: "520px", maxWidth: "92%", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", overflow: "hidden" }}>
            {/* Modal header */}
            <div style={{ padding: "28px 32px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                <h3 className="font-serif" style={{ fontSize: "26px", fontWeight: 500, color: "var(--ink)", margin: 0 }}>Share Report</h3>
                <button onClick={() => setShareModal(null)} style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "var(--muted)", lineHeight: 1, padding: "0 4px" }}>×</button>
              </div>
              <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "20px" }}>
                {(shareModal.type || "report").toUpperCase()} — {shareModal.brand}
              </p>

              {/* Tabs */}
              <div style={{ display: "flex", gap: "0", borderBottom: "2px solid var(--hairline)" }}>
                {([
                  { id: "email",    label: "📧 Email" },
                  { id: "whatsapp", label: "💬 WhatsApp" },
                  { id: "link",     label: "🔗 Link" },
                ] as { id: "email" | "whatsapp" | "link"; label: string }[]).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setShareTab(tab.id)}
                    style={{
                      padding: "10px 20px",
                      background: "none",
                      border: "none",
                      borderBottom: `2px solid ${shareTab === tab.id ? "var(--primary)" : "transparent"}`,
                      marginBottom: "-2px",
                      fontSize: "14px",
                      fontWeight: shareTab === tab.id ? 600 : 400,
                      color: shareTab === tab.id ? "var(--primary-active)" : "var(--muted)",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div style={{ padding: "24px 32px 28px" }}>
              {shareTab === "whatsapp" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Phone Numbers</label>
                    <input
                      type="text"
                      className="input-field"
                      value={toPhones}
                      onChange={e => setToPhones(e.target.value)}
                      placeholder="+919876543210, +919999999999"
                    />
                    {recipients.filter(r => r.whatsapp).length > 0 && (
                      <div style={{ marginTop: "8px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {recipients.filter(r => r.whatsapp).map(r => (
                          <button
                            key={r._id}
                            type="button"
                            onClick={() => {
                              const phones = toPhones.split(",").map((p: string) => p.trim()).filter(Boolean);
                              if (!phones.includes(r.whatsapp)) setToPhones([...phones, r.whatsapp].join(", "));
                            }}
                            style={{ fontSize: "11px", padding: "3px 10px", background: "var(--surface-soft)", border: "1px solid var(--hairline)", borderRadius: "20px", cursor: "pointer", color: "var(--ink)" }}
                          >
                            + {r.name}
                          </button>
                        ))}
                      </div>
                    )}
                    <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "8px", lineHeight: 1.5 }}>
                      A secure 48-hour link will be generated and sent via WhatsApp Business API.
                    </p>
                  </div>
                  <button onClick={handleShareWhatsapp} disabled={sendingWhatsapp || !toPhones.trim()} className="btn-primary" style={{ width: "100%", marginTop: "4px" }}>
                    {sendingWhatsapp ? "Sending…" : "Send via WhatsApp"}
                  </button>
                </div>
              ) : shareTab === "email" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>To</label>
                    <input
                      type="text"
                      className="input-field"
                      value={toEmails}
                      onChange={e => setToEmails(e.target.value)}
                      placeholder="email1@example.com, email2@example.com"
                    />
                    {recipients.length > 0 && (
                      <div style={{ marginTop: "8px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {recipients.map(r => (
                          <button
                            key={r._id}
                            type="button"
                            onClick={() => {
                              const emails = toEmails.split(",").map(e => e.trim()).filter(Boolean);
                              if (!emails.includes(r.email)) setToEmails([...emails, r.email].join(", "));
                            }}
                            style={{ fontSize: "11px", padding: "3px 10px", background: "var(--surface-soft)", border: "1px solid var(--hairline)", borderRadius: "20px", cursor: "pointer", color: "var(--ink)" }}
                          >
                            + {r.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Personal Note</label>
                    <textarea
                      className="input-field"
                      value={personalNote}
                      onChange={e => setPersonalNote(e.target.value)}
                      placeholder="Optional message to the recipient…"
                      style={{ height: "80px", resize: "vertical" }}
                    />
                  </div>
                  <button onClick={handleShareEmail} disabled={sendingEmail} className="btn-primary" style={{ width: "100%", marginTop: "4px" }}>
                    {sendingEmail ? "Sending…" : "Send Email"}
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {shareLink ? (
                    <>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <input type="text" readOnly value={shareLink} className="input-field" style={{ flex: 1, fontSize: "13px" }} />
                        <button
                          className="btn-ghost"
                          onClick={() => { navigator.clipboard.writeText(shareLink); toast.success("Copied!"); }}
                        >
                          Copy
                        </button>
                      </div>
                      <div style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        padding: "12px 16px",
                        background: countdown === "Expired" ? "rgba(198,69,69,0.06)" : "rgba(93,184,166,0.08)",
                        borderRadius: "8px",
                        border: `1px solid ${countdown === "Expired" ? "rgba(198,69,69,0.2)" : "rgba(93,184,166,0.2)"}`,
                      }}>
                        <span style={{ fontSize: "18px" }}>{countdown === "Expired" ? "⛔" : "⏱"}</span>
                        <div>
                          <div style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            {countdown === "Expired" ? "Link expired" : "Link expires in"}
                          </div>
                          <div style={{ fontSize: "20px", fontWeight: 700, color: countdown === "Expired" ? "var(--error)" : "var(--ink)", fontFamily: "var(--font-mono)" }}>
                            {countdown}
                          </div>
                        </div>
                      </div>
                      <p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.5 }}>
                        No login required to view. Share only with authorised management contacts.
                      </p>
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize: "14px", color: "var(--muted)", lineHeight: 1.6 }}>
                        Generate a secure, time-limited link to this report. The link is valid for <strong>48 hours</strong> and requires no login.
                      </p>
                      <button onClick={handleGenerateLink} disabled={generatingLink} className="btn-primary" style={{ width: "100%" }}>
                        {generatingLink ? "Generating…" : "Generate 48h Link"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
