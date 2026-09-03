export interface PageFamilyMatch {
  readonly matches: boolean;
  readonly actualCount: number;
}

/** Match one exact Bitwig page family without stripping general number suffixes. */
export function matchPageFamily(
  pages: readonly string[],
  pageName: string,
  expectedCount: number,
): PageFamilyMatch {
  const bareCount = pages.filter((page) => page === pageName).length;
  const ordinalPrefix = `${pageName} `;
  const familySuffixes = pages
    .filter((page) => page.startsWith(ordinalPrefix))
    .map((page) => page.slice(ordinalPrefix.length));
  const actualCount = bareCount + familySuffixes.length;

  if (expectedCount === 0) return { matches: actualCount === 0, actualCount };
  if (expectedCount === 1) {
    return { matches: bareCount === 1 && familySuffixes.length === 0, actualCount };
  }

  const expectedOrdinals = Array.from({ length: expectedCount }, (_, index) => String(index + 1));
  return {
    matches: bareCount === 0
      && familySuffixes.length === expectedCount
      && expectedOrdinals.every((ordinal) => familySuffixes.includes(ordinal)),
    actualCount,
  };
}
