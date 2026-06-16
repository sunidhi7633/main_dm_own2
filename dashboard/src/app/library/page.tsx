"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "../components/ToastProvider";
import { UploadCloud, Copy, Paperclip, Trash2 } from "lucide-react";

const FILTER_TYPES = ["All", "Logos", "Photos", "Visuals", "Reports", "PDFs", "Videos"];
const TYPE_MAP: Record<string, string> = {
  Logos: "logo", Photos: "photo", Visuals: "visual",
  Reports: "report", PDFs: "pdf", Videos: "video",
};
const BRANDS = ["All", "hcllp", "blue_arrow_cpa", "advisory", "shared"];

function fileEmoji(type: string) {
  if (type === "logo") return "🖼️";
  if (type === "photo") return "📷";
  if (type === "visual") return "🎨";
  if (type === "report") return "📊";
  if (type === "pdf") return "📄";
  if (type === "video") return "🎬";
  return "📁";
}

export default function DMLibrary() {
  const toast = useToast();
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PER_PAGE = 40;

  // Filters
  const [filterType, setFilterType] = useState("All");
  const [filterBrand, setFilterBrand] = useState("All");
  const [search, setSearch] = useState("");

  // Upload
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadBrand, setUploadBrand] = useState("hcllp");
  const [uploadType, setUploadType] = useState("visual");
  const [tags, setTags] = useState("");
  const [progress, setProgress] = useState(0);   // 0–100
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const role = typeof window !== "undefined" ? localStorage.getItem("user_role") ?? "admin" : "admin";
  const canDelete = role === "dm_leader" || role === "designer" || role === "admin";

  const fetchAssets = async (targetPage = page) => {
    try {
      const token = localStorage.getItem("access_token");
      const params = new URLSearchParams({ page: String(targetPage), per_page: String(PER_PAGE) });
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/library/assets?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets ?? []);
        setTotal(data.total ?? 0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAssets(page); }, [page]);
  useEffect(() => { setPage(1); fetchAssets(1); }, [filterType, filterBrand, search]);

  // Derived filtered list
  const filtered = assets.filter(a => {
    if (filterType !== "All" && a.file_type !== TYPE_MAP[filterType]) return false;
    if (filterBrand !== "All" && a.brand !== filterBrand) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = (a.original_name || "").toLowerCase();
      const tagStr = (a.tags || []).join(" ").toLowerCase();
      if (!name.includes(q) && !tagStr.includes(q)) return false;
    }
    return true;
  });

  // Drag-and-drop handlers
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(true);
  }, []);
  const onDragLeave = useCallback(() => setDragOver(false), []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) setPendingFiles(prev => [...prev, ...dropped]);
  }, []);

  const handleUpload = () => {
    if (!pendingFiles.length) { toast.error("Select or drop files first."); return; }
    const token = localStorage.getItem("access_token");
    const formData = new FormData();
    pendingFiles.forEach(f => formData.append("files", f));
    formData.append("brand", uploadBrand);
    formData.append("file_type", uploadType);
    formData.append("tags", tags);

    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      setUploading(false);
      setProgress(0);
      if (xhr.status >= 200 && xhr.status < 300) {
        toast.success(`${pendingFiles.length} file(s) uploaded!`);
        setPendingFiles([]);
        setTags("");
        fetchAssets();
      } else {
        try { toast.error(JSON.parse(xhr.responseText).detail || "Upload failed"); }
        catch { toast.error("Upload failed"); }
      }
    };
    xhr.onerror = () => { setUploading(false); setProgress(0); toast.error("Network error during upload."); };
    xhr.open("POST", `${process.env.NEXT_PUBLIC_API_URL}/api/library/upload`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    setUploading(true);
    setProgress(1);
    xhr.send(formData);
  };

  const handleDelete = async (file_id: string) => {
    if (!confirm("Delete this asset?")) return;
    const token = localStorage.getItem("access_token");
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/library/assets/${file_id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setAssets(a => a.filter(x => x.file_id !== file_id));
      setSelected(s => { const n = new Set(s); n.delete(file_id); return n; });
      toast.success("Asset deleted.");
    } else {
      toast.error("Failed to delete.");
    }
  };

  const copyUrl = (asset: any) => {
    const url = asset.url || asset.thumbnail_url || "";
    navigator.clipboard.writeText(url);
    toast.success("URL copied to clipboard!");
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <div className="page-container" style={{ maxWidth: 1200 }}>
      <style>{`
        @media (max-width: 768px) {
          .lib-upload-controls { flex-direction: column !important; }
          .lib-upload-controls select, .lib-upload-controls input { min-width: 0 !important; width: 100% !important; }
          .lib-filters { flex-direction: column !important; gap: 10px !important; }
          .lib-filters select { width: 100% !important; }
          .lib-asset-title { font-size: 28px !important; }
        }
      `}</style>
      <h1 className="lib-asset-title font-serif" style={{ fontSize: "36px", fontWeight: 500, marginBottom: "8px", color: "var(--ink)", letterSpacing: "-0.5px" }}>
        DM Asset Library
      </h1>
      <p style={{ color: "var(--muted)", marginBottom: "32px", fontSize: "15px" }}>
        Store and reuse approved graphics, logos, and reports.
      </p>

      {/* ── Upload zone ── */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          background: dragOver ? "rgba(204,120,92,0.06)" : "#ffffff",
          border: `2px dashed ${dragOver ? "var(--primary)" : "var(--hairline)"}`,
          borderRadius: "16px",
          padding: "28px 32px",
          marginBottom: "32px",
          transition: "all 0.2s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: 600, color: "var(--ink)", margin: 0 }}>Upload Assets</h2>
          {pendingFiles.length > 0 && (
            <span style={{ fontSize: "13px", color: "var(--primary-active)", fontWeight: 600 }}>
              {pendingFiles.length} file(s) ready
            </span>
          )}
        </div>

        {/* Drop target */}
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: "8px", padding: "32px", background: "var(--canvas)", borderRadius: "12px",
            border: "1px dashed var(--hairline)", cursor: "pointer", marginBottom: "20px",
            transition: "background 0.15s",
          }}
        >
          <UploadCloud size={28} color="var(--muted)" />
          <span style={{ fontSize: "14px", color: "var(--muted)" }}>
            Drag &amp; drop files here, or <strong style={{ color: "var(--primary-active)" }}>browse</strong>
          </span>
          {pendingFiles.length > 0 && (
            <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "6px", justifyContent: "center" }}>
              {pendingFiles.map((f, i) => (
                <span key={i} style={{ fontSize: "12px", padding: "3px 10px", background: "var(--surface-soft)", borderRadius: "20px", color: "var(--ink)" }}>
                  {f.name}
                </span>
              ))}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={e => {
              const picked = Array.from(e.target.files ?? []);
              if (picked.length) setPendingFiles(prev => [...prev, ...picked]);
              e.target.value = "";
            }}
          />
        </div>

        {/* Upload options row */}
        <div className="lib-upload-controls" style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Brand</label>
            <select className="input-field" value={uploadBrand} onChange={e => setUploadBrand(e.target.value)} style={{ height: "38px", minWidth: "160px" }}>
              <option value="hcllp">HCLLP</option>
              <option value="blue_arrow_cpa">Blue Arrow CPA</option>
              <option value="advisory">Advisory</option>
              <option value="shared">Shared</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Type</label>
            <select className="input-field" value={uploadType} onChange={e => setUploadType(e.target.value)} style={{ height: "38px", minWidth: "140px" }}>
              <option value="logo">Logo</option>
              <option value="photo">Photo</option>
              <option value="visual">Visual</option>
              <option value="report">Report</option>
              <option value="pdf">PDF</option>
              <option value="video">Video</option>
            </select>
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Tags</label>
            <input className="input-field" type="text" value={tags} onChange={e => setTags(e.target.value)} placeholder="tax, 2026, hero" style={{ height: "38px" }} />
          </div>
          <button
            className="btn-primary"
            onClick={handleUpload}
            disabled={uploading || pendingFiles.length === 0}
            style={{ height: "38px", padding: "0 24px", flexShrink: 0 }}
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
          {pendingFiles.length > 0 && (
            <button className="btn-ghost" onClick={() => setPendingFiles([])} style={{ height: "38px" }}>
              Clear
            </button>
          )}
        </div>

        {/* Progress bar */}
        {uploading && (
          <div style={{ marginTop: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
              <span>Uploading {pendingFiles.length} file(s)…</span>
              <span>{progress}%</span>
            </div>
            <div style={{ height: "6px", background: "var(--hairline)", borderRadius: "4px", overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${progress}%`,
                background: "var(--primary)",
                borderRadius: "4px",
                transition: "width 0.2s ease",
              }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Filters + Search ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", marginBottom: "24px" }}>
        {/* Type chips */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {FILTER_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              style={{
                padding: "5px 14px",
                borderRadius: "20px",
                border: "1px solid",
                borderColor: filterType === t ? "var(--primary)" : "var(--hairline)",
                background: filterType === t ? "var(--primary)" : "transparent",
                color: filterType === t ? "#fff" : "var(--muted)",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Brand filter */}
        <select
          className="input-field"
          value={filterBrand}
          onChange={e => setFilterBrand(e.target.value)}
          style={{ height: "34px", fontSize: "13px", padding: "0 10px", minWidth: "140px" }}
        >
          {BRANDS.map(b => <option key={b} value={b}>{b === "All" ? "All Brands" : b}</option>)}
        </select>

        {/* Search */}
        <input
          className="input-field"
          type="text"
          placeholder="Search by name or tag…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ height: "34px", fontSize: "13px", flex: "1 1 180px", minWidth: "180px" }}
        />

        <span style={{ fontSize: "13px", color: "var(--muted)", marginLeft: "auto" }}>
          {filtered.length} asset{filtered.length !== 1 ? "s" : ""}
          {selected.size > 0 && <> · <strong style={{ color: "var(--primary-active)" }}>{selected.size} selected</strong></>}
        </span>
      </div>

      {/* ── Asset grid ── */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "20px" }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{ background: "#fff", borderRadius: "14px", border: "1px solid var(--hairline)", overflow: "hidden" }}>
              <div className="skeleton" style={{ height: "160px" }} />
              <div style={{ padding: "16px" }}>
                <div className="skeleton" style={{ width: "70%", height: "16px", marginBottom: "10px" }} />
                <div className="skeleton" style={{ width: "50%", height: "12px" }} />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: "60px", textAlign: "center", background: "#fff", borderRadius: "16px", border: "1px solid var(--hairline)" }}>
          <p style={{ color: "var(--muted)" }}>No assets match your filters.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "20px" }}>
          {filtered.map(asset => {
            const isSelected = selected.has(asset.file_id);
            const isImage = ["logo","photo","visual"].includes(asset.file_type);

            return (
              <div
                key={asset.file_id}
                style={{
                  background: "#fff",
                  borderRadius: "14px",
                  border: `1.5px solid ${isSelected ? "var(--primary)" : "var(--hairline)"}`,
                  boxShadow: isSelected ? "0 0 0 3px rgba(204,120,92,0.15)" : "0 4px 20px rgba(0,0,0,0.03)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
              >
                {/* Thumbnail */}
                <div
                  onClick={() => toggleSelect(asset.file_id)}
                  style={{
                    height: "160px",
                    background: "var(--canvas)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderBottom: "1px solid var(--hairline)",
                    cursor: "pointer",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {isImage && asset.url ? (
                    <img src={asset.url} alt={asset.original_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ fontSize: "48px" }}>{fileEmoji(asset.file_type)}</span>
                  )}
                  {/* Selection checkbox overlay */}
                  <div style={{
                    position: "absolute", top: "10px", left: "10px",
                    width: "20px", height: "20px",
                    borderRadius: "5px",
                    background: isSelected ? "var(--primary)" : "rgba(255,255,255,0.85)",
                    border: `2px solid ${isSelected ? "var(--primary)" : "rgba(0,0,0,0.15)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s",
                  }}>
                    {isSelected && <span style={{ color: "#fff", fontSize: "12px", lineHeight: 1 }}>✓</span>}
                  </div>
                </div>

                {/* Card body */}
                <div style={{ padding: "16px", flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {asset.original_name}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "12px" }}>
                    <span style={{ color: "var(--primary-active)", fontWeight: 600, textTransform: "uppercase" }}>{asset.brand}</span>
                    {" · "}{asset.file_type}
                    {asset.size_bytes ? ` · ${(asset.size_bytes / 1024).toFixed(0)} KB` : ""}
                  </div>
                  {(asset.tags || []).length > 0 && (
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "12px" }}>
                      {asset.tags.slice(0, 4).map((t: string) => (
                        <span key={t} style={{ fontSize: "10px", padding: "2px 7px", background: "var(--surface-soft)", color: "var(--ink)", borderRadius: "4px" }}>#{t}</span>
                      ))}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ marginTop: "auto", display: "flex", gap: "6px" }}>
                    <button
                      className="btn-ghost"
                      onClick={() => copyUrl(asset)}
                      title="Copy URL"
                      style={{ flex: 1, padding: "7px 8px", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                    >
                      <Copy size={13} /> Copy URL
                    </button>
                    <button
                      className="btn-ghost"
                      onClick={() => {
                        const url = asset.url || asset.thumbnail_url || "";
                        navigator.clipboard.writeText(url);
                        toast.success("Asset URL ready — paste into post editor.");
                      }}
                      title="Use in post"
                      style={{ flex: 1, padding: "7px 8px", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                    >
                      <Paperclip size={13} /> Use in post
                    </button>
                    {canDelete && (
                      <button
                        className="btn-ghost"
                        onClick={() => handleDelete(asset.file_id)}
                        title="Delete"
                        style={{ padding: "7px 10px", color: "var(--error)", borderColor: "rgba(198,69,69,0.2)" }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && total > PER_PAGE && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 28 }}>
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            style={{ padding: "7px 18px", borderRadius: 8, border: "1px solid var(--hairline)", background: page === 1 ? "var(--surface-soft)" : "#fff", cursor: page === 1 ? "default" : "pointer", fontSize: 13, fontWeight: 500, color: page === 1 ? "var(--muted)" : "var(--ink)" }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            Page {page} of {Math.ceil(total / PER_PAGE)} &middot; {total} total
          </span>
          <button
            disabled={page * PER_PAGE >= total}
            onClick={() => setPage(p => p + 1)}
            style={{ padding: "7px 18px", borderRadius: 8, border: "1px solid var(--hairline)", background: page * PER_PAGE >= total ? "var(--surface-soft)" : "#fff", cursor: page * PER_PAGE >= total ? "default" : "pointer", fontSize: 13, fontWeight: 500, color: page * PER_PAGE >= total ? "var(--muted)" : "var(--ink)" }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
