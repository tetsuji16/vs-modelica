import type { EnvironmentStatus } from "@modelica-studio/omc";

/** What the status item needs to know, independent of VS Code. */
export interface HealthState {
  readonly environment: EnvironmentStatus;
  readonly errors: number;
  readonly warnings: number;
}

export interface HealthText {
  readonly text: string;
  readonly tooltip: string;
  /** True when the item should use the warning background colour. */
  readonly alert: boolean;
}

export const PRODUCT_SHORT = "Modelica Studio";

function count(value: number, noun: string): string {
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
}

/**
 * Renders the status bar health item.
 *
 * Pure, and in a module that does not import `vscode`, so the wording and the
 * alert rule are unit tested in node rather than behind a host mock. Two rules
 * matter here:
 *
 * - the compiler's own state outranks model diagnostics, because "0 errors"
 *   while OMC is missing would be a lie: nothing has been checked;
 * - warnings alone are not an alert, so the item does not cry wolf.
 */
export function renderHealth(state: HealthState): HealthText {
  if (state.environment !== "ready") {
    const reason = state.environment === "missing" ? "compiler not found" : "compiler unsupported";
    return {
      text: `$(error) ${PRODUCT_SHORT}: ${reason}`,
      tooltip: `${PRODUCT_SHORT}: no model has been checked. Run "Show Environment Status" for details.`,
      alert: true,
    };
  }
  if (state.errors === 0 && state.warnings === 0) {
    return {
      text: `$(check) ${PRODUCT_SHORT}: OK`,
      tooltip: `${PRODUCT_SHORT}: no errors or warnings.`,
      alert: false,
    };
  }
  return {
    text: `$(error) ${state.errors} $(warning) ${state.warnings}`,
    tooltip: `${PRODUCT_SHORT}: ${count(state.errors, "error")}, ${count(state.warnings, "warning")}.`,
    alert: state.errors > 0,
  };
}
