import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, CheckCircle, XCircle, Inbox, Settings, Lock, Palette, Plus, X, BookOpen, User } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { COURSES, courseOf } from "../courses";

const STATUS_COLOR = { approved: "#10b981", pending: "#f59e0b", rejected: "#ef4444" };
const STATUS_ICON  = { approved: CheckCircle, pending: Clock, rejected: XCircle };
const STATUS_LABEL = { approved: "Approved", pending: "Pending", rejected: "Rejected" };
const EMPTY_ROW = () => ({ course: "", topic_id: "", title: "", url: "", resource_type: "video" });

export default function UserProfile() {
  const { user, setUser, logout } = useAuth();
  const [tab, setTab] = useState("contributions");

  // Dark mode
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  useEffect(() => {
    document.body.classList.toggle("dark", darkMode);
    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);

  // Submissions
  const [submissions, setSubmissions] = useState([]);
  const loadSubmissions = () =>
    api.get("/auth/me/submissions").then((r) => setSubmissions(r.data)).catch(() => {});
  useEffect(() => { loadSubmissions(); }, []);

  // Edit profile
  const [profileForm, setProfileForm] = useState({ username: user?.username || "", avatar_url: user?.avatar_url || "" });
  const [profileMsg, setProfileMsg]   = useState("");
  const [profileErr, setProfileErr]   = useState("");

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileErr(""); setProfileMsg("");
    try {
      const res = await api.patch("/auth/me", {
        username: profileForm.username.trim() || undefined,
        avatar_url: profileForm.avatar_url.trim() || "",
      });
      setProfileMsg("Profile updated!");
      if (setUser) setUser((prev) => ({ ...prev, username: res.data.username, avatar_url: res.data.avatar_url }));
    } catch (err) {
      setProfileErr(err.response?.data?.detail || "Failed to update profile");
    }
  };

  // Course suggestion
  const [courseReq, setCourseReq]   = useState({ title: "", description: "" });
  const [courseMsg, setCourseMsg]   = useState("");
  const [courseErr, setCourseErr]   = useState("");

  const suggestCourse = async (e) => {
    e.preventDefault();
    setCourseErr(""); setCourseMsg("");
    try {
      await api.post("/resources/courses/suggest", courseReq);
      setCourseMsg("Course suggestion submitted! An admin will review it.");
      setCourseReq({ title: "", description: "" });
    } catch (err) {
      setCourseErr(err.response?.data?.detail || "Failed to submit");
    }
  };

  // Suggest rows
  const [allTopics, setAllTopics] = useState([]);
  const [rows, setRows]           = useState([EMPTY_ROW()]);
  const [results, setResults]     = useState([]);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { api.get("/topics/").then((r) => setAllTopics(r.data)); }, []);

  const topicsByCourse = (courseId) =>
    allTopics.filter((t) => courseOf(t) === parseInt(courseId))
             .sort((a, b) => a.order_index - b.order_index);

  const updateRow = (i, field, val) => setRows((prev) => {
    const next = [...prev];
    next[i] = { ...next[i], [field]: val };
    if (field === "course") next[i].topic_id = "";
    return next;
  });

  const validateUrl = (url) => {
    try { const u = new URL(url); return ["http:", "https:"].includes(u.protocol); }
    catch { return false; }
  };

  const submitSuggestions = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const out = await Promise.all(rows.map(async (row, i) => {
      if (!row.topic_id) return { i, ok: false, msg: "No subtopic selected" };
      if (!validateUrl(row.url)) return { i, ok: false, msg: "URL must start with https://" };
      try {
        await api.post("/resources/", {
          topic_id: parseInt(row.topic_id),
          title: row.title.trim(),
          url: row.url.trim(),
          resource_type: row.resource_type,
        });
        return { i, ok: true };
      } catch (err) {
        return { i, ok: false, msg: err.response?.data?.detail || "Failed" };
      }
    }));
    setResults(out);
    setSubmitting(false);
    const failedIdx = new Set(out.filter((r) => !r.ok).map((r) => r.i));
    setRows(failedIdx.size === 0 ? [EMPTY_ROW()] : (prev) => prev.filter((_, i) => failedIdx.has(i)));
    if (failedIdx.size === 0) loadSubmissions();
  };

  // Change password
  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "", confirm: "" });
  const [pwMsg, setPwMsg]   = useState("");
  const [pwErr, setPwErr]   = useState("");

  const changePassword = async (e) => {
    e.preventDefault();
    setPwErr(""); setPwMsg("");
    if (pwForm.new_password !== pwForm.confirm) { setPwErr("Passwords do not match"); return; }
    try {
      await api.post("/auth/change-password", {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      setPwMsg("Password updated");
      setPwForm({ current_password: "", new_password: "", confirm: "" });
    } catch (err) {
      setPwErr(err.response?.data?.detail || "Failed");
    }
  };

  const pending  = submissions.filter((s) => s.status === "pending");
  const approved = submissions.filter((s) => s.status === "approved");
  const rejected = submissions.filter((s) => s.status === "rejected");
  const successCount = results.filter((r) => r.ok).length;
  const avatarUrl = user?.avatar_url;

  return (
    <div className="page">
      {/* Header */}
      <motion.div
        className="profile-header"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="profile-avatar">
          {avatarUrl
            ? <img src={avatarUrl} alt={user?.username} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
            : user?.username?.[0]?.toUpperCase()}
        </div>
        <div>
          <h2>{user?.username}</h2>
          <p className="muted">{user?.email}</p>
        </div>
        <div className="profile-header-actions">
          <button className={`toggle-btn ${darkMode ? "active" : ""}`} onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? "Light mode" : "Dark mode"}
          </button>
          <button className="btn" style={{ background: "#fee2e2", color: "#991b1b" }} onClick={logout}>
            Logout
          </button>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="profile-tabs">
        <button className={`profile-tab ${tab === "contributions" ? "active" : ""}`} onClick={() => setTab("contributions")}>
          <Inbox size={15} style={{ display: "inline", marginRight: 5, verticalAlign: "middle" }} />
          Contributions
          {pending.length > 0 && <span className="tab-badge">{pending.length}</span>}
        </button>
        <button className={`profile-tab ${tab === "settings" ? "active" : ""}`} onClick={() => setTab("settings")}>
          <Settings size={15} style={{ display: "inline", marginRight: 5, verticalAlign: "middle" }} />
          Settings
        </button>
      </div>

      <AnimatePresence mode="wait">
        {tab === "contributions" && (
          <motion.div key="contributions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

            {/* Suggest form */}
            <section style={{ marginBottom: 32 }}>
              <h3 className="section-title">Submit a Resource</h3>
              <p className="muted" style={{ marginBottom: 16 }}>
                Know a great video or article? Submit it for admin review.
              </p>

              {successCount > 0 && (
                <motion.div className="all-done-banner" style={{ marginBottom: 16 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <CheckCircle size={15} style={{ display: "inline", marginRight: 6 }} />
                  {successCount} resource{successCount > 1 ? "s" : ""} submitted for review!
                </motion.div>
              )}

              <form onSubmit={submitSuggestions}>
                <div className="suggest-rows">
                  {rows.map((row, i) => {
                    const result = results.find((r) => r.i === i);
                    const topics = row.course ? topicsByCourse(row.course) : [];
                    return (
                      <motion.div key={i} className="suggest-row"
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                      >
                        <div className="suggest-row-header">
                          <span className="suggest-row-num">#{i + 1}</span>
                          {rows.length > 1 && (
                            <button type="button" className="remove-row-btn"
                              onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))}>
                              <X size={13} />
                            </button>
                          )}
                        </div>
                        <div className="suggest-row-fields">
                          <select value={row.course} onChange={(e) => updateRow(i, "course", e.target.value)} required>
                            <option value="">— Course —</option>
                            {COURSES.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                          </select>
                          <select value={row.topic_id} onChange={(e) => updateRow(i, "topic_id", e.target.value)} required disabled={!row.course}>
                            <option value="">— Subtopic —</option>
                            {topics.map((t) => <option key={t.id} value={t.id}>{t.title.replace(/^[^:]+: /, "")}</option>)}
                          </select>
                          <input placeholder="Resource title" value={row.title}
                            onChange={(e) => updateRow(i, "title", e.target.value)} required />
                          <input placeholder="URL (https://...)" value={row.url}
                            onChange={(e) => updateRow(i, "url", e.target.value)} required />
                          <select value={row.resource_type} onChange={(e) => updateRow(i, "resource_type", e.target.value)}>
                            <option value="video">Video</option>
                            <option value="article">Article</option>
                            <option value="pdf">PDF</option>
                            <option value="doc">Document</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        {result && !result.ok && <p className="error-msg" style={{ marginTop: 6 }}>{result.msg}</p>}
                      </motion.div>
                    );
                  })}
                </div>
                <div className="suggest-actions">
                  <button type="button" className="add-row-btn" onClick={() => setRows((p) => [...p, EMPTY_ROW()])}>
                    <Plus size={14} style={{ display: "inline", marginRight: 4 }} />
                    Add another
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? "Submitting…" : `Submit ${rows.length > 1 ? `${rows.length} Resources` : "Resource"}`}
                  </button>
                </div>
              </form>
            </section>

            {/* My submissions history */}
            <section style={{ marginBottom: 32 }}>
              <h3 className="section-title">My Submission History</h3>
              {submissions.length === 0 ? (
                <p className="muted">No submissions yet.</p>
              ) : (
                <>
                  <div className="submission-stats">
                    <span style={{ color: STATUS_COLOR.pending, display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={14} /> {pending.length} pending
                    </span>
                    <span style={{ color: STATUS_COLOR.approved, display: "flex", alignItems: "center", gap: 4 }}>
                      <CheckCircle size={14} /> {approved.length} approved
                    </span>
                    <span style={{ color: STATUS_COLOR.rejected, display: "flex", alignItems: "center", gap: 4 }}>
                      <XCircle size={14} /> {rejected.length} rejected
                    </span>
                  </div>
                  <div className="submission-list" style={{ marginTop: 12 }}>
                    {submissions.map((s, i) => {
                      const SIcon = STATUS_ICON[s.status] || Clock;
                      return (
                        <motion.div key={s.id} className="submission-item"
                          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                        >
                          <div className="submission-body">
                            <a href={s.url} target="_blank" rel="noreferrer" className="resource-link">{s.title}</a>
                            <span className="muted" style={{ fontSize: "0.8rem" }}> — {s.topic.replace(/^[^:]+: /, "")}</span>
                          </div>
                          <span className="submission-status" style={{ color: STATUS_COLOR[s.status], display: "flex", alignItems: "center", gap: 4 }}>
                            <SIcon size={14} />
                            {STATUS_LABEL[s.status]}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>
                </>
              )}
            </section>

            {/* Suggest a new course */}
            <section style={{ marginBottom: 32 }}>
              <h3 className="section-title">
                <BookOpen size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
                Suggest a New Course
              </h3>
              <p className="muted" style={{ marginBottom: 14 }}>
                Don't see a course you need? Suggest it — an admin will review your idea.
              </p>
              <form className="pw-form" onSubmit={suggestCourse}>
                <input placeholder="Course title (e.g. Machine Learning Basics)"
                  value={courseReq.title}
                  onChange={(e) => setCourseReq({ ...courseReq, title: e.target.value })} required />
                <textarea placeholder="Brief description (optional) — what should this course cover?"
                  value={courseReq.description}
                  onChange={(e) => setCourseReq({ ...courseReq, description: e.target.value })}
                  rows={3} style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.95rem", resize: "vertical" }} />
                {courseErr && <p className="error-msg">{courseErr}</p>}
                {courseMsg && <p className="success-msg" style={{ display: "flex", alignItems: "center", gap: 5 }}><CheckCircle size={14} /> {courseMsg}</p>}
                <button type="submit" className="btn btn-primary">Submit Suggestion</button>
              </form>
            </section>
          </motion.div>
        )}

        {tab === "settings" && (
          <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

            {/* Edit profile */}
            <section style={{ marginBottom: 32 }}>
              <h3 className="section-title">
                <User size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
                Edit Profile
              </h3>
              <form className="pw-form" onSubmit={saveProfile}>
                <label style={{ fontSize: 13, color: "#6b7280", marginBottom: 2, display: "block" }}>Username</label>
                <input placeholder="Username"
                  value={profileForm.username}
                  onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })} />
                <label style={{ fontSize: 13, color: "#6b7280", marginBottom: 2, display: "block" }}>Avatar URL</label>
                <input placeholder="https://example.com/your-avatar.jpg"
                  value={profileForm.avatar_url}
                  onChange={(e) => setProfileForm({ ...profileForm, avatar_url: e.target.value })} />
                {profileForm.avatar_url && (
                  <div style={{ marginBottom: 8 }}>
                    <img src={profileForm.avatar_url} alt="preview"
                      onError={(e) => { e.target.style.display = "none"; }}
                      style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: "2px solid #e5e7eb" }} />
                    <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 8 }}>Preview</span>
                  </div>
                )}
                {profileErr && <p className="error-msg">{profileErr}</p>}
                {profileMsg && <p className="success-msg" style={{ display: "flex", alignItems: "center", gap: 5 }}><CheckCircle size={14} /> {profileMsg}</p>}
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </form>
            </section>
            <section style={{ marginBottom: 32 }}>
              <h3 className="section-title">
                <Lock size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
                Change Password
              </h3>
              <form className="pw-form" onSubmit={changePassword}>
                <input type="password" placeholder="Current password"
                  value={pwForm.current_password}
                  onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })} required />
                <input type="password" placeholder="New password (min 6 chars)"
                  value={pwForm.new_password}
                  onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })} required />
                <input type="password" placeholder="Confirm new password"
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} required />
                {pwErr && <p className="error-msg">{pwErr}</p>}
                {pwMsg && <p className="success-msg" style={{ display: "flex", alignItems: "center", gap: 5 }}><CheckCircle size={14} /> {pwMsg}</p>}
                <button type="submit" className="btn btn-primary">Update Password</button>
              </form>
            </section>

            <section style={{ marginBottom: 32 }}>
              <h3 className="section-title">
                <Palette size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
                Appearance
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span>Dark mode</span>
                <button className={`toggle-btn ${darkMode ? "active" : ""}`} onClick={() => setDarkMode(!darkMode)}>
                  {darkMode ? "Light mode" : "Dark mode"}
                </button>
              </div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
