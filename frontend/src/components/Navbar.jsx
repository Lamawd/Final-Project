import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <nav>
      <Link to="/" className="brand">Opic</Link>
      <Link to="/courses">Courses</Link>
      <Link to="/progress">Progress</Link>
      {user?.is_admin && <Link to="/admin">Admin</Link>}
      <div className="nav-right">
        {user ? (
          <>
            <span
              className="nav-username"
              onClick={() => navigate("/profile")}
              title="My Profile"
            >
              {user.username}
            </span>
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
