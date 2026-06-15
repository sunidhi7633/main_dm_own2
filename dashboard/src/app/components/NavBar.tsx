"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const ALL_LINKS: { href: string; label: string; roles: string[] | null }[] = [
  { href: "/", label: "Dashboard", roles: null },
  { href: "/content", label: "Content", roles: null },
  { href: "/smo", label: "SMO", roles: null },
  { href: "/brand-voice", label: "Brand Voice", roles: null },
  { href: "/designer-queue", label: "Designer Queue", roles: ["designer"] },
  { href: "/library", label: "DM Library", roles: null },
  { href: "/reports", label: "Reports", roles: null },
  { href: "/competitor-intel", label: "Competitor Intel", roles: ["admin", "dm_leader"] },
  { href: "/competitor-intel/calendar", label: "Calendar", roles: ["admin", "dm_leader"] },
  { href: "/settings", label: "Settings", roles: ["admin", "dm_leader"] },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/login";
  const [role, setRole] = useState<string>("admin");
  const [username, setUsername] = useState<string>("admin");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const r = localStorage.getItem("user_role");
    const u = localStorage.getItem("access_token");
    if (r) setRole(r);
    if (u) {
      try {
        const payload = JSON.parse(atob(u.split(".")[1]));
        setUsername(payload.sub || "admin");
      } catch { setUsername("admin"); }
    }
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    router.push("/login");
  };

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

      {/* Nav Links — scrollable center section */}
      <nav className="navbar-nav" style={{ flex: 1, minWidth: 0 }}>
        {links.map(link => {
          const active = pathname === link.href;
          return (
            <a
              key={link.href}
              href={link.href}
              style={{
                padding: "5px 10px",
                fontSize: "13px",
                fontWeight: 500,
                color: active ? "var(--ink)" : "var(--muted)",
                textDecoration: "none",
                borderRadius: "6px",
                backgroundColor: active ? "var(--surface-soft)" : "transparent",
                transition: "background 150ms, color 150ms",
                whiteSpace: "nowrap",
              }}
            >
              {link.label}
            </a>
          );
        })}

      </nav>

      {/* Right actions — always visible, never scrolled off */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, marginLeft: "12px" }}>
        <div className="navbar-divider" style={{ width: "1px", height: "20px", background: "var(--hairline)", flexShrink: 0 }} />
        <AgentHealthBar />

        {/* User avatar + logout dropdown */}
        <div ref={dropdownRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => setDropdownOpen(o => !o)}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "5px 10px 5px 6px",
              background: dropdownOpen ? "var(--surface-soft)" : "transparent",
              border: "1px solid var(--hairline)",
              borderRadius: "20px",
              cursor: "pointer",
              transition: "background 150ms",
            }}
          >
            <div style={{
              width: "26px", height: "26px", borderRadius: "50%",
              background: "linear-gradient(135deg, var(--primary), var(--primary-active))",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "12px", fontWeight: 700, color: "#fff", flexShrink: 0,
            }}>
              {username.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--ink)", maxWidth: "80px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {username}
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform 150ms", transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {dropdownOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", right: 0,
              background: "#fff", border: "1px solid var(--hairline)",
              borderRadius: "12px", padding: "6px",
              boxShadow: "0 8px 30px rgba(0,0,0,0.10)",
              minWidth: "180px", zIndex: 200,
            }}>
              <div style={{ padding: "10px 14px 8px", borderBottom: "1px solid var(--hairline)", marginBottom: "4px" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>{username}</div>
                <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "capitalize", marginTop: "2px" }}>{role.replace("_", " ")}</div>
              </div>
              <button
                onClick={handleLogout}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: "10px",
                  padding: "9px 14px", background: "none", border: "none",
                  borderRadius: "8px", cursor: "pointer", fontSize: "13px",
                  color: "var(--error)", fontWeight: 500, fontFamily: "var(--font-sans)",
                  transition: "background 150ms",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(198,69,69,0.06)")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
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
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setHealth(data);
        // Reset dismissed state when a new error appears
        const hasError = Object.values(data).some((a: any) => a.status === "error");
        if (hasError) setAlertDismissed(false);
      } catch {
        // Backend may be starting up — silently retry on next interval
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // retry every 30s
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
