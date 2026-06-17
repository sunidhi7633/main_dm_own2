"use client";
import { useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

type Run = {
  id: number; triggered_by: string; status: string; step: string;
  posts_collected: number; posts_scored: number; posts_top: number;
  content_generated: number; started_at: string; completed_at: string | null; logs: string;
};
type Stats = {
  total_competitors: number; total_runs: number;
  pending_review: number; approved: number; latest_run: Run | null;
};

const STATUS_COLOR: Record<string, string> = {
  pending: "#f59e0b", running: "#3b82f6", completed: "#22c55e", failed: "#ef4444",
};
const STATUS_BG: Record<string, string> = {
  pending: "#fef3c7", running: "#dbeafe", completed: "#dcfce7", failed: "#fee2e2",
};

function StepBar({ run }: { run: Run }) {
  const steps = [
    "Collecting posts", "Scoring posts", "Selecting Top 30",
    "Analyzing trends", "Generating content", "Quality review",
  ];
  const currentIdx = run.status === "completed" ? steps.length
    : steps.findIndex(s => run.step?.toLowerCase().includes(s.toLowerCase().split(" ")[0]));

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {steps.map((s, i) => {
          const done = run.status === "completed" || i < currentIdx;
          const active = i === currentIdx && run.status === "running";
          return (
            <div key={s} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "5px 12px",
              borderRadius: 20, fontSize: 12, fontWeight: 500,
              background: done ? "#dcfce7" : active ? "#dbeafe" : "var(--surface-soft)",
              color: done ? "#15803d" : active ? "#1d4ed8" : "var(--muted)",
              border: active ? "1px solid #93c5fd" : "1px solid transparent",
            }}>
              {done ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              ) : active ? (
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", display: "inline-block", animation: "pulse 1s infinite" }} />
              ) : (
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#d1d5db", display: "inline-block" }} />
              )}
              {s}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CompetitorIntelPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [running, setRunning] = useState(false);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [schedule, setSchedule] = useState({ cron_hour: 3, cron_minute: 0, is_enabled: 0 });
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [activeRun, setActiveRun] = useState<Run | null>(null);
  const activeRunRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const token = () => typeof window !== "undefined" ? localStorage.getItem("access_token") : "";
  const h = () => ({ Authorization: `Bearer ${token()}`, "Content-Type": "application/json" });

  const fetchAll = async () => {
    try {
      const [s, r, sc] = await Promise.all([
        fetch(`${API}/api/ci/stats`, { headers: h() }).then(x => x.json()),
        fetch(`${API}/api/ci/runs?limit=10`, { headers: h() }).then(x => x.json()),
        fetch(`${API}/api/ci/schedule`, { headers: h() }).then(x => x.json()),
      ]);
      setStats(s);
      setRuns(Array.isArray(r) ? r : []);
      if (sc) setSchedule(sc);
    } catch {}
  };

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 6000);
    return () => clearInterval(iv);
  }, []);

  // Cleanup active-run polling on unmount
  useEffect(() => {
    return () => { if (activeRunRef.current) clearInterval(activeRunRef.current); };
  }, []);

  const triggerRun = async () => {
    setRunning(true);
    try {
      const res = await fetch(`${API}/api/ci/run`, { method: "POST", headers: h(), body: JSON.stringify({}) });
      const data = await res.json();
      const runId = data.run_id;

      if (runId) {
        if (activeRunRef.current) clearInterval(activeRunRef.current);

        const pollActiveRun = async () => {
          try {
            const r = await fetch(`${API}/api/ci/runs/${runId}`, { headers: h() });
            if (r.ok) {
              const run: Run = await r.json();
              setActiveRun(run);
              if (run.status === "completed" || run.status === "failed") {
                if (activeRunRef.current) clearInterval(activeRunRef.current);
                activeRunRef.current = null;
                fetchAll();
              }
            }
          } catch {}
        };

        pollActiveRun();
        activeRunRef.current = setInterval(pollActiveRun, 5000);
      }

      setTimeout(fetchAll, 1500);
    } catch {}
    finally {
      setTimeout(() => setRunning(false), 3000);
    }
  };

  const saveSchedule = async () => {
    setSavingSchedule(true);
    try {
      await fetch(`${API}/api/ci/schedule`, { method: "POST", headers: h(), body: JSON.stringify(schedule) });
    } finally { setSavingSchedule(false); }
  };

  const dismissActiveRun = () => {
    setActiveRun(null);
    if (activeRunRef.current) { clearInterval(activeRunRef.current); activeRunRef.current = null; }
  };

  const latestRun = runs[0] ?? stats?.latest_run;

  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        @keyframes slideUp { from{transform:translateY(16px);opacity:0} to{transform:translateY(0);opacity:1} }
        .ci-card { background:#fff; border:1px solid var(--hairline); border-radius:14px; padding:24px; }
        .ci-stat { background:var(--surface-soft); border-radius:12px; padding:20px; }
        .run-row { padding:12px 16px; border-radius:10px; border:1px solid var(--hairline); cursor:pointer; transition:background 150ms; margin-bottom:8px; }
        .run-row:hover { background:var(--surface-soft); }
        .run-row.selected { border-color:var(--primary); background:#fdf6f3; }
        @media (max-width:768px) {
          .ci-outer { padding:20px 16px !important; }
          .ci-header { flex-direction:column !important; align-items:flex-start !important; gap:12px !important; }
          .ci-header > div:last-child { width:100%; }
          .ci-header > div:last-child > button { flex:1; }
          .ci-stats { grid-template-columns:repeat(2,1fr) !important; }
          .ci-main { grid-template-columns:1fr !important; }
          .ci-card { padding:16px !important; }
          .ci-run-counts { grid-template-columns:repeat(2,1fr) !important; }
          .ci-toast { width:calc(100vw - 32px) !important; left:16px !important; right:16px !important; }
        }
      `}</style>

      {/* Active-run progress toast */}
      {activeRun && (
        <div className="ci-toast" style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 1000, width: 320,
          background: "#fff", borderRadius: 14, padding: "16px 20px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.05)",
          animation: "slideUp 200ms ease",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                Pipeline Run #{activeRun.id}
              </div>
              <span style={{
                display: "inline-block", marginTop: 4,
                padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: STATUS_BG[activeRun.status] || "#f3f4f6",
                color: STATUS_COLOR[activeRun.status] || "#6b7280",
              }}>
                {activeRun.status.toUpperCase()}
              </span>
            </div>
            <button onClick={dismissActiveRun}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--muted)", lineHeight: 1, padding: 0 }}>
              ×
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
            {[
              ["Collected", activeRun.posts_collected],
              ["Scored", activeRun.posts_scored],
              ["Top", activeRun.posts_top],
              ["Generated", activeRun.content_generated],
            ].map(([label, val]) => (
              <div key={label as string} style={{ padding: "6px 10px", background: "var(--surface-soft)", borderRadius: 6, textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{val ?? 0}</div>
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>{label}</div>
              </div>
            ))}
          </div>

          <StepBar run={activeRun} />

          {activeRun.step && activeRun.status === "running" && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#3b82f6", fontWeight: 500 }}>
              â†³ {activeRun.step}
            </div>
          )}

          {(activeRun.status === "completed" || activeRun.status === "failed") && (
            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {activeRun.status === "completed" && (
                <a href="/competitor-intel/generated" style={{ fontSize: 12, color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}>
                  Review content â†’
                </a>
              )}
              <button onClick={dismissActiveRun} style={{ fontSize: 12, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", marginLeft: "auto" }}>
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}

      <div className="ci-outer" style={{ padding: "32px 40px", maxWidth: 1200, margin: "0 auto" }}>

        {/* Header */}
        <div className="ci-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--ink)", margin: 0 }}>Competitor Intelligence</h1>
            <p style={{ fontSize: 14, color: "var(--muted)", margin: "4px 0 0" }}>
              Monitor competitors · Analyze trends · Generate branded content
            </p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <a href="/competitor-intel/competitors" style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid var(--hairline)", background: "#fff", color: "var(--ink)", fontSize: 13, fontWeight: 500, textDecoration: "none" }}>
              Manage Competitors
            </a>
            <button onClick={triggerRun} disabled={running} style={{
              padding: "9px 20px", borderRadius: 8, border: "none",
              background: running ? "#d1ccc6" : "var(--primary)", color: "#fff",
              fontSize: 13, fontWeight: 600, cursor: running ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              {running ? (
                <><span style={{ width: 10, height: 10, borderRadius: "50%", background: "#fff", opacity: 0.6, animation: "pulse 1s infinite", display: "inline-block" }} />Running...</>
              ) : (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>Run Analysis Now</>
              )}
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="ci-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
          {[
            { label: "Competitors Monitored", value: stats?.total_competitors ?? 0, icon: "" },
            { label: "Pipeline Runs", value: stats?.total_runs ?? 0, icon: "" },
            { label: "Pending Review", value: stats?.pending_review ?? 0, icon: "", link: "/competitor-intel/generated" },
            { label: "Approved Posts", value: stats?.approved ?? 0, icon: "" },
          ].map(s => (
            <div key={s.label} className="ci-stat" style={{ cursor: s.link ? "pointer" : "default" }}
              onClick={() => s.link && (window.location.href = s.link)}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ink)" }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div className="ci-main" style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20 }}>

          {/* Left â€” latest run + history */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Latest run */}
            {latestRun && (
              <div className="ci-card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>Latest Pipeline Run</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <a href="/competitor-intel/top-posts" style={{ fontSize: 12, color: "var(--primary)", textDecoration: "none", fontWeight: 500 }}>Top Posts â†’</a>
                    <a href="/competitor-intel/generated" style={{ fontSize: 12, color: "var(--primary)", textDecoration: "none", fontWeight: 500 }}>Review Content â†’</a>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <span style={{
                    padding: "3px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: STATUS_BG[latestRun.status] || "#f3f4f6",
                    color: STATUS_COLOR[latestRun.status] || "#6b7280",
                  }}>{latestRun.status.toUpperCase()}</span>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>Run #{latestRun.id} · by {latestRun.triggered_by}</span>
                  <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>
                    {latestRun.started_at ? new Date(latestRun.started_at).toLocaleString() : ""}
                  </span>
                </div>
                <div className="ci-run-counts" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
                  {[
                    ["Posts Collected", latestRun.posts_collected],
                    ["Posts Scored", latestRun.posts_scored],
                    ["Top Posts", latestRun.posts_top],
                    ["Content Generated", latestRun.content_generated],
                  ].map(([label, val]) => (
                    <div key={label as string} style={{ textAlign: "center", padding: "10px 0", background: "var(--surface-soft)", borderRadius: 8 }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)" }}>{val}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{label}</div>
                    </div>
                  ))}
                </div>
                <StepBar run={latestRun} />
                {latestRun.step && latestRun.status === "running" && (
                  <div style={{ marginTop: 12, fontSize: 12, color: "#3b82f6", fontWeight: 500 }}>
                    â†³ {latestRun.step}
                  </div>
                )}
              </div>
            )}

            {!latestRun && (
              <div className="ci-card" style={{ textAlign: "center", padding: 48 }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}></div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>No runs yet</div>
                <div style={{ fontSize: 14, color: "var(--muted)", marginBottom: 24 }}>Click "Run Analysis Now" to start your first competitor intelligence pipeline.</div>
                <button onClick={triggerRun} disabled={running} style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  Run Analysis Now
                </button>
              </div>
            )}

            {/* Run history */}
            {runs.length > 1 && (
              <div className="ci-card">
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 16 }}>Run History</div>
                {runs.slice(1).map(r => (
                  <div key={r.id} className={`run-row${selectedRun?.id === r.id ? " selected" : ""}`}
                    onClick={() => setSelectedRun(r.id === selectedRun?.id ? null : r)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                        background: STATUS_COLOR[r.status] || "#d1d5db",
                      }} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>Run #{r.id}</span>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>by {r.triggered_by}</span>
                      <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>
                        {r.started_at ? new Date(r.started_at).toLocaleDateString() : ""}
                      </span>
                      <span style={{ fontSize: 12, color: STATUS_COLOR[r.status] || "var(--muted)", fontWeight: 600 }}>
                        {r.status}
                      </span>
                    </div>
                    {selectedRun?.id === r.id && r.logs && (
                      <pre style={{ marginTop: 12, fontSize: 11, color: "var(--muted)", background: "var(--surface-soft)", borderRadius: 8, padding: 12, whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto" }}>
                        {r.logs}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Quick links */}
            <div className="ci-card">
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 16 }}>Quick Access</div>
              {[
                { href: "/competitor-intel/competitors", icon: "", label: "Competitor List", sub: "Add / manage competitors" },
                { href: "/competitor-intel/top-posts", icon: "", label: "Top Posts", sub: "Highest-performing content" },
                { href: "/competitor-intel/generated", icon: "", label: "Review Queue", sub: "Approve or reject generated posts" },
                { href: "/competitor-intel/calendar", icon: "", label: "Content Calendar", sub: "Monthly events for AI content" },
              ].map(l => (
                <a key={l.href} href={l.href} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 10, textDecoration: "none", marginBottom: 6, transition: "background 150ms", background: "var(--surface-soft)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f0ebe5")}
                  onMouseLeave={e => (e.currentTarget.style.background = "var(--surface-soft)")}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{l.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{l.label}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{l.sub}</div>
                  </div>
                  <svg style={{ marginLeft: "auto", flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </a>
              ))}
            </div>

            {/* Schedule config */}
            <div className="ci-card">
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>Auto Schedule</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>Run pipeline automatically every day</div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>Enable daily run</span>
                <button onClick={() => setSchedule(s => ({ ...s, is_enabled: s.is_enabled ? 0 : 1 }))}
                  style={{
                    width: 42, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                    background: schedule.is_enabled ? "var(--primary)" : "#d1d5db",
                    position: "relative", transition: "background 200ms",
                  }}>
                  <div style={{
                    position: "absolute", top: 3, left: schedule.is_enabled ? 21 : 3,
                    width: 18, height: 18, borderRadius: "50%", background: "#fff",
                    transition: "left 200ms", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }} />
                </button>
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>Hour (0â€“23)</label>
                  <input type="number" min={0} max={23} value={schedule.cron_hour}
                    onChange={e => setSchedule(s => ({ ...s, cron_hour: +e.target.value }))}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid var(--hairline)", fontSize: 14, fontFamily: "var(--font-sans)" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>Minute</label>
                  <input type="number" min={0} max={59} value={schedule.cron_minute}
                    onChange={e => setSchedule(s => ({ ...s, cron_minute: +e.target.value }))}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid var(--hairline)", fontSize: 14, fontFamily: "var(--font-sans)" }} />
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
                Runs at {String(schedule.cron_hour).padStart(2,"0")}:{String(schedule.cron_minute).padStart(2,"0")} daily
              </div>
              <button onClick={saveSchedule} disabled={savingSchedule} style={{ width: "100%", padding: "9px 0", borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {savingSchedule ? "Saving..." : "Save Schedule"}
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
