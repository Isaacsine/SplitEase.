import { Component, type ReactNode } from "react";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <section className="panel" role="alert">
          <h2>Couldn't open this page</h2>
          <p>Check your connection and try again.</p>
          <button className="button primary" onClick={() => location.reload()}>
            Reload page
          </button>
          <a className="button secondary" href="#help">
            Get help
          </a>
        </section>
      );
    return this.props.children;
  }
}
