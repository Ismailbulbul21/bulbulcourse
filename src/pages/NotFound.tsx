import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="page empty-state">
      <h1>404</h1>
      <p>This page doesn't exist.</p>
      <Link to="/" className="btn btn-primary">
        Back to courses
      </Link>
    </div>
  );
}
