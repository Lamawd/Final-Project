import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, CheckCircle, XCircle, Play, FileText, Users, ClipboardList, BookOpen } from "lucide-react";
import api from "../api/client";

const TYPE_COLOR = { video: "#6366f1", article: "#10b981", pdf: "#ef4444", doc: "#3b82f6", other: "#6b7280" };
const STATUS_COLOR = { approved: "#059669", rejected: "#dc2626", pending: "#d97706" };

export default function AdminReview() {
  const [tab, setTab] = useState("pending");
  const [pending, setPending]   = useState([]);
  const [all, setAll]           = useState([]);
  const [users, setUsers]       = useState([]);
  const [reviewed, setReviewed] = useState({});
  const [courseReqs, setCourseReqs] = useState([]);
  const [courseReviewed, setCourseReviewed] = useState({});

  useEffect(() => {
    api.get("/resources/pending").then((r) => setPending(r.data));
    api.get("/resources/admin/all").then((r) => setAll(r.data));
    api.get("/auth/admin/users").then((r) => setUsers(r.data));
    api.get("/resources/courses/suggestions").then((r) => setCourseReqs(r.data)).catch(() => {});
  }, []);

  const review = async (id, approved) => {
    await api.post(`/resources/${id}/review`, null, { params: { approved } });
    setReviewed((prev) => ({ ...prev, [id]: approved ? "approved" : "rejected" }));
    setTimeout(() => {
      setPending((prev) => prev.filter((r) => r.id !== id));
      setAll((prev) => prev.map((r) => r.id === id ? { ...r, status: approved ? "approved" : "rejected" } : r));
    }, 500);
  };

  const reviewCourse = async (id, approved) => {
    await api.patch(`/resources/courses/suggestions/${id}`, null, { params: { approved } });
    setCourseReviewed((prev) => ({ ...prev, [id]: approved ? "approved" : "rejected" }));
    setCourseReqs((prev) => prev.map((r) => r.id === id ? { ...r, status: approved ? "approved" : "rejected" } : r));
  };

  const deleteUser = async (id) => {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    await api.delete(`/auth/admin/users/${id}`);
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  const tabs = [
    { key: "pending",  Icon: Clock,         label: `Pending (${pending.length})` },
    { key: "all",      Icon: ClipboardList, label: `All Submissions (${all.length})` },
    { key: "users",    Icon: Users,         label: `Users (${users.length})` },
    { key: "courses",  Icon: BookOpen,      label: `Course Suggestions (${courseReqs.filter(r => r.status === "pending").length})` },
  ];

  return (
    <div className="page">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <h2>Admin Panel</h2>
        <p className="muted" style={{ marginBottom: 20 }}>Manage resources and users.</p>
      </motion.div>

      <div className="profile-tabs" style={{ marginBottom: 28 }}>
        {tabs.map((t) => (
          <button key={t.key} className={`profile-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            <t.Icon size={14} style={{ display: "inline", marginRight: 5, verticalAlign: "middle" }} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Pending tab */}
      {tab === "pending" && (
        pending.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><CheckCircle size={40} color="#10b981" /></div>
            <p>All caught up!</p>
          </div>
        ) : (
          <AnimatePresence>
            {pending.map((r, i) => (
              <ResourceCard key={r.id} r={r} i={i} reviewed={reviewed[r.id]} onReview={review} />
            ))}
          </AnimatePresence>
        )
      )}

      {/* All submissions tab */}
      {tab === "all" && (
        <div className="submission-list">
          {all.map((r) => (
            <div key={r.id} className="submission-item">
              <div className="submission-body">
                <strong style={{ fontSize: "0.9rem" }}>{r.title}</strong>
                <span className="muted" style={{ fontSize: "0.8rem", display: "block" }}>
                  {r.course} › {r.topic} · {r.uploader} · {r.submitted}
                </span>
                <a href={r.url} target="_blank" rel="noreferrer" className="review-url" style={{ fontSize: "0.78rem" }}>
                  {r.url.length > 55 ? r.url.slice(0, 55) + "…" : r.url} ↗
                </a>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <span className="review-type-badge" style={{ background: TYPE_COLOR[r.type] || "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
                  {r.type === "video" ? <Play size={11} fill="currentColor" /> : <FileText size={11} />}
                  {r.type}
                </span>
                <span style={{ fontSize: "0.78rem", fontWeight: 600, color: STATUS_COLOR[r.status] }}>
                  {r.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Users tab */}
      {tab === "users" && (
        <div className="submission-list">
          {users.map((u) => (
            <div key={u.id} className="submission-item">
              <div className="submission-body">
                <strong style={{ fontSize: "0.9rem" }}>{u.username}</strong>
                {u.is_admin && <span className="badge" style={{ marginLeft: 8, background: "#ede9fe", color: "#5b21b6" }}>admin</span>}
                <span className="muted" style={{ fontSize: "0.8rem", display: "block" }}>{u.email} · joined {u.joined}</span>
                <span className="muted" style={{ fontSize: "0.78rem" }}>
                  {u.submissions} submission{u.submissions !== 1 ? "s" : ""} · {u.completed} topic{u.completed !== 1 ? "s" : ""} completed
                </span>
              </div>
              {!u.is_admin && (
                <button className="btn btn-reject" style={{ fontSize: "0.8rem", padding: "5px 12px" }} onClick={() => deleteUser(u.id)}>
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Course suggestions tab */}
      {tab === "courses" && (
        courseReqs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><BookOpen size={40} color="#6b7280" /></div>
            <p>No course suggestions yet.</p>
          </div>
        ) : (
          <div className="submission-list">
            {courseReqs.map((cr) => (
              <div key={cr.id} className="submission-item" style={{ alignItems: "flex-start", gap: 12 }}>
                <div className="submission-body" style={{ flex: 1 }}>
                  <strong style={{ fontSize: "0.95rem" }}>{cr.title}</strong>
                  <span className="muted" style={{ fontSize: "0.8rem", display: "block", marginTop: 2 }}>
                    by {cr.requested_by} · {cr.created_at}
                  </span>
                  {cr.description && <p style={{ fontSize: "0.85rem", color: "#374151", marginTop: 4 }}>{cr.description}</p>}
                  {cr.admin_note && <p style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: 4 }}>Note: {cr.admin_note}</p>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 600, color: STATUS_COLOR[cr.status] || "#6b7280" }}>
                    {cr.status}
                  </span>
                  {cr.status === "pending" && !courseReviewed[cr.id] && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-approve" style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                        onClick={() => reviewCourse(cr.id, true)}>
                        <CheckCircle size={13} style={{ display: "inline", marginRight: 3 }} />Approve
                      </button>
                      <button className="btn btn-reject" style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                        onClick={() => reviewCourse(cr.id, false)}>
                        <XCircle size={13} style={{ display: "inline", marginRight: 3 }} />Reject
                      </button>
                    </div>
                  )}
                  {courseReviewed[cr.id] && (
                    <span style={{ fontSize: "0.78rem", color: courseReviewed[cr.id] === "approved" ? "#10b981" : "#ef4444" }}>
                      {courseReviewed[cr.id] === "approved" ? "✓ Approved" : "✗ Rejected"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function ResourceCard({ r, i, reviewed, onReview }) {
  return (
    <motion.div
      className={`review-card ${reviewed ? `review-${reviewed}` : ""}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: reviewed === "approved" ? 60 : -60 }}
      transition={{ duration: 0.3, delay: i * 0.04 }}
    >
      <div className="review-card-top">
        <div className="review-meta">
          <span className="review-course">{r.course}</span>
          <span className="review-arrow">›</span>
          <span className="review-topic">{r.topic}</span>
          <span className="review-type-badge" style={{ background: TYPE_COLOR[r.type] || "#94a3b8", display: "inline-flex", alignItems: "center", gap: 4 }}>
            {r.type === "video" ? <Play size={11} fill="currentColor" /> : <FileText size={11} />}
            {r.type}
          </span>
        </div>
        <span className="review-date">{r.submitted} by <strong>{r.uploader}</strong></span>
      </div>
      <div className="review-card-body">
        <strong className="review-title">{r.title}</strong>
        <a href={r.url} target="_blank" rel="noreferrer" className="review-url">
          {r.url.length > 60 ? r.url.slice(0, 60) + "…" : r.url} ↗
        </a>
      </div>
      <div className="review-actions">
        <button className="btn btn-approve" onClick={() => onReview(r.id, true)} disabled={!!reviewed}>
          <CheckCircle size={14} style={{ display: "inline", marginRight: 4 }} />Approve
        </button>
        <button className="btn btn-reject"  onClick={() => onReview(r.id, false)} disabled={!!reviewed}>
          <XCircle size={14} style={{ display: "inline", marginRight: 4 }} />Reject
        </button>
      </div>
    </motion.div>
  );
}
