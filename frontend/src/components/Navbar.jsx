import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  return (
    <nav>
      <Link to="/" className="brand">Opic</Link>
      <Link to="/">Courses</Link>
      <Link to="/suggest">Suggest</Link>
      {user?.is_admin && <Link to="/admin">Admin</Link>}
      <div className="nav-right">
        {user ? (
          <>
            <span style={{ fontSize: "0.9rem", color: "#555" }}>{user.username}</span>
            <button className="btn" style={{ background: "#f3f4f6" }} onClick={logout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register" className="btn btn-primary">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}
