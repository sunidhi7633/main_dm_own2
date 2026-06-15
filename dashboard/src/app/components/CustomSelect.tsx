"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: Option[];
}

export default function CustomSelect({ value, onChange, options }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value) || options[0];

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="input-field"
        style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          background: "var(--canvas)",
          cursor: "pointer",
          textAlign: "left"
        }}
      >
        <span>{selectedOption?.label || "Select..."}</span>
        <ChevronDown 
          size={16} 
          color="var(--muted)" 
          style={{ 
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", 
            transition: "transform 0.2s ease",
            marginLeft: "8px"
          }} 
        />
      </button>

      {isOpen && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          left: 0,
          right: 0,
          background: "#ffffff",
          border: "1px solid var(--hairline)",
          borderRadius: "8px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
          zIndex: 50,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          padding: "4px"
        }}>
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              style={{
                padding: "10px 14px",
                textAlign: "left",
                background: opt.value === value ? "var(--surface-soft)" : "transparent",
                color: opt.value === value ? "var(--ink)" : "var(--body)",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
                fontFamily: "var(--font-sans)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                transition: "background 0.1s ease"
              }}
              onMouseEnter={e => {
                if (opt.value !== value) e.currentTarget.style.background = "var(--surface-soft)";
              }}
              onMouseLeave={e => {
                if (opt.value !== value) e.currentTarget.style.background = "transparent";
              }}
            >
              <span>{opt.label}</span>
              {opt.value === value && <Check size={16} color="var(--primary-active)" strokeWidth={3} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
