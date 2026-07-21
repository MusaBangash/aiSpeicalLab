import { en, type Dictionary } from "./en";
import { ur } from "./ur";

const dictionaries: Record<string, Dictionary> = { en, ur };

export function getDictionary(language: string): Dictionary {
  return dictionaries[language] ?? en;
}

export type { Dictionary };
