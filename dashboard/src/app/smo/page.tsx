"use client";

import React, { useState } from 'react';
import { useToast } from "../components/ToastProvider";

type Post = {
  id: number;
  title: string;
  platform: "LinkedIn" | "Facebook" | "Instagram";
  caption: string;
  tag: string;
  status: string;
  age?: string;
};


const platformColor: Record<string, string> = {
  LinkedIn: "rgb(0 119 181)",
  Facebook: "rgb(24 119 242)",
  Instagram: "rgb(225 48 108)",
};

function HarshwalLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 7,
        background: 'linear-gradient(135deg, #cc785c 0%, #a9583e 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 800, color: 'white', letterSpacing: '-0.5px',
      }}>H</div>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e6e1' }}>SMO Workflow</span>
    </div>
  );
}

export default function SMOWorkflowPage() {
  const toast = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [activePipeline, setActivePipeline] = useState('designer_review');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickTopic, setQuickTopic] = useState("");
  const [generatingQuick, setGeneratingQuick] = useState(false);
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editCaption, setEditCaption] = useState<string>("");

  const fetchPosts = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/smo/posts");
      if (res.ok) {
        setPosts(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchPosts();
  }, []);

  const handleApprove = async (id: number) => {
    try {
      await fetch(`http://localhost:8000/api/smo/approve/${id}`, { method: 'PATCH' });
      fetchPosts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (id: number) => {
    try {
      await fetch(`http://localhost:8000/api/smo/reject/${id}`, { method: 'PATCH' });
      fetchPosts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (post: Post) => {
    setEditingPostId(post.id);
    setEditCaption(post.caption);
  };

  const handleCancelEdit = () => {
    setEditingPostId(null);
    setEditCaption("");
  };

  const handleSaveEdit = async (id: number) => {
    try {
      await fetch(`http://localhost:8000/api/smo/edit/${id}`, {
        method: 'PATCH',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption: editCaption })
      });
      setEditingPostId(null);
      fetchPosts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuickGenerate = async () => {
    if (!quickTopic.trim()) return;
    setGeneratingQuick(true);
    try {
      const aiRes = await fetch("http://localhost:8000/api/brand-voice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_name: "Harshwal & Company",
          platform: "LinkedIn",
          tone: "Professional",
          topic: quickTopic
        })
      });
      if (!aiRes.ok) throw new Error("AI generation failed");
      const { caption } = await aiRes.json();

      await fetch("http://localhost:8000/api/smo/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Quick Draft: ${quickTopic.slice(0, 20)}...`,
          platform: "LinkedIn",
          caption: caption,
          tag: "Auto-Generated",
        })
      });
      
      setQuickTopic("");
      fetchPosts();
    } catch (e) {
      console.error(e);
      toast.error("Quick generation failed.");
    } finally {
      setGeneratingQuick(false);
    }
  };

  // Filter posts by pipeline stage
  const visiblePosts = posts.filter(p => p.status === activePipeline || (activePipeline === 'ready' && p.status === 'published'));

  const pipelineStages = [
    { id: 'designer_review', label: "Designer Review", count: posts.filter(p => p.status === 'designer_review').length },
    { id: 'manager_review', label: "Manager Review", count: posts.filter(p => p.status === 'manager_review').length },
    { id: 'ready', label: "Ready to Publish", count: posts.filter(p => p.status === 'published').length },
    { id: 'history', label: "Published History", count: null },
  ];

  return (
    <>
      <style>{`
        /* ── Global resets for this page ── */
        body { margin: 0; }

        /* ── Animations ── */
        @keyframes fadeIn {
          from { opacity:0; } to { opacity:1; }
        }

        /* ── Sidebar ── */
        .gpt-sidebar {
          width: 260px;
          flex-shrink: 0;
          background: #171717;
          display: flex;
          flex-direction: column;
          height: 100%;
          border-right: 1px solid rgba(255,255,255,0.06);
          transition: width 0.22s ease;
          overflow: hidden;
        }
        .gpt-sidebar.collapsed { width: 0; }

        .sidebar-item {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          padding: 8px 12px; border-radius: 8px; cursor: pointer;
          font-size: 13.5px; color: #c5c5c5; font-family: var(--font-sans);
          transition: background 150ms; border: none; background: transparent;
          text-align: left; width: 100%; white-space: nowrap; overflow: hidden;
        }
        .sidebar-item:hover { background: rgba(255,255,255,0.07); color: #e8e8e8; }
        .sidebar-item.active { 
          background: linear-gradient(to right, rgba(204,120,92,0.15), rgba(204,120,92,0.05)); 
          color: #f0f0f0; 
          font-weight:500; 
          border-left: 2px solid #cc785c;
          border-radius: 4px 8px 8px 4px;
        }

        .pipeline-badge {
          background: rgba(255,255,255,0.1);
          color: #c5c5c5;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 9999px;
        }
        .sidebar-item.active .pipeline-badge {
          background: #cc785c;
          color: white;
        }

        /* Generate input */
        .gen-input {
          width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px; padding: 10px 12px; color: white; font-family: var(--font-sans);
          font-size: 13px; outline: none; transition: border-color 150ms;
        }
        .gen-input:focus { border-color: rgba(255,255,255,0.3); }
        .gen-input::placeholder { color: rgba(255,255,255,0.4); }

        .gen-btn {
          width: 100%; background: linear-gradient(135deg, #cc785c, #a9583e); border: none; border-radius: 8px;
          padding: 10px; color: white; font-family: var(--font-sans); font-size: 13px;
          font-weight: 600; cursor: pointer; transition: all 200ms ease;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          box-shadow: 0 2px 8px rgba(204,120,92,0.2);
        }
        .gen-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(204,120,92,0.3); filter: brightness(1.05); }

        /* ── Post Cards ── */
        .post-card {
          background: #ffffff;
          border: 1px solid var(--hairline);
          border-radius: 16px;
          padding: 28px;
          display: flex;
          gap: 32px;
          transition: all 0.2s ease;
          box-shadow: 0 4px 20px rgba(0,0,0,0.03);
        }
        .post-card:hover {
          box-shadow: 0 8px 32px rgba(0,0,0,0.05);
          transform: translateY(-2px);
        }

        .img-preview-box {
          aspect-ratio: 1.91;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid var(--hairline);
          position: relative;
          background: var(--surface-soft);
        }

        .caption-box {
          padding: 20px;
          background: var(--canvas);
          border: 1px solid var(--hairline);
          border-radius: 12px;
          font-size: 14.5px;
          color: var(--ink);
          line-height: 1.65;
          white-space: pre-wrap;
          margin-bottom: 24px;
        }
        
        .action-btn {
          height: 36px;
          padding: 0 16px;
          border-radius: 8px;
          font-family: var(--font-sans);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          white-space: nowrap;
        }
        .action-btn.approve {
          background: var(--primary);
          color: #ffffff;
          border: none;
        }
        .action-btn.approve:hover {
          background: var(--primary-active);
        }
        .action-btn.edit {
          background: #ffffff;
          color: var(--ink);
          border: 1px solid var(--hairline);
        }
        .action-btn.edit:hover {
          background: var(--surface-soft);
        }
        .action-btn.reject {
          background: #ffffff;
          color: var(--error);
          border: 1px solid rgba(198, 69, 69, 0.2);
        }
        .action-btn.reject:hover {
          background: rgba(198, 69, 69, 0.05);
        }

        /* ── Sidebar toggle ── */
        .toggle-btn {
          background:transparent; border:none; cursor:pointer;
          color:#9a9a9a; padding:6px; border-radius:6px;
          display:flex; align-items:center; justify-content:center;
          transition:background 150ms, color 150ms;
        }
        .toggle-btn:hover { background:rgba(255,255,255,0.08); color:#e0e0e0; }
        .toggle-btn.dark-icon:hover { background:rgba(0,0,0,0.05); color:#333; }

        /* ── Mobile ── */
        @media (max-width:768px) {
          .gpt-sidebar { position:fixed!important; top:60px; left:0; height:calc(100vh - 60px); z-index:60; width:300px!important; transform:translateX(-100%); transition:transform 0.24s ease!important; }
          .gpt-sidebar.mobile-open { transform:translateX(0)!important; }
          .sidebar-overlay { display:block!important; }
          .toggle-btn-mobile { display:flex!important; }
          .desktop-toggle { display:none!important; }
          .post-card { flex-direction: column; gap: 16px; padding: 16px; }
          .img-preview { width: 100%!important; }
          .main-feed-pad { padding: 24px 16px!important; }
          .action-btn-group { flex-direction: column; gap: 10px!important; }
          .action-btn { padding: 12px!important; font-size: 14.5px!important; }
          .caption-box { padding: 16px; margin-bottom: 16px; }
        }
        .sidebar-overlay {
          display:none; position:fixed; inset:0; top:60px;
          background:rgba(0,0,0,0.5); z-index:55;
          backdrop-filter:blur(2px);
          animation:fadeIn 0.18s ease;
        }
        .toggle-btn-mobile { display:none; }

      `}</style>

      <div style={{ display:'flex', height:'calc(100vh - 60px)', overflow:'hidden', background:'#fbfaf8', fontFamily:'var(--font-sans)' }}>

        {/* Mobile overlay */}
        {mobileSidebar && <div className="sidebar-overlay" onClick={() => setMobileSidebar(false)} />}

        {/* ── Sidebar ── */}
        <aside className={`gpt-sidebar${!sidebarOpen ? ' collapsed' : ''}${mobileSidebar ? ' mobile-open' : ''}`}>
          {/* Header */}
          <div style={{ padding:'16px 14px 12px', display:'flex', alignItems:'center', gap:8, borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
            <HarshwalLogo />
            <button className="toggle-btn desktop-toggle" onClick={() => setSidebarOpen(false)} style={{ marginLeft:'auto' }} title="Collapse sidebar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>
              </svg>
            </button>
          </div>

          {/* Pipeline */}
          <div style={{ flex:1, overflowY:'auto', padding:'12px 12px' }}>
            <p style={{ fontSize:10.5, fontWeight:700, color:'#606060', letterSpacing:'0.6px', textTransform:'uppercase', marginBottom:6, padding:'4px 2px' }}>Pipeline</p>

            {pipelineStages.map(stage => (
              <button key={stage.id} className={`sidebar-item${activePipeline === stage.id ? ' active' : ''}`}
                onClick={() => { setActivePipeline(stage.id); setMobileSidebar(false); }}>
                <span className="sidebar-item-text">{stage.label}</span>
                {stage.count !== null && (
                  <span className="pipeline-badge">{stage.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Footer - Quick Generate */}
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', padding:'16px 14px', flexShrink:0 }}>
            <p style={{ fontSize:10.5, fontWeight:700, color:'#606060', letterSpacing:'0.6px', textTransform:'uppercase', marginBottom:12, padding:'0 2px' }}>Quick Generate</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input
                type="text"
                className="gen-input"
                placeholder="Event name (e.g. Tax Day)"
                value={quickTopic}
                onChange={e => setQuickTopic(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleQuickGenerate()}
                disabled={generatingQuick}
              />
              <button className="gen-btn" onClick={handleQuickGenerate} disabled={generatingQuick}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
                {generatingQuick ? "Generating..." : "Generate Drafts"}
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>

          {/* Top bar */}
          <div style={{
            height:52, flexShrink:0,
            borderBottom:'1px solid #eeece9',
            display:'flex', alignItems:'center', gap:10, padding:'0 20px',
            background:'#fff',
          }}>
            {/* Sidebar toggle (desktop) */}
            {!sidebarOpen && (
              <button className="toggle-btn desktop-toggle dark-icon" onClick={() => setSidebarOpen(true)} title="Open sidebar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>
                </svg>
              </button>
            )}

            {/* Mobile menu */}
            <button className="toggle-btn toggle-btn-mobile dark-icon" style={{ flexShrink: 0 }} onClick={() => setMobileSidebar(o => !o)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>

            <h1 style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a', margin: 0, paddingLeft: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>Review Queue</h1>
            
            <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center', flexShrink: 0 }}>
              <span style={{ fontSize:11, fontWeight:600, padding:'4px 9px', borderRadius:99, background:'#f5ede8', color:'#cc785c', letterSpacing:'0.3px', whiteSpace: 'nowrap' }}>SMO Agent</span>
            </div>
          </div>

          {/* Main Feed */}
          <main className="main-feed-pad" style={{ flex: 1, overflowY: "auto", padding: "32px 40px" }}>
            <div style={{ maxWidth: "860px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
              
              <div style={{ marginBottom: "8px" }}>
                <p style={{ fontSize: "15px", color: "#666", margin: 0 }}>
                  {loading ? "Loading posts..." : `${visiblePosts.length} posts in this stage.`}
                </p>
              </div>

              {visiblePosts.map(post => (
                <div key={post.id} className="post-card">
                  {/* Image Preview */}
                  <div className="img-preview" style={{ flexShrink: 0, width: "340px" }}>
                    <div className="img-preview-box">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/og?title=${encodeURIComponent(post.title)}&category=${encodeURIComponent(post.tag)}`}
                        alt="Social graphic"
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: 'block' }}
                      />
                    </div>
                  </div>

                  {/* Content & Actions */}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{
                              padding: "3px 10px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: 700,
                              letterSpacing: "0.5px",
                              textTransform: "uppercase",
                              backgroundColor: platformColor[post.platform] + "18",
                              color: platformColor[post.platform],
                            }}>{post.platform}</span>
                            <span style={{ fontSize: "12px", color: "#888" }}>{post.age}</span>
                          </div>
                          <h3 style={{ fontFamily: "var(--font-sans)", fontSize: "18px", fontWeight: 600, color: "#1a1a1a", margin: 0 }}>
                            {post.title}
                          </h3>
                        </div>
                      </div>

                      {editingPostId === post.id ? (
                        <textarea 
                          className="caption-box" 
                          style={{ width: "100%", outline: "none", resize: "vertical", minHeight: "120px", fontFamily: "inherit" }}
                          value={editCaption}
                          onChange={(e) => setEditCaption(e.target.value)}
                        />
                      ) : (
                        <div className="caption-box">
                          {post.caption}
                        </div>
                      )}
                    </div>

                    <div className="action-btn-group" style={{ display: "flex", gap: "10px" }}>
                      {editingPostId === post.id ? (
                        <>
                          <button className="action-btn approve" onClick={() => handleSaveEdit(post.id)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline>
                            </svg>
                            Save
                          </button>
                          <button className="action-btn reject" onClick={handleCancelEdit}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="action-btn approve" onClick={() => handleApprove(post.id)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            Approve
                          </button>
                          <button className="action-btn edit" onClick={() => handleEdit(post)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                            </svg>
                            Edit
                          </button>
                          <button className="action-btn reject" onClick={() => handleReject(post.id)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                            Reject & Regenerate
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
