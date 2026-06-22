import { useEffect, useState } from "react";
import api from "../api/client";

export default function AdminReview() {
  const [pending, setPending] = useState([]);

  const load = () => api.get("/resources/pending").then((r) => setPending(r.data));
  useEffect(() => { load(); }, []);

  const review = async (id, approved) => {
    await api.post(`/resources/${id}/review`, null, { params: { approved } });
    load();
  };

  return (
    <div className="page">
      <h2>Admin: Pending Resources</h2>
      {pending.length === 0
        ? <p className="muted" style={{ marginTop: 16 }}>Nothing to review.</p>
        : <ul className="admin-list">
            {pending.map((r) => (
              <li key={r.id} className="admin-item">
                <div className="info">
                  <strong>{r.title}</strong><br />
                  <a href={r.url} target="_blank" rel="noreferrer">{r.url}</a>
                </div>
                <div className="admin-actions">
                  <button className="btn btn-approve" onClick={() => review(r.id, true)}>Approve</button>
                  <button className="btn btn-reject"  onClick={() => review(r.id, false)}>Reject</button>
                </div>
              </li>
            ))}
          </ul>
      }
    </div>
  );
}
