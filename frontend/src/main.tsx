import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";
import { API_BASE } from "./config";

function showFatal(err: any) {
  const pre = document.createElement("pre");
  pre.style.position = "fixed";
  pre.style.inset = "0";
  pre.style.zIndex = "999999";
  pre.style.margin = "0";
  pre.style.padding = "16px";
  pre.style.overflow = "auto";
  pre.style.background = "rgba(0,0,0,.92)";
  pre.style.color = "#fff";
  pre.style.fontSize = "12px";
  pre.style.whiteSpace = "pre-wrap";

  const name = err?.name || "Error";
  const message = err?.message || "";
  const stack = err?.stack || String(err);
  const cause =
    err?.cause
      ? "\nCAUSE:\n" + (err.cause?.stack || err.cause?.message || String(err.cause))
      : "";

  pre.textContent =
    `FATAL ERROR: ${name}\n\n` +
    (message ? `MESSAGE:\n${message}\n\n` : "") +
    `STACK:\n${stack}\n` +
    cause +
    `\n\nAPI_BASE=${API_BASE}`;

  document.body.appendChild(pre);
}

window.addEventListener("error", (e: any) => showFatal(e?.error || e?.message));
window.addEventListener("unhandledrejection", (e: any) => showFatal(e?.reason));

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
