"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const PLATFORMS = ["linkedin", "facebook", "instagram", "twitter", "youtube"];

type Competitor = {
  id: number; name: string; industry: string; website: string;
  linkedin_handle: string; facebook_handle: string; instagram_handle: string;
  twitter_handle: string; youtube_handle: string; is_active: number;
  posts_collected: number; latest_run_id: number | null;
};

type CompetitorForm = {
  name: string; industry: string; website: string;
  linkedin_handle: string; facebook_handle: string; instagram_handle: string;
  twitter_handle: string; youtube_handle: string;
};

const BLANK: CompetitorForm = {
  name: "", industry: "CPA / Accounting", website: "",
  linkedin_handle: "", facebook_handle: "", instagram_handle: "",
  twitter_handle: "", youtube_handle: "",
};

const PLATFORM_ICONS: Record<string, string> = {
  linkedin: "in", facebook: "f", instagram: "ig", twitter: "x", youtube: "yt",
};

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Competitor | null>(null);
  const [form, setForm] = useState<CompetitorForm>({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);

  const token = () => localStorage.getItem("access_token") || "";
  const h = () => ({ Authorization: `Bearer ${token()}`, "Content-Type": "application/json" });

  const fetchCompetitors = async () => {
    try {
      const r = await fetch(`${API}/api/ci/competitors?active_only=false`, { headers: h() });
      const d = await r.json();
      setCompetitors(Array.isArray(d) ? d : []);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchCompetitors(); }, []);

  const openAdd = () => { setEditing(null); setForm({ ...BLANK }); setShowModal(true); };
  const openEdit = (c: Competitor) => {
    setEditing(c);
    setForm({ name: c.name, industry: c.industry, website: c.website,
              linkedin_handle: c.linkedin_handle, facebook_handle: c.facebook_handle,
              instagram_handle: c.instagram_handle, twitter_handle: c.twitter_handle,
              youtube_handle: c.youtube_handle });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await fetch(`${API}/api/ci/competitors/${editing.id}`, { method: "PATCH", headers: h(), body: JSON.stringify(form) });
      } else {
        await fetch(`${API}/api/ci/competitors`, { method: "POST", headers: h(), body: JSON.stringify(form) });
      }
      setShowModal(false);
      fetchCompetitors();
    } finally { setSaving(false); }
  };

  const deactivate = async (id: number) => {
    setDeleting(id);
    try {
      await fetch(`${API}/api/ci/competitors/${id}`, { method: "DELETE", headers: h() });
      fetchCompetitors();
    } finally { setDeleting(null); }
  };

  const filtered = competitors.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.industry.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <style>{`
        .ci-modal-overlay { position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:100;display:flex;align-items:center;justify-content:center;padding:20px; }
        .ci-modal { background:#fff;border-radius:16px;width:100%;max-width:600px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.2); }
        .ci-input { width:100%;padding:9px 12px;border-radius:8px;border:1px solid var(--hairline);font-size:13px;font-family:var(--font-sans);box-sizing:border-box; }
        .ci-input:focus { outline:none;border-color:var(--primary);box-shadow:0 0 0 3px rgba(204,120,92,0.1); }
        .platform-badge { display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:6px;font-size:9px;font-weight:700;text-transform:uppercase; }
      `}</style>

      <div style={{ padding: "32px 40px", maxWidth: 1200, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <a href="/competitor-intel" style={{ fontSize: 13, color: "var(--muted)", textDecoration: "none" }}>← Competitor Intel</a>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)", margin: 0 }}>Competitors</h1>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0" }}>
              {competitors.filter(c => c.is_active).length} active · {competitors.length} total
            </p>
          </div>
          <button onClick={openAdd} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Competitor
          </button>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 20, maxWidth: 360 }}>
          <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search competitors..."
            style={{ width: "100%", padding: "9px 12px 9px 36px", borderRadius: 8, border: "1px solid var(--hairline)", fontSize: 13, fontFamily: "var(--font-sans)", boxSizing: "border-box" }} />
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--muted)" }}>Loading...</div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid var(--hairline)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-soft)" }}>
                  {["Competitor", "Industry", "Platforms", "Posts (Last Run)", "Status", "Actions"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id} style={{ borderTop: i > 0 ? "1px solid var(--hairline)" : "none" }}>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{c.name}</div>
                      {c.website && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{c.website}</div>}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 13, color: "var(--muted)" }}>{c.industry}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        {PLATFORMS.map(p => {
                          const handle = (c as any)[`${p}_handle`];
                          return (
                            <span key={p} className="platform-badge" style={{
                              background: handle ? "var(--primary)" : "var(--surface-soft)",
                              color: handle ? "#fff" : "#ccc",
                            }}>
                              {PLATFORM_ICONS[p]}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      {c.posts_collected > 0 ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                          {c.posts_collected}
                          <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>posts</span>
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{
                        padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: c.is_active ? "#dcfce7" : "#f3f4f6",
                        color: c.is_active ? "#15803d" : "#9ca3af",
                      }}>
                        {c.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => openEdit(c)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--hairline)", background: "#fff", fontSize: 12, color: "var(--ink)", cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                          Edit
                        </button>
                        {c.is_active === 1 && (
                          <button onClick={() => deactivate(c.id)} disabled={deleting === c.id} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #fee2e2", background: "#fff", fontSize: 12, color: "#ef4444", cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                            {deleting === c.id ? "..." : "Remove"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
                    {search ? "No competitors match your search." : "No competitors yet. Click Add Competitor to get started."}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="ci-modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="ci-modal">
            <div style={{ padding: "24px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
                {editing ? "Edit Competitor" : "Add Competitor"}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--muted)" }}>×</button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 6 }}>Company Name *</label>
                  <input className="ci-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Deloitte" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 6 }}>Industry</label>
                  <input className="ci-input" value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 6 }}>Website</label>
                  <input className="ci-input" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="deloitte.com" />
                </div>
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>Social Media Handles</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {PLATFORMS.map(p => (
                  <div key={p}>
                    <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "capitalize" }}>{p}</label>
                    <input className="ci-input" value={(form as any)[`${p}_handle`]}
                      onChange={e => setForm(f => ({ ...f, [`${p}_handle`]: e.target.value }))}
                      placeholder={`@handle or username`} />
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
                <button onClick={() => setShowModal(false)} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid var(--hairline)", background: "#fff", fontSize: 13, color: "var(--ink)", cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                  Cancel
                </button>
                <button onClick={save} disabled={saving || !form.name.trim()} style={{ padding: "9px 24px", borderRadius: 8, border: "none", background: !form.name.trim() ? "#d1ccc6" : "var(--primary)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving || !form.name.trim() ? "not-allowed" : "pointer", fontFamily: "var(--font-sans)" }}>
                  {saving ? "Saving..." : editing ? "Save Changes" : "Add Competitor"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
