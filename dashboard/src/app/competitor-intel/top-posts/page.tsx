"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Post = {
  id: number; rank: number; competitor_name: string; platform: string;
  content: string; post_url: string; published_at: string;
  likes: number; comments: number; shares: number; reposts: number;
  views: number; engagement_score: number;
};
type TrendReport = {
  themes: string[]; writing_styles: string[];
  hook_patterns: string[]; cta_patterns: string[]; summary: string;
};

const PLATFORM_COLOR: Record<string, [string, string]> = {
  linkedin:  ["#0077b5", "#e8f4fd"],
  facebook:  ["#1877f2", "#e8f1fe"],
  instagram: ["#e1306c", "#fce8f1"],
  twitter:   ["#1da1f2", "#e8f5fd"],
  youtube:   ["#ff0000", "#ffe8e8"],
};

function MetricPill({ label, val }: { label: string; val: number }) {
  return (
    <span style={{ fontSize: 11, color: "var(--muted)", background: "var(--surface-soft)", padding: "2px 8px", borderRadius: 6 }}>
      {label}: <strong style={{ color: "var(--ink)" }}>{val.toLocaleString()}</strong>
    </span>
  );
}

export default function TopPostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [trend, setTrend] = useState<TrendReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [platformFilter, setPlatformFilter] = useState("all");

  const token = () => localStorage.getItem("access_token") || "";
  const h = () => ({ Authorization: `Bearer ${token()}` });

  useEffect(() => {
    const load = async () => {
      try {
        const [p, t] = await Promise.all([
          fetch(`${API}/api/ci/posts/top?limit=30`, { headers: h() }).then(x => x.json()),
          fetch(`${API}/api/ci/trend-report`, { headers: h() }).then(x => x.json()),
        ]);
        setPosts(Array.isArray(p) ? p : []);
        if (t && t.summary) setTrend(t);
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const platforms = ["all", ...Array.from(new Set(posts.map(p => p.platform)))];
  const filtered = platformFilter === "all" ? posts : posts.filter(p => p.platform === platformFilter);

  return (
    <div className="tp-container" style={{ padding: "32px 40px", maxWidth: 1200, margin: "0 auto" }}>
      <style>{`
        @media (max-width: 768px) {
          .tp-container { padding: 20px 16px !important; }
          .tp-header-row { flex-direction: column !important; align-items: flex-start !important; gap: 12px !important; }
          .tp-review-btn { width: 100% !important; text-align: center !important; box-sizing: border-box; }
          .tp-trend-grid { grid-template-columns: 1fr 1fr !important; }
          .tp-platform-filter { flex-wrap: wrap !important; }
          .tp-post-header { flex-wrap: wrap !important; gap: 6px !important; }
        }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <a href="/competitor-intel" style={{ fontSize: 13, color: "var(--muted)", textDecoration: "none" }}>← Competitor Intel</a>
      </div>
      <div className="tp-header-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)", margin: 0 }}>Top 30 Posts</h1>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0" }}>Highest-performing competitor content from the latest pipeline run</p>
        </div>
        <a href="/competitor-intel/generated" className="tp-review-btn" style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          Review Generated Content →
        </a>
      </div>

      {/* Trend report */}
      {trend && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid var(--hairline)", padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>AI Trend Analysis</div>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7, marginBottom: 20 }}>{trend.summary}</p>
          <div className="tp-trend-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
            {[
              { label: "Content Themes", items: trend.themes, color: "#dbeafe", tc: "#1d4ed8" },
              { label: "Writing Styles", items: trend.writing_styles, color: "#dcfce7", tc: "#15803d" },
              { label: "Hook Patterns", items: trend.hook_patterns, color: "#fef3c7", tc: "#b45309" },
              { label: "CTA Patterns", items: trend.cta_patterns, color: "#fce7f3", tc: "#9d174d" },
            ].map(g => (
              <div key={g.label}>
                <div style={{ fontSize: 11, fontWeight: 700, color: g.tc, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>{g.label}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {g.items.map(item => (
                    <span key={item} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 8, background: g.color, color: g.tc }}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Platform filter */}
      <div className="tp-platform-filter" style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {platforms.map(p => (
          <button key={p} onClick={() => setPlatformFilter(p)} style={{
            padding: "6px 16px", borderRadius: 20, border: "1px solid var(--hairline)",
            background: platformFilter === p ? "var(--primary)" : "#fff",
            color: platformFilter === p ? "#fff" : "var(--muted)",
            fontSize: 12, fontWeight: 500, cursor: "pointer", textTransform: "capitalize",
            fontFamily: "var(--font-sans)",
          }}>
            {p === "all" ? `All (${posts.length})` : `${p} (${posts.filter(x => x.platform === p).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 80, color: "var(--muted)" }}>Loading top posts...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 80, color: "var(--muted)" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🏆</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>No posts yet</div>
          <div style={{ fontSize: 14 }}>Run a pipeline first to see top competitor posts here.</div>
          <a href="/competitor-intel" style={{ display: "inline-block", marginTop: 16, padding: "10px 24px", borderRadius: 8, background: "var(--primary)", color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>Go to Dashboard</a>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map(p => {
            const [tc, bg] = PLATFORM_COLOR[p.platform] ?? ["#666", "#f3f4f6"];
            const isOpen = expanded === p.id;
            return (
              <div key={p.id} style={{ background: "#fff", border: "1px solid var(--hairline)", borderRadius: 14, overflow: "hidden", transition: "box-shadow 150ms" }}>
                <div style={{ padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 16 }}
                  onClick={() => setExpanded(isOpen ? null : p.id)}>

                  {/* Rank badge */}
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: p.rank <= 3 ? "var(--primary)" : "var(--surface-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: p.rank <= 3 ? "#fff" : "var(--muted)", flexShrink: 0 }}>
                    #{p.rank}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{p.competitor_name}</span>
                      <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: bg, color: tc, textTransform: "capitalize" }}>{p.platform}</span>
                      {p.published_at && (
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>{new Date(p.published_at).toLocaleDateString()}</span>
                      )}
                    </div>
                    <p style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.6, margin: 0,
                      display: isOpen ? "block" : "-webkit-box",
                      WebkitLineClamp: isOpen ? undefined : 2,
                      WebkitBoxOrient: "vertical" as any,
                      overflow: isOpen ? "visible" : "hidden",
                    }}>
                      {p.content}
                    </p>
                  </div>

                  {/* Score */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--primary)" }}>{p.engagement_score.toLocaleString()}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px" }}>Score</div>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ padding: "0 20px 16px", borderTop: "1px solid var(--hairline)", paddingTop: 12 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                      <MetricPill label="👍 Likes" val={p.likes} />
                      <MetricPill label="💬 Comments" val={p.comments} />
                      <MetricPill label="🔁 Shares" val={p.shares} />
                      <MetricPill label="🔃 Reposts" val={p.reposts} />
                      <MetricPill label="👁️ Views" val={p.views} />
                    </div>
                    {p.post_url && (
                      <a href={p.post_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--primary)", textDecoration: "none" }}>
                        View original post →
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
