import { NavLink } from "react-router-dom";

/** Switches between the three admin areas. */
export default function AdminNav() {
  return (
    <nav className="admin-nav" aria-label="Admin sections">
      <NavLink to="/admin" end>
        🎬 Courses
      </NavLink>
      <NavLink to="/admin/bookings">📅 Bookings</NavLink>
      <NavLink to="/admin/services">💼 Hire me</NavLink>
    </nav>
  );
}
