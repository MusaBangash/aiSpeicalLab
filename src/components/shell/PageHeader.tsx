/** Formats today's date in the mockup's style, e.g. "Saturday, 18 July 2026". */
function formatToday() {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function PageHeader({ title }: { title: string }) {
  return (
    <div className="crumb">
      <h1>{title}</h1>
      <div className="date">{formatToday()}</div>
    </div>
  );
}
