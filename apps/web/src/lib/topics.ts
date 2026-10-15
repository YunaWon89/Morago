// Small pictures for categories: there are no uploaded icons yet.
export function categoryEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("работ")) return "\u{1F4BC}";
  if (n.includes("медиц")) return "\u{1F3E5}";
  if (n.includes("авто")) return "\u{1F697}";
  if (n.includes("услуг")) return "\u{1F6CD}\u{FE0F}";
  if (n.includes("бизнес")) return "\u{1F3E2}";
  if (n.includes("государ")) return "\u{1F3DB}\u{FE0F}";
  if (n.includes("закон")) return "\u2696\u{FE0F}";
  if (n.includes("образ")) return "\u{1F393}";
  return "\u{1F4CC}";
}

export const EMERGENCY_EMOJI = "\u{1F6A8}";
