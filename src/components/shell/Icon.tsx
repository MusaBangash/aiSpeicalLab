/**
 * Static SVG icon set, ported 1:1 from the `ic()` path-map in
 * docs/design/ananas_dashboard.html and docs/design/exam_ui.html.
 * Pure server component — no client JS needed for a static path.
 */
const PATHS = {
  home: '<path d="M4 11l8-7 8 7v8.5a1.5 1.5 0 01-1.5 1.5H14v-6h-4v6H5.5A1.5 1.5 0 014 19.5z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>',
  book: '<path d="M4.5 5.5c2.3-.9 4.6-.9 7.5 0v13c-2.9-.9-5.2-.9-7.5 0z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M19.5 5.5c-2.3-.9-4.6-.9-7.5 0v13c2.9-.9 5.2-.9 7.5 0z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>',
  pencil: '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M14.5 6.5l3 3" stroke="currentColor" stroke-width="1.9"/>',
  award: '<circle cx="12" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M8.5 13.5L7 21l5-2.5L17 21l-1.5-7.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  chart: '<path d="M4.5 19.5V11M11.5 19.5V4.5M18.5 19.5v-6" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/>',
  gear: '<circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 2.8v3M12 18.2v3M21.2 12h-3M5.8 12h-3M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1M18.5 18.5l-2.1-2.1M7.6 7.6L5.5 5.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  flame: '<path d="M12 2.5c1.1 3-2.4 4.1-2.4 7.7a2.4 2.4 0 004.8 0c0-1.5-.7-2.2-.7-2.2s1.6.8 1.6 3.2a3.9 3.9 0 11-7.8 0c0-4.8 4.5-5.5 4.5-8.7z" fill="currentColor"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 01-8 0z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M8 5.5H5v1a3 3 0 003 3M16 5.5h3v1a3 3 0 01-3 3M12 13v3.5M8.5 20h7M10 16.5h4v3.5h-4z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>',
  play: '<path d="M8 5.5l10 6.5-10 6.5z" fill="currentColor"/>',
  check: '<path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
  star: '<path d="M12 3.5l2.5 5.2 5.7.7-4.2 4 1.1 5.6-5.1-2.8-5.1 2.8 1.1-5.6-4.2-4 5.7-.7z" fill="currentColor"/>',
  lock: '<rect x="6" y="10.5" width="12" height="8.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M8.5 10.5v-3a3.5 3.5 0 017 0v3" fill="none" stroke="currentColor" stroke-width="1.9"/>',
  upload: '<path d="M12 16V5M7.5 9L12 4.5 16.5 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 19h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  shield: '<path d="M12 3l7 2.5v5.5c0 4.5-3 7.5-7 9.5-4-2-7-5-7-9.5V5.5z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M9 11.5l2 2 4-4.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
  clock: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="4.5" cy="6" r="1.3" fill="currentColor"/><circle cx="4.5" cy="12" r="1.3" fill="currentColor"/><circle cx="4.5" cy="18" r="1.3" fill="currentColor"/>',
  swap: '<path d="M7 8h11M15 4.5L18.5 8 15 11.5M17 16H6M9 12.5L5.5 16 9 19.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  target: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  logout: '<path d="M9 21H5.5A1.5 1.5 0 014 19.5v-15A1.5 1.5 0 015.5 3H9M16 17l5-5-5-5M21 12H9" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  close: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  people: '<circle cx="9" cy="8.5" r="3" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M3.5 19c.6-3 2.7-4.7 5.5-4.7s4.9 1.7 5.5 4.7" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="16.5" cy="9" r="2.4" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M14.8 14.7c1.7-.5 3.4-.3 4.7 1a5.8 5.8 0 011.5 3.3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  megaphone: '<path d="M3.5 10.5v3a1.5 1.5 0 001.5 1.5h1l1.2 4.2a1.3 1.3 0 001.25.9h.3a1.3 1.3 0 001.25-1.66L9 15h.5l9-3.5v-3l-9-3.5H6a2.5 2.5 0 00-2.5 2.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M18.5 8.5v6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  question: '<path d="M4 5.5A2 2 0 016 3.5h12a2 2 0 012 2v9a2 2 0 01-2 2H9l-4 3.5v-3.5H6a2 2 0 01-2-2z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M9.6 9.3c0-1.4 1.1-2.3 2.5-2.3 1.3 0 2.3.8 2.3 2 0 1.6-2.4 1.7-2.4 3.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="12" cy="15.3" r="0.95" fill="currentColor"/>',
  medal: '<path d="M8.5 3.5L6 9.8l3.4 1" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.5 3.5L18 9.8l-3.4 1" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="15" r="5.3" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 12.2v2.8l2 1.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  bell: '<path d="M6 10.5a6 6 0 0112 0v3.8l1.7 2.7H4.3L6 14.3z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M9.5 19a2.5 2.5 0 005 0" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      dangerouslySetInnerHTML={{ __html: PATHS[name] }}
    />
  );
}
