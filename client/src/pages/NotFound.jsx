import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container page center">
      <h1>404 — page not found</h1>
      <p className="muted">That page does not exist in the SRMS customer flow.</p>
      <Link className="btn primary" to="/">Back to home</Link>
    </div>
  );
}
