import * as os from "node:os";

/**
 * Shortens filesystem paths in text that is shown in the UI.
 *
 * Compiler errors routinely embed the full path of the file they came from.
 * Echoed verbatim into the canvas status line that text puts the user's home
 * directory — and therefore their account name — on screen, into screenshots
 * and into bug reports. The information the reader needs is which file failed,
 * which the basename already carries.
 *
 * The home directory becomes `~`; any other absolute path is reduced to its
 * final segment. Relative paths and ordinary prose are left alone.
 */
export function redactPaths(text: string, home: string = os.homedir()): string {
  const absolute = new RegExp(
    // Root: a Windows drive, a UNC prefix, or a POSIX slash. The lookbehind
    // keeps `docs/04-visual-spec.md` from matching at its inner slash, which
    // would splice the path back together as `docs04-visual-spec.md`.
    String.raw`(?:[A-Za-z]:[\\/]|[\\/]{2}|(?<![\w.~])/)` +
      // Body: separators, plus segment characters. A space counts as a segment
      // character only when another separator follows before the next space,
      // which is what keeps `C:\Program Files\...` whole without swallowing
      // the sentence that follows the path.
      String.raw`(?:[^\s\\/"'<>|]|[\\/]|[ ](?=[^ ]*[\\/]))+`,
    "g",
  );
  const normalisedHome = home.replace(/[\\/]+$/, "");

  return text.replace(absolute, (match) => {
    const trimmed = match.replace(/[\\/]+$/, "");
    if (normalisedHome !== "" && startsWithPath(trimmed, normalisedHome)) {
      const rest = trimmed.slice(normalisedHome.length).replace(/^[\\/]+/, "");
      return rest === "" ? "~" : `~/${rest.replace(/\\/g, "/")}`;
    }
    const segments = trimmed.split(/[\\/]/).filter((part) => part !== "");
    return segments.length === 0 ? trimmed : segments[segments.length - 1]!;
  });
}

function startsWithPath(value: string, prefix: string): boolean {
  const normalise = (input: string): string => input.replace(/\\/g, "/").toLowerCase();
  const a = normalise(value);
  const b = normalise(prefix);
  return a === b || a.startsWith(`${b}/`);
}
