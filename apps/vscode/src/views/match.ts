/**
 * Class-name matching for the sidebar trees.
 *
 * Kept free of `vscode` so the ranking rules are unit tested directly. The
 * rules exist because Modelica names are long, deeply qualified and share
 * prefixes: `Modelica.Electrical.Analog.Basic.Resistor` and
 * `Modelica.Electrical.Machines...` differ only late in the string, so a plain
 * substring filter returns hundreds of equally-ranked hits.
 */

export interface ClassMatch {
  readonly qualifiedName: string;
  readonly score: number;
}

/**
 * True when `query` matches somewhere in the name.
 *
 * Matching is case-insensitive and dot-segmented: `el.an.res` matches
 * `Modelica.Electrical.Analog.Basic.Resistor`, because each dotted piece of the
 * query must appear in order across the segments of the name. A query with no
 * dots is matched against the whole name, so `resis` still works.
 */
export function matchesQuery(qualifiedName: string, query: string): boolean {
  return scoreMatch(qualifiedName, query) > 0;
}

/**
 * Scores a name against a query; 0 means no match.
 *
 * Higher is better. An exact leaf name beats a leading match, which beats a
 * match anywhere, and short names beat long ones at equal quality — so
 * `Resistor` outranks `ResistorSensorArray` for the query `resistor`.
 */
export function scoreMatch(qualifiedName: string, query: string): number {
  const trimmed = query.trim();
  if (trimmed === "") {
    // No query is not a failed match: everything shows, in its natural order.
    return 1;
  }

  const name = qualifiedName.toLowerCase();
  const needle = trimmed.toLowerCase();
  const leaf = name.split(".").pop() ?? name;

  if (needle.includes(".")) {
    return scoreSegmented(name, needle);
  }

  let score = 0;
  if (leaf === needle) {
    score = 100;
  } else if (leaf.startsWith(needle)) {
    score = 80;
  } else if (leaf.includes(needle)) {
    score = 60;
  } else if (name.includes(needle)) {
    // The hit is in an ancestor package rather than the class itself, which is
    // still useful but is not what the user typed at.
    score = 30;
  } else {
    return 0;
  }

  // Prefer the shorter of two otherwise equal names, without ever letting
  // length flip the tier above it.
  return score + 19 / (1 + leaf.length);
}

/** Consumes dotted query pieces in order across the name's segments. */
function scoreSegmented(name: string, needle: string): number {
  const segments = name.split(".");
  const pieces = needle.split(".").filter((piece) => piece !== "");
  let at = 0;
  let exactSegments = 0;

  for (const piece of pieces) {
    let found = -1;
    for (let index = at; index < segments.length; index += 1) {
      if (segments[index]!.includes(piece)) {
        found = index;
        if (segments[index] === piece) {
          exactSegments += 1;
        }
        break;
      }
    }
    if (found === -1) {
      return 0;
    }
    at = found + 1;
  }

  // A trailing piece that lands on the final segment is what the user meant to
  // select, so it ranks above a match that stops in the middle of the path.
  const landedOnLeaf = at === segments.length;
  return 40 + (landedOnLeaf ? 30 : 0) + exactSegments * 5 + 19 / (1 + name.length);
}

/** Filters and orders names for display, best first, then alphabetically. */
export function rankMatches(
  names: readonly string[],
  query: string,
  limit = Number.POSITIVE_INFINITY,
): ClassMatch[] {
  const matches: ClassMatch[] = [];
  for (const qualifiedName of names) {
    const score = scoreMatch(qualifiedName, query);
    if (score > 0) {
      matches.push({ qualifiedName, score });
    }
  }
  matches.sort((a, b) => b.score - a.score || a.qualifiedName.localeCompare(b.qualifiedName));
  return Number.isFinite(limit) ? matches.slice(0, limit) : matches;
}
