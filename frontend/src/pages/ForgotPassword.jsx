import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../api/client";
import { HeroBrand } from "./Login";

export default function ForgotPassword() {
  const [email, setEmail]   = useState("");
  const [sent, setSent]     = useState(false);
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const [devToken, setDevToken] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      if (data.dev_token) {
        setDevToken(data.dev_token);
      }
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <HeroBrand />
      <div className="auth-panel">
        <motion.div className="auth-form-box" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
          {sent ? (
            <>
              <h2>Check your email</h2>
              <p className="auth-sub" style={{ marginBottom: 24 }}>
                We sent a 6-digit code to <strong>{email}</strong>. It expires in 10 minutes.
              </p>
              {devToken && (
                <div style={{ background: "#fef3c7", border: "1px solid #f59e0b", color: "#92400e", padding: "12px", borderRadius: "6px", marginBottom: "16px", fontSize: "0.9rem" }}>
                  <strong>Demo Mode Reset Code:</strong> <code style={{ fontSize: "1.1rem", fontWeight: "bold" }}>{devToken}</code>
                </div>
              )}
              <Link to={`/reset-password?email=${encodeURIComponent(email)}`} className="btn btn-primary btn-full" style={{ display: "block", textAlign: "center" }}>
                Enter Code →
              </Link>
            </>
          ) : (
            <>
              <h2>Forgot password</h2>
              <p className="auth-sub">Enter your account email and we'll send a reset code.</p>
              <form onSubmit={submit}>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                {error && <p className="error-msg">{error}</p>}
                <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                  {loading ? "Sending…" : "Send Reset Code"}
                </button>
              </form>
              <p className="auth-switch"><Link to="/login">← Back to Login</Link></p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
