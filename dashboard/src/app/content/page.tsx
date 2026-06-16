"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';

/* ── Types ─────────────────────────────────────────────── */
type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  ts: Date;
};

type Chat = {
  id: string;
  title: string;
  ts: Date;
  messages: Message[];
};

/* ── Static Data ────────────────────────────────────────── */
const SUGGESTIONS = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    ),
    label: 'Draft a blog post',
    sub: 'Tax season planning tips for SMBs',
    prompt: 'Draft a professional blog post about tax season planning tips for small businesses.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>
      </svg>
    ),
    label: 'LinkedIn update',
    sub: 'Announce a new advisory service',
    prompt: 'Write a compelling LinkedIn update announcing our new tax advisory service for high-net-worth individuals.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
    label: 'Case study',
    sub: 'Client saved 30% on taxes',
    prompt: 'Create a detailed case study for a client who saved 30% on taxes through our advisory services.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
      </svg>
    ),
    label: 'Email newsletter',
    sub: 'Q2 2025 key tax deadlines',
    prompt: 'Write a monthly newsletter intro for Q2 2025 highlighting key tax deadlines and compliance reminders.',
  },
];



/* ── Helpers ─────────────────────────────────────────────── */
const uid = () => Math.random().toString(36).slice(2);

/* ── Sub-components ──────────────────────────────────────── */
function SendIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={active ? 'white' : 'none'}
      stroke={active ? 'white' : '#666'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function HarshwalLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 7,
        background: 'linear-gradient(135deg, #cc785c 0%, #a9583e 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 800, color: 'white', letterSpacing: '-0.5px',
      }}>H</div>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e6e1' }}>Content AI</span>
    </div>
  );
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '4px 0', maxWidth: 720, margin: '0 auto' }}>
      {/* Avatar */}
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

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  };
  return (
    <button onClick={copy} className="msg-action-btn" title="Copy" style={{
      border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 6px',
      borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4,
      fontSize: 11, color: '#8a8a8a', fontFamily: 'var(--font-sans)',
      transition: 'background 120ms, color 120ms',
    }}>
      {done ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

/* ── Main Page ───────────────────────────────────────────── */
const BRANDS = [
  { value: 'hcllp',         label: 'Harshwal & Co.',  short: 'HCLLP' },
  { value: 'blue_arrow_cpa', label: 'Blue Arrow CPA', short: 'BA CPA' },
  { value: 'advisory',      label: 'Advisory',         short: 'Advisory' },
];

export default function ContentPage() {
  const [activeChat, setActiveChat] = useState<string>('new');
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [kbStats, setKbStats] = useState({ documents: 0, last_updated: 'Just now', model: 'gpt-4o-mini' });
  const [brand, setBrand] = useState('hcllp');
  const [brandOpen, setBrandOpen] = useState(false);
  const brandRef = useRef<HTMLDivElement>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (brandRef.current && !brandRef.current.contains(e.target as Node)) setBrandOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat/sessions`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setChats(data.map((s: any) => ({ id: s.id, title: s.title, ts: new Date(s.ts), messages: [] })));
        }
      })
      .catch(console.error);

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/kb/stats`)
      .then(res => res.json())
      .then(data => setKbStats(data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const resizeTA = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  };

  const newChat = () => {
    setActiveChat('new');
    setMessages([]);
    setInput('');
    setMobileSidebar(false);
  };

  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput('');
    if (taRef.current) taRef.current.style.height = 'auto';

    const userMsg: Message = { id: uid(), role: 'user', content: msg, ts: new Date() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    // Auto-create chat title from first message
    if (activeChat === 'new') {
      const newId = uid();
      const newTitle = msg.length > 40 ? msg.slice(0, 40) + '…' : msg;
      setChats(prev => [{ id: newId, title: newTitle, ts: new Date(), messages: [] }, ...prev]);
      setActiveChat(newId);
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, session_id: activeChat === 'new' ? null : activeChat, brand }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages(prev => [...prev, { id: uid(), role: 'assistant', content: data.reply, sources: data.sources, ts: new Date() }]);
    } catch {
      setMessages(prev => [...prev, {
        id: uid(), role: 'assistant', ts: new Date(),
        content: '⚠️ Could not reach the backend. Please ensure FastAPI is running on port 8000.',
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, activeChat]);

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const isEmpty = messages.length === 0;

  return (
    <>
      <style>{`
        /* ── Global resets for this page ── */
        body { margin: 0; }

        /* ── Animations ── */
        @keyframes tDot {
          0%,60%,100% { transform:translateY(0); opacity:0.35; }
          30% { transform:translateY(-5px); opacity:1; }
        }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity:0; } to { opacity:1; }
        }
        .msg-in { animation: fadeUp 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }

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
          display: flex; align-items: center; gap: 10px;
          padding: 8px 12px; border-radius: 8px; cursor: pointer;
          font-size: 13.5px; color: #c5c5c5; font-family: var(--font-sans);
          transition: background 150ms; border: none; background: transparent;
          text-align: left; width: 100%; white-space: nowrap; overflow: hidden;
        }
        .sidebar-item:hover { background: rgba(255,255,255,0.07); color: #e8e8e8; }
        .sidebar-item.active { background: rgba(255,255,255,0.1); color: #f0f0f0; font-weight:500; }
        .sidebar-item-text { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; }

        /* New chat button */
        .new-chat-btn {
          display:flex; align-items:center; gap:8px;
          padding:8px 12px; border-radius:8px;
          background:transparent; border:1px solid rgba(255,255,255,0.15);
          color:#e0e0e0; cursor:pointer; font-size:13.5px;
          font-family:var(--font-sans); font-weight:500;
          transition:background 150ms, border-color 150ms;
          width:100%;
        }
        .new-chat-btn:hover { background:rgba(255,255,255,0.08); border-color:rgba(255,255,255,0.25); }

        /* ── Message actions ── */
        .msg-actions { opacity:0; transition:opacity 150ms; display:flex; gap:2px; margin-top:6px; }
        .msg-row:hover .msg-actions { opacity:1; }
        .msg-action-btn:hover { background:rgba(0,0,0,0.07)!important; color:#444!important; }

        /* ── Input ── */
        .gpt-input-box {
          background:#f4f4f4;
          border:1.5px solid #e0e0e0;
          border-radius:16px;
          padding:12px 14px 12px 18px;
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
          resize:none; line-height:1.6; max-height:180px;
          padding:0;
        }
        .gpt-textarea::placeholder { color:#aaa; }

        .send-btn {
          width:36px; height:36px; border-radius:10px; border:none;
          cursor:pointer; display:flex; align-items:center; justify-content:center;
          transition:background 150ms, transform 100ms; flex-shrink:0;
        }
        .send-btn.active { background:#cc785c; }
        .send-btn.active:hover { background:#a9583e; transform:scale(1.06); }
        .send-btn.inactive { background:#e0e0e0; cursor:not-allowed; }

        /* ── Suggestion cards ── */
        .sug-card {
          border:1px solid #e8e4df;
          border-radius:14px; padding:18px 20px;
          background:linear-gradient(to bottom, #ffffff, #faf9f7);
          cursor:pointer;
          font-family:var(--font-sans);
          transition:all 250ms cubic-bezier(0.2, 0.8, 0.2, 1);
          text-align:left;
        }
        .sug-card:hover {
          border-color:#cc785c;
          box-shadow:0 8px 30px rgba(204,120,92,0.12);
          transform:translateY(-4px);
        }

        /* ── Sidebar toggle ── */
        .toggle-btn {
          background:transparent; border:none; cursor:pointer;
          color:#9a9a9a; padding:6px; border-radius:6px;
          display:flex; align-items:center; justify-content:center;
          transition:background 150ms, color 150ms;
        }
        .toggle-btn:hover { background:rgba(255,255,255,0.08); color:#e0e0e0; }

        /* ── Action Icons ── */
        .action-icon-btn {
          width: 32px; height: 32px; border-radius: 8px; border: none; background: transparent;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          color: #888; transition: all 150ms;
        }
        .action-icon-btn:hover { background: rgba(0,0,0,0.05); color: #444; }

        /* ── Mobile ── */
        @media (max-width:768px) {
          .gpt-sidebar { position:fixed!important; top:60px; left:0; height:calc(100vh - 60px); z-index:60; width:300px!important; transform:translateX(-100%); transition:transform 0.24s ease!important; }
          .gpt-sidebar.mobile-open { transform:translateX(0)!important; }
          .sidebar-overlay { display:block!important; }
          .toggle-btn-mobile { display:flex!important; }
          .desktop-toggle { display:none!important; }
          .sug-grid { grid-template-columns:1fr!important; }
          .gpt-input-wrap { padding:12px 16px 16px!important; }
          .chat-area-pad { padding:24px 16px!important; }
          .desktop-only { display: none!important; }
        }
        .sidebar-overlay {
          display:none; position:fixed; inset:0; top:60px;
          background:rgba(0,0,0,0.5); z-index:55;
          backdrop-filter:blur(2px);
          animation:fadeIn 0.18s ease;
        }
        .toggle-btn-mobile { display:none; }

        /* ── User message ── */
        .user-bubble {
          background:linear-gradient(135deg, #f4f0ea 0%, #ece6de 100%);
          border:1px solid #e2d9cf;
          border-radius:18px 18px 4px 18px;
          padding:14px 20px;
          font-size:15px; line-height:1.65;
          color:#1a1a1a;
          max-width:80%;
          word-break:break-word;
          box-shadow:0 1px 4px rgba(0,0,0,0.05);
        }

        /* ── Scrollbar ── */
        .chat-scroll::-webkit-scrollbar { width:5px; }
        .chat-scroll::-webkit-scrollbar-track { background:transparent; }
        .chat-scroll::-webkit-scrollbar-thumb { background:#ddd; border-radius:99px; }
        .chat-scroll::-webkit-scrollbar-thumb:hover { background:#ccc; }
      `}</style>

      <div style={{ display:'flex', height:'calc(100vh - 60px)', overflow:'hidden', background:'#fff', fontFamily:'var(--font-sans)' }}>

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

          {/* New Chat */}
          <div style={{ padding:'12px 12px 8px' }}>
            <button className="new-chat-btn" onClick={newChat}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New chat
            </button>
          </div>

          {/* History */}
          <div style={{ flex:1, overflowY:'auto', padding:'4px 12px' }}>
            <p style={{ fontSize:10.5, fontWeight:700, color:'#606060', letterSpacing:'0.6px', textTransform:'uppercase', marginBottom:6, padding:'4px 2px' }}>Today</p>

            <button className={`sidebar-item${activeChat === 'new' && messages.length > 0 ? '' : ''}`} onClick={newChat}
              style={{ color: activeChat === 'new' ? '#f0f0f0' : undefined, background: activeChat === 'new' && messages.length > 0 ? 'rgba(255,255,255,0.1)' : undefined }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0, opacity:0.6 }}>
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
              <span className="sidebar-item-text">Current session</span>
            </button>

            <p style={{ fontSize:10.5, fontWeight:700, color:'#606060', letterSpacing:'0.6px', textTransform:'uppercase', margin:'14px 0 6px', padding:'4px 2px' }}>Previous 7 Days</p>

            {chats.map(chat => (
              <button key={chat.id} className={`sidebar-item${activeChat === chat.id ? ' active' : ''}`}
                onClick={() => { 
                  setActiveChat(chat.id); 
                  setMessages([]); 
                  setMobileSidebar(false); 
                  setLoading(true);
                  fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat/sessions/${chat.id}`)
                    .then(res => res.json())
                    .then(data => {
                      if (data.messages) {
                        setMessages(data.messages.map((m: any) => ({
                          id: m.id,
                          role: m.role,
                          content: m.content,
                          ts: new Date(m.ts)
                        })));
                      }
                    })
                    .catch(console.error)
                    .finally(() => setLoading(false));
                }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0, opacity:0.5 }}>
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
                <span className="sidebar-item-text">{chat.title}</span>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', padding:'14px 14px', flexShrink:0 }}>
            {/* KB Stats */}
            <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'10px 12px', marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:'#4ade80', display:'inline-block', boxShadow:'0 0 5px #4ade80' }} />
                <span style={{ fontSize:10.5, fontWeight:700, color:'#5a5a5a', letterSpacing:'0.5px', textTransform:'uppercase' }}>Knowledge Base</span>
              </div>
              {[['📄', `${kbStats.documents} documents`], ['🔄', kbStats.last_updated], ['🧠', kbStats.model]].map(([ic, val]) => (
                <div key={val} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                  <span style={{ fontSize:12 }}>{ic}</span>
                  <span style={{ fontSize:12, color:'#7a7a7a' }}>{val}</span>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#cc785c,#a9583e)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'white' }}>H</div>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'#d0d0d0' }}>Harshwal</div>
                <div style={{ fontSize:11, color:'#606060' }}>Admin</div>
              </div>
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
              <button className="toggle-btn desktop-toggle" onClick={() => setSidebarOpen(true)} title="Open sidebar">
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

            <h1 style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a', margin: 0, paddingLeft: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>Knowledge Base Chat</h1>

            {/* Brand picker */}
            <div ref={brandRef} style={{ position: 'relative', flexShrink: 0 }}>
              <button
                onClick={() => setBrandOpen(o => !o)}
                style={{
                  display:'flex', alignItems:'center', gap:6,
                  padding:'5px 12px', borderRadius:99, border:'1px solid #e5e2de',
                  background: brandOpen ? '#f0ede9' : '#faf9f7', cursor:'pointer',
                  fontSize:13, fontWeight:500, color:'#3a3a3a',
                  whiteSpace: 'nowrap', fontFamily:'var(--font-sans)',
                  transition:'background 150ms',
                }}
              >
                <div style={{ width:7, height:7, borderRadius:'50%', background:'#cc785c', boxShadow:'0 0 5px rgba(204,120,92,0.5)', flexShrink:0 }} />
                {BRANDS.find(b => b.value === brand)?.label ?? 'Select Brand'}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition:'transform 150ms', transform: brandOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {brandOpen && (
                <div style={{
                  position:'absolute', top:'calc(100% + 6px)', left:0,
                  background:'#fff', border:'1px solid #e5e2de',
                  borderRadius:12, padding:4,
                  boxShadow:'0 8px 24px rgba(0,0,0,0.10)',
                  minWidth:170, zIndex:100,
                }}>
                  {BRANDS.map(b => (
                    <button
                      key={b.value}
                      onClick={() => { setBrand(b.value); setBrandOpen(false); }}
                      style={{
                        width:'100%', display:'flex', alignItems:'center', gap:8,
                        padding:'8px 12px', background: brand === b.value ? '#f5ede8' : 'none',
                        border:'none', borderRadius:8, cursor:'pointer',
                        fontSize:13, fontWeight: brand === b.value ? 600 : 400,
                        color: brand === b.value ? '#cc785c' : '#3a3a3a',
                        fontFamily:'var(--font-sans)', textAlign:'left',
                        transition:'background 120ms',
                      }}
                    >
                      <div style={{ width:6, height:6, borderRadius:'50%', background: brand === b.value ? '#cc785c' : '#ccc', flexShrink:0 }} />
                      {b.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center', flexShrink: 0 }}>
              {messages.length > 0 && (
                <button onClick={newChat} style={{
                  border:'1px solid #e5e2de', background:'transparent', borderRadius:8,
                  padding:'5px 12px', fontSize:12, color:'#666', cursor:'pointer',
                  fontFamily:'var(--font-sans)', fontWeight:500, display:'flex', alignItems:'center', gap:5,
                  transition:'background 150ms',
                  whiteSpace: 'nowrap'
                }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  <span className="desktop-only">New chat</span>
                </button>
              )}
              <span style={{ fontSize:11, fontWeight:600, padding:'4px 9px', borderRadius:99, background:'#f5ede8', color:'#cc785c', letterSpacing:'0.3px', whiteSpace: 'nowrap' }}>RAG</span>
            </div>
          </div>

          {/* ── Chat messages ── */}
          <div className="chat-scroll" style={{ flex:1, overflowY:'auto', background:'#fff' }}>

            {/* Empty state */}
            {isEmpty ? (
              <div style={{
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                minHeight:'100%', padding:'40px 24px',
                animation:'fadeIn 0.4s ease',
              }}>
                {/* Greeting */}
                <div style={{
                  width:56, height:56, borderRadius:16, marginBottom:24,
                  background:'linear-gradient(135deg, #cc785c 0%, #a9583e 100%)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:22, fontWeight:800, color:'white',
                  boxShadow:'0 8px 24px rgba(204,120,92,0.3)',
                }}>H</div>
                <h2 style={{ fontFamily:'var(--font-serif)', fontSize:'clamp(22px,4vw,32px)', fontWeight:400, color:'#1a1a1a', margin:'0 0 8px', letterSpacing:'-0.5px', textAlign:'center' }}>
                  How can I help you today?
                </h2>
                <p style={{ fontSize:15, color:'#888', margin:'0 0 36px', textAlign:'center', maxWidth:360, lineHeight:1.6 }}>
                  Connected to your firm's knowledge base — 142 indexed documents ready.
                </p>

                {/* Suggestion cards */}
                <div className="sug-grid" style={{
                  display:'grid', gridTemplateColumns:'repeat(2,1fr)',
                  gap:12, width:'100%', maxWidth:640,
                }}>
                  {SUGGESTIONS.map(s => (
                    <button key={s.label} className="sug-card" onClick={() => send(s.prompt)}>
                      <div style={{ color:'#cc785c', marginBottom:8 }}>{s.icon}</div>
                      <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:3 }}>{s.label}</div>
                      <div style={{ fontSize:12.5, color:'#888', lineHeight:1.4 }}>{s.sub}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="chat-area-pad" style={{ padding:'32px 24px', maxWidth:780, margin:'0 auto', display:'flex', flexDirection:'column', gap:0 }}>
                {messages.map((msg) => (
                  <div key={msg.id} className="msg-row msg-in" style={{
                    display:'flex',
                    flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                    alignItems:'flex-start', gap:12,
                    marginBottom: msg.role === 'user' ? 24 : 28,
                  }}>
                    {/* Avatar */}
                    {msg.role === 'assistant' ? (
                      <div style={{
                        width:30, height:30, borderRadius:'50%', flexShrink:0, marginTop:2,
                        background:'linear-gradient(135deg,#cc785c,#a9583e)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:12, fontWeight:700, color:'white',
                        boxShadow:'0 2px 8px rgba(204,120,92,0.25)',
                      }}>T</div>
                    ) : (
                      <div style={{
                        width:30, height:30, borderRadius:'50%', flexShrink:0, marginTop:2,
                        background:'#2d2d2d',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:12, fontWeight:700, color:'white',
                      }}>U</div>
                    )}

                    <div style={{ flex:1, minWidth:0 }}>
                      {/* Role + time */}
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6,
                        flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                        <span style={{ fontSize:13, fontWeight:600, color: msg.role === 'assistant' ? '#1a1a1a' : '#4a4a4a' }}>
                          {msg.role === 'assistant' ? 'Trenoxa RAG' : 'You'}
                        </span>
                        <span style={{ fontSize:11, color:'#b0b0b0' }}>
                          {msg.ts.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
                        </span>
                      </div>

                      {/* Content */}
                      {msg.role === 'user' ? (
                        <div style={{ display:'flex', justifyContent:'flex-end' }}>
                          <div className="user-bubble">{msg.content}</div>
                        </div>
                      ) : (
                        <div style={{ 
                          fontSize:15, lineHeight:1.75, color:'#1c1c1c', 
                          whiteSpace:'pre-wrap', wordBreak:'break-word',
                          padding: '12px 0 0 0'
                        }}>
                          {msg.content}
                        </div>
                      )}

                      {/* Actions (assistant only) */}
                      {msg.role === 'assistant' && (
                        <div className="msg-actions" style={{ display:'flex', gap:2, marginTop:8 }}>
                          <CopyBtn text={msg.content} />
                          <button className="msg-action-btn" style={{
                            border:'none', background:'transparent', cursor:'pointer', padding:'4px 6px',
                            borderRadius:6, display:'flex', alignItems:'center', gap:4,
                            fontSize:11, color:'#8a8a8a', fontFamily:'var(--font-sans)',
                            transition:'background 120ms',
                          }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>
                            </svg>
                            Good
                          </button>
                          <button className="msg-action-btn" style={{
                            border:'none', background:'transparent', cursor:'pointer', padding:'4px 6px',
                            borderRadius:6, display:'flex', alignItems:'center', gap:4,
                            fontSize:11, color:'#8a8a8a', fontFamily:'var(--font-sans)',
                            transition:'background 120ms',
                          }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/>
                            </svg>
                            Bad
                          </button>

                          {/* Sources */}
                          {msg.sources && msg.sources.length > 0 && (
                            <div style={{ display:'flex', gap:4, alignItems:'center', marginLeft:8 }}>
                              <span style={{ fontSize:11, color:'#aaa' }}>·</span>
                              <span style={{ fontSize:11, color:'#aaa' }}>Sources:</span>
                              {msg.sources.map((s, si) => (
                                <span key={si} style={{
                                  fontSize:11, fontWeight:600,
                                  padding:'2px 8px', borderRadius:5,
                                  background:'#f2ede8', color:'#9a8070',
                                  fontFamily:'var(--font-mono)',
                                  border:'1px solid #e8e0d8',
                                }}>{s}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {loading && <TypingDots />}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* ── Input ── */}
          <div className="gpt-input-wrap" style={{ padding:'16px 24px 20px', background:'#fff', flexShrink:0, borderTop:'1px solid #f0ede9' }}>
            <div style={{ maxWidth:780, margin:'0 auto' }}>
              <div className="gpt-input-box">
                <button className="action-icon-btn" title="Attach file">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                </button>
                <textarea
                  ref={taRef}
                  className="gpt-textarea"
                  value={input}
                  onChange={e => { setInput(e.target.value); resizeTA(); }}
                  onKeyDown={onKey}
                  disabled={loading}
                  rows={1}
                  placeholder="Message Trenoxa RAG…"
                />
                <button
                  className={`send-btn${input.trim() && !loading ? ' active' : ' inactive'}`}
                  onClick={() => send()}
                  disabled={loading || !input.trim()}
                >
                  <SendIcon active={!!(input.trim() && !loading)} />
                </button>
              </div>
              <p style={{ textAlign:'center', fontSize:11.5, color:'#b8b8b8', marginTop:8 }}>
                Trenoxa RAG can make mistakes. Verify important content before publishing.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
