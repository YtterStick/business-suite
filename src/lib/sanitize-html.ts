/**
 * Minimal allowlist HTML sanitizer for rich-text project descriptions.
 * Strips dangerous tags/attributes/URLs while preserving basic formatting,
 * lists, colors, alignment, links, and mention chips.
 */
const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "strike",
  "span",
  "div",
  "ul",
  "ol",
  "li",
  "a",
  "font",
]);

export function sanitizeRichHtml(rawHtml: string): string {
  if (!rawHtml) return "";

  // Remove script/style/iframe/object/embed blocks completely.
  let cleaned = rawHtml
    .replace(/<\s*(script|style|iframe|object|embed|svg|math)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed|svg|math)[^>]*\/?\s*>/gi, "");

  // Strip inline event handlers (on*=) and javascript:/data: URLs.
  cleaned = cleaned
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(?:"\s*(?:javascript|data|vbscript):[^"]*"|'\s*(?:javascript|data|vbscript):[^']*')/gi, '$1="#"');

  // Remove disallowed tags while preserving their inner text.
  cleaned = cleaned.replace(/<\/?([a-z0-9-]+)([^>]*)>/gi, (full, tagName: string, attrs: string) => {
    const tag = tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (full.startsWith("</")) return `</${tag}>`;

    if (tag === "a") {
      const hrefMatch = attrs.match(/href\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
      const href = hrefMatch?.[1] ?? hrefMatch?.[2] ?? "#";
      const safeHref = /^https?:\/\/|^mailto:|^\//i.test(href) ? href : "#";
      return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" class="text-primary underline">`;
    }

    if (tag === "span" || tag === "div" || tag === "p" || tag === "font") {
      const styleMatch = attrs.match(/style\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
      const classMatch = attrs.match(/class\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
      const colorMatch = attrs.match(/color\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
      const sizeMatch = attrs.match(/size\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
      const faceMatch = attrs.match(/face\s*=\s*(?:"([^"]*)"|'([^']*)')/i);

      const safeAttrs: string[] = [];
      if (styleMatch) {
        const rawStyle = styleMatch[1] ?? styleMatch[2] ?? "";
        const safeRules = rawStyle
          .split(";")
          .map((r) => r.trim())
          .filter((r) =>
            /^(color|background-color|text-align|font-family|font-size|font-weight|font-style|text-decoration)\s*:\s*[^()<>]+$/i.test(
              r,
            ),
          );
        if (safeRules.length > 0) {
          safeAttrs.push(`style="${safeRules.join("; ")}"`);
        }
      }
      if (classMatch) {
        const cls = (classMatch[1] ?? classMatch[2] ?? "").replace(/[^a-zA-Z0-9 _:/-]/g, "");
        if (cls) safeAttrs.push(`class="${cls}"`);
      }
      if (tag === "font") {
        if (colorMatch) safeAttrs.push(`color="${(colorMatch[1] ?? colorMatch[2] ?? "").replace(/[^#a-zA-Z0-9(),.\s]/g, "")}"`);
        if (sizeMatch) safeAttrs.push(`size="${(sizeMatch[1] ?? sizeMatch[2] ?? "").replace(/[^0-9]/g, "")}"`);
        if (faceMatch) safeAttrs.push(`face="${(faceMatch[1] ?? faceMatch[2] ?? "").replace(/[^a-zA-Z0-9 ,_-]/g, "")}"`);
      }

      return safeAttrs.length > 0 ? `<${tag} ${safeAttrs.join(" ")}>` : `<${tag}>`;
    }

    return `<${tag}>`;
  });

  return cleaned.trim();
}
