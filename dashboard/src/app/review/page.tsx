"use client";

import { useEffect, useState } from "react";
import { useToast } from "../components/ToastProvider";

const PLATFORM_COLORS: Record<string, { bg: string; color: string }> = {
  LinkedIn:  { bg: "#e8f0fe", color: "#1a5bbf" },
  Facebook:  { bg: "#e8f4fd", color: "#1877f2" },
  Instagram: { bg: "#fce4ec", color: "#c2185b" },
};

function PlatformBadge({ platform }: { platform: string }) {
  const style = PLATFORM_COLORS[platform] || { bg: "var(--surface-soft)", color: "var(--ink)" };
  return (
    <span style={{
      padding: "3px 10px",
      background: style.bg,
      color: style.color,
      borderRadius: "20px",
      fontSize: "12px",
      fontWeight: 600,
    }}>
      {platform}
    </span>
  );
}

export default function ReviewQueue() {
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState<Record<string, string>>({});

  const fetchQueue = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/review/queue`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 300000); // 5 min
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (id: string) => {
    const token = localStorage.getItem("access_token");
    const scheduled = scheduledAt[id];
    const body: Record<string, string> = {};
    if (scheduled) body.scheduled_at = new Date(scheduled).toISOString();
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/review/approve/${id}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      toast.success("Content approved and queued for publishing.");
      setItems(items.filter(i => i._id !== id));
    } else {
      const err = await res.json();
      toast.error(`Error: ${err.detail || err.message || "Failed to approve"}`);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;

    const token = localStorage.getItem("access_token");
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/review/reject/${id}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ reason })
    });
    if (res.ok) {
      toast.success("Rejected. Regeneration queued.");
      setItems(items.filter(i => i._id !== id));
    } else {
      toast.error("Failed to reject item.");
    }
  };

  const handleSaveEdit = async (id: string) => {
    const token = localStorage.getItem("access_token");
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/review/edit/${id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ content_body: editBody })
    });
    if (res.ok) {
      toast.success("Edit saved.");
      setItems(items.map(i => i._id === id ? { ...i, content_body: editBody } : i));
      setEditingId(null);
    } else {
      toast.error("Failed to save edit.");
    }
  };

  if (loading) return (
    <div className="page-container" style={{ maxWidth: 1000 }}>
      <h1 className="font-serif" style={{ fontSize: "36px", fontWeight: 500, marginBottom: "32px", color: "var(--ink)", letterSpacing: "-0.5px" }}>Review Queue</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="card-row" style={{ background: "#ffffff", border: "1px solid var(--hairline)", borderRadius: "16px", padding: "32px", boxShadow: "0 4px 24px rgba(0,0,0,0.03)" }}>
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ width: "120px", height: "24px", marginBottom: "20px" }} />
              <div className="skeleton" style={{ width: "100%", height: "16px", marginBottom: "8px" }} />
              <div className="skeleton" style={{ width: "100%", height: "16px", marginBottom: "8px" }} />
              <div className="skeleton" style={{ width: "80%", height: "16px", marginBottom: "24px" }} />
              <div style={{ display: "flex", gap: "12px" }}>
                <div className="skeleton" style={{ width: "100px", height: "40px" }} />
                <div className="skeleton" style={{ width: "100px", height: "40px" }} />
              </div>
            </div>
            <div style={{ width: "200px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="skeleton" style={{ width: "100%", height: "120px" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="page-container" style={{ maxWidth: 1000 }}>
      <style>{`
        @media (max-width: 768px) {
          .rv-title-row { flex-wrap: wrap !important; gap: 8px !important; }
          .rv-header { font-size: 28px !important; }
          .rv-card { flex-direction: column !important; padding: 20px !important; }
          .rv-sidebar { width: 100% !important; border-left: none !important; border-top: 1px solid var(--hairline) !important; padding-left: 0 !important; padding-top: 16px !important; margin-top: 16px !important; flex-wrap: wrap !important; }
          .rv-sidebar > div:first-child { width: 100% !important; }
          .rv-sidebar button { flex: 1 1 auto !important; min-width: 0 !important; }
        }
      `}</style>
      <div className="rv-title-row" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "32px" }}>
        <h1 className="font-serif rv-header" style={{ fontSize: "36px", fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.5px" }}>
          Review Queue
        </h1>
        {items.length > 0 && (
          <span style={{ fontSize: "14px", color: "var(--muted)" }}>
            {items.length} item{items.length !== 1 ? "s" : ""} pending
          </span>
        )}
      </div>

      {items.length === 0 && (
        <div style={{ padding: "60px 40px", textAlign: "center", background: "#ffffff", border: "1px solid var(--hairline)", borderRadius: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
          <p style={{ color: "var(--muted)" }}>No items pending review! 🎉</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {items.map(item => {
          const isBlueArrow = item.brand === "blue_arrow_cpa";
          const isLocked = isBlueArrow && !item.designer_approved;
          const score = item.ai_prescore?.score ?? 0;
          const isEditing = editingId === item._id;
          const platforms: string[] = Array.isArray(item.platform) ? item.platform : [];

          return (
            <div key={item._id} className="rv-card" style={{
              background: "#ffffff",
              border: "1px solid var(--hairline)",
              borderRadius: "16px",
              padding: "32px",
              boxShadow: "0 4px 24px rgba(0,0,0,0.03)",
              display: "flex",
              gap: "24px",
            }}>
              {/* Left: content */}
              <div style={{ flex: 1, minWidth: 0 }}>

                {/* Row 1: brand + platforms + score */}
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
                  <span style={{
                    padding: "4px 10px",
                    background: "var(--surface-soft)",
                    color: "var(--primary-active)",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                  }}>
                    {item.brand}
                  </span>

                  {platforms.map((p: string) => <PlatformBadge key={p} platform={p} />)}

                  {item.format && (
                    <span style={{ padding: "3px 10px", background: "var(--surface-soft)", color: "var(--muted)", borderRadius: "20px", fontSize: "12px", fontWeight: 500 }}>
                      {item.format}
                    </span>
                  )}

                  <span style={{
                    marginLeft: "auto",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: score >= 90 ? "var(--success)" : score >= 70 ? "var(--warning)" : "var(--danger)",
                  }}>
                    AI Score: {score}/100
                  </span>
                </div>

                {/* Row 2: FAQ# and Tagline# metadata badges */}
                {(item.faq_num != null || item.tagline_num != null) && (
                  <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                    {item.faq_num != null && (
                      <span style={{
                        padding: "3px 10px",
                        background: "rgba(232, 165, 90, 0.12)",
                        color: "var(--accent-amber)",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}>
                        FAQ #{item.faq_num}
                      </span>
                    )}
                    {item.tagline_num != null && (
                      <span style={{
                        padding: "3px 10px",
                        background: "rgba(93, 184, 166, 0.12)",
                        color: "var(--accent-teal)",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}>
                        Tagline #{item.tagline_num}
                      </span>
                    )}
                  </div>
                )}

                {/* Post body / inline edit */}
                {isEditing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <textarea
                      className="input-field"
                      value={editBody}
                      onChange={e => setEditBody(e.target.value)}
                      style={{ height: "200px", resize: "vertical" }}
                    />
                    <div style={{ display: "flex", gap: "12px" }}>
                      <button className="btn-primary" onClick={() => handleSaveEdit(item._id)}>Save Edit</button>
                      <button className="btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    whiteSpace: "pre-wrap",
                    color: "var(--ink)",
                    fontSize: "15px",
                    lineHeight: 1.7,
                    letterSpacing: "0.2px",
                    background: "var(--canvas)",
                    border: "1px solid var(--hairline)",
                    borderRadius: "10px",
                    padding: "16px 20px",
                  }}>
                    {item.content_body}
                  </div>
                )}

                {/* Blue Arrow designer gate */}
                {isBlueArrow && (
                  <div style={{
                    marginTop: "16px",
                    padding: "12px 16px",
                    background: isLocked ? "var(--surface-soft)" : "rgba(93, 184, 166, 0.08)",
                    borderRadius: "8px",
                    border: `1px solid ${isLocked ? "var(--hairline)" : "rgba(93, 184, 166, 0.25)"}`,
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}>
                    <span style={{ fontSize: "16px" }}>{isLocked ? "⏳" : "✅"}</span>
                    <span style={{ fontSize: "13px", fontWeight: 500, color: isLocked ? "var(--muted)" : "var(--success)" }}>
                      {isLocked ? "Waiting for Designer review" : "Designer approved"}
                    </span>
                  </div>
                )}

                {/* Blog cascade timeline */}
                {item.format?.toLowerCase() === "blog" && (
                  <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px dashed var(--hairline)" }}>
                    <CascadePreview contentId={item._id} />
                  </div>
                )}
              </div>

              {/* Right: sidebar — scheduled time + actions */}
              <div className="rv-sidebar" style={{
                width: "180px",
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                borderLeft: "1px solid var(--hairline)",
                paddingLeft: "24px",
              }}>
                <div style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.5, marginBottom: "8px" }}>
                  <label style={{ display: "block", marginBottom: "4px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                    Publish At
                  </label>
                  <input
                    type="datetime-local"
                    className="input-field"
                    style={{ fontSize: "12px", padding: "6px 8px", width: "100%" }}
                    value={scheduledAt[item._id] ?? (item.scheduled_at ? new Date(item.scheduled_at).toISOString().slice(0, 16) : "")}
                    onChange={e => setScheduledAt(prev => ({ ...prev, [item._id]: e.target.value }))}
                  />
                </div>

                {isBlueArrow && (
                  <div style={{
                    padding: "8px 10px",
                    background: isLocked ? "var(--surface-soft)" : "rgba(93, 184, 166, 0.08)",
                    borderRadius: "8px",
                    border: `1px solid ${isLocked ? "var(--hairline)" : "rgba(93, 184, 166, 0.25)"}`,
                    fontSize: "12px",
                    fontWeight: 600,
                    color: isLocked ? "var(--muted)" : "var(--success)",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginBottom: "4px",
                  }}>
                    {isLocked ? "⏳ Waiting for Designer" : "✅ Designer approved"}
                  </div>
                )}

                <button
                  className="btn-primary"
                  onClick={isLocked ? undefined : () => handleApprove(item._id)}
                  disabled={isLocked}
                  style={isLocked ? { opacity: 0.4, cursor: "not-allowed", pointerEvents: "none" } : {}}
                  aria-disabled={isLocked}
                >
                  Approve
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => { setEditBody(item.content_body); setEditingId(item._id); }}
                >
                  Edit Inline
                </button>
                <button
                  className="btn-ghost"
                  style={{ color: "var(--error)", borderColor: "rgba(198, 69, 69, 0.2)" }}
                  onClick={() => handleReject(item._id)}
                >
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CascadePreview({ contentId }: { contentId: string }) {
  const [cascade, setCascade] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCascade = async () => {
      try {
        const token = localStorage.getItem("access_token");
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/review/cascade-preview/${contentId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          setCascade(await res.json());
        }
      } catch (e) {
        console.error("Failed to fetch cascade", e);
      } finally {
        setLoading(false);
      }
    };
    fetchCascade();
  }, [contentId]);

  if (loading) return <div style={{ fontSize: "13px", color: "var(--muted)" }}>Loading cascade timeline...</div>;
  if (!cascade.length) return null;

  return (
    <div>
      <h4 style={{ fontSize: "12px", fontWeight: 700, marginBottom: "14px", color: "var(--muted)", letterSpacing: "0.8px", textTransform: "uppercase" }}>
        Blog Cascade Timeline
      </h4>
      <div style={{ display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "8px" }}>
        {cascade.map((c, idx) => (
          <div key={idx} style={{
            minWidth: "150px",
            padding: "14px",
            background: "var(--canvas)",
            border: "1px solid var(--hairline)",
            borderRadius: "10px",
            fontSize: "13px",
          }}>
            <div style={{ fontWeight: 700, color: "var(--accent-teal)", marginBottom: "4px" }}>
              Day {c.day_offset === 0 ? "0" : `+${c.day_offset}`}
            </div>
            <div style={{ fontWeight: 600, color: "var(--ink)", marginBottom: "4px" }}>{c.platform}</div>
            <div style={{ color: "var(--muted)", lineHeight: 1.4 }}>{c.content_summary}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
