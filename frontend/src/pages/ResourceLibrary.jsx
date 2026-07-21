import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Play, FileText, Star, Search, Filter } from "lucide-react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { COURSES } from "../courses";

const TYPE_COLOR = {
  video:   "#6366f1",
  article: "#10b981",
  pdf:     "#ef4444",
  doc:     "#3b82f6",
  other:   "#6b7280",
};

export default function ResourceLibrary() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [filterCourse, setFilterCourse] = useState("");
  const [filterType, setFilterType]     = useState("");

  useEffect(() => {
    api.get("/resources/library")
      .then((r) => setResources(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return resources.filter((r) => {
      if (filterCourse && r.course !== filterCourse) return false;
      if (filterType   && r.type   !== filterType)   return false;
      if (q && !r.title.toLowerCase().includes(q) &&
               !r.topic.toLowerCase().includes(q) &&
               !r.uploader.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [resources, search, filterCourse, filterType]);

  // Derive unique course names from actual data
  const courses = useMemo(() => {
    const seen = new Set();
    const out = [];
    resources.forEach((r) => {
      if (r.course && !seen.has(r.course)) { seen.add(r.course); out.push(r.course); }
    });
    return out.sort();
  }, [resources]);

  const types = ["video", "article", "pdf", "doc", "other"];

  return (
    <div className="page">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <h2>Community Resource Library</h2>
        <p className="muted" style={{ marginBottom: 24 }}>
          All approved resources submitted by the community — browse, filter, and learn.
        </p>
      </motion.div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ position: "relative", flex: "1 1 220px" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            placeholder="Search title, topic, or contributor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "8px 12px 8px 32px",
              border: "1px solid #d1d5db", borderRadius: 8, fontSize: "0.9rem",
            }}
          />
        </div>
        <select
          value={filterCourse}
          onChange={(e) => setFilterCourse(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: "0.9rem", background: "#fff" }}
        >
          <option value="">All Courses</option>
          {courses.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: "0.9rem", background: "#fff" }}
        >
          <option value="">All Types</option>
          {types.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
      </div>

      {/* Stats bar */}
      <p className="muted" style={{ fontSize: "0.82rem", marginBottom: 16 }}>
        {loading ? "Loading…" : `${filtered.length} resource${filtered.length !== 1 ? "s" : ""} found`}
        {(filterCourse || filterType || search) && (
          <button
            onClick={() => { setSearch(""); setFilterCourse(""); setFilterType(""); }}
            style={{ marginLeft: 10, fontSize: "0.8rem", color: "#6366f1", background: "none", border: "none", cursor: "pointer" }}
          >
            Clear filters
          </button>
        )}
      </p>

      {/* Resource list */}
      {loading ? (
        <div className="loading">Loading resources…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Filter size={36} color="#9ca3af" /></div>
          <p>No resources match your filters.</p>
        </div>
      ) : (
        <div className="submission-list">
          {filtered.map((r, i) => (
            <motion.div
              key={r.id}
              className="submission-item"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
            >
              <div className="submission-body" style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <a href={r.url} target="_blank" rel="noreferrer" className="resource-link"
                    style={{ fontWeight: 600, fontSize: "0.92rem" }}>
                    {r.title} ↗
                  </a>
                  <span
                    className="review-type-badge"
                    style={{ background: TYPE_COLOR[r.type] || "#94a3b8", display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.72rem", padding: "2px 7px", borderRadius: 99, color: "#fff" }}
                  >
                    {r.type === "video" ? <Play size={10} fill="currentColor" /> : <FileText size={10} />}
                    {r.type}
                  </span>
                </div>
                <span className="muted" style={{ fontSize: "0.8rem", display: "block", marginTop: 2 }}>
                  {r.course && <>{r.course} › </>}{r.topic}
                  {" · "}by <strong>{r.uploader}</strong>
                  {" · "}{r.submitted}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, minWidth: 80 }}>
                {r.rating_count > 0 ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: "0.82rem", color: "#f59e0b", fontWeight: 600 }}>
                    <Star size={13} fill="#f59e0b" />
                    {r.avg_rating} <span style={{ color: "#9ca3af", fontWeight: 400 }}>({r.rating_count})</span>
                  </span>
                ) : (
                  <span className="muted" style={{ fontSize: "0.78rem" }}>No ratings yet</span>
                )}
                <Link
                  to={`/topics/${r.topic_id}`}
                  style={{ fontSize: "0.75rem", color: "#6366f1", fontWeight: 500 }}
                >
                  View topic →
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
