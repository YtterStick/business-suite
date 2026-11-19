const META_REGEX = /\[\[META:([\s\S]*?)\]\]\s*$/;

export interface PhaseMeta {
  flag?: "Internal" | "External";
  startDate?: string | null;
  ownerId?: string | null;
  ownerName?: string | null;
  dependsOnId?: string | null;
}

export interface IssueMeta {
  classification?: "Bug" | "Crash" | "UI/UX" | "Security" | "Performance" | "Feature";
  reproducible?: "Always" | "Sometimes" | "Rarely" | "Unable";
  affectedModule?: string | null;
}

export function extractZohoMeta<T extends object>(
  rawDescription: string | null | undefined,
): { cleanDescription: string; meta: T } {
  if (!rawDescription) {
    return { cleanDescription: "", meta: {} as T };
  }
  const match = rawDescription.match(META_REGEX);
  if (!match) {
    return { cleanDescription: rawDescription, meta: {} as T };
  }
  const cleanDescription = rawDescription.slice(0, match.index).trimEnd();
  try {
    const parsed = JSON.parse(match[1] ?? "{}") as T;
    return { cleanDescription, meta: parsed ?? ({} as T) };
  } catch {
    return { cleanDescription: rawDescription, meta: {} as T };
  }
}

export function attachZohoMeta<T extends object>(
  cleanDescription: string | null | undefined,
  meta: T,
): string | null {
  const text = (cleanDescription ?? "").replace(META_REGEX, "").trim();
  const entries = Object.entries(meta).filter(
    ([, value]) => value !== undefined && value !== null && value !== "",
  );
  if (entries.length === 0) {
    return text || null;
  }
  const serialized = `[[META:${JSON.stringify(Object.fromEntries(entries))}]]`;
  return text ? `${text}\n\n${serialized}` : serialized;
}
