"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
const PAGE_SIZE = 30;

type Post = {
  id: number; run_id: number; brand: string; platform: string;
  headline: string; content: string; cta: string; hashtags: string[];
  quality_brand_score: number; quality_originality_score: number; quality_readability_score: number;
  status: string; rejection_reason: string;
  scheduled_at: string | null; created_at: string;
};

const BRAND_LABEL: Record<string, string> = {
  hcllp: "Harshwal & Co.", blue_arrow_cpa: "Blue Arrow CPA", advisory: "Advisory",
};
const BRAND_COLOR: Record<string, [string, string]> = {
  hcllp: ["#cc785c", "#fdf6f3"], blue_arrow_cpa: ["#1d4ed8", "#dbeafe"], advisory: ["#7c3aed", "#ede9fe"],
};
const PLATFORM_COLOR: Record<string, [string, string]> = {
  linkedin: ["#0077b5", "#e8f4fd"], facebook: ["#1877f2", "#e8f1fe"],
  instagram: ["#e1306c", "#fce8f1"], twitter: ["#1da1f2", "#e8f5fd"],
};
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  draft:        { bg: "#f3f4f6", color: "#6b7280" },
  approved:     { bg: "#dcfce7", color: "#15803d" },
  rejected:     { bg: "#fee2e2", color: "#ef4444" },
  scheduled:    { bg: "#fef3c7", color: "#b45309" },
  published:    { bg: "#dbeafe", color: "#1d4ed8" },
  under_review: { bg: "#fce7f3", color: "#9d174d" },
};

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{score}%</span>
      </div>
      <div style={{ height: 5, background: "var(--surface-soft)", borderRadius: 3 }}>
        <div style={{ height: "100%", width: `${score}%`, background: color, borderRadius: 3, transition: "width 600ms" }} />
      </div>
    </div>
  );
}

export default function GeneratedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [brandFilter, setBrandFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("draft");
  const [selected, setSelected] = useState<Post | null>(null);
  const [editContent, setEditContent] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [action, setAction] = useState<"approve" | "reject" | "schedule" | null>(null);
  const [saving, setSaving] = useState(false);

  const token = () => localStorage.getItem("access_token") || "";
  const h = (json = false) => ({ Authorization: `Bearer ${token()}`, ...(json ? { "Content-Type": "application/json" } : {}) });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String((page - 1) * PAGE_SIZE),
        });
        if (brandFilter !== "all") params.set("brand", brandFilter);
        if (platformFilter !== "all") params.set("platform", platformFilter);
        if (statusFilter !== "all") params.set("status", statusFilter);
        const r = await fetch(`${API}/api/ci/generated?${params}`, { headers: h() });
        const d = await r.json();
        setPosts(Array.isArray(d) ? d : []);
      } finally { setLoading(false); }
    };
    load();
  }, [brandFilter, platformFilter, statusFilter, page]);

  const setFilter = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(1);
  };

  const openPost = (p: Post) => {
    setSelected(p);
    setEditContent(p.content);
    setRejectReason("");
    setScheduledAt("");
    setAction(null);
  };

  const submitAction = async () => {
    if (!selected || !action) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { action, content: editContent };
      if (action === "reject") body.rejection_reason = rejectReason;
      if (action === "schedule") body.scheduled_at = new Date(scheduledAt).toISOString();
      const r = await fetch(`${API}/api/ci/generated/${selected.id}`, { method: "PATCH", headers: h(true), body: JSON.stringify(body) });
      const updated = await r.json();
      setPosts(prev => prev.map(p => p.id === updated.id ? updated : p));
      setSelected(updated);
      setAction(null);
    } finally { setSaving(false); }
  };

  const avgScore = (p: Post) => Math.round((p.quality_brand_score + p.quality_originality_score + p.quality_readability_score) / 3);

  const brands = ["all", "hcllp", "blue_arrow_cpa", "advisory"];
  const platforms = ["all", "linkedin", "facebook", "twitter", "instagram"];
  const statuses = ["all", "draft", "approved", "rejected", "scheduled"];

  const hasPrev = page > 1;
  const hasNext = posts.length === PAGE_SIZE;

  return (
    <>
      <style>{`
        .gen-card { background:#fff;border:1px solid var(--hairline);border-radius:12px;padding:16px;cursor:pointer;transition:box-shadow 150ms,border-color 150ms; }
        .gen-card:hover { box-shadow:0 4px 16px rgba(0,0,0,0.08);border-color:#d1ccc6; }
        .gen-card.selected { border-color:var(--primary);box-shadow:0 0 0 3px rgba(204,120,92,0.1); }
        .detail-panel { background:#fff;border:1px solid var(--hairline);border-radius:14px;position:sticky;top:80px;max-height:calc(100vh - 100px);overflow-y:auto; }
        .action-btn { width:100%;padding:10px 0;border-radius:8px;border:none;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font-sans); }
        .filter-btn { padding:6px 14px;border-radius:20px;border:1px solid var(--hairline);background:#fff;font-size:12px;font-weight:500;cursor:pointer;font-family:var(--font-sans);transition:all 120ms; }
        .filter-btn.active { background:var(--primary);color:#fff;border-color:var(--primary); }
        textarea.ci-ta { width:100%;border:1px solid var(--hairline);border-radius:8px;padding:10px;font-size:13px;font-family:var(--font-sans);resize:vertical;line-height:1.6; }
        textarea.ci-ta:focus { outline:none;border-color:var(--primary); }
        .pager-btn { padding:7px 16px;border-radius:8px;border:1px solid var(--hairline);font-size:13px;font-weight:500;cursor:pointer;font-family:var(--font-sans);transition:background 120ms; }
        .pager-btn:disabled { opacity:0.4;cursor:default; }
        .pager-btn:not(:disabled):hover { background:var(--surface-soft); }
        @media (max-width:768px) {
          .gen-outer { padding:16px !important; }
          .gen-layout { grid-template-columns:1fr !important; }
          .detail-panel { position:relative !important; top:0 !important; max-height:none !important; margin-top:12px; }
        }
      `}</style>

      <div className="gen-outer" style={{ padding: "28px 40px", maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <a href="/competitor-intel" style={{ fontSize: 13, color: "var(--muted)", textDecoration: "none" }}>← Competitor Intel</a>
        </div>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)", margin: "0 0 4px" }}>Generated Content Review</h1>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Review, edit, approve or reject AI-generated posts before publishing</p>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          <span style={{ fontSize: 12, color: "var(--muted)", alignSelf: "center", marginRight: 4 }}>Brand:</span>
          {brands.map(b => (
            <button key={b} className={`filter-btn${brandFilter === b ? " active" : ""}`} onClick={() => setFilter(setBrandFilter)(b)}>
              {b === "all" ? "All Brands" : BRAND_LABEL[b] || b}
            </button>
          ))}
          <span style={{ fontSize: 12, color: "var(--muted)", alignSelf: "center", marginLeft: 8, marginRight: 4 }}>Platform:</span>
          {platforms.map(p => (
            <button key={p} className={`filter-btn${platformFilter === p ? " active" : ""}`} onClick={() => setFilter(setPlatformFilter)(p)}>
              {p === "all" ? "All" : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
          <span style={{ fontSize: 12, color: "var(--muted)", alignSelf: "center", marginLeft: 8, marginRight: 4 }}>Status:</span>
          {statuses.map(s => (
            <button key={s} className={`filter-btn${statusFilter === s ? " active" : ""}`} onClick={() => setFilter(setStatusFilter)(s)}>
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: "var(--muted)" }}>Loading...</div>
        ) : (
          <>
            <div className="gen-layout" style={{ display: "grid", gridTemplateColumns: selected ? "1fr 420px" : "1fr", gap: 20 }}>

              {/* Left: post cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {posts.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 80, color: "var(--muted)" }}>
                    <div style={{ fontSize: 36, marginBottom: 16 }}></div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>No posts to review</div>
                    <div style={{ fontSize: 14 }}>Run a pipeline to generate content for review.</div>
                  </div>
                ) : posts.map(p => {
                  const [bc, bbg] = BRAND_COLOR[p.brand] ?? ["#666", "#f3f4f6"];
                  const [pc, pbg] = PLATFORM_COLOR[p.platform] ?? ["#666", "#f3f4f6"];
                  const ss = STATUS_STYLE[p.status] ?? STATUS_STYLE.draft;
                  const avg = avgScore(p);
                  return (
                    <div key={p.id} className={`gen-card${selected?.id === p.id ? " selected" : ""}`} onClick={() => openPost(p)}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                            <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: bbg, color: bc }}>{BRAND_LABEL[p.brand] || p.brand}</span>
                            <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: pbg, color: pc, textTransform: "capitalize" }}>{p.platform}</span>
                            <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: ss.bg, color: ss.color, marginLeft: "auto" }}>{p.status}</span>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 5 }}>{p.headline}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
                            {p.content}
                          </div>
                        </div>
                        <div style={{ textAlign: "center", flexShrink: 0 }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: avg >= 80 ? "#15803d" : avg >= 65 ? "#b45309" : "#ef4444" }}>{avg}</div>
                          <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px" }}>Score</div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Pagination */}
                {posts.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, justifyContent: "center" }}>
                    <button className="pager-btn" disabled={!hasPrev} onClick={() => setPage(p => p - 1)} style={{ background: "#fff" }}>
                      â† Prev
                    </button>
                    <span style={{ fontSize: 13, color: "var(--muted)", minWidth: 60, textAlign: "center" }}>Page {page}</span>
                    <button className="pager-btn" disabled={!hasNext} onClick={() => setPage(p => p + 1)} style={{ background: "#fff" }}>
                      Next â†’
                    </button>
                  </div>
                )}
              </div>

              {/* Right: detail panel */}
              {selected && (
                <div className="detail-panel">
                  <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>Post Detail</div>
                    <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--muted)" }}>×</button>
                  </div>

                  <div style={{ padding: 20 }}>
                    {/* Badges */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                      {(() => { const [bc, bbg] = BRAND_COLOR[selected.brand] ?? ["#666", "#f3f4f6"]; return <span style={{ padding: "3px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: bbg, color: bc }}>{BRAND_LABEL[selected.brand] || selected.brand}</span>; })()}
                      {(() => { const [pc, pbg] = PLATFORM_COLOR[selected.platform] ?? ["#666", "#f3f4f6"]; return <span style={{ padding: "3px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: pbg, color: pc, textTransform: "capitalize" }}>{selected.platform}</span>; })()}
                      {(() => { const ss = STATUS_STYLE[selected.status] ?? STATUS_STYLE.draft; return <span style={{ padding: "3px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: ss.bg, color: ss.color }}>{selected.status}</span>; })()}
                    </div>

                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Headline</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 16 }}>{selected.headline}</div>

                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Content</div>
                    <textarea className="ci-ta" rows={8} value={editContent} onChange={e => setEditContent(e.target.value)} />

                    {selected.cta && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>CTA</div>
                        <div style={{ fontSize: 13, color: "var(--ink)", padding: "8px 12px", background: "var(--surface-soft)", borderRadius: 8 }}>{selected.cta}</div>
                      </div>
                    )}

                    {selected.hashtags?.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Hashtags</div>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          {selected.hashtags.map(tag => (
                            <span key={tag} style={{ padding: "3px 10px", borderRadius: 6, background: "#f0ebe5", color: "var(--primary)", fontSize: 12, fontWeight: 500 }}>#{tag.replace(/^#/, "")}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: 20, padding: 14, background: "var(--surface-soft)", borderRadius: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>Quality Scores</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <ScoreBar label="Brand Alignment" score={selected.quality_brand_score} color="#cc785c" />
                        <ScoreBar label="Originality" score={selected.quality_originality_score} color="#3b82f6" />
                        <ScoreBar label="Readability" score={selected.quality_readability_score} color="#22c55e" />
                      </div>
                    </div>

                    {action === "reject" && (
                      <div style={{ marginTop: 16 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 6 }}>Rejection Reason</label>
                        <textarea className="ci-ta" rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Why is this post being rejected?" />
                      </div>
                    )}

                    {action === "schedule" && (
                      <div style={{ marginTop: 16 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 6 }}>Schedule Date & Time</label>
                        <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                          style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--hairline)", fontSize: 13, fontFamily: "var(--font-sans)", boxSizing: "border-box" }} />
                      </div>
                    )}

                    {selected.status === "draft" && (
                      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                        <button className="action-btn" onClick={() => { setAction("approve"); submitAction(); }}
                          style={{ background: "#22c55e", color: "#fff" }} disabled={saving}>
                          {saving && action === "approve" ? "Approving..." : " Approve"}
                        </button>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="action-btn" onClick={() => setAction(action === "schedule" ? null : "schedule")}
                            style={{ background: action === "schedule" ? "#b45309" : "#fef3c7", color: action === "schedule" ? "#fff" : "#b45309", flex: 1 }}>
                             Schedule
                          </button>
                          <button className="action-btn" onClick={() => setAction(action === "reject" ? null : "reject")}
                            style={{ background: action === "reject" ? "#ef4444" : "#fee2e2", color: action === "reject" ? "#fff" : "#ef4444", flex: 1 }}>
                             Reject
                          </button>
                        </div>
                        {(action === "reject" || action === "schedule") && (
                          <button className="action-btn" onClick={submitAction} disabled={saving}
                            style={{ background: "var(--primary)", color: "#fff" }}>
                            {saving ? "Saving..." : `Confirm ${action}`}
                          </button>
                        )}
                      </div>
                    )}

                    {selected.status !== "draft" && (
                      <div style={{ marginTop: 16, padding: 12, background: "var(--surface-soft)", borderRadius: 8, fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
                        This post is {selected.status}.
                        {selected.rejection_reason && <div style={{ marginTop: 6, color: "#ef4444" }}>Reason: {selected.rejection_reason}</div>}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
