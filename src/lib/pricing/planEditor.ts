/** Hydrate display fields from defaults without borrowing another plan's figures. */
export function hydratePlanModel<T extends Record<string, any>>(defaults: T, own?: Record<string, any> | null): T {
  if (!own) return JSON.parse(JSON.stringify(defaults));
  const result: Record<string, any> = { ...defaults, ...own };
  for (const field of Object.keys(defaults)) {
    if (!Array.isArray(defaults[field]) || !Array.isArray(own[field])) continue;
    result[field] = own[field].map((row: Record<string, any>, index: number) => {
      const reference = defaults[field].find((item: Record<string, any>) =>
        row.key != null ? item.key === row.key : row.limit != null ? item.limit === row.limit : row.rate != null ? item.rate === row.rate : item.min === row.min
      ) ?? {};
      return { ...reference, key: row.key ?? reference.key ?? `${field}-${index}`, label: row.label ?? reference.label ?? row.key ?? '', ...row };
    });
  }
  return JSON.parse(JSON.stringify(result));
}

/** Explicit plan percentages must never be replaced by a browser-wide draft. */
export function planWebsiteDifference(explicit: number | undefined, existing: number | undefined, fallback: number): number {
  return explicit ?? existing ?? fallback;
}