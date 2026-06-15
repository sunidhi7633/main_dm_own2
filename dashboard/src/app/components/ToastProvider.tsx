"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { CheckCircle, AlertCircle, X } from "lucide-react";

type ToastType = "success" | "error";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);

    // Auto dismiss after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const success = useCallback((message: string) => addToast("success", message), [addToast]);
  const error = useCallback((message: string) => addToast("error", message), [addToast]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ success, error }}>
      {children}
      
      {/* Toast Container */}
      <div style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        zIndex: 9999,
        pointerEvents: "none"
      }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              pointerEvents: "auto",
              background: "#ffffff",
              border: "1px solid var(--hairline)",
              borderRadius: "12px",
              padding: "16px 20px",
              boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              minWidth: "300px",
              maxWidth: "400px",
              animation: "toast-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards"
            }}
          >
            {toast.type === "success" ? (
              <CheckCircle size={20} color="var(--primary-active)" />
            ) : (
              <AlertCircle size={20} color="#e11d48" />
            )}
            <span style={{ flex: 1, fontSize: "14px", color: "var(--ink)", fontWeight: 500 }}>
              {toast.message}
            </span>
            <button
              onClick={() => removeToast(toast.id)}
              style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", color: "var(--muted)", padding: "4px" }}
              onMouseEnter={e => e.currentTarget.style.color = "var(--ink)"}
              onMouseLeave={e => e.currentTarget.style.color = "var(--muted)"}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
