import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import api from "../api/client";
import { HeroBrand } from "./Login";

export default function ResetPassword() {
  const [params]  = useSearchParams();
  const navigate  = useNavigate();
  const [email, setEmail]       = useState(params.get("email") || "");
  const [token, setToken]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(600);
  const [resending, setResending]     = useState(false);
  const [resendMsg, setResendMsg]     = useState("");
  const [devToken, setDevToken]       = useState("");
  const timerRef = useRef(null);

  const startTimer = () => {
    clearInterval(timerRef.current);
    setSecondsLeft(600);
    timerRef.current = setInterval(() => setSecondsLeft((s) => { if (s <= 1) { clearInterval(timerRef.current); return 0; } return s - 1; }), 1000);
  };

  useEffect(() => { startTimer(); return () => clearInterval(timerRef.current); }, []);

  const resend = async () => {
    if (!email) return;
    setResending(true); setResendMsg(""); setError("");
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      if (data.dev_token) {
        setDevToken(data.dev_token);
      }
      setToken(""); setResendMsg("New code sent! Check your inbox.");
      startTimer();
    } catch {
      setResendMsg("Failed to resend. Try again.");
    } finally {
      setResending(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await api.post("/auth/reset-password", { email, token, new_password: password });
      setDone(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid or expired code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <HeroBrand />
      <div className="auth-panel">
        <motion.div className="auth-form-box" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
          {done ? (
            <>
              <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle size={22} color="#10b981" /> Password reset!
              </h2>
              <p className="auth-sub">Redirecting to login…</p>
            </>
          ) : (
            <>
              <h2>Enter reset code</h2>
              <p className="auth-sub">
                Code sent to <strong>{email}</strong> —{" "}
                {secondsLeft > 0
                  ? <span style={{ color: secondsLeft <= 60 ? "#dc2626" : "#059669" }}>
                      expires in {Math.floor(secondsLeft/60)}:{String(secondsLeft%60).padStart(2,"0")}
                    </span>
                  : <span style={{ color: "#dc2626" }}>Code expired</span>
                }
              </p>
              <form onSubmit={submit}>
                {!params.get("email") && (
                  <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                )}
                <input
                  placeholder="6-digit code"
                  value={token}
                  onChange={(e) => setToken(e.target.value.toUpperCase())}
                  maxLength={6}
                  required
                  style={{ letterSpacing: "0.2em", fontWeight: 700 }}
                />
                <input
                  type="password"
                  placeholder="New password (min 6 chars)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                {error && <p className="error-msg">{error}</p>}
                <button type="submit" className="btn btn-primary btn-full" disabled={loading || secondsLeft === 0}>
                  {loading ? "Resetting…" : "Reset Password"}
                </button>
              </form>
              <p className="auth-switch" style={{ marginTop: 12 }}>
                Didn't get it?{" "}
                <button onClick={resend} disabled={resending} style={{ background: "none", border: "none", color: "#4f46e5", cursor: "pointer", fontWeight: 600, padding: 0 }}>
                  {resending ? "Sending…" : "Resend code"}
                </button>
              </p>
              {resendMsg && <p className="success-msg" style={{ textAlign: "center", marginTop: 6 }}>{resendMsg}</p>}
              {devToken && (
                <div style={{ background: "#fef3c7", border: "1px solid #f59e0b", color: "#92400e", padding: "12px", borderRadius: "6px", marginTop: "12px", fontSize: "0.9rem", textAlign: "center" }}>
                  <strong>Demo Mode Code:</strong> <code style={{ fontSize: "1.1rem", fontWeight: "bold" }}>{devToken}</code>
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
