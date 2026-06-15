"use client";

import React, { useState, useRef, useEffect } from "react";
import { useToast } from "../components/ToastProvider";

const brands = [
  {
    id: "harshwal",
    name: "Harshwal & Company",
    domain: "harshwalconsulting.com",
    logo: "/Harshwal.png",
    tone: "Professional, warm, trustworthy. Focused on CPA, tax, and advisory services.",
  },
  {
    id: "bluearrow",
    name: "Blue Arrow CPA",
    domain: "bluearrowcpa.com",
    logo: null,
    initials: "BA",
    tone: "Concise, modern, data-driven. Focused on tech startups and bookkeeping.",
  },
];

const platforms = ["LinkedIn", "Twitter / X", "Instagram", "Facebook"];
const tones = ["Professional", "Conversational", "Inspirational", "Educational", "Promotional"];

type GeneratedPost = {
  caption: string;
  hashtags: string[];
  platform: string;
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
      <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e6e1' }}>Brand Voice</span>
    </div>
  );
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '4px 0', maxWidth: 720, margin: '0 auto' }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg, #cc785c, #a9583e)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, color: 'white',
        boxShadow: '0 2px 8px rgba(204,120,92,0.3)',
        marginTop: 2,
      }}>T</div>
      <div style={{
        display: 'flex', gap: 5, alignItems: 'center',
        padding: '10px 0', marginTop: 4,
      }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#9a9a9a',
            display: 'inline-block',
            animation: `tDot 1.3s ease-in-out ${i * 0.18}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

export default function BrandVoicePage() {
  const toast = useToast();
  const [selectedBrand, setSelectedBrand] = useState(brands[0].id);
  const [platform, setPlatform] = useState("LinkedIn");
  const [tone, setTone] = useState("Professional");
  
  const [topic, setTopic] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedPost | null>(null);
  const [copied, setCopied] = useState(false);
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [generated, isGenerating]);

  const resizeTA = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    setGenerated(null);

    try {
      const res = await fetch("http://localhost:8000/api/brand-voice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_name: selectedBrand,
          platform: platform,
          tone: tone,
          topic: topic
        })
      });
      
      if (!res.ok) throw new Error("API failed");
      const data = await res.json();
      
      setGenerated({
        caption: data.caption,
        hashtags: ["#CPA", "#TaxPlanning", "#HarshwalConsulting"],
        platform
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate content. Please ensure backend is running.");
    } finally {
      setIsGenerating(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); }
  };

  const copyToClipboard = () => {
    if (!generated) return;
    navigator.clipboard.writeText(`${generated.caption}\n\n${generated.hashtags.join(" ")}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendToSMO = async () => {
    if (!generated) return;
    try {
      const res = await fetch("http://localhost:8000/api/smo/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Brand Voice: ${topic.slice(0, 25)}${topic.length > 25 ? '...' : ''}`,
          platform: generated.platform,
          caption: generated.caption + "\n\n" + generated.hashtags.join(" "),
          tag: tone,
        })
      });
      if (res.ok) {
        toast.success("Draft successfully sent to SMO Review Queue!");
      } else {
        toast.error("Failed to send draft to SMO.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error connecting to backend.");
    }
  };

  return (
    <>
      <style>{`
        body { margin: 0; }
        @keyframes tDot {
          0%,60%,100% { transform:translateY(0); opacity:0.35; }
          30% { transform:translateY(-5px); opacity:1; }
        }
        @keyframes fadeIn {
          from { opacity:0; } to { opacity:1; }
        }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .msg-in { animation: fadeUp 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }

        /* Sidebar */
        .gpt-sidebar {
          width: 300px;
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
        
        .sidebar-section {
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .sidebar-title {
          font-size: 11px; font-weight: 700; color: #606060;
          letter-spacing: 0.6px; text-transform: uppercase; margin-bottom: 12px;
        }

        /* Brand Cards */
        .brand-card {
          width: 100%; text-align: left;
          padding: 16px; border-radius: 12px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          cursor: pointer; transition: all 200ms ease;
          margin-bottom: 10px; position: relative;
        }
        .brand-card:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.12); }
        .brand-card.active {
          background: linear-gradient(to bottom right, rgba(204,120,92,0.12), rgba(204,120,92,0.05));
          border-color: rgba(204,120,92,0.4);
        }
        .brand-check {
          position: absolute; top: 10px; right: 10px;
          width: 16px; height: 16px; border-radius: 50%;
          background: #cc785c; display: flex; align-items: center; justify-content: center;
          color: white; font-size: 9px; font-weight: bold;
        }

        /* Pills */
        .pill-btn {
          padding: 6px 12px; border-radius: 99px;
          border: 1px solid rgba(255,255,255,0.1);
          background: transparent; color: #a0a0a0;
          font-size: 12px; font-family: var(--font-sans);
          cursor: pointer; transition: all 150ms;
        }
        .pill-btn:hover { background: rgba(255,255,255,0.05); color: #ddd; }
        .pill-btn.active { background: #e8e6e1; color: #1a1a1a; border-color: #e8e6e1; font-weight: 500; }

        /* Main Input */
        .gpt-input-box {
          background:#f4f4f4; border:1.5px solid #e0e0e0;
          border-radius:16px; padding:12px 14px 12px 18px;
          display:flex; align-items:flex-end; gap:10px;
          transition:border-color 200ms, box-shadow 200ms;
          box-shadow:0 2px 10px rgba(0,0,0,0.06);
        }
        .gpt-input-box:focus-within {
          border-color:#cc785c;
          box-shadow:0 0 0 3px rgba(204,120,92,0.12), 0 2px 10px rgba(0,0,0,0.06);
          background:#fff;
        }
        .gpt-textarea {
          flex:1; border:none; outline:none; background:transparent;
          font-family:var(--font-sans); font-size:15px; color:#1a1a1a;
          resize:none; line-height:1.6; max-height:140px; padding:0;
        }
        .gpt-textarea::placeholder { color:#aaa; }
        
        .action-icon-btn {
          width: 32px; height: 32px; border-radius: 8px; border: none; background: transparent;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          color: #888; transition: all 150ms;
        }
        .action-icon-btn:hover { background: rgba(0,0,0,0.05); color: #444; }

        .send-btn {
          width:36px; height:36px; border-radius:10px; border:none;
          cursor:pointer; display:flex; align-items:center; justify-content:center;
          transition:background 150ms, transform 100ms; flex-shrink:0;
        }
        .send-btn.active { background:#cc785c; }
        .send-btn.active:hover { background:#a9583e; transform:scale(1.06); }
        .send-btn.inactive { background:#e0e0e0; cursor:not-allowed; }

        /* Output Card */
        .output-card {
          padding: 24px 28px;
          background: linear-gradient(to bottom right, #ffffff, #faf9f7);
          border: 1px solid #e8e4df;
          border-radius: 16px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.03);
          margin-bottom: 24px;
          transition: box-shadow 250ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 250ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .output-card:hover {
          box-shadow: 0 8px 30px rgba(204,120,92,0.08);
          transform: translateY(-2px);
        }

        /* Toggles */
        .toggle-btn {
          background:transparent; border:none; cursor:pointer;
          color:#9a9a9a; padding:6px; border-radius:6px;
          display:flex; align-items:center; justify-content:center;
          transition:background 150ms, color 150ms;
        }
        .toggle-btn:hover { background:rgba(255,255,255,0.08); color:#e0e0e0; }
        .toggle-btn.dark-icon:hover { background:rgba(0,0,0,0.05); color:#333; }

        @media (max-width:768px) {
          .gpt-sidebar { position:fixed!important; top:60px; left:0; height:calc(100vh - 60px); z-index:60; width:300px!important; transform:translateX(-100%); transition:transform 0.24s ease!important; }
          .gpt-sidebar.mobile-open { transform:translateX(0)!important; }
          .sidebar-overlay { display:block!important; }
          .toggle-btn-mobile { display:flex!important; }
          .desktop-toggle { display:none!important; }
          .main-pad { padding: 20px 16px!important; }
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

        {mobileSidebar && <div className="sidebar-overlay" onClick={() => setMobileSidebar(false)} />}

        {/* ── Sidebar ── */}
        <aside className={`gpt-sidebar${!sidebarOpen ? ' collapsed' : ''}${mobileSidebar ? ' mobile-open' : ''}`}>
          <div style={{ padding:'16px 20px 12px', display:'flex', alignItems:'center', gap:8, borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
            <HarshwalLogo />
            <button className="toggle-btn desktop-toggle" onClick={() => setSidebarOpen(false)} style={{ marginLeft:'auto' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>
              </svg>
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* 1. Brand */}
            <div className="sidebar-section">
              <div className="sidebar-title">Brand Voice Profile</div>
              {brands.map(brand => (
                <button key={brand.id} className={`brand-card ${selectedBrand === brand.id ? 'active' : ''}`} onClick={() => setSelectedBrand(brand.id)}>
                  {selectedBrand === brand.id && <div className="brand-check">✓</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    {brand.logo ? (
                      <img src={brand.logo} alt={brand.name} style={{ height: 24, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.9 }} />
                    ) : (
                      <div style={{ width: 26, height: 26, borderRadius: 6, background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>{brand.initials}</div>
                    )}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e8e8', marginBottom: 2 }}>{brand.name}</div>
                  <div style={{ fontSize: 11, color: '#888', lineHeight: 1.4 }}>{brand.tone}</div>
                </button>
              ))}
            </div>

            {/* 2. Platform */}
            <div className="sidebar-section">
              <div className="sidebar-title">Target Platform</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {platforms.map(p => (
                  <button key={p} className={`pill-btn ${platform === p ? 'active' : ''}`} onClick={() => setPlatform(p)}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Tone */}
            <div className="sidebar-section" style={{ borderBottom: 'none' }}>
              <div className="sidebar-title">Writing Tone</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {tones.map(t => (
                  <button key={t} className={`pill-btn ${tone === t ? 'active' : ''}`} onClick={() => setTone(t)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main Area ── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
          
          {/* Top bar */}
          <div style={{
            height:52, flexShrink:0, borderBottom:'1px solid #eeece9',
            display:'flex', alignItems:'center', gap:10, padding:'0 20px', background:'#fff',
          }}>
            {!sidebarOpen && (
              <button className="toggle-btn desktop-toggle dark-icon" onClick={() => setSidebarOpen(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>
                </svg>
              </button>
            )}
            <button className="toggle-btn toggle-btn-mobile dark-icon" style={{ flexShrink: 0 }} onClick={() => setMobileSidebar(o => !o)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <h1 style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a', margin: 0, paddingLeft: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>Brand Voice</h1>
          </div>

          {/* Feed */}
          <div className="main-pad" style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
            <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
              
              {!generated && !isGenerating ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', opacity: 0.8 }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(204,120,92,0.1), rgba(169,88,62,0.1))', border: '1px solid rgba(204,120,92,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#cc785c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                  </div>
                  <h2 style={{ fontSize: 20, fontFamily: 'var(--font-serif)', color: '#1a1a1a', margin: '0 0 8px' }}>Create On-Brand Content</h2>
                  <p style={{ fontSize: 14, color: '#888', textAlign: 'center', maxWidth: 320 }}>
                    Configure the brand voice settings in the sidebar, type your topic below, and let the AI draft your post.
                  </p>
                </div>
              ) : null}

              {isGenerating && <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}><TypingDots /></div>}

              {generated && (
                <div className="output-card msg-in">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width:30, height:30, borderRadius:'50%', background:'linear-gradient(135deg,#cc785c,#a9583e)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'white', boxShadow:'0 2px 8px rgba(204,120,92,0.25)' }}>T</div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>Generated Draft</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: '#f5ede8', color: '#cc785c', textTransform: 'uppercase' }}>{generated.platform}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={copyToClipboard} style={{
                        border: '1px solid #e5e2de', background: 'transparent', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#555', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500, display: 'flex', gap: 6, alignItems: 'center', transition: 'background 150ms'
                      }}>
                        {copied ? '✓ Copied' : '⎘ Copy text'}
                      </button>
                      <button onClick={sendToSMO} style={{
                        border: 'none', background: '#cc785c', borderRadius: 8, padding: '6px 16px', fontSize: 12, color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500, display: 'flex', gap: 6, alignItems: 'center', textDecoration: 'none'
                      }}>
                        Send to SMO →
                      </button>
                    </div>
                  </div>

                  <div style={{ fontSize: 15, lineHeight: 1.75, color: '#1c1c1c', whiteSpace: 'pre-wrap', padding: '16px 20px', background: 'linear-gradient(to bottom right, #fcfbf9, #f7f5f2)', border: '1px solid #e8e4df', borderRadius: 12, marginBottom: 16 }}>
                    {generated.caption}
                  </div>

                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#888', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 8 }}>Hashtags</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {generated.hashtags.map(tag => (
                        <span key={tag} style={{ padding: '3px 10px', background: '#fff', border: '1px solid #e5e2de', borderRadius: 6, fontSize: 12, color: '#666', fontFamily: 'var(--font-mono)' }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input Bar */}
          <div style={{ padding: '16px 24px 20px', background: '#fff', flexShrink: 0, borderTop: '1px solid #f0ede9' }}>
            <div style={{ maxWidth: 780, margin: '0 auto' }}>
              
              {/* Image Preview inside input area */}
              {imagePreview && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: '8px 12px', background: '#fcfbf9', border: '1px solid #eeece9', borderRadius: 10 }}>
                  <img src={imagePreview} alt="Preview" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>{imageFile?.name}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>Attached image</div>
                  </div>
                  <button onClick={() => { setImageFile(null); setImagePreview(null); }} style={{ width: 28, height: 28, borderRadius: '50%', background: '#fff', border: '1px solid #eeece9', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                </div>
              )}

              <div className="gpt-input-box">
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFileInput} style={{ display: "none" }} />
                <button className="action-icon-btn" onClick={() => fileRef.current?.click()} title="Attach image">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                  </svg>
                </button>

                <textarea
                  ref={taRef}
                  className="gpt-textarea"
                  value={topic}
                  onChange={e => { setTopic(e.target.value); resizeTA(); }}
                  onKeyDown={onKey}
                  disabled={isGenerating}
                  rows={1}
                  placeholder="Describe your post topic... (e.g. Tax season tips for small businesses)"
                />
                
                <button
                  className={`send-btn${topic.trim() && !isGenerating ? ' active' : ' inactive'}`}
                  onClick={() => handleGenerate()}
                  disabled={isGenerating || !topic.trim()}
                  title="Generate"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={topic.trim() && !isGenerating ? 'white' : 'none'} stroke={topic.trim() && !isGenerating ? 'white' : '#666'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
              <p style={{ textAlign:'center', fontSize:11.5, color:'#b8b8b8', marginTop:8 }}>
                AI-generated content will adapt to your selected Brand Voice and Target Platform.
              </p>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
