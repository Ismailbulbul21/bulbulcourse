import { useQuery } from "@tanstack/react-query";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { SettingsService, isOn } from "../services/settings.service";
import Logo from "./Logo";

export default function Layout() {
  const { user, profile, isAdmin, signOut } = useAuthStore();
  const navigate = useNavigate();

  // Booking and Hire me only appear once switched on in Admin (admins
  // always see them, so they can preview before going live).
  const settingsQuery = useQuery({
    queryKey: ["app-settings", user?.id ?? "anon"],
    queryFn: () => SettingsService.all(),
    staleTime: 60_000,
  });
  const showBooking = isAdmin || isOn(settingsQuery.data, "booking_enabled");
  const showHire = isAdmin || isOn(settingsQuery.data, "services_enabled");

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
          {showBooking && <NavLink to="/book">Book a session</NavLink>}
          {showHire && <NavLink to="/hire">Hire me</NavLink>}
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
              <Link to="/signup" className="btn btn-primary">
                <span className="bi-en">Sign up</span> Is diiwaangeli
              </Link>
              <Link to="/login" className="btn btn-ghost">
                <span className="bi-en">Login</span> Gal
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
