"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("user_role", data.role ?? "admin");
        router.push('/');
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || 'Invalid credentials. Please try again.');
      }
    } catch {
      setError('Cannot connect to the server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "var(--canvas)",
      padding: "24px",
      backgroundImage: "radial-gradient(ellipse 80% 60% at 50% 0%, #efe9de 0%, transparent 60%)",
    }}>
      <style>{`
        @media (max-width: 768px) {
          .login-card { padding: 32px 20px 24px !important; }
          .login-heading { font-size: 26px !important; }
        }
      `}</style>
      <div className="login-card" style={{
        width: "100%",
        maxWidth: "420px",
        backgroundColor: "var(--canvas)",
        border: "1px solid var(--hairline)",
        borderRadius: "16px",
        padding: "48px 40px 40px",
        boxShadow: "0 4px 24px rgba(20,20,19,0.06), 0 1px 4px rgba(20,20,19,0.04)",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <img
            src="/Harshwal.png"
            alt="Harshwal Logo"
            style={{ height: "32px", objectFit: "contain", marginBottom: "20px" }}
          />
          <h1 className="login-heading" style={{
            fontFamily: "var(--font-serif)",
            fontSize: "32px",
            fontWeight: 400,
            color: "var(--ink)",
            letterSpacing: "-0.5px",
            lineHeight: 1.2,
            marginBottom: "8px",
          }}>Welcome back</h1>
          <p style={{
            fontSize: "14px",
            color: "var(--muted)",
            lineHeight: 1.5,
          }}>Sign in to the Harshwal Automation platform</p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            marginBottom: "20px",
            padding: "12px 16px",
            backgroundColor: "rgb(198 69 69 / 0.08)",
            border: "1px solid rgb(198 69 69 / 0.2)",
            borderRadius: "8px",
            color: "var(--error)",
            fontSize: "14px",
            lineHeight: 1.4,
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{
              display: "block",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--ink)",
              marginBottom: "6px",
            }}>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              className="input-field"
              placeholder="Enter your username"
              autoComplete="username"
            />
          </div>

          <div>
            <label style={{
              display: "block",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--ink)",
              marginBottom: "6px",
            }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="input-field"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              marginTop: "8px",
              width: "100%",
              padding: "12px 20px",
              backgroundColor: isLoading ? "var(--primary-disabled)" : "var(--primary)",
              color: "var(--on-primary)",
              fontFamily: "var(--font-sans)",
              fontSize: "15px",
              fontWeight: 500,
              border: "none",
              borderRadius: "8px",
              cursor: isLoading ? "not-allowed" : "pointer",
              transition: "background-color 150ms ease",
            }}
          >
            {isLoading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={{ marginTop: "24px", textAlign: "center", fontSize: "13px", color: "var(--muted)" }}>
          Internal tool — Harshwal & Company LLP
        </p>
      </div>
    </div>
  );
}
