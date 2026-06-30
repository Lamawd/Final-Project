import { useState } from "react";
import api from "../api/client";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { HeroBrand } from "./Login";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm]     = useState({ username: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.username.trim())            e.username = "Username is required";
    else if (form.username.trim().length < 2) e.username = "Username must be at least 2 characters";
    if (!form.email)                      e.email    = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email address";
    if (!form.password)                   e.password = "Password is required";
    else if (form.password.length < 8)    e.password = "Password must be at least 8 characters";
    return e;
  };

  const submit = async (e) => {
    e.preventDefault();
    const v = validate();
    if (Object.keys(v).length) { setErrors(v); return; }
    setErrors({});
    setLoading(true);
    try {
      await api.post("/auth/register", form);
      await login(form.email, form.password);
      navigate("/onboarding");
    } catch (err) {
      const msg = err.response?.data?.detail || "Registration failed. Please try again.";
      // Route the server message to the right field
      if (msg.toLowerCase().includes("email")) {
        setErrors({ email: msg });
      } else if (msg.toLowerCase().includes("username")) {
        setErrors({ username: msg });
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
          <h2>Create account</h2>
          <p className="auth-sub">Start your learning journey today</p>
          <form onSubmit={submit} noValidate>
            <input
              placeholder="Username"
              value={form.username}
              onChange={(e) => setField("username", e.target.value)}
              className={errors.username ? "input-error" : ""}
              required
            />
            {errors.username && <p className="error-msg">{errors.username}</p>}
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              className={errors.email ? "input-error" : ""}
              required
            />
            {errors.email && <p className="error-msg">{errors.email}</p>}
            <input
              type="password"
              placeholder="Password (min. 8 characters)"
              value={form.password}
              onChange={(e) => setField("password", e.target.value)}
              className={errors.password ? "input-error" : ""}
              required
            />
            {errors.password && <p className="error-msg">{errors.password}</p>}
            {errors.general  && <p className="error-msg">{errors.general}</p>}
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
