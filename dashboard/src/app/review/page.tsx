"use client";

import { useEffect, useState } from "react";
import { useToast } from "../components/ToastProvider";

type Tab = "smo" | "ci";
type CiSubTab = "calendar" | "competitor";

const API = process.env.NEXT_PUBLIC_API_URL;
const token = () => typeof window !== "undefined" ? localStorage.getItem("access_token") : "";
const authHeader = () => ({ Authorization: `Bearer ${token()}`, "Content-Type": "application/json" });

const PLATFORM_COLORS: Record<string, { bg: string; color: string }> = {
  LinkedIn:  { bg: "#e8f0fe", color: "#1a5bbf" },
  Facebook:  { bg: "#e8f4fd", color: "#1877f2" },
  Instagram: { bg: "#fce4ec", color: "#c2185b" },
  Twitter:   { bg: "#e8f8fd", color: "#1da1f2" },
};

const BRAND_LABELS: Record<string, string> = {
  hcllp: "HCLLP",
  blue_arrow_cpa: "Blue Arrow CPA",
  advisory: "Advisory",
  consulting: "Consulting",
};

function PlatformBadge({ platform }: { platform: string }) {
  const style = PLATFORM_COLORS[platform] || { bg: "var(--surface-soft)", color: "var(--ink)" };
  return (
    <span style={{ padding: "3px 10px", background: style.bg, color: style.color, borderRadius: "20px", fontSize: "12px", fontWeight: 600 }}>
      {platform}
    </span>
  );
}

function BrandBadge({ brand }: { brand: string }) {
  return (
    <span style={{ padding: "4px 10px", background: "var(--surface-soft)", color: "var(--primary-active)", borderRadius: "6px", fontSize: "12px", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase" }}>
      {BRAND_LABELS[brand] || brand}
    </span>
  );
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div style={{ marginBottom: "6px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--muted)", marginBottom: "3px" }}>
        <span>{label}</span><span style={{ fontWeight: 700, color }}>{score}</span>
      </div>
      <div style={{ height: "4px", background: "var(--hairline)", borderRadius: "2px" }}>
        <div style={{ height: "100%", width: `${score}%`, background: color, borderRadius: "2px", transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

function TabButton({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 20px",
        borderRadius: "10px",
        border: active ? "2px solid var(--primary)" : "2px solid var(--hairline)",
        background: active ? "var(--primary)" : "#fff",
        color: active ? "#fff" : "var(--ink)",
        fontWeight: 600,
        fontSize: "14px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        transition: "all 0.15s",
      }}
    >
      {label}
      <span style={{
        padding: "2px 8px",
        borderRadius: "12px",
        background: active ? "rgba(255,255,255,0.25)" : "var(--surface-soft)",
        color: active ? "#fff" : "var(--muted)",
        fontSize: "12px",
        fontWeight: 700,
        minWidth: "22px",
        textAlign: "center",
      }}>
        {count}
      </span>
    </button>
  );
}

// Safely converts any content_body value to a renderable string
function toBodyText(body: unknown): string {
  if (body == null) return "";
  // If it's a JSON string, try to parse and recurse
  if (typeof body === "string") {
    const t = body.trim();
    if (t.startsWith("[") || t.startsWith("{")) {
      try { return toBodyText(JSON.parse(t)); } catch {}
    }
    return body;
  }
  // Array of slides (carousel format)
  if (Array.isArray(body)) {
    return body.map((slide: Record<string, unknown>, i: number) => {
      const title = slide.slide_title ? `Slide ${i + 1}: ${slide.slide_title}` : `Slide ${i + 1}`;
      const bullets = Array.isArray(slide.bullet_points)
        ? (slide.bullet_points as string[]).map((p: string) => `  • ${p}`).join("\n")
        : "";
      return bullets ? `${title}\n${bullets}` : title;
    }).join("\n\n");
  }
  // Single slide object
  if (typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (b.slide_title || b.bullet_points) {
      const title = b.slide_title ? `${b.slide_title}\n` : "";
      const bullets = Array.isArray(b.bullet_points)
        ? (b.bullet_points as string[]).map((p: string) => `• ${p}`).join("\n")
        : "";
      return title + bullets;
    }
    return JSON.stringify(body, null, 2);
  }
  return String(body);
}

// ─── SMO TAB ─────────────────────────────────────────────────────────────────

function SmoQueue() {
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState<Record<string, string>>({});

  const fetchQueue = async () => {
    try {
      const res = await fetch(`${API}/api/review/queue`, { headers: authHeader() });
      if (res.ok) setItems(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchQueue(); const t = setInterval(fetchQueue, 300000); return () => clearInterval(t); }, []);

  const handleApprove = async (id: string) => {
    const body: Record<string, string> = {};
    if (scheduledAt[id]) body.scheduled_at = new Date(scheduledAt[id]).toISOString();
    const res = await fetch(`${API}/api/review/approve/${id}`, { method: "POST", headers: authHeader(), body: JSON.stringify(body) });
    if (res.ok) { toast.success("Approved and queued for publishing."); setItems(items.filter(i => i._id !== id)); }
    else { const e = await res.json(); toast.error(`Error: ${e.detail || "Failed"}`); }
  };

  const handleReject = async (id: string) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;
    const res = await fetch(`${API}/api/review/reject/${id}`, { method: "POST", headers: authHeader(), body: JSON.stringify({ reason }) });
    if (res.ok) { toast.success("Rejected. Regeneration queued."); setItems(items.filter(i => i._id !== id)); }
    else toast.error("Failed to reject.");
  };

  const handleSaveEdit = async (id: string) => {
    const res = await fetch(`${API}/api/review/edit/${id}`, { method: "PUT", headers: authHeader(), body: JSON.stringify({ content_body: editBody }) });
    if (res.ok) { toast.success("Edit saved."); setItems(items.map(i => i._id === id ? { ...i, content_body: editBody } : i)); setEditingId(null); }
    else toast.error("Failed to save edit.");
  };

  if (loading) return <LoadingSkeleton />;
  if (!items.length) return <EmptyState message="No SMO posts pending review." />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {items.map(item => {
        const isBlueArrow = item.brand === "blue_arrow_cpa";
        const isLocked = isBlueArrow && !item.designer_approved;
        const score = item.ai_prescore?.score ?? 0;
        const isEditing = editingId === item._id;
        const platforms: string[] = Array.isArray(item.platform) ? item.platform : [];

        return (
          <div key={item._id} className="rv-card" style={{ background: "#fff", border: "1px solid var(--hairline)", borderRadius: "16px", padding: "32px", boxShadow: "0 4px 24px rgba(0,0,0,0.03)", display: "flex", gap: "24px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
                <BrandBadge brand={item.brand} />
                {platforms.map((p: string) => <PlatformBadge key={p} platform={p} />)}
                {item.format && <span style={{ padding: "3px 10px", background: "var(--surface-soft)", color: "var(--muted)", borderRadius: "20px", fontSize: "12px", fontWeight: 500 }}>{item.format}</span>}
                <span style={{ marginLeft: "auto", fontSize: "13px", fontWeight: 700, color: score >= 90 ? "var(--success)" : score >= 70 ? "var(--warning)" : "var(--danger)" }}>
                  AI Score: {score}/100
                </span>
              </div>

              {(item.faq_num != null || item.tagline_num != null) && (
                <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                  {item.faq_num != null && <span style={{ padding: "3px 10px", background: "rgba(232,165,90,0.12)", color: "var(--accent-amber)", borderRadius: "20px", fontSize: "12px", fontWeight: 600 }}>FAQ #{item.faq_num}</span>}
                  {item.tagline_num != null && <span style={{ padding: "3px 10px", background: "rgba(93,184,166,0.12)", color: "var(--accent-teal)", borderRadius: "20px", fontSize: "12px", fontWeight: 600 }}>Tagline #{item.tagline_num}</span>}
                </div>
              )}

              {isEditing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <textarea className="input-field" value={editBody} onChange={e => setEditBody(e.target.value)} style={{ height: "200px", resize: "vertical" }} />
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button className="btn-primary" onClick={() => handleSaveEdit(item._id)}>Save Edit</button>
                    <button className="btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ whiteSpace: "pre-wrap", color: "var(--ink)", fontSize: "15px", lineHeight: 1.7, background: "var(--canvas)", border: "1px solid var(--hairline)", borderRadius: "10px", padding: "16px 20px" }}>
                  {toBodyText(item.content_body)}
                </div>
              )}

              {isBlueArrow && (
                <div style={{ marginTop: "16px", padding: "12px 16px", background: isLocked ? "var(--surface-soft)" : "rgba(93,184,166,0.08)", borderRadius: "8px", border: `1px solid ${isLocked ? "var(--hairline)" : "rgba(93,184,166,0.25)"}`, display: "flex", alignItems: "center", gap: "10px" }}>
                  <span>{isLocked ? "⏳" : "✅"}</span>
                  <span style={{ fontSize: "13px", fontWeight: 500, color: isLocked ? "var(--muted)" : "var(--success)" }}>{isLocked ? "Waiting for Designer review" : "Designer approved"}</span>
                </div>
              )}

              {item.format?.toLowerCase() === "blog" && (
                <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px dashed var(--hairline)" }}>
                  <CascadePreview contentId={item._id} />
                </div>
              )}
            </div>

            <ActionSidebar
              scheduledAt={scheduledAt[item._id] ?? (item.scheduled_at ? new Date(item.scheduled_at).toISOString().slice(0, 16) : "")}
              onScheduleChange={v => setScheduledAt(prev => ({ ...prev, [item._id]: v }))}
              onApprove={isLocked ? undefined : () => handleApprove(item._id)}
              onEdit={() => { setEditBody(toBodyText(item.content_body)); setEditingId(item._id); }}
              onReject={() => handleReject(item._id)}
              locked={isLocked}
              lockedLabel={isBlueArrow ? (isLocked ? "⏳ Waiting for Designer" : "✅ Designer approved") : undefined}
              lockedColor={isBlueArrow && !isLocked ? "var(--success)" : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── COMPETITOR TAB ───────────────────────────────────────────────────────────

function CompetitorQueue() {
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState<Record<number, string>>({});

  const fetchQueue = async () => {
    try {
      const res = await fetch(`${API}/api/review/queue/competitor`, { headers: authHeader() });
      if (res.ok) setItems(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchQueue(); }, []);

  const handleApprove = async (id: number) => {
    const body: Record<string, string> = {};
    if (scheduledAt[id]) body.scheduled_at = new Date(scheduledAt[id]).toISOString();
    const res = await fetch(`${API}/api/review/competitor/approve/${id}`, { method: "POST", headers: authHeader(), body: JSON.stringify(body) });
    if (res.ok) { toast.success("Competitor post approved."); setItems(items.filter(i => i.id !== id)); }
    else { const e = await res.json(); toast.error(`Error: ${e.detail || "Failed"}`); }
  };

  const handleReject = async (id: number) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;
    const res = await fetch(`${API}/api/review/competitor/reject/${id}`, { method: "POST", headers: authHeader(), body: JSON.stringify({ reason }) });
    if (res.ok) { toast.success("Post rejected."); setItems(items.filter(i => i.id !== id)); }
    else toast.error("Failed to reject.");
  };

  const handleSaveEdit = async (id: number) => {
    const res = await fetch(`${API}/api/review/competitor/edit/${id}`, { method: "PUT", headers: authHeader(), body: JSON.stringify({ content_body: editBody }) });
    if (res.ok) { toast.success("Edit saved."); setItems(items.map(i => i.id === id ? { ...i, content: editBody } : i)); setEditingId(null); }
    else toast.error("Failed to save edit.");
  };

  if (loading) return <LoadingSkeleton />;
  if (!items.length) return <EmptyState message="No competitor intelligence posts pending review. Run the CI pipeline to generate posts." />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {items.map(item => {
        const isEditing = editingId === item.id;
        const avgScore = item.avg_quality ?? 0;

        return (
          <div key={item.id} className="rv-card" style={{ background: "#fff", border: "1px solid var(--hairline)", borderRadius: "16px", padding: "32px", boxShadow: "0 4px 24px rgba(0,0,0,0.03)", display: "flex", gap: "24px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>

              {/* Header row */}
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
                <BrandBadge brand={item.brand} />
                <PlatformBadge platform={item.platform} />
                <span style={{ padding: "3px 10px", background: "rgba(114,75,180,0.08)", color: "#7249b4", borderRadius: "20px", fontSize: "12px", fontWeight: 600 }}>
                  Competitor Intel
                </span>
                <span style={{ marginLeft: "auto", fontSize: "13px", fontWeight: 700, color: avgScore >= 80 ? "var(--success)" : avgScore >= 60 ? "var(--warning)" : "var(--danger)" }}>
                  Avg Quality: {avgScore}/100
                </span>
              </div>

              {/* Inspired by badge */}
              {item.competitor_names?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
                  <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600, alignSelf: "center" }}>Inspired by:</span>
                  {item.competitor_names.map((name: string) => (
                    <span key={name} style={{ padding: "3px 10px", background: "rgba(114,75,180,0.08)", color: "#7249b4", borderRadius: "20px", fontSize: "12px", fontWeight: 600 }}>{name}</span>
                  ))}
                </div>
              )}

              {/* Headline */}
              {item.headline && (
                <div style={{ fontWeight: 700, fontSize: "15px", color: "var(--ink)", marginBottom: "10px" }}>
                  {item.headline}
                </div>
              )}

              {/* Content body */}
              {isEditing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <textarea className="input-field" value={editBody} onChange={e => setEditBody(e.target.value)} style={{ height: "200px", resize: "vertical" }} />
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button className="btn-primary" onClick={() => handleSaveEdit(item.id)}>Save Edit</button>
                    <button className="btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ whiteSpace: "pre-wrap", color: "var(--ink)", fontSize: "15px", lineHeight: 1.7, background: "var(--canvas)", border: "1px solid var(--hairline)", borderRadius: "10px", padding: "16px 20px", marginBottom: "14px" }}>
                  {item.content}
                </div>
              )}

              {/* CTA + Hashtags */}
              {(item.cta || item.hashtags) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "14px" }}>
                  {item.cta && (
                    <span style={{ padding: "4px 12px", background: "rgba(26,91,191,0.08)", color: "var(--primary)", borderRadius: "8px", fontSize: "12px", fontWeight: 600 }}>
                      CTA: {item.cta}
                    </span>
                  )}
                  {item.hashtags && (
                    <span style={{ padding: "4px 12px", background: "var(--surface-soft)", color: "var(--muted)", borderRadius: "8px", fontSize: "12px" }}>
                      {item.hashtags}
                    </span>
                  )}
                </div>
              )}

              {/* Quality score bars */}
              <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px dashed var(--hairline)" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.6px", textTransform: "uppercase", marginBottom: "10px" }}>Quality Scores</div>
                <ScoreBar label="Brand Voice" score={item.quality_brand_score} color="#1a5bbf" />
                <ScoreBar label="Originality" score={item.quality_originality_score} color="#7249b4" />
                <ScoreBar label="Readability" score={item.quality_readability_score} color="var(--accent-teal)" />
              </div>
            </div>

            <ActionSidebar
              scheduledAt={scheduledAt[item.id] ?? (item.scheduled_at ? new Date(item.scheduled_at).toISOString().slice(0, 16) : "")}
              onScheduleChange={v => setScheduledAt(prev => ({ ...prev, [item.id]: v }))}
              onApprove={() => handleApprove(item.id)}
              onEdit={() => { setEditBody(item.content); setEditingId(item.id); }}
              onReject={() => handleReject(item.id)}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── CALENDAR TAB ─────────────────────────────────────────────────────────────

function CalendarQueue() {
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState<Record<number, string>>({});

  const fetchQueue = async () => {
    try {
      const res = await fetch(`${API}/api/review/queue/calendar`, { headers: authHeader() });
      if (res.ok) setItems(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchQueue(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${API}/api/ci/calendar/generate`, { method: "POST", headers: authHeader(), body: JSON.stringify({}) });
      if (res.ok) {
        const data = await res.json();
        if (data.generated === 0) {
          toast.error(data.message || "No upcoming calendar events found in the next 30 days.");
        } else {
          toast.success(`Generated ${data.generated} calendar post(s) for ${data.events_processed} event(s).`);
          setLoading(true);
          fetchQueue();
        }
      } else {
        const e = await res.json();
        toast.error(`Error: ${e.detail || "Generation failed"}`);
      }
    } catch (e) { toast.error("Network error during generation."); }
    finally { setGenerating(false); }
  };

  const handleApprove = async (id: number) => {
    const body: Record<string, string> = {};
    if (scheduledAt[id]) body.scheduled_at = new Date(scheduledAt[id]).toISOString();
    const res = await fetch(`${API}/api/review/competitor/approve/${id}`, { method: "POST", headers: authHeader(), body: JSON.stringify(body) });
    if (res.ok) { toast.success("Calendar post approved."); setItems(items.filter(i => i.id !== id)); }
    else { const e = await res.json(); toast.error(`Error: ${e.detail || "Failed"}`); }
  };

  const handleReject = async (id: number) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;
    const res = await fetch(`${API}/api/review/competitor/reject/${id}`, { method: "POST", headers: authHeader(), body: JSON.stringify({ reason }) });
    if (res.ok) { toast.success("Rejected."); setItems(items.filter(i => i.id !== id)); }
    else toast.error("Failed to reject.");
  };

  const handleSaveEdit = async (id: number) => {
    const res = await fetch(`${API}/api/review/competitor/edit/${id}`, { method: "PUT", headers: authHeader(), body: JSON.stringify({ content_body: editBody }) });
    if (res.ok) { toast.success("Edit saved."); setItems(items.map(i => i.id === id ? { ...i, content: editBody } : i)); setEditingId(null); }
    else toast.error("Failed to save edit.");
  };

  const GenerateButton = () => (
    <button
      onClick={handleGenerate}
      disabled={generating}
      style={{ padding: "8px 18px", borderRadius: "8px", border: "1.5px solid rgba(13,148,136,0.4)", background: generating ? "var(--surface-soft)" : "rgba(13,148,136,0.08)", color: "#0d9488", fontWeight: 600, fontSize: "13px", cursor: generating ? "not-allowed" : "pointer" }}
    >
      {generating ? "Generating..." : "📅 Generate Calendar Posts"}
    </button>
  );

  if (loading) return <LoadingSkeleton />;

  if (!items.length) return (
    <div style={{ padding: "60px 40px", textAlign: "center", background: "#fff", border: "1px solid var(--hairline)", borderRadius: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
      <p style={{ color: "var(--muted)", fontSize: "15px", marginBottom: "20px" }}>No calendar posts pending review.</p>
      <GenerateButton />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <GenerateButton />
      </div>
      {items.map(item => {
        const isEditing = editingId === item.id;
        const avgScore = item.avg_quality ?? 0;

        return (
          <div key={item.id} className="rv-card" style={{ background: "#fff", border: "1px solid rgba(13,148,136,0.2)", borderLeft: "3px solid #0d9488", borderRadius: "16px", padding: "32px", boxShadow: "0 4px 24px rgba(0,0,0,0.03)", display: "flex", gap: "24px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>

              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
                <BrandBadge brand={item.brand} />
                <PlatformBadge platform={item.platform.charAt(0).toUpperCase() + item.platform.slice(1)} />
                <span style={{ padding: "3px 10px", background: "rgba(93,184,166,0.12)", color: "#0d9488", borderRadius: "20px", fontSize: "12px", fontWeight: 600 }}>
                  📅 Calendar Event
                </span>
                <span style={{ marginLeft: "auto", fontSize: "13px", fontWeight: 700, color: avgScore >= 80 ? "var(--success)" : avgScore >= 60 ? "var(--warning)" : "var(--danger)" }}>
                  Avg Quality: {avgScore}/100
                </span>
              </div>

              {/* Event name */}
              {item.calendar_event_name && (
                <div style={{ padding: "10px 14px", background: "rgba(93,184,166,0.06)", border: "1px solid rgba(93,184,166,0.2)", borderRadius: "8px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "16px" }}>📅</span>
                  <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--ink)" }}>{item.calendar_event_name}</div>
                </div>
              )}

              {/* Headline */}
              {item.headline && (
                <div style={{ fontWeight: 700, fontSize: "15px", color: "var(--ink)", marginBottom: "10px" }}>
                  {item.headline}
                </div>
              )}

              {/* Content */}
              {isEditing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <textarea className="input-field" value={editBody} onChange={e => setEditBody(e.target.value)} style={{ height: "200px", resize: "vertical" }} />
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button className="btn-primary" onClick={() => handleSaveEdit(item.id)}>Save Edit</button>
                    <button className="btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ whiteSpace: "pre-wrap", color: "var(--ink)", fontSize: "15px", lineHeight: 1.7, background: "var(--canvas)", border: "1px solid var(--hairline)", borderRadius: "10px", padding: "16px 20px", marginBottom: "14px" }}>
                  {item.content}
                </div>
              )}

              {/* CTA + Hashtags */}
              {(item.cta || item.hashtags) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "14px" }}>
                  {item.cta && (
                    <span style={{ padding: "4px 12px", background: "rgba(26,91,191,0.08)", color: "var(--primary)", borderRadius: "8px", fontSize: "12px", fontWeight: 600 }}>
                      CTA: {item.cta}
                    </span>
                  )}
                  {item.hashtags && (
                    <span style={{ padding: "4px 12px", background: "var(--surface-soft)", color: "var(--muted)", borderRadius: "8px", fontSize: "12px" }}>
                      {item.hashtags}
                    </span>
                  )}
                </div>
              )}

              {/* Quality score bars */}
              <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px dashed var(--hairline)" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.6px", textTransform: "uppercase", marginBottom: "10px" }}>Quality Scores</div>
                <ScoreBar label="Brand Voice" score={item.quality_brand_score} color="#0d9488" />
                <ScoreBar label="Originality" score={item.quality_originality_score} color="#0d9488" />
                <ScoreBar label="Readability" score={item.quality_readability_score} color="#0d9488" />
              </div>
            </div>

            <ActionSidebar
              scheduledAt={scheduledAt[item.id] ?? (item.scheduled_at ? new Date(item.scheduled_at).toISOString().slice(0, 16) : "")}
              onScheduleChange={v => setScheduledAt(prev => ({ ...prev, [item.id]: v }))}
              onApprove={() => handleApprove(item.id)}
              onEdit={() => { setEditBody(item.content); setEditingId(item.id); }}
              onReject={() => handleReject(item.id)}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────

function ActionSidebar({ scheduledAt, onScheduleChange, onApprove, onEdit, onReject, locked, lockedLabel, lockedColor }: {
  scheduledAt: string;
  onScheduleChange: (v: string) => void;
  onApprove?: () => void;
  onEdit: () => void;
  onReject: () => void;
  locked?: boolean;
  lockedLabel?: string;
  lockedColor?: string;
}) {
  return (
    <div className="rv-sidebar" style={{ width: "180px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "10px", borderLeft: "1px solid var(--hairline)", paddingLeft: "24px" }}>
      <div style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.5, marginBottom: "8px" }}>
        <label style={{ display: "block", marginBottom: "4px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", fontSize: "11px" }}>Publish At</label>
        <input type="datetime-local" className="input-field" style={{ fontSize: "12px", padding: "6px 8px", width: "100%" }} value={scheduledAt} onChange={e => onScheduleChange(e.target.value)} />
      </div>

      {lockedLabel && (
        <div style={{ padding: "8px 10px", background: lockedColor ? "rgba(93,184,166,0.08)" : "var(--surface-soft)", borderRadius: "8px", border: `1px solid ${lockedColor ? "rgba(93,184,166,0.25)" : "var(--hairline)"}`, fontSize: "12px", fontWeight: 600, color: lockedColor || "var(--muted)", display: "flex", alignItems: "center", gap: "6px" }}>
          {lockedLabel}
        </div>
      )}

      <button
        className="btn-primary"
        onClick={locked ? undefined : onApprove}
        disabled={locked || !onApprove}
        style={locked ? { opacity: 0.4, cursor: "not-allowed", pointerEvents: "none" } : {}}
      >
        Approve
      </button>
      <button className="btn-ghost" onClick={onEdit}>Edit Inline</button>
      <button className="btn-ghost" style={{ color: "var(--error)", borderColor: "rgba(198,69,69,0.2)" }} onClick={onReject}>Reject</button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {[1, 2].map(i => (
        <div key={i} style={{ background: "#fff", border: "1px solid var(--hairline)", borderRadius: "16px", padding: "32px", boxShadow: "0 4px 24px rgba(0,0,0,0.03)" }}>
          <div className="skeleton" style={{ width: "120px", height: "24px", marginBottom: "20px" }} />
          <div className="skeleton" style={{ width: "100%", height: "16px", marginBottom: "8px" }} />
          <div className="skeleton" style={{ width: "80%", height: "16px" }} />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ padding: "60px 40px", textAlign: "center", background: "#fff", border: "1px solid var(--hairline)", borderRadius: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
      <p style={{ color: "var(--muted)", fontSize: "15px" }}>{message}</p>
    </div>
  );
}

function CascadePreview({ contentId }: { contentId: string }) {
  const [cascade, setCascade] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/api/review/cascade-preview/${contentId}`, { headers: authHeader() });
        if (res.ok) setCascade(await res.json());
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [contentId]);

  if (loading) return <div style={{ fontSize: "13px", color: "var(--muted)" }}>Loading cascade timeline...</div>;
  if (!cascade.length) return null;

  return (
    <div>
      <h4 style={{ fontSize: "12px", fontWeight: 700, marginBottom: "14px", color: "var(--muted)", letterSpacing: "0.8px", textTransform: "uppercase" }}>Blog Cascade Timeline</h4>
      <div style={{ display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "8px" }}>
        {cascade.map((c, idx) => (
          <div key={idx} style={{ minWidth: "150px", padding: "14px", background: "var(--canvas)", border: "1px solid var(--hairline)", borderRadius: "10px", fontSize: "13px" }}>
            <div style={{ fontWeight: 700, color: "var(--accent-teal)", marginBottom: "4px" }}>Day {c.day_offset === 0 ? "0" : `+${c.day_offset}`}</div>
            <div style={{ fontWeight: 600, color: "var(--ink)", marginBottom: "4px" }}>{c.platform}</div>
            <div style={{ color: "var(--muted)", lineHeight: 1.4 }}>{c.content_summary}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function ReviewQueue() {
  const [activeTab, setActiveTab] = useState<Tab>("smo");
  const [ciSubTab, setCiSubTab] = useState<CiSubTab>("calendar");
  const [counts, setCounts] = useState({ smo: 0, calendar: 0, competitor: 0 });

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [smoRes, calRes, compRes] = await Promise.all([
          fetch(`${API}/api/review/queue`, { headers: authHeader() }),
          fetch(`${API}/api/review/queue/calendar`, { headers: authHeader() }),
          fetch(`${API}/api/review/queue/competitor`, { headers: authHeader() }),
        ]);
        const [smo, cal, comp] = await Promise.all([smoRes.json(), calRes.json(), compRes.json()]);
        setCounts({
          smo: Array.isArray(smo) ? smo.length : 0,
          calendar: Array.isArray(cal) ? cal.length : 0,
          competitor: Array.isArray(comp) ? comp.length : 0,
        });
      } catch (e) { console.error(e); }
    };
    fetchCounts();
  }, []);

  const ciTotal = counts.calendar + counts.competitor;
  const total = counts.smo + ciTotal;

  return (
    <div className="page-container" style={{ maxWidth: 1000 }}>
      <style>{`
        @media (max-width: 768px) {
          .rv-card { flex-direction: column !important; padding: 20px !important; }
          .rv-sidebar { width: 100% !important; border-left: none !important; border-top: 1px solid var(--hairline) !important; padding-left: 0 !important; padding-top: 16px !important; margin-top: 16px !important; flex-wrap: wrap !important; }
          .rv-sidebar button { flex: 1 1 auto !important; }
          .rv-tabs { flex-wrap: wrap !important; }
        }
        .subtab-btn {
          padding: 8px 18px;
          border-radius: 8px;
          border: 1.5px solid var(--hairline);
          background: #fff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 7px;
          transition: all 0.15s;
          color: var(--ink);
        }
        .subtab-btn.cal.active { background: #ccfbf1; border-color: #0d9488; color: #0d9488; }
        .subtab-btn.comp.active { background: #ede9fe; border-color: #7c3aed; color: #7c3aed; }
        .subtab-count {
          padding: 1px 7px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 700;
        }
      `}</style>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "28px" }}>
        <h1 className="font-serif" style={{ fontSize: "36px", fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.5px" }}>Review Queue</h1>
        {total > 0 && <span style={{ fontSize: "14px", color: "var(--muted)" }}>{total} item{total !== 1 ? "s" : ""} pending</span>}
      </div>

      {/* Primary tabs */}
      <div className="rv-tabs" style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <TabButton label="SMO Posts" count={counts.smo} active={activeTab === "smo"} onClick={() => setActiveTab("smo")} />
        <TabButton label="CI Generated" count={ciTotal} active={activeTab === "ci"} onClick={() => setActiveTab("ci")} />
      </div>

      {/* SMO description */}
      {activeTab === "smo" && (
        <div style={{ marginBottom: "24px", padding: "10px 16px", background: "var(--surface-soft)", borderRadius: "8px", fontSize: "13px", color: "var(--muted)" }}>
          Weekly AI-generated social posts from the SMO agent — built from your FAQ library and brand taglines.
        </div>
      )}

      {/* CI sub-tabs */}
      {activeTab === "ci" && (
        <div style={{ marginBottom: "24px", background: "var(--surface-soft)", borderRadius: "12px", padding: "16px 20px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "12px" }}>
            Select post type to review:
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              className={`subtab-btn cal${ciSubTab === "calendar" ? " active" : ""}`}
              onClick={() => setCiSubTab("calendar")}
            >
              <span>📅 Calendar Posts</span>
              <span className="subtab-count" style={{
                background: ciSubTab === "calendar" ? "#0d9488" : "var(--hairline)",
                color: ciSubTab === "calendar" ? "#fff" : "var(--muted)",
              }}>
                {counts.calendar}
              </span>
            </button>
            <button
              className={`subtab-btn comp${ciSubTab === "competitor" ? " active" : ""}`}
              onClick={() => setCiSubTab("competitor")}
            >
              <span>🏆 Competitor Posts</span>
              <span className="subtab-count" style={{
                background: ciSubTab === "competitor" ? "#7c3aed" : "var(--hairline)",
                color: ciSubTab === "competitor" ? "#fff" : "var(--muted)",
              }}>
                {counts.competitor}
              </span>
            </button>
          </div>
          <div style={{ marginTop: "10px", fontSize: "12px", color: "var(--muted)" }}>
            {ciSubTab === "calendar" && "Posts auto-generated ahead of scheduled events — tax deadlines, campaigns, and holidays."}
            {ciSubTab === "competitor" && "Branded posts inspired by top competitor content — generated by the Competitor Intelligence pipeline."}
          </div>
        </div>
      )}

      {/* Content */}
      {activeTab === "smo" && <SmoQueue />}
      {activeTab === "ci" && ciSubTab === "calendar" && <CalendarQueue />}
      {activeTab === "ci" && ciSubTab === "competitor" && <CompetitorQueue />}
    </div>
  );
}
