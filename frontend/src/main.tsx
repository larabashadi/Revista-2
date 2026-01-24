/*import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
*/
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";
import { API_BASE } from "./config";
...
pre.textContent =
  "FATAL ERROR:\n\n" +
  (err?.stack || err?.message || String(err)) +
  "\n\nAPI_BASE=" + API_BASE;


// Muestra errores en pantalla (por si la consola no los enseña)
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
  pre.textContent =
    "FATAL ERROR:\n\n" +
    (err?.stack || err?.message || String(err)) +
    "\n\nVITE_API_BASE=" +
    ((import.meta as any)?.env?.VITE_API_BASE || "(empty)");
  document.body.appendChild(pre);
}

window.addEventListener("error", (e: any) => showFatal(e?.error || e?.message));
window.addEventListener("unhandledrejection", (e: any) => showFatal(e?.reason));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
