"use client";

import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

type AgentStatus = { is_running: boolean; last_run: string; logs: string[] };

const quickActions = [
  { label: "Generate Content", desc: "Chat with your knowledge base", href: "/content", icon: "✦", bg: "var(--primary)", color: "white" },
  { label: "Brand Voice", desc: "Create a branded social post", href: "/brand-voice", icon: "◈", bg: "var(--surface-dark)", color: "var(--on-dark)" },
  { label: "SMO Queue", desc: "Review & approve pending posts", href: "/smo", icon: "▣", bg: "var(--surface-card)", color: "var(--ink)" },
];

export default function Home() {
  const [status, setStatus] = useState<AgentStatus>({ is_running: false, last_run: "Never", logs: [] });
  const [time, setTime] = useState<Date | null>(null);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [smoQueue, setSmoQueue] = useState<any[]>([]);
  const [runError, setRunError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('${API}/api/status');
      if (res.ok) setStatus(await res.json());
    } catch { /* backend offline */ }
  };

  const fetchDashboardData = async () => {
    try {
      const [resStats, resSmo] = await Promise.all([
        fetch('${API}/api/dashboard/stats'),
        fetch('${API}/api/smo/posts')
      ]);
      if (resStats.ok) setDashboardStats(await resStats.json());
      if (resSmo.ok) setSmoQueue(await resSmo.json());
    } catch { /* backend offline */ }
  };

  const runPipeline = async () => {
    setRunError(null);
    try {
      const res = await fetch(`${API}/api/agents/run`, { method: 'POST' });
      if (!res.ok) { setRunError(`Server error: ${res.status}`); return; }
      const data = await res.json();
      if (data.status === "already_running") { setRunError("Pipeline is already running."); return; }
      setTimeout(fetchStatus, 500);
    } catch {
      setRunError("Could not reach backend. Is it running?");
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchDashboardData();
    const statusId = setInterval(fetchStatus, 3000);
    setTime(new Date());
    const clockId = setInterval(() => setTime(new Date()), 1000);
    return () => { clearInterval(statusId); clearInterval(clockId); };
  }, []);

  const greeting = !time ? "Good morning" : time.getHours() < 12 ? "Good morning" : time.getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <div style={{ backgroundColor: "var(--canvas)", minHeight: "calc(100vh - 60px)" }}>
      <style>{`
        @media (max-width: 1024px) {
          .home-main-grid { grid-template-columns: 1fr !important; padding: 24px !important; }
          .home-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .home-top-band { padding: 32px 24px 0 !important; }
          .home-greeting-row { flex-direction: column; gap: 16px; align-items: flex-start !important; margin-bottom: 24px !important; }
          .home-clock { text-align: left !important; }
        }
        @media (max-width: 768px) {
          .quick-actions-grid { grid-template-columns: 1fr !important; }
          .home-stats-grid { grid-template-columns: 1fr !important; }
          .home-top-band { padding: 24px 16px 0 !important; }
          .home-main-grid { padding: 16px !important; }
          .home-hero-title { font-size: 32px !important; }
        }
      `}</style>

      {/* ── Top Band ─────────────────────────────────────── */}
      <div className="home-top-band" style={{
        background: "linear-gradient(135deg, var(--surface-dark) 0%, #252320 100%)",
        padding: "48px 56px 0",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Decorative blobs */}
        <div style={{
          position: "absolute", top: "-80px", right: "-60px",
          width: "400px", height: "400px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(204,120,92,0.15) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: "-100px", left: "30%",
          width: "300px", height: "300px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(93,184,166,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Greeting row */}
          <div className="home-greeting-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "40px" }}>
            <div>
              <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--on-dark-soft)", marginBottom: "8px", letterSpacing: "0.3px" }}>
                {greeting}, Admin · {time ? time.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) : ""}
              </p>
              <h1 className="home-hero-title" style={{
                fontFamily: "var(--font-serif)",
                fontSize: "44px",
                fontWeight: 400,
                color: "var(--on-dark)",
                lineHeight: 1.1,
                letterSpacing: "-1px",
              }}>
                Harshwal<br />Automation Hub
              </h1>
            </div>

            {/* Live clock */}
            <div className="home-clock" style={{
              textAlign: "right",
              fontFamily: "var(--font-mono)",
              color: "var(--on-dark-soft)",
            }}>
              <div style={{ fontSize: "32px", letterSpacing: "2px", color: "var(--on-dark)", fontWeight: 400 }}>
                {time ? time.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "--:--"}
              </div>
              <div style={{ fontSize: "12px", marginTop: "4px" }}>IST</div>
            </div>
          </div>

          {/* Stats strip */}
          <div className="home-stats-grid" style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "1px",
            backgroundColor: "rgba(255,255,255,0.06)",
            borderRadius: "12px 12px 0 0",
            overflow: "hidden",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            borderLeft: "1px solid rgba(255,255,255,0.06)",
            borderRight: "1px solid rgba(255,255,255,0.06)",
          }}>
            {[
              { label: "Competitors Tracked", value: dashboardStats?.stats?.competitorsTracked || "0", delta: "Active tracking", up: true },
              { label: "Presence Score", value: dashboardStats?.stats?.presenceScore || "0", delta: "Real-time index", up: true },
              { label: "Posts Approved", value: dashboardStats?.stats?.postsApproved || "0", delta: "Published", up: null },
              { label: "Content Drafts", value: dashboardStats?.stats?.contentDrafts || "0", delta: "In knowledge base", up: null },
            ].map((s, i) => (
              <div key={s.label} style={{
                padding: "24px 28px",
                backgroundColor: "rgba(255,255,255,0.03)",
                borderRight: i < 3 ? "1px solid rgba(255,255,255,0.06)" : "none",
              }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--on-dark-soft)", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: "10px" }}>
                  {s.label}
                </div>
                <div style={{ fontSize: "32px", fontWeight: 600, color: "var(--on-dark)", fontFamily: "var(--font-mono)", letterSpacing: "-1px", marginBottom: "6px" }}>
                  {s.value}
                </div>
                <div style={{ fontSize: "12px", color: s.up === true ? "var(--accent-teal)" : s.up === false ? "var(--error)" : "var(--on-dark-soft)" }}>
                  {s.up === true ? "↑ " : s.up === false ? "↓ " : ""}{s.delta}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Body ─────────────────────────────────────── */}
      <div className="home-main-grid" style={{
        display: "grid",
        gridTemplateColumns: "1fr 340px",
        gap: "28px",
        padding: "32px 56px 56px",
        maxWidth: "1400px",
        margin: "0 auto",
      }}>

        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

          {/* Quick Actions */}
          <div>
            <h2 style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "14px" }}>
              Quick Actions
            </h2>
            <div className="quick-actions-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
              {quickActions.map(qa => (
                <a key={qa.label} href={qa.href} style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  padding: "22px",
                  backgroundColor: qa.bg,
                  borderRadius: "12px",
                  textDecoration: "none",
                  border: qa.bg === "var(--surface-card)" ? "1px solid var(--hairline)" : "none",
                  transition: "transform 150ms ease, box-shadow 150ms ease",
                  cursor: "pointer",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(20,20,19,0.12)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                >
                  <span style={{ fontSize: "20px", color: qa.color, opacity: 0.9 }}>{qa.icon}</span>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 600, color: qa.color, marginBottom: "4px" }}>{qa.label}</div>
                    <div style={{ fontSize: "12px", color: qa.color, opacity: 0.65, lineHeight: 1.4 }}>{qa.desc}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Trenoxa Agent Card */}
          <div>
            <h2 style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "14px" }}>
              Trenoxa Intelligence Engine
            </h2>
            <div className="card-dark" style={{ padding: "28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <span className={`status-dot status-dot-${status.is_running ? "warning" : "success"}`}></span>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--on-dark)" }}>
                      {status.is_running ? "Pipeline Running…" : "Systems Operational"}
                    </span>
                  </div>
                  <p style={{ fontSize: "13px", color: "var(--on-dark-soft)" }}>
                    Last run: {status.last_run} · Scheduled every Monday 3:00 AM
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <button
                    onClick={runPipeline}
                    disabled={status.is_running}
                    style={{
                      padding: "8px 18px",
                      backgroundColor: status.is_running ? "rgba(255,255,255,0.05)" : "var(--primary)",
                      color: status.is_running ? "var(--on-dark-soft)" : "white",
                      border: "none",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: status.is_running ? "not-allowed" : "pointer",
                      fontFamily: "var(--font-sans)",
                      transition: "background-color 150ms",
                      whiteSpace: "nowrap",
                    }}
                  >{status.is_running ? "⠋ Running" : "▶ Run Now"}</button>
                  {runError && <span style={{ fontSize: "11px", color: "#f87171", maxWidth: 200, textAlign: "right" }}>{runError}</span>}
                </div>
              </div>

              {/* Terminal */}
              <div style={{
                backgroundColor: "#0d0c0b",
                borderRadius: "8px",
                padding: "16px 18px",
                fontFamily: "var(--font-mono)",
                fontSize: "12.5px",
                lineHeight: 1.7,
                minHeight: "120px",
              }}>
                <div style={{ color: "var(--accent-teal)", marginBottom: "2px" }}>$ trenoxa run --agents=all --concurrent</div>
                {status.logs && status.logs.length > 0
                  ? status.logs.map((log, i) => <div key={i} style={{ color: "var(--on-dark-soft)", paddingBottom: "4px" }}>{log}</div>)
                  : <div style={{ color: "var(--on-dark-soft)", fontStyle: "italic", opacity: 0.7, marginTop: "8px" }}>
                      System idle. Click "Run Now" to spawn Trenoxa agents.
                    </div>
                }
              </div>

              {/* Sub-agent pills */}
              <div style={{ display: "flex", gap: "8px", marginTop: "16px", flexWrap: "wrap" }}>
                {["Discovery", "Scoring", "Gap Analysis", "Outreach", "Content"].map((a, i) => (
                  <span key={a} style={{
                    padding: "4px 12px",
                    borderRadius: "9999px",
                    fontSize: "11px",
                    fontWeight: 600,
                    backgroundColor: "rgba(255,255,255,0.05)",
                    color: i < 3 ? "var(--accent-teal)" : "var(--on-dark-soft)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}>Agent {i + 1}: {a}</span>
                ))}
              </div>
            </div>
          </div>

          {/* SMO Preview */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h2 style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", letterSpacing: "1px", textTransform: "uppercase" }}>
                SMO — Pending Approvals
              </h2>
              <a href="/smo" style={{ fontSize: "12px", fontWeight: 600, color: "var(--primary)", textDecoration: "none" }}>View All →</a>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {smoQueue.filter(p => p.status === 'designer_review' || p.status === 'manager_review').slice(0, 3).map(post => (
                <div key={post.id} className="card" style={{
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px", overflow: "hidden" }}>
                    <div style={{
                      width: "36px", height: "36px", borderRadius: "8px",
                      backgroundColor: "var(--surface-soft)",
                      border: "1px solid var(--hairline)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "14px", flexShrink: 0
                    }}>▣</div>
                    <div style={{ overflow: "hidden" }}>
                      <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--ink)", marginBottom: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{post.title}</div>
                      <div style={{ fontSize: "12px", color: "var(--muted)" }}>{post.platform} · {post.status.replace("_", " ")}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                    <a href="/smo" className="btn-primary" style={{ height: "30px", padding: "0 12px", fontSize: "12px", textDecoration: "none", display: "flex", alignItems: "center" }}>Review</a>
                  </div>
                </div>
              ))}
              {smoQueue.length === 0 && (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: "13px", border: "1px dashed var(--hairline)", borderRadius: "8px" }}>
                  No pending approvals in queue.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

          {/* Activity Feed */}
          <div>
            <h2 style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "14px" }}>
              Recent Activity
            </h2>
            <div className="card" style={{ padding: "8px 0", overflow: "hidden" }}>
              {dashboardStats?.activity?.map((a: any, i: number) => (
                <div key={i} style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "14px",
                  padding: "14px 20px",
                  borderBottom: i < (dashboardStats.activity.length - 1) ? "1px solid var(--hairline)" : "none",
                }}>
                  <div style={{
                    width: "28px", height: "28px",
                    borderRadius: "50%",
                    backgroundColor: a.color + "18",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                    fontSize: "11px",
                    color: a.color,
                    fontWeight: 700,
                  }}>{a.icon}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "13px", color: "var(--body)", lineHeight: 1.5, marginBottom: "3px" }}>{a.text}</p>
                    <span style={{ fontSize: "11px", color: "var(--muted)" }}>{a.time}</span>
                  </div>
                </div>
              ))}
              {!dashboardStats?.activity && (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>Loading activity...</div>
              )}
            </div>
          </div>

          {/* Competitor Snapshot */}
          <div>
            <h2 style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "14px" }}>
              Competitor Snapshot
            </h2>
            <div className="card" style={{ padding: "20px" }}>
              {dashboardStats?.competitors?.map((c: any, i: number) => (
                <div key={c.name} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: i < 4 ? "14px" : 0,
                }}>
                  <span style={{
                    width: "18px",
                    fontSize: "11px",
                    color: "var(--muted)",
                    fontWeight: 600,
                    textAlign: "right",
                    flexShrink: 0,
                  }}>#{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "13px", fontWeight: c.yours ? 600 : 400, color: c.yours ? "var(--ink)" : "var(--body)" }}>
                        {c.name} {c.yours && <span style={{ color: "var(--primary)", fontSize: "11px" }}>← you</span>}
                      </span>
                      <span style={{ fontSize: "13px", fontWeight: 600, fontFamily: "var(--font-mono)", color: c.yours ? "var(--primary)" : "var(--muted)" }}>{c.score}</span>
                    </div>
                    <div style={{ height: "4px", backgroundColor: "var(--surface-card)", borderRadius: "9999px", overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: `${c.score}%`,
                        backgroundColor: c.yours ? "var(--primary)" : "var(--hairline-soft)",
                        borderRadius: "9999px",
                        transition: "width 600ms ease",
                      }} />
                    </div>
                  </div>
                </div>
              ))}
              {!dashboardStats?.competitors && (
                <div style={{ padding: "10px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>Loading competitors...</div>
              )}
            </div>
          </div>

          {/* Platform Breakdown */}
          <div>
            <h2 style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "14px" }}>
              Posts This Month
            </h2>
            <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {dashboardStats?.platforms?.map((p: any) => {
                const color = p.platform === "LinkedIn" ? "#0077b5" : p.platform === "Facebook" ? "#1877f2" : "#e1306c";
                const total = Math.max(dashboardStats.platforms.reduce((sum: number, plt: any) => sum + plt.count, 0), 10); // avoid div 0, set min scale
                return (
                  <div key={p.platform} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: "13px", color: "var(--body)" }}>{p.platform}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{
                        width: "80px", height: "4px",
                        backgroundColor: "var(--surface-card)",
                        borderRadius: "9999px", overflow: "hidden",
                      }}>
                        <div style={{ height: "100%", width: `${(p.count / total) * 100}%`, backgroundColor: color, borderRadius: "9999px", transition: "width 600ms ease" }} />
                      </div>
                      <span style={{ fontSize: "13px", fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--ink)", width: "20px", textAlign: "right" }}>{p.count}</span>
                    </div>
                  </div>
                );
              })}
              {!dashboardStats?.platforms && (
                <div style={{ padding: "10px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>Loading data...</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
