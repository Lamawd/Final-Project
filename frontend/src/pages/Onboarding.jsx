import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

export default function Onboarding() {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/recommend/onboarding/questions").then((r) => setQuestions(r.data));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    const payload = Object.entries(answers).map(([question_id, answer]) => ({
      question_id: parseInt(question_id), answer
    }));
    await api.post("/recommend/onboarding/submit", { answers: payload });
    navigate("/topics");
  };

  if (questions.length === 0) return <p className="loading">Loading quiz…</p>;

  return (
    <div className="page" style={{ maxWidth: 560 }}>
      <h2>Quick Setup</h2>
      <p className="muted">Answer a few questions so we can personalise your learning path.</p>
      <form onSubmit={submit} className="onboarding-form">
        {questions.map((q) => (
          <div key={q.id} className="quiz-question">
            <label>{q.question}</label>
            <input
              placeholder="Your answer"
              value={answers[q.id] || ""}
              onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
              required
            />
          </div>
        ))}
        <button type="submit" className="btn btn-primary">Start Learning →</button>
      </form>
    </div>
  );
}
