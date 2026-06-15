"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const ALL_LINKS: { href: string; label: string; roles: string[] | null }[] = [
  { href: "/", label: "Dashboard", roles: null },
  { href: "/content", label: "Content", roles: null },
  { href: "/smo", label: "SMO", roles: null },
  { href: "/brand-voice", label: "Brand Voice", roles: null },
  { href: "/review", label: "Review Queue", roles: ["admin", "dm_leader"] },
  { href: "/designer-queue", label: "Designer Queue", roles: ["designer"] },
  { href: "/library", label: "📁 DM Library", roles: null },
  { href: "/reports", label: "📤 Share Reports", roles: null },
  { href: "/settings", label: "⚙ Settings", roles: ["admin", "dm_leader"] },
];

export default function NavBar() {
  const pathname = usePathname();
  const isLogin = pathname === "/login";
  const [role, setRole] = useState<string>("admin");

  useEffect(() => {
    const r = localStorage.getItem("user_role");
    if (r) setRole(r);
  }, []);

  const links = ALL_LINKS.filter(l => !l.roles || l.roles.includes(role));

  if (isLogin) return null;

  return (
    <>
      <style>{`
        .navbar-header { padding: 0 40px; }
        .navbar-nav { display: flex; align-items: center; gap: 4px; overflow-x: auto; scrollbar-width: none; white-space: nowrap; -webkit-overflow-scrolling: touch; }
        .navbar-nav::-webkit-scrollbar { display: none; }
        @media (max-width: 768px) {
          .navbar-header { padding: 0 16px!important; gap: 16px; }
          .navbar-divider { display: none!important; }
          .navbar-btn { display: none!important; }
        }
      `}</style>
      <header className="navbar-header" style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        height: "60px",
        backgroundColor: "var(--canvas)",
        borderBottom: "1px solid var(--hairline)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
      {/* Logo */}
      <a href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
        <img src="/Harshwal.png" alt="Harshwal Logo" style={{ height: "38px", objectFit: "contain" }} />
      </a>

      {/* Nav Links */}
      <nav className="navbar-nav">
        {links.map(link => {
          const active = pathname === link.href;
          return (
            <a
              key={link.href}
              href={link.href}
              style={{
                padding: "6px 14px",
                fontSize: "14px",
                fontWeight: 500,
                color: active ? "var(--ink)" : "var(--muted)",
                textDecoration: "none",
                borderRadius: "6px",
                backgroundColor: active ? "var(--surface-soft)" : "transparent",
                transition: "background 150ms, color 150ms",
              }}
            >
              {link.label}
            </a>
          );
        })}

        <div className="navbar-divider" style={{ width: "1px", height: "20px", background: "var(--hairline)", margin: "0 8px", flexShrink: 0 }} />

        <AgentHealthBar />

        <a href="/content" className="btn-primary navbar-btn" style={{ height: "36px", padding: "0 16px", fontSize: "13px", flexShrink: 0, marginLeft: "8px" }}>
          New Campaign
        </a>
      </nav>
    </header>
    </>
  );
}

function AgentHealthBar() {
  const [health, setHealth] = useState<Record<string, { status: string; last_run: string }>>({});
  const [alertDismissed, setAlertDismissed] = useState(false);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${apiUrl}/api/agents/health`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setHealth(data);
        // Reset dismissed state when a new error appears
        const hasError = Object.values(data).some((a: any) => a.status === "error");
        if (hasError) setAlertDismissed(false);
      } catch (err) {
        console.error("Failed to fetch agent health", err);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 120000); // 2 minutes
    return () => clearInterval(interval);
  }, []);

  const AGENTS: { key: string; label: string }[] = [
    { key: "agent1", label: "A1" },
    { key: "agent2", label: "A2" },
    { key: "agent3", label: "A3" },
    { key: "agent4", label: "A4" },
    { key: "agent7", label: "A7" },
  ];

  const errorAgents = AGENTS.filter(a => health[a.key]?.status === "error");
  const role = typeof window !== "undefined" ? localStorage.getItem("user_role") : null;
  const isDmLeader = role === "dm_leader" || role === "admin";
  const showAlert = isDmLeader && errorAgents.length > 0 && !alertDismissed;

  return (
    <>
      {/* Alert banner — rendered outside the nav pill, spans full width */}
      {showAlert && (
        <div style={{
          position: "fixed",
          top: "60px",
          left: 0,
          right: 0,
          zIndex: 100,
          background: "rgba(198,69,69,0.95)",
          color: "#fff",
          padding: "10px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "14px",
          fontWeight: 500,
          backdropFilter: "blur(4px)",
        }}>
          <span>
            ⚠️ Agent error detected: {errorAgents.map(a => a.label).join(", ")} — check pipeline logs immediately.
          </span>
          <button
            onClick={() => setAlertDismissed(true)}
            style={{ background: "none", border: "none", color: "#fff", fontSize: "18px", cursor: "pointer", lineHeight: 1, padding: "0 4px" }}
          >
            ×
          </button>
        </div>
      )}

      {/* Inline dot indicator in navbar */}
      <style>{`
        @keyframes pulse-red { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        .dot-error { animation: pulse-red 1.2s ease-in-out infinite; }
      `}</style>
      <div style={{ display: "flex", gap: "8px", alignItems: "center", padding: "4px 12px", background: "var(--surface-soft)", borderRadius: "20px", fontSize: "12px", fontWeight: 500, color: "var(--muted)" }}>
        Agents:
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {AGENTS.map(({ key, label }) => {
            const status = health[key]?.status || "unknown";
            const lastRun = health[key]?.last_run || "Never";
            let dotColor = "#d1ccc6"; // unknown/grey
            if (status === "ok") dotColor = "var(--success)";
            if (status === "warning") dotColor = "var(--warning)";
            if (status === "error") dotColor = "var(--error)";

            return (
              <div key={key} title={`${label}: ${status} — last run: ${lastRun}`}
                style={{ display: "flex", alignItems: "center", gap: "3px", cursor: "help" }}>
                <div
                  className={status === "error" ? "dot-error" : ""}
                  style={{ width: "8px", height: "8px", borderRadius: "50%", background: dotColor, flexShrink: 0 }}
                />
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
