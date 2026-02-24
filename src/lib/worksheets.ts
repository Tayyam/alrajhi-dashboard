export const DEFAULT_WORKSHEET_NAME = "Pilgrimage Affairs";
export const DEFAULT_WORKSHEET_SLUG = "Pilgrimage Affairs";

export function decodeWorksheetSlug(raw?: string) {
  return decodeURIComponent(raw ?? DEFAULT_WORKSHEET_SLUG);
}

export function makeWorksheetSlug(name: string) {
  const value = name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .slice(0, 80);

  if (!value) return DEFAULT_WORKSHEET_SLUG;
  return value;
}
