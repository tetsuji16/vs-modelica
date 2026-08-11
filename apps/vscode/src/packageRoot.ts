import * as path from "node:path";
import { parseWithinClause } from "@modelica-studio/modelica";

/**
 * Finds the package root OMC must load for a file that declares `within`.
 *
 * OMC rejects loading a nested file directly because it treats that file's
 * directory as a package root. Loading the outer package instead preserves the
 * standard directory/package.mo layout and exposes the target class normally.
 */
export function modelicaRootFile(filePath: string, source: string): string {
  const within = parseWithinClause(source);
  if (within === undefined) {
    return filePath;
  }
  const segments = within.split(".").length;
  const isPackageFile = path.basename(filePath).toLowerCase() === "package.mo";
  const ascents = isPackageFile ? segments : Math.max(0, segments - 1);
  let directory = path.dirname(filePath);
  for (let index = 0; index < ascents; index += 1) {
    directory = path.dirname(directory);
  }
  return path.join(directory, "package.mo");
}

/** Adds the optional `within` path to a class name without interpreting its body. */
export function qualifyClassName(name: string, source: string): string {
  const within = parseWithinClause(source);
  return within === undefined ? name : `${within}.${name}`;
}
