"use client";

export function Toggle({
  on,
  onToggle,
  label,
  disabled,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      className={"toggle" + (on ? " on" : "")}
      onClick={onToggle}
      disabled={disabled}
      aria-label={label}
      aria-checked={on}
    />
  );
}
