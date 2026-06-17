"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

type CalendarEvent = {
  id: number;
  event_date: string;
  event_name: string;
  event_type: string;
  brand: string;
  platforms: string;
  notes: string;
  days_before: number;
  is_active: number;
};

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  deadline: { bg: "#fee2e2", text: "#b91c1c", border: "#fca5a5" },
  campaign:  { bg: "#ffedd5", text: "#c2410c", border: "#fdba74" },
  holiday:   { bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd" },
  webinar:   { bg: "#dcfce7", text: "#15803d", border: "#86efac" },
  general:   { bg: "#f3f4f6", text: "#374151", border: "#d1d5db" },
};

const BRANDS = [
  { value: "all",            label: "All Brands" },
  { value: "hcllp",          label: "Harshwal & Co." },
  { value: "blue_arrow_cpa", label: "Blue Arrow CPA" },
  { value: "advisory",       label: "Harshwal Advisory" },
];

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function pad(n: number) { return String(n).padStart(2, "0"); }
function toLocalDateStr(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const EMPTY_FORM = {
  event_date: "", event_name: "", event_type: "general",
  brand: "all", platforms: "linkedin,facebook", notes: "", days_before: 3,
};

export default function CalendarPage() {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  const [fileParsing, setFileParsing] = useState(false);
  const [fileParseMsg, setFileParseMsg] = useState("");
  const [attachedFile, setAttachedFile] = useState<{ name: string; size: number } | null>(null);

  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState("");

  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/ci/calendar?month=${month}&year=${year}`, { headers });
      if (r.ok) setEvents(await r.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [month, year]);

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const eventsByDay: Record<string, CalendarEvent[]> = {};
  for (const ev of events) {
    const d = ev.event_date.slice(0, 10);
    if (!eventsByDay[d]) eventsByDay[d] = [];
    eventsByDay[d].push(ev);
  }

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const openAdd = (day?: number) => {
    setEditEvent(null);
    const defaultDate = day ? `${year}-${pad(month)}-${pad(day)}` : "";
    setForm({ ...EMPTY_FORM, event_date: defaultDate });
    setFileParseMsg("");
    setAttachedFile(null);
    setShowModal(true);
  };

  const openEdit = (ev: CalendarEvent) => {
    setEditEvent(ev);
    setForm({
      event_date: ev.event_date.slice(0, 10),
      event_name: ev.event_name,
      event_type: ev.event_type,
      brand: ev.brand,
      platforms: ev.platforms,
      notes: ev.notes || "",
      days_before: ev.days_before,
    });
    setFileParseMsg("");
    setAttachedFile(null);
    setShowModal(true);
  };

  const saveEvent = async () => {
    setSaving(true);
    try {
      const url = editEvent ? `${API}/api/ci/calendar/${editEvent.id}` : `${API}/api/ci/calendar`;
      const method = editEvent ? "PATCH" : "POST";
      const r = await fetch(url, { method, headers, body: JSON.stringify({ ...form, days_before: Number(form.days_before) }) });
      if (r.ok) { setShowModal(false); load(); }
    } finally { setSaving(false); }
  };

  const deleteEvent = async (id: number) => {
    if (!confirm("Delete this event?")) return;
    await fetch(`${API}/api/ci/calendar/${id}`, { method: "DELETE", headers });
    load();
  };

  const saveBulk = async () => {
    if (!bulkText.trim()) return;
    setBulkSaving(true);
    try {
      const eventList: Record<string, unknown>[] = [];
      for (const rawLine of bulkText.split("\n")) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const parts = line.split("|").map(s => s.trim());
        if (parts.length < 2) continue;
        const [date, name, type, brand, notes] = parts;
        eventList.push({
          event_date: date, event_name: name,
          event_type: type || "general",
          brand: brand || "all",
          notes: notes || "",
          platforms: "linkedin,facebook",
          days_before: 3,
        });
      }
      if (!eventList.length) { alert("No valid lines parsed."); return; }
      const r = await fetch(`${API}/api/ci/calendar/bulk`, { method: "POST", headers, body: JSON.stringify(eventList) });
      if (r.ok) { setShowBulk(false); setBulkText(""); load(); }
    } finally { setBulkSaving(false); }
  };

  const parseFile = async (file: File) => {
    setFileParsing(true);
    setFileParseMsg("");
    setAttachedFile(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const r = await fetch(`${API}/api/ci/calendar/parse-file`, { method: "POST", headers: authHeaders, body: fd });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setForm(f => ({
        ...f,
        event_name:  data.event_name  || f.event_name,
        event_date:  data.event_date  || f.event_date,
        event_type:  data.event_type  || f.event_type,
        brand:       data.brand       || f.brand,
        platforms:   data.platforms   || f.platforms,
        days_before: data.days_before ?? f.days_before,
        notes:       data.notes       || f.notes,
      }));
      const filled = ["event_name","event_date","event_type","notes"].filter(k => (data as Record<string,string>)[k]).length;
      setAttachedFile({ name: file.name, size: file.size });
      setFileParseMsg(data.parse_error
        ? `File loaded as context (AI parse failed).`
        : `AI filled ${filled} field(s).`);
    } catch {
      setFileParseMsg("Could not parse file  -  check backend is running.");
    } finally {
      setFileParsing(false);
    }
  };

  const generateMonthlyContent = async () => {
    setGenerating(true);
    setGenerateMsg("");
    try {
      const r = await fetch(`${API}/api/ci/calendar/generate`, { method: "POST", headers, body: JSON.stringify({}) });
      if (r.ok) {
        const data = await r.json();
        if (data.generated === 0) {
          setGenerateMsg(data.message || "No upcoming calendar events found in the next 30 days.");
        } else {
          setGenerateMsg(`Generated ${data.generated} calendar post(s) for ${data.events_processed} event(s) — run #${data.run_id}. Review them in the Review Queue.`);
        }
      } else {
        setGenerateMsg("Failed to generate. Make sure you are logged in and events exist.");
      }
    } catch {
      setGenerateMsg("Network error — could not reach backend.");
    } finally {
      setGenerating(false);
    }
  };

  const selectedEvents = selectedDay ? (eventsByDay[selectedDay] || []) : [];

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1200, margin: "0 auto" }} className="cal-page">
      <style>{`
        @media (max-width: 768px) {
          .cal-page { padding: 16px !important; }
          .cal-header { flex-direction: column !important; align-items: flex-start !important; gap: 14px !important; }
          .cal-header-actions { align-items: flex-start !important; }
          .cal-grid-layout { flex-direction: column !important; }
          .cal-day-panel { width: 100% !important; }
          .cal-cell { min-height: 60px !important; padding: 4px 5px !important; }
          .cal-cell-num { font-size: 11px !important; }
          .cal-event-chip { font-size: 9px !important; }
        }
      `}</style>

      {/* Header */}
      <div className="cal-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <a href="/competitor-intel" style={{ fontSize: 13, color: "var(--muted)", textDecoration: "none" }}>← Competitor Intel</a>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)", margin: "6px 0 4px" }}>Content Calendar</h1>
          <p style={{ fontSize: 14, color: "var(--muted)", margin: 0 }}>Manage monthly events that drive AI content generation</p>
        </div>
        <div className="cal-header-actions" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setShowBulk(true)} style={{ padding: "9px 18px", fontSize: 13, fontWeight: 600, border: "1px solid var(--hairline)", borderRadius: 8, background: "#fff", cursor: "pointer", color: "var(--ink)" }}>
              Bulk Upload
            </button>
            <button onClick={() => openAdd()} className="btn-primary" style={{ padding: "9px 18px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "none", cursor: "pointer" }}>
              + Add Event
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <button
              onClick={generateMonthlyContent}
              disabled={generating}
              style={{ padding: "10px 22px", fontSize: 13, fontWeight: 700, borderRadius: 8, border: "none", cursor: generating ? "not-allowed" : "pointer", background: generating ? "#9ca3af" : "#16a34a", color: "#fff", display: "flex", alignItems: "center", gap: 8 }}
            >
              {generating
                ? <><span style={{ width: 14, height: 14, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} /> Generating...</>
                : " Generate Monthly Content"}
            </button>
            {generateMsg && (
              <p style={{ fontSize: 12, color: generateMsg.startsWith("Pipeline") ? "#15803d" : "#b91c1c", margin: 0, maxWidth: 280, textAlign: "right" }}>{generateMsg}</p>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {Object.entries(TYPE_COLORS).map(([type, c]) => (
          <span key={type} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 20, background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </span>
        ))}
      </div>

      {/* Month navigation */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <button onClick={prevMonth} style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid var(--hairline)", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", margin: 0, minWidth: 180, textAlign: "center" }}>{MONTHS[month - 1]} {year}</h2>
        <button onClick={nextMonth} style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid var(--hairline)", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <span style={{ fontSize: 13, color: "var(--muted)", marginLeft: 8 }}>{events.length} events</span>
        <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1); }} style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)", border: "1px solid var(--hairline)", borderRadius: 6, background: "#fff", padding: "4px 12px", cursor: "pointer" }}>
          Today
        </button>
      </div>

      {/* Calendar grid + day detail */}
      <div className="cal-grid-layout" style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, marginBottom: 1 }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: "center", padding: "8px 0", fontSize: 12, fontWeight: 600, color: "var(--muted)", background: "var(--surface-soft)", borderRadius: 4 }}>
                {d}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} style={{ minHeight: 90, background: "var(--surface-soft)", opacity: 0.3, borderRadius: 4 }} />;
              const dateStr = `${year}-${pad(month)}-${pad(day)}`;
              const dayEvents = eventsByDay[dateStr] || [];
              const isToday = toLocalDateStr(today) === dateStr;
              const isSelected = selectedDay === dateStr;
              return (
                <div key={idx} className="cal-cell" onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                  style={{ minHeight: 90, padding: "6px 8px", background: isSelected ? "#eff6ff" : "#fff", border: isSelected ? "2px solid #3b82f6" : isToday ? "2px solid var(--primary)" : "1px solid var(--hairline)", borderRadius: 6, cursor: "pointer", transition: "border 150ms, background 150ms", position: "relative" }}>
                  <div className="cal-cell-num" style={{ fontSize: 13, fontWeight: isToday ? 700 : 500, color: isToday ? "var(--primary)" : "var(--ink)", marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    {day}
                    {isToday && <span style={{ fontSize: 9, background: "var(--primary)", color: "#fff", borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>TODAY</span>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {dayEvents.slice(0, 3).map(ev => {
                      const c = TYPE_COLORS[ev.event_type] || TYPE_COLORS.general;
                      return (
                        <div key={ev.id} style={{ fontSize: 10, fontWeight: 600, padding: "2px 5px", borderRadius: 3, background: c.bg, color: c.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {ev.event_name}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 500 }}>+{dayEvents.length - 3} more</div>}
                    {dayEvents.length === 0 && (
                      <div onClick={e => { e.stopPropagation(); openAdd(day); }}
                        style={{ fontSize: 10, color: "var(--muted)", opacity: 0, transition: "opacity 150ms" }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                        onMouseLeave={e => (e.currentTarget.style.opacity = "0")}>
                        + add
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {selectedDay && (
          <div className="cal-day-panel" style={{ width: 300, flexShrink: 0, background: "#fff", border: "1px solid var(--hairline)", borderRadius: 12, padding: 20, alignSelf: "flex-start" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>{MONTHS[month - 1]} {year}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)" }}>
                  {parseInt(selectedDay.slice(8, 10))}
                  <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 400, marginLeft: 6 }}>{DAYS[new Date(selectedDay + "T12:00:00").getDay()]}</span>
                </div>
              </div>
              <button onClick={() => openAdd(parseInt(selectedDay.slice(8, 10)))} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--hairline)", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "var(--primary)" }}>+</button>
            </div>
            {selectedEvents.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "var(--muted)", fontSize: 13 }}>No events. Click + to add one.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {selectedEvents.map(ev => {
                  const c = TYPE_COLORS[ev.event_type] || TYPE_COLORS.general;
                  const brandLabel = BRANDS.find(b => b.value === ev.brand)?.label || ev.brand;
                  return (
                    <div key={ev.id} style={{ border: `1px solid ${c.border}`, borderRadius: 8, padding: 12, background: c.bg }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: c.text, textTransform: "capitalize", marginBottom: 4 }}>{ev.event_type}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>{ev.event_name}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{brandLabel} · {ev.platforms}</div>
                      {ev.notes && <div style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic", marginBottom: 8 }}>{ev.notes}</div>}
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button onClick={() => openEdit(ev)} style={{ flex: 1, padding: "5px 0", fontSize: 11, fontWeight: 600, borderRadius: 6, border: "1px solid var(--hairline)", background: "#fff", cursor: "pointer", color: "var(--ink)" }}>Edit</button>
                        <button onClick={() => deleteEvent(ev.id)} style={{ flex: 1, padding: "5px 0", fontSize: 11, fontWeight: 600, borderRadius: 6, border: "1px solid #fca5a5", background: "#fee2e2", cursor: "pointer", color: "#b91c1c" }}>Delete</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upcoming Events List */}
      <div style={{ marginTop: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 16 }}>All Events This Month</h3>
        {loading ? (
          <div style={{ color: "var(--muted)", fontSize: 14, padding: "20px 0" }}>Loading...</div>
        ) : events.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)", fontSize: 14, border: "2px dashed var(--hairline)", borderRadius: 12 }}>
            No events for {MONTHS[month - 1]} {year}.{" "}
            <button onClick={() => openAdd()} style={{ color: "var(--primary)", background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>Add your first event</button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
            {events.sort((a, b) => a.event_date.localeCompare(b.event_date)).map(ev => {
              const c = TYPE_COLORS[ev.event_type] || TYPE_COLORS.general;
              const brandLabel = BRANDS.find(b => b.value === ev.brand)?.label || ev.brand;
              const d = new Date(ev.event_date);
              return (
                <div key={ev.id} style={{ border: "1px solid var(--hairline)", borderRadius: 10, padding: 16, background: "#fff", display: "flex", gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: c.bg, border: `1px solid ${c.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <div style={{ fontSize: 8, fontWeight: 700, color: c.text, textTransform: "uppercase", letterSpacing: 0.5 }}>{MONTHS[d.getUTCMonth()].slice(0, 3)}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: c.text, lineHeight: 1 }}>{d.getUTCDate()}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.event_name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{brandLabel} · {ev.platforms} · {ev.days_before}d before</div>
                    {ev.notes && <div style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.notes}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button onClick={() => openEdit(ev)} style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, borderRadius: 6, border: "1px solid var(--hairline)", background: "#fff", cursor: "pointer" }}>Edit</button>
                    <button onClick={() => deleteEvent(ev.id)} style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, borderRadius: 6, border: "1px solid #fca5a5", background: "#fee2e2", cursor: "pointer", color: "#b91c1c" }}>×</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* -- Add / Edit Modal -- */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: 480, maxWidth: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>

            {/* Modal header */}
            <div style={{ padding: "24px 28px 16px", borderBottom: "1px solid var(--hairline)", flexShrink: 0 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: 0 }}>{editEvent ? "Edit Event" : "Add Calendar Event"}</h2>
            </div>

            {/* Scrollable body */}
            <div style={{ overflowY: "auto", padding: "20px 28px", flex: 1 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* File upload  -  AI auto-fill */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>
                    Upload Brief / File{" "}
                    <span style={{ fontWeight: 400 }}>(optional  -  AI will extract event details)</span>
                  </div>

                  {/* Attached file chip  -  shown after upload */}
                  {attachedFile && !fileParsing ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "1px solid var(--hairline)", borderRadius: 10, background: "#f8faff" }}>
                      {/* File icon */}
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--surface-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        </svg>
                      </div>
                      {/* File info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{attachedFile.name}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>
                          {(attachedFile.size / 1024).toFixed(1)} KB
                          {fileParseMsg && <span style={{ marginLeft: 8, color: "#15803d" }}>{fileParseMsg}</span>}
                        </div>
                      </div>
                      {/* Replace / remove */}
                      <label title="Replace file" style={{ cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--primary)", fontWeight: 500 }}>
                        <input type="file" accept=".csv,.xlsx,.xls,.txt,.pdf,.md" style={{ display: "none" }}
                          onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f); e.target.value = ""; }} />
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        Replace
                      </label>
                      <button onClick={() => { setAttachedFile(null); setFileParseMsg(""); }}
                        title="Remove file"
                        style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid var(--hairline)", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", flexShrink: 0 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ) : (
                    /* Drop zone  -  shown when no file attached */
                    <label
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: "16px 12px", border: "2px dashed var(--hairline)", borderRadius: 10, cursor: fileParsing ? "not-allowed" : "pointer", background: fileParsing ? "var(--surface-soft)" : "#fafafa", transition: "border-color 150ms", textAlign: "center" }}
                      onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--primary)"; }}
                      onDragLeave={e => { e.currentTarget.style.borderColor = "var(--hairline)"; }}
                      onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--hairline)"; const f = e.dataTransfer.files[0]; if (f) parseFile(f); }}
                    >
                      <input type="file" accept=".csv,.xlsx,.xls,.txt,.pdf,.md" style={{ display: "none" }} disabled={fileParsing}
                        onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f); e.target.value = ""; }} />
                      {fileParsing ? (
                        <>
                          <span style={{ width: 18, height: 18, border: "2px solid var(--primary)", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>Parsing with AI...</span>
                        </>
                      ) : (
                        <>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                          </svg>
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>Drop file here or <span style={{ color: "var(--primary)", fontWeight: 600 }}>browse</span></span>
                          <span style={{ fontSize: 11, color: "var(--muted)", opacity: 0.7 }}>CSV, Excel, PDF, TXT supported</span>
                        </>
                      )}
                    </label>
                  )}
                </div>

                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
                  Event Date *
                  <input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
                    style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", border: "1px solid var(--hairline)", borderRadius: 8, fontSize: 13, color: "var(--ink)" }} />
                </label>

                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
                  Event Name *
                  <input type="text" placeholder="e.g. Tax Filing Deadline" value={form.event_name} onChange={e => setForm(f => ({ ...f, event_name: e.target.value }))}
                    style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", border: "1px solid var(--hairline)", borderRadius: 8, fontSize: 13, color: "var(--ink)" }} />
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
                    Type
                    <select value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}
                      style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", border: "1px solid var(--hairline)", borderRadius: 8, fontSize: 13 }}>
                      {Object.keys(TYPE_COLORS).map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                    </select>
                  </label>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
                    Brand
                    <select value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
                      style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", border: "1px solid var(--hairline)", borderRadius: 8, fontSize: 13 }}>
                      {BRANDS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                    </select>
                  </label>
                </div>

                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
                  Platforms (comma-separated)
                  <input type="text" placeholder="linkedin,facebook,instagram,twitter" value={form.platforms} onChange={e => setForm(f => ({ ...f, platforms: e.target.value }))}
                    style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", border: "1px solid var(--hairline)", borderRadius: 8, fontSize: 13 }} />
                </label>

                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
                  Days Before Event (when to generate content)
                  <input type="number" min={0} max={30} value={form.days_before} onChange={e => setForm(f => ({ ...f, days_before: Number(e.target.value) }))}
                    style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", border: "1px solid var(--hairline)", borderRadius: 8, fontSize: 13 }} />
                </label>

                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
                  Notes / Context for AI (optional)
                  <textarea placeholder="Extra context the AI should know about this event..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={3} style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", border: "1px solid var(--hairline)", borderRadius: 8, fontSize: 13, resize: "vertical", fontFamily: "inherit" }} />
                </label>

              </div>
            </div>

            {/* Sticky footer buttons */}
            <div style={{ padding: "16px 28px", borderTop: "1px solid var(--hairline)", flexShrink: 0, display: "flex", gap: 10 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 600, border: "1px solid var(--hairline)", borderRadius: 8, background: "#fff", cursor: "pointer" }}>Cancel</button>
              <button onClick={saveEvent} disabled={saving || !form.event_date || !form.event_name} className="btn-primary"
                style={{ flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "none", cursor: "pointer", opacity: (saving || !form.event_date || !form.event_name) ? 0.5 : 1 }}>
                {saving ? "Saving..." : (editEvent ? "Save Changes" : "Add Event")}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* -- Bulk Upload Modal -- */}
      {showBulk && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 560, maxWidth: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>Bulk Upload Events</h2>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
              One event per line. Format:<br/>
              <code style={{ background: "var(--surface-soft)", padding: "1px 6px", borderRadius: 4, fontSize: 12 }}>YYYY-MM-DD | Event Name | type | brand | notes</code><br/>
              Type: general / deadline / campaign / holiday / webinar. Brand: all / hcllp / blue_arrow_cpa / advisory
            </p>
            <div style={{ background: "#f8f8f6", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 11, color: "var(--muted)", fontFamily: "monospace", lineHeight: 1.8 }}>
              # Example entries (lines starting with # are ignored)<br/>
              2026-04-15 | Tax Filing Deadline | deadline | hcllp | Q1 individual returns due<br/>
              2026-04-01 | April Fools Campaign | campaign | all |<br/>
              2026-05-27 | Memorial Day | holiday | all |
            </div>
            <textarea value={bulkText} onChange={e => setBulkText(e.target.value)}
              placeholder={"2026-04-15 | Tax Filing Deadline | deadline | hcllp | Q1 individual returns due\n2026-05-01 | Spring Webinar | webinar | advisory |\n..."}
              rows={10}
              style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--hairline)", borderRadius: 8, fontSize: 12, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => setShowBulk(false)} style={{ flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 600, border: "1px solid var(--hairline)", borderRadius: 8, background: "#fff", cursor: "pointer" }}>Cancel</button>
              <button onClick={saveBulk} disabled={bulkSaving || !bulkText.trim()} className="btn-primary"
                style={{ flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "none", cursor: "pointer", opacity: (bulkSaving || !bulkText.trim()) ? 0.5 : 1 }}>
                {bulkSaving ? "Uploading..." : "Upload Events"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
