import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="container-page py-20 sm:py-32 text-center">
      <h1 className="font-display font-extrabold text-5xl text-brand-500">404</h1>
      <p className="text-ink-soft mt-3">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn-primary mt-6 inline-flex">Back to Home</Link>
    </div>
  );
}
