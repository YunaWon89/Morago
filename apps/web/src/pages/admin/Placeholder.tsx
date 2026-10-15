import { useAuth } from "../../auth/AuthContext";

export function AdminPlaceholder() {
  const { user, logout } = useAuth();
  return (
    <div className="screen no-tabs">
      <header className="header">
        <div className="header-row">
          <span style={{ width: 36 }} />
          <span className="logo">morago</span>
          <span style={{ width: 36 }} />
        </div>
      </header>
      <div className="body">
        <h1 className="page-title">Admin: {user?.fullName}</h1>
        <p className="subtle" style={{ margin: "10px 0 18px" }}>
          The administrator panel is being prepared as a separate screen set. Until then, use the API to approve
          translators, confirm top-ups and process withdrawals.
        </p>
        <button className="btn secondary" onClick={logout}>
          Log out
        </button>
      </div>
    </div>
  );
}
