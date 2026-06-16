"use client";
import React from "react";

interface Props { children: React.ReactNode; }
interface State { error: Error | null; }

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "60px 40px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#c64545", marginBottom: 12 }}>
            Something went wrong
          </h2>
          <p style={{ color: "#6b7280", marginBottom: 24, fontSize: 14, maxWidth: 480, margin: "0 auto 24px" }}>
            {this.state.error.message || "An unexpected error occurred in this section."}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              padding: "10px 24px", borderRadius: 8,
              border: "1px solid #e5e7eb", background: "#fff",
              cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#374151",
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
