import { Component, type ReactNode } from "react";

// Last safety net: if a page crashes while drawing, show a 500 page instead of a white screen.
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="error-page" role="alert">
        <div className="error-code">500</div>
        <h1>Something went wrong</h1>
        <p>The page could not be shown. Please reload it.</p>
        <div className="error-actions">
          <button className="btn" onClick={() => window.location.reload()}>
            Reload
          </button>
          <button className="btn outline" onClick={() => window.location.assign("/")}>
            Home
          </button>
        </div>
      </div>
    );
  }
}
