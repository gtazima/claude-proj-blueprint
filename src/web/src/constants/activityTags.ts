// ─── Tipo de atividade (coluna principal no modo "Por tipo") ─────────────────
export const TYPE_TAGS = [
  "Irrigação",
  "Adubação",
  "Plantio",
  "Colheita",
  "Poda",
  "Manejo",
  "Roçar",
  "Limpeza",
  "Manutenção",
  "Monitoramento",
  "Controle de pragas",
  "Venda",
  "Transporte",
] as const;

// ─── Cultura / área (coluna principal no modo "Por cultura") ──────────────────
export const CULTURE_TAGS = [
  "Shiitake",
  "Café SAF",
  "Abelhas",
  "Cúrcuma",
  "Canavial",
] as const;

export type TypeTag    = (typeof TYPE_TAGS)[number];
export type CultureTag = (typeof CULTURE_TAGS)[number];
export const ALL_TAGS  = [...TYPE_TAGS, ...CULTURE_TAGS] as const;
export type AnyTag     = (typeof ALL_TAGS)[number];

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

function sortedBy<T extends string>(list: readonly T[]): T[] {
  const f = getTagFrequency();
  return [...list].sort((a, b) => (f[b] ?? 0) - (f[a] ?? 0));
}

export const sortedTypeTags    = () => sortedBy(TYPE_TAGS);
export const sortedCultureTags = () => sortedBy(CULTURE_TAGS);
export const sortedByFrequency = () => [...sortedBy(TYPE_TAGS), ...sortedBy(CULTURE_TAGS)];

// ─── Parsing / building de títulos ───────────────────────────────────────────
// Formato: "[type] · [culture] — [base]"
// Qualquer parte é opcional; separador primário " — ", entre tags " · "

const TAG_SEP  = " · ";
const BASE_SEP = " — ";

export interface ParsedTitle {
  type:    TypeTag    | null;
  culture: CultureTag | null;
  base:    string;
}

export function parseTitle(title: string): ParsedTitle {
  const [tagsPart, ...baseParts] = title.split(BASE_SEP);
  const base = baseParts.join(BASE_SEP);        // reúne se base continha " — "
  const segments = tagsPart.split(TAG_SEP).map((s) => s.trim());

  const type    = TYPE_TAGS.find((t) =>
    segments.some((s) => s.toLowerCase() === t.toLowerCase())) ?? null;
  const culture = CULTURE_TAGS.find((c) =>
    segments.some((s) => s.toLowerCase() === c.toLowerCase())) ?? null;

  // Se nenhuma tag reconhecida → o "tagsPart" inteiro é o base
  if (!type && !culture) return { type: null, culture: null, base: title };
  return { type, culture, base };
}

export function buildTitle(base: string, type: string | null, culture: string | null): string {
  const tags = [type, culture].filter(Boolean).join(TAG_SEP);
  if (!tags)        return base;
  if (!base.trim()) return tags;
  return `${tags}${BASE_SEP}${base}`;
}

/** Remove o prefixo de tipo (mantém cultura, se houver). */
export function applyTypePrefix(base: string, type: string): string {
  const { culture } = parseTitle(base);
  return buildTitle(parseTitle(base).base || base, type, culture);
}

/** Remove o prefixo de cultura (mantém tipo, se houver). */
export function applyCulturePrefix(base: string, culture: string): string {
  const { type } = parseTitle(base);
  return buildTitle(parseTitle(base).base || base, type, culture);
}

export function removeTypePrefix(title: string): string {
  const { culture, base } = parseTitle(title);
  return buildTitle(base, null, culture);
}

export function detectTaskType(title: string): TypeTag | null {
  return parseTitle(title).type;
}

export function detectTaskCulture(title: string): CultureTag | null {
  return parseTitle(title).culture;
}
