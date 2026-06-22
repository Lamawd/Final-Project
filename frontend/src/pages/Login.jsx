import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.username, form.password);
      navigate("/");
    } catch {
      setError("Invalid username or password");
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
          <h2>Welcome back</h2>
          <p className="auth-sub">Log in to continue learning</p>
          <form onSubmit={submit}>
            <input
              placeholder="Username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
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
              {loading ? "Logging in…" : "Log In"}
            </button>
          </form>
          <p className="auth-switch">No account? <Link to="/register">Register</Link></p>
        </motion.div>
      </div>
    </div>
  );
}

export function HeroBrand() {
  const features = [
    { icon: "🌳", text: "5 structured courses" },
    { icon: "✅", text: "Track your progress" },
    { icon: "✨", text: "Personalised recommendations" },
    { icon: "📹", text: "Watch videos in-site" },
  ];
  return (
    <div className="auth-hero">
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="hero-brand">Opic</div>
        <h1 className="hero-tagline">Learn smarter,<br />one topic at a time.</h1>
        <p className="hero-desc">
          A structured learning platform that adapts to what you know
          and guides you through what's next.
        </p>
        <ul className="hero-features">
          {features.map((f) => (
            <motion.li
              key={f.text}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + features.indexOf(f) * 0.1 }}
            >
              <span>{f.icon}</span> {f.text}
            </motion.li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}
