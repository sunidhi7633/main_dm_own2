"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../components/ToastProvider";

export default function DesignerQueue() {
  const toast = useToast();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // per-item asset URL: keyed by item._id
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  // which items are showing the "Upload Custom Asset" URL input
  const [uploadOpen, setUploadOpen] = useState<Record<string, boolean>>({});

  // Role guard — redirect non-designers on mount
  useEffect(() => {
    const role = localStorage.getItem("user_role");
    if (role && role !== "designer") {
      router.replace("/");
    }
  }, [router]);

  const fetchQueue = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/review/designer-queue`, {
        headers: { Authorization: `Bearer ${token}` },
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
    const interval = setInterval(fetchQueue, 300000);
    return () => clearInterval(interval);
  }, []);

  const callApprove = async (id: string, assetUrl?: string) => {
    const token = localStorage.getItem("access_token");
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/review/designer-approve/${id}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "approve", asset_url: assetUrl ?? "" }),
      }
    );
    return res;
  };

  const handleApproveVisual = async (id: string) => {
    const res = await callApprove(id);
    if (res.ok) {
      toast.success("Visual approved. Content unlocked for DM Leader.");
      setItems(items.filter(i => i._id !== id));
    } else {
      const err = await res.json();
      toast.error(`Error: ${err.detail || "Failed to approve"}`);
    }
  };

  const handleUploadAsset = async (id: string) => {
    const url = assetUrls[id]?.trim();
    if (!url) {
      toast.error("Paste an asset URL first.");
      return;
    }
    const res = await callApprove(id, url);
    if (res.ok) {
      toast.success("Asset attached and visual approved.");
      setItems(items.filter(i => i._id !== id));
      setAssetUrls(prev => { const n = { ...prev }; delete n[id]; return n; });
      setUploadOpen(prev => { const n = { ...prev }; delete n[id]; return n; });
    } else {
      const err = await res.json();
      toast.error(`Error: ${err.detail || "Failed to upload"}`);
    }
  };

  if (loading) return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "60px 20px" }}>
      <h1 className="font-serif" style={{ fontSize: "36px", fontWeight: 500, marginBottom: "8px", color: "var(--ink)", letterSpacing: "-0.5px" }}>Designer Queue</h1>
      <p style={{ color: "var(--muted)", marginBottom: "32px", fontSize: "15px" }}>
        Review generated text and attach final visuals. Approving here unlocks the content for the DM Leader.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {[1, 2].map(i => (
          <div key={i} style={{ background: "#ffffff", border: "1px solid var(--hairline)", borderRadius: "16px", padding: "32px", boxShadow: "0 4px 24px rgba(0,0,0,0.03)" }}>
            <div className="skeleton" style={{ width: "120px", height: "24px", marginBottom: "20px" }} />
            <div className="skeleton" style={{ width: "100%", height: "80px", marginBottom: "24px", borderRadius: "12px" }} />
            <div style={{ display: "flex", gap: "12px" }}>
              <div className="skeleton" style={{ width: "160px", height: "40px", borderRadius: "8px" }} />
              <div className="skeleton" style={{ width: "160px", height: "40px", borderRadius: "8px" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="page-container" style={{ maxWidth: 800 }}>
      <style>{`
        @media (max-width: 768px) {
          .dq-card { padding: 20px !important; }
          .dq-header { font-size: 28px !important; }
          .dq-url-row { flex-direction: column !important; }
          .dq-url-row input { min-width: 0 !important; }
        }
      `}</style>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "8px" }}>
        <h1 className="dq-header font-serif" style={{ fontSize: "36px", fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.5px" }}>
          Designer Queue
        </h1>
        {items.length > 0 && (
          <span style={{ fontSize: "14px", color: "var(--muted)" }}>
            {items.length} item{items.length !== 1 ? "s" : ""} pending
          </span>
        )}
      </div>
      <p style={{ color: "var(--muted)", marginBottom: "32px", fontSize: "15px" }}>
        Review generated text and attach final visuals. Approving here unlocks the content for the DM Leader.
      </p>

      {items.length === 0 && (
        <div style={{ padding: "60px 40px", textAlign: "center", background: "#ffffff", border: "1px solid var(--hairline)", borderRadius: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
          <p style={{ color: "var(--muted)", fontSize: "15px" }}>No visuals pending your review! 🎨</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {items.map(item => (
          <div key={item._id} className="dq-card" style={{
            background: "#ffffff",
            border: "1px solid var(--hairline)",
            borderRadius: "16px",
            padding: "32px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.03)",
          }}>
            {/* Header row */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
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
              <span style={{ fontSize: "13px", color: "var(--muted)" }}>
                {(item.platform || []).join(", ")}
              </span>
              {item.format && (
                <span style={{ padding: "3px 10px", background: "var(--surface-soft)", color: "var(--muted)", borderRadius: "20px", fontSize: "12px" }}>
                  {item.format}
                </span>
              )}
            </div>

            {/* Content preview */}
            <div style={{
              padding: "20px",
              background: "var(--canvas)",
              borderRadius: "12px",
              fontSize: "15px",
              lineHeight: 1.6,
              marginBottom: "24px",
              border: "1px solid var(--hairline)",
              whiteSpace: "pre-wrap",
            }}>
              <strong style={{ display: "block", marginBottom: "8px", color: "var(--muted)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.6px" }}>
                AI Generated Content
              </strong>
              {item.content_body}
            </div>

            {/* Upload panel (conditional) */}
            {uploadOpen[item._id] && (
              <div style={{
                marginBottom: "16px",
                padding: "16px",
                background: "var(--surface-soft)",
                borderRadius: "10px",
                border: "1px solid var(--hairline)",
              }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "8px", color: "var(--ink)" }}>
                  Asset URL (S3, CDN, or direct link)
                </label>
                <div className="dq-url-row" style={{ display: "flex", gap: "10px" }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="https://s3.amazonaws.com/.../image.jpg"
                    value={assetUrls[item._id] ?? ""}
                    onChange={e => setAssetUrls(prev => ({ ...prev, [item._id]: e.target.value }))}
                    style={{ flex: 1 }}
                  />
                  <button className="btn-primary" onClick={() => handleUploadAsset(item._id)}>
                    Attach & Approve
                  </button>
                  <button className="btn-ghost" onClick={() => setUploadOpen(prev => ({ ...prev, [item._id]: false }))}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button
                className="btn-primary"
                onClick={() => handleApproveVisual(item._id)}
              >
                ✅ Approve Visual
              </button>
              <button
                className="btn-ghost"
                onClick={() => setUploadOpen(prev => ({ ...prev, [item._id]: !prev[item._id] }))}
              >
                📎 Upload Custom Asset
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
