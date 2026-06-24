import { useState } from "react";
import api from "../api/client";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { HeroBrand } from "./Login";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/register", form);
      await login(form.email, form.password);
      navigate("/onboarding");
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <HeroBrand />
      <div className="auth-panel">
        <motion.div
          className="auth-form-box"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h2>Create account</h2>
          <p className="auth-sub">Start your learning journey today</p>
          <form onSubmit={submit}>
            <input
              placeholder="Username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            {error && <p className="error-msg">{error}</p>}
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? "Creating account…" : "Register"}
            </button>
          </form>
          <p className="auth-switch">Have an account? <Link to="/login">Log in</Link></p>
        </motion.div>
      </div>
    </div>
  );
}
