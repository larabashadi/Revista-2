/*export const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, "") ||
  "https://revista-2-1.onrender.com";

export function apiUrl(path: string) {
  if (!path) return API_BASE;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}
*/
export const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, "") ||
  "";

// If VITE_API_BASE is not set at build time, fall back to same-origin.
// In production on Render, you SHOULD set VITE_API_BASE=https://<your-backend>.onrender.com
export const apiUrl = (path: string) => {
  const base = API_BASE || "";
  if (!path) return base || "/";
  if (/^https?:\/\//i.test(path)) return path;
  if (!base) return path;
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
};
