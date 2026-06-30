import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, CheckCircle, Play, FileText } from "lucide-react";
import api from "../api/client";
import { COURSES, courseOf } from "../courses";

const EMPTY_ROW = () => ({ course: "", topic_id: "", title: "", url: "", resource_type: "video", note: "" });

export default function SuggestPage() {
  const [allTopics, setAllTopics] = useState([]);
  const [rows, setRows] = useState([EMPTY_ROW()]);
  const [results, setResults] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/topics/").then((r) => setAllTopics(r.data));
  }, []);

  const topicsByCourse = (courseId) =>
    allTopics
      .filter((t) => courseOf(t) === parseInt(courseId))
      .sort((a, b) => a.order_index - b.order_index);

  const update = (i, field, val) => {
    setRows((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: val };
      if (field === "course") next[i].topic_id = "";
      return next;
    });
  };

  const addRow    = () => setRows((prev) => [...prev, EMPTY_ROW()]);
  const removeRow = (i) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const validateUrl = (url) => {
    try {
      const u = new URL(url);
      return ["http:", "https:"].includes(u.protocol);
    } catch { return false; }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const out = await Promise.all(
      rows.map(async (row, i) => {
        if (!row.topic_id) return { i, ok: false, msg: "No subtopic selected" };
        if (!validateUrl(row.url)) return { i, ok: false, msg: "URL must start with https://" };
        try {
          await api.post("/resources/", {
            topic_id: parseInt(row.topic_id),
            title: row.title.trim(),
            url: row.url.trim(),
            resource_type: row.resource_type,
          });
          return { i, ok: true, msg: "Submitted for review" };
        } catch (err) {
          return { i, ok: false, msg: err.response?.data?.detail || "Failed" };
        }
      })
    );
    setResults(out);
    setSubmitting(false);
    const failedIdx = new Set(out.filter((r) => !r.ok).map((r) => r.i));
    setRows((prev) => prev.filter((_, i) => failedIdx.has(i)));
    if (failedIdx.size === 0) setRows([EMPTY_ROW()]);
  };

  const successCount = results.filter((r) => r.ok).length;

  return (
    <div className="page">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h2>Suggest Resources</h2>
        <p className="muted" style={{ marginBottom: 24 }}>
          Submit videos or articles for any subtopic. Each submission goes to admin review before appearing on the platform.
        </p>
      </motion.div>

      {successCount > 0 && (
        <motion.div className="all-done-banner" style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <CheckCircle size={16} />
          {successCount} resource{successCount > 1 ? "s" : ""} submitted successfully!
        </motion.div>
      )}

      <form onSubmit={submit}>
        <div className="suggest-rows">
          <AnimatePresence>
            {rows.map((row, i) => {
              const result = results.find((r) => r.i === i);
              const topics = row.course ? topicsByCourse(row.course) : [];
              return (
                <motion.div
                  key={i}
                  className="suggest-row"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="suggest-row-header">
                    <span className="suggest-row-num">#{i + 1}</span>
                    {rows.length > 1 && (
                      <button type="button" className="remove-row-btn" onClick={() => removeRow(i)}>
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  <div className="suggest-row-fields">
                    <select value={row.course} onChange={(e) => update(i, "course", e.target.value)} required>
                      <option value="">— Select course —</option>
                      {COURSES.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>

                    <select value={row.topic_id} onChange={(e) => update(i, "topic_id", e.target.value)} required disabled={!row.course}>
                      <option value="">— Select subtopic —</option>
                      {topics.map((t) => (
                        <option key={t.id} value={t.id}>{t.title.replace(/^[^:]+: /, "")}</option>
                      ))}
                    </select>

                    <input placeholder="Resource title" value={row.title} onChange={(e) => update(i, "title", e.target.value)} required />
                    <input placeholder="URL (https://...)" value={row.url} onChange={(e) => update(i, "url", e.target.value)} required />

                    <select value={row.resource_type} onChange={(e) => update(i, "resource_type", e.target.value)}>
                      <option value="video">Video</option>
                      <option value="article">Article</option>
                    </select>

                    <input placeholder="Note for admin (optional)" value={row.note} onChange={(e) => update(i, "note", e.target.value)} />
                  </div>

                  {result && (
                    <p className={result.ok ? "success-msg" : "error-msg"} style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
                      {result.ok ? <CheckCircle size={13} /> : null}
                      {result.msg}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <div className="suggest-actions">
          <button type="button" className="add-row-btn" onClick={addRow}>
            <Plus size={14} style={{ display: "inline", marginRight: 4 }} />
            Add another resource
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Submitting…" : `Submit ${rows.length} Resource${rows.length > 1 ? "s" : ""}`}
          </button>
        </div>
      </form>
    </div>
  );
}
