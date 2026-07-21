"use client";

/**
 * Free-text module input with native browser autocomplete (a <datalist>),
 * instead of a <select> — still constrained to real modules: the typed
 * name is resolved back to a moduleId on submit via resolveModuleId, and
 * a non-matching name is rejected rather than silently creating a new
 * module.
 */
export function ModuleField({
  modules,
  moduleName,
  onChange,
}: {
  modules: { id: string; title: string }[];
  moduleName: string;
  onChange: (name: string) => void;
}) {
  return (
    <div className="field">
      <label htmlFor="module">Module</label>
      <input
        id="module"
        list="module-options"
        value={moduleName}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Start typing a module name…"
        autoComplete="off"
        required
      />
      <datalist id="module-options">
        {modules.map((m) => (
          <option key={m.id} value={m.title} />
        ))}
      </datalist>
    </div>
  );
}

export function resolveModuleId(modules: { id: string; title: string }[], name: string): string | null {
  const match = modules.find((m) => m.title.toLowerCase() === name.trim().toLowerCase());
  return match ? match.id : null;
}
