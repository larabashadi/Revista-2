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

// Overlay de errores en pantalla (para debug)
function showFatal(err: any) {
 const name = err?.name || "Error";
const message = err?.message || "";
const cause = err?.cause ? ("\nCAUSE:\n" + (err.cause?.stack || err.cause?.message || String(err.cause))) : "";
const stack = err?.stack || String(err);

pre.textContent =
  `FATAL ERROR: ${name}\n\n` +
  (message ? `MESSAGE:\n${message}\n\n` : "") +
  `STACK:\n${stack}\n` +
  cause +
  `\n\nAPI_BASE=${API_BASE}`;

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
