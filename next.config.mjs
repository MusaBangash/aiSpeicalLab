/** @type {import('next').NextConfig} */
const nextConfig = {
  // The app is served over LAN from the R730 — no external image domains needed.
  // pdf-parse wraps pdfjs-dist, which webpack mis-bundles; keep it external
  // so the PDF question-upload route requires it normally at runtime.
  serverExternalPackages: ["pdf-parse"],
};
export default nextConfig;
