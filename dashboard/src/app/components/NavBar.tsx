"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type NavLink = {
  href: string;
  label: string;
  roles: string[] | null;
  dropdown?: { href: string; label: string }[];
};

const ALL_LINKS: NavLink[] = [
  { href: "/", label: "Dashboard", roles: ["admin", "dm_leader"] },
  { href: "/content", label: "Content", roles: ["admin", "dm_leader"] },
  { href: "/smo", label: "SMO", roles: ["admin", "dm_leader"] },
  { href: "/brand-voice", label: "Brand Voice", roles: ["admin", "dm_leader"] },
  { href: "/chat", label: "Chat / KB", roles: ["admin", "dm_leader"] },
  { href: "/designer-queue", label: "Designer Queue", roles: ["designer"] },
  { href: "/library", label: "DM Library", roles: ["admin", "dm_leader", "designer"] },
  { href: "/reports", label: "Reports", roles: ["admin", "dm_leader"] },
  {
    href: "/competitor-intel",
    label: "Competitor Intel",
    roles: ["admin", "dm_leader"],
    dropdown: [
      { href: "/competitor-intel", label: "Overview" },
      { href: "/competitor-intel/generated", label: "Review Queue" },
      { href: "/competitor-intel/calendar", label: "Calendar" },
      { href: "/competitor-intel/analytics", label: "CI Analytics" },
      { href: "/competitor-intel/top-posts", label: "Top Posts" },
      { href: "/competitor-intel/competitors", label: "Competitors" },
    ],
  },
  { href: "/settings", label: "Settings", roles: ["admin", "dm_leader"] },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/login";
  const [role, setRole] = useState<string>("admin");
  const [username, setUsername] = useState<string>("admin");
  const [userDropOpen, setUserDropOpen] = useState(false);
  const [ciDropOpen, setCiDropOpen] = useState(false);
  const [ciDropPos, setCiDropPos] = useState({ top: 68, left: 0 });
  const userDropRef = useRef<HTMLDivElement>(null);
  const ciDropRef = useRef<HTMLDivElement>(null);
  const ciButtonRef = useRef<HTMLButtonElement>(null);

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
      if (userDropRef.current && !userDropRef.current.contains(e.target as Node)) setUserDropOpen(false);
      if (
        ciDropRef.current && !ciDropRef.current.contains(e.target as Node) &&
        ciButtonRef.current && !ciButtonRef.current.contains(e.target as Node)
      ) setCiDropOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleCiToggle = () => {
    if (!ciDropOpen && ciButtonRef.current) {
      const rect = ciButtonRef.current.getBoundingClientRect();
      setCiDropPos({ top: rect.bottom + 8, left: rect.left + rect.width / 2 });
    }
    setCiDropOpen(o => !o);
  };

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
        .nb { padding: 0 32px; }
        .nb-nav { display:flex; align-items:center; gap:2px; overflow-x:auto; scrollbar-width:none; white-space:nowrap; -webkit-overflow-scrolling:touch; }
        .nb-nav::-webkit-scrollbar { display:none; }
        .nb-link { padding:5px 9px; font-size:13px; font-weight:500; color:var(--muted); text-decoration:none; border-radius:6px; transition:background 150ms,color 150ms; white-space:nowrap; display:inline-flex; align-items:center; gap:4px; }
        .nb-link:hover { background:var(--surface-soft); color:var(--ink); }
        .nb-link.active { background:var(--surface-soft); color:var(--ink); }
        .nb-drop { position:absolute; top:calc(100% + 8px); left:50%; transform:translateX(-50%); background:#fff; border:1px solid var(--hairline); border-radius:12px; padding:6px; box-shadow:0 8px 30px rgba(0,0,0,0.10); min-width:196px; z-index:200; }
        .nb-drop-item { display:flex; align-items:center; gap:10px; padding:9px 12px; border-radius:8px; text-decoration:none; font-size:13px; font-weight:500; color:var(--ink); transition:background 150ms; }
        .nb-drop-item:hover { background:var(--surface-soft); }
        .nb-drop-item.active { background:#fdf6f3; color:var(--primary); }
        @keyframes nb-fade { from{opacity:0;transform:translateX(-50%) translateY(-6px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        .nb-drop { animation: nb-fade 140ms ease; transform-origin: top center; }
        @media (max-width:768px) {
          .nb { padding:0 16px!important; }
          .nb-agents { display:none!important; }
        }
      `}</style>

      <header className="nb" style={{
        position: "sticky", top: 0, zIndex: 50, height: "60px",
        backgroundColor: "var(--canvas)", borderBottom: "1px solid var(--hairline)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      }}>

        {/* Logo */}
        <a href="/" style={{ display: "flex", alignItems: "center", flexShrink: 0, textDecoration: "none" }}>
          <img src="/Harshwal.png" alt="Harshwal" style={{ height: "36px", objectFit: "contain" }} />
        </a>

        {/* Nav - scrollable center */}
        <nav className="nb-nav" style={{ flex: 1, minWidth: 0, padding: "0 4px" }}>
          {links.map(link => {
            if (link.dropdown) {
              const isCiActive = pathname.startsWith(link.href);
              return (
                <button
                  key={link.href}
                  ref={ciButtonRef}
                  onClick={handleCiToggle}
                  className={`nb-link${isCiActive ? " active" : ""}`}
                  style={{ background: ciDropOpen || isCiActive ? "var(--surface-soft)" : "transparent", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)" }}
                >
                  {link.label}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transition: "transform 150ms", transform: ciDropOpen ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              );
            }

            const active = pathname === link.href;
            return (
              <a key={link.href} href={link.href} className={`nb-link${active ? " active" : ""}`}>
                {link.label}
              </a>
            );
          })}
        </nav>

        {/* CI dropdown rendered outside the overflow nav so it isn't clipped */}
        {ciDropOpen && (() => {
          const ciLink = links.find(l => l.dropdown);
          if (!ciLink) return null;
          return (
            <div
              ref={ciDropRef}
              className="nb-drop"
              style={{ position: "fixed", top: ciDropPos.top, left: ciDropPos.left, transform: "translateX(-50%)" }}
            >
              <div style={{ padding: "6px 12px 8px", borderBottom: "1px solid var(--hairline)", marginBottom: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Competitor Intelligence
                </div>
              </div>
              {ciLink.dropdown!.map(sub => (
                <a
                  key={sub.href}
                  href={sub.href}
                  className={`nb-drop-item${pathname === sub.href ? " active" : ""}`}
                  onClick={() => setCiDropOpen(false)}
                >
                  {sub.label}
                </a>
              ))}
            </div>
          );
        })()}

        {/* Right: agents + avatar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{ width: 1, height: 20, background: "var(--hairline)" }} />
          <AgentHealthBar />

          {/* User avatar dropdown */}
          <div ref={userDropRef} style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => setUserDropOpen(o => !o)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "5px 10px 5px 6px",
                background: userDropOpen ? "var(--surface-soft)" : "transparent",
                border: "1px solid var(--hairline)", borderRadius: 20,
                cursor: "pointer", transition: "background 150ms",
              }}
            >
              <div style={{
                width: 26, height: 26, borderRadius: "50%",
                background: "linear-gradient(135deg, var(--primary), var(--primary-active))",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0,
              }}>
                {username.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", maxWidth: 72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {username}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ transition: "transform 150ms", transform: userDropOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {userDropOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0,
                background: "#fff", border: "1px solid var(--hairline)",
                borderRadius: 12, padding: 6,
                boxShadow: "0 8px 30px rgba(0,0,0,0.10)",
                minWidth: 180, zIndex: 200,
              }}>
                <div style={{ padding: "10px 14px 8px", borderBottom: "1px solid var(--hairline)", marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{username}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "capitalize", marginTop: 2 }}>{role.replace("_", " ")}</div>
                </div>
                <button
                  onClick={handleLogout}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 14px", background: "none", border: "none",
                    borderRadius: 8, cursor: "pointer", fontSize: 13,
                    color: "var(--error)", fontWeight: 500, fontFamily: "var(--font-sans)",
                    transition: "background 150ms",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(198,69,69,0.06)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
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

// â"€â"€ Agent health indicator â€" compact dots only â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function AgentHealthBar() {
  const [health, setHealth] = useState<Record<string, { status: string; last_run: string }>>({});
  const [alertDismissed, setAlertDismissed] = useState(false);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
        const res = await fetch(`${apiUrl}/api/agents/health`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setHealth(data);
        const hasError = Object.values(data).some((a: any) => a.status === "error");
        if (hasError) setAlertDismissed(false);
      } catch {}
    };
    fetchHealth();
    const iv = setInterval(fetchHealth, 30000);
    return () => clearInterval(iv);
  }, []);

  const AGENTS = [
    { key: "agent1", label: "Agent 1" },
    { key: "agent2", label: "Agent 2" },
    { key: "agent3", label: "Agent 3" },
    { key: "agent4", label: "Agent 4" },
    { key: "agent7", label: "Agent 7" },
  ];

  const errorAgents = AGENTS.filter(a => health[a.key]?.status === "error");
  const role = typeof window !== "undefined" ? localStorage.getItem("user_role") : null;
  const isDmLeader = role === "dm_leader" || role === "admin";
  const showAlert = isDmLeader && errorAgents.length > 0 && !alertDismissed;
  const hasAnyError = errorAgents.length > 0;

  return (
    <>
      {/* Error banner */}
      {showAlert && (
        <div style={{
          position: "fixed", top: 60, left: 0, right: 0, zIndex: 100,
          background: "rgba(198,69,69,0.95)", color: "#fff",
          padding: "10px 24px", display: "flex", alignItems: "center",
          justifyContent: "space-between", fontSize: 14, fontWeight: 500,
          backdropFilter: "blur(4px)",
        }}>
          <span>Agent error: {errorAgents.map(a => a.label).join(", ")} â€" check pipeline logs.</span>
          <button onClick={() => setAlertDismissed(true)}
            style={{ background: "none", border: "none", color: "#fff", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>
            Ã—
          </button>
        </div>
      )}

      <style>{`
        @keyframes pulse-red { 0%,100%{opacity:1}50%{opacity:0.3} }
        .dot-err { animation:pulse-red 1.2s ease-in-out infinite; }
      `}</style>

      {/* Compact dots pill */}
      <div
        className="nb-agents"
        title={hasAnyError ? `${errorAgents.length} agent error(s)` : "All agents healthy"}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "5px 10px", borderRadius: 20,
          background: hasAnyError ? "rgba(198,69,69,0.07)" : "var(--surface-soft)",
          border: `1px solid ${hasAnyError ? "rgba(198,69,69,0.25)" : "transparent"}`,
          cursor: "help",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: hasAnyError ? "var(--error)" : "var(--muted)", letterSpacing: "0.2px" }}>
          {hasAnyError ? `${errorAgents.length} err` : "Agents"}
        </span>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {AGENTS.map(({ key, label }) => {
            const status = health[key]?.status || "unknown";
            const lastRun = health[key]?.last_run || "Never";
            let color = "#d1ccc6";
            if (status === "ok") color = "var(--success, #22c55e)";
            if (status === "warning") color = "var(--warning, #f59e0b)";
            if (status === "error") color = "var(--error, #ef4444)";
            return (
              <div
                key={key}
                className={status === "error" ? "dot-err" : ""}
                title={`${label}: ${status} â€" last run: ${lastRun}`}
                style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}
