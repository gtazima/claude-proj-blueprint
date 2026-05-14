// ─── Parsing / building de títulos ───────────────────────────────────────────
// Formato: "[type] · [culture] — [base]"
// Qualquer parte é opcional; separador primário " — ", entre tags " · "

export const TAG_SEP  = " · ";
export const BASE_SEP = " — ";

export interface ParsedTitle {
  type:    string | null;
  culture: string | null;
  base:    string;
}

export function parseTitle(
  title: string,
  typeNames?: string[],
  cultureNames?: string[],
): ParsedTitle {
  const [tagsPart, ...baseParts] = title.split(BASE_SEP);
  const base = baseParts.join(BASE_SEP);
  const segments = tagsPart.split(TAG_SEP).map((s) => s.trim());

  const effectiveTypes    = typeNames    ?? _FALLBACK_TYPES;
  const effectiveCultures = cultureNames ?? _FALLBACK_CULTURES;

  const type    = effectiveTypes.find((t) =>
    segments.some((s) => s.toLowerCase() === t.toLowerCase())) ?? null;
  const culture = effectiveCultures.find((c) =>
    segments.some((s) => s.toLowerCase() === c.toLowerCase())) ?? null;

  if (!type && !culture) return { type: null, culture: null, base: title };
  return { type, culture, base };
}

export function buildTitle(base: string, type: string | null, culture: string | null): string {
  const tags = [type, culture].filter(Boolean).join(TAG_SEP);
  if (!tags)        return base;
  if (!base.trim()) return tags;
  return `${tags}${BASE_SEP}${base}`;
}

export function applyTypePrefix(base: string, type: string, typeNames?: string[], cultureNames?: string[]): string {
  const { culture } = parseTitle(base, typeNames, cultureNames);
  return buildTitle(parseTitle(base, typeNames, cultureNames).base || base, type, culture);
}

export function applyCulturePrefix(base: string, culture: string, typeNames?: string[], cultureNames?: string[]): string {
  const { type } = parseTitle(base, typeNames, cultureNames);
  return buildTitle(parseTitle(base, typeNames, cultureNames).base || base, type, culture);
}

export function removeTypePrefix(title: string, typeNames?: string[], cultureNames?: string[]): string {
  const { culture, base } = parseTitle(title, typeNames, cultureNames);
  return buildTitle(base, null, culture);
}

export function detectTaskType(title: string, typeNames?: string[]): string | null {
  return parseTitle(title, typeNames).type;
}

export function detectTaskCulture(title: string, cultureNames?: string[]): string | null {
  return parseTitle(title, undefined, cultureNames).culture;
}

// ─── Frequência de uso ────────────────────────────────────────────────────────
const FREQ_KEY = "tag_frequency";

export function getTagFrequency(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(FREQ_KEY) ?? "{}") as Record<string, number>; }
  catch { return {}; }
}

export function incrementTagFrequency(tag: string): void {
  const f = getTagFrequency();
  f[tag] = (f[tag] ?? 0) + 1;
  localStorage.setItem(FREQ_KEY, JSON.stringify(f));
}

export function sortedByFrequency(names: string[]): string[] {
  const f = getTagFrequency();
  return [...names].sort((a, b) => (f[b] ?? 0) - (f[a] ?? 0));
}

// ─── Fallbacks (mirrors backend seed — used only when API hasn't loaded yet) ──
const _FALLBACK_TYPES = [
  "Irrigação", "Adubação", "Plantio", "Colheita", "Poda", "Manejo",
  "Roçar", "Limpeza", "Manutenção", "Monitoramento", "Controle de pragas",
  "Venda", "Transporte",
];

const _FALLBACK_CULTURES = ["Shiitake", "Café SAF", "Abelhas", "Cúrcuma", "Canavial"];

// Legacy sorted helpers (used by components before hooks load) — kept for compatibility
export const sortedTypeTags    = () => sortedByFrequency(_FALLBACK_TYPES);
export const sortedCultureTags = () => sortedByFrequency(_FALLBACK_CULTURES);
export const sortedByFrequencyAll = () => [
  ...sortedByFrequency(_FALLBACK_TYPES),
  ...sortedByFrequency(_FALLBACK_CULTURES),
];

// Legacy type-check helpers — kept for KanbanView column detection
export const TYPE_TAGS    = _FALLBACK_TYPES as string[];
export const CULTURE_TAGS = _FALLBACK_CULTURES as string[];
