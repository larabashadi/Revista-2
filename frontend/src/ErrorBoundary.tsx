import React from "react";
import { API_BASE } from "./config";

type State = { error?: any; info?: any };

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = {};

  componentDidCatch(error: any, info: any) {
    this.setState({ error, info });
  }

  render() {
    if (!this.state.error) return this.props.children;

    const err = this.state.error;
    const name = err?.name || "Error";
    const msg = err?.message || "(no message)";
    const stack = err?.stack || String(err);
    const comp = this.state.info?.componentStack || "(no component stack)";

    const netlog = (window as any).__netlog__ || [];
    const netText = netlog
      .slice(-25)
      .map((x: any) => `${new Date(x.t).toISOString()} ${x.kind} ${x.url || ""} ${x.status || ""} ${x.msg || ""}`)
      .join("\n");

    return (
      <div style={{ padding: 16, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
        <h2>FATAL ERROR: {name}</h2>
        <pre style={{ whiteSpace: "pre-wrap" }}>
          MESSAGE:
          {"\n"}
          {msg}
          {"\n\n"}
          STACK:
          {"\n"}
          {stack}
          {"\n\n"}
          COMPONENT STACK:
          {"\n"}
          {comp}
          {"\n\n"}
          API_BASE={API_BASE}
          {"\n\n"}
          LAST NETWORK (25):
          {"\n"}
          {netText || "(empty)"}
        </pre>
        <button onClick={() => location.reload()}>Reload</button>
      </div>
    );
  }
}
