import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle, TrendingUp, Sparkles, PlayCircle, ArrowRight } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.email)                              e.email    = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email address";
    if (!form.password)                           e.password = "Password is required";
    return e;
  };

  const submit = async (e) => {
    e.preventDefault();
    const v = validate();
    if (Object.keys(v).length) { setErrors(v); return; }
    setErrors({});
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate("/");
    } catch (err) {
      const msg = err.response?.data?.detail || "Login failed. Please try again.";
      // Route the server message to the right field
      if (msg.toLowerCase().includes("email") || msg.toLowerCase().includes("account")) {
        setErrors({ email: msg });
      } else if (msg.toLowerCase().includes("password")) {
        setErrors({ password: msg });
      } else {
        setErrors({ general: msg });
      }
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
          <form onSubmit={submit} noValidate>
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => { setForm({ ...form, email: e.target.value }); setErrors((prev) => ({ ...prev, email: "" })); }}
              className={errors.email ? "input-error" : ""}
              required
            />
            {errors.email && <p className="error-msg">{errors.email}</p>}
            <input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => { setForm({ ...form, password: e.target.value }); setErrors((prev) => ({ ...prev, password: "" })); }}
              className={errors.password ? "input-error" : ""}
              required
            />
            {errors.password && <p className="error-msg">{errors.password}</p>}
            {errors.general  && <p className="error-msg">{errors.general}</p>}
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? "Logging in…" : "Log In"}
            </button>
          </form>
          <p className="auth-switch">No account? <Link to="/register">Register</Link></p>
          <p className="auth-switch"><Link to="/forgot-password">Forgot password?</Link></p>
        </motion.div>
      </div>
    </div>
  );
}

export function HeroBrand() {
  const features = [
    { Icon: TrendingUp,  text: "5 structured courses",                         color: "#a5b4fc" },
    { Icon: CheckCircle, text: "Track your progress",                           color: "#6ee7b7" },
    { Icon: Sparkles,    text: "Resource suggestions based on your activity",   color: "#fde68a" },
    { Icon: PlayCircle,  text: "Watch videos in-site",                          color: "#f9a8d4" },
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
          {features.map((f, idx) => (
            <motion.li
              key={f.text}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + idx * 0.1 }}
            >
              <span className="hero-feature-icon" style={{ color: f.color }}>
                <f.Icon size={16} strokeWidth={2} />
              </span>
              {f.text}
            </motion.li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}
