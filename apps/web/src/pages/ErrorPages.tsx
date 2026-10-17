import { Link, useNavigate } from "react-router-dom";

function ErrorPage({ code, title, text }: { code: string; title: string; text: string }) {
  const navigate = useNavigate();
  return (
    <div className="error-page" role="alert">
      <div className="error-code">{code}</div>
      <h1>{title}</h1>
      <p>{text}</p>
      <div className="error-actions">
        <button className="btn" onClick={() => navigate(-1)}>
          Go back
        </button>
        <Link className="btn outline" to="/">
          Home
        </Link>
      </div>
    </div>
  );
}

export function NotFound() {
  return <ErrorPage code="404" title="Page not found" text="This page does not exist or was moved." />;
}

export function Forbidden() {
  return <ErrorPage code="403" title="Access denied" text="You do not have permission to open this page." />;
}
