import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import Logo from "./Logo";

export default function Layout() {
  const { user, profile, isAdmin, signOut } = useAuthStore();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  return (
    <div className="app">
      <header className="navbar">
        <Link to="/" className="brand">
          <Logo size={30} />
          <span className="brand-text">BulbulCourses</span>
        </Link>
        <nav className="nav-links">
          <NavLink to="/" end>
            Courses
          </NavLink>
          {user && <NavLink to="/dashboard">My Learning</NavLink>}
          {isAdmin && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <div className="nav-auth">
          {user ? (
            <>
              <Link to="/profile" className="nav-profile" title="Profile">
                {profile?.full_name || user.email}
              </Link>
              <button type="button" className="btn btn-ghost" onClick={handleSignOut}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost">
                Log in
              </Link>
              <Link to="/signup" className="btn btn-primary">
                Sign up
              </Link>
            </>
          )}
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">
        © {new Date().getFullYear()} BulbulCourses — learn anything, anywhere.
      </footer>
    </div>
  );
}
