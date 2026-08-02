export interface SidebarSection {
  /** Stable view id contributed to VS Code. */
  readonly id: string;
  /** Uppercase-rendered section title. */
  readonly title: string;
  /** Single-sentence empty state, per docs/04-visual-spec.md section 2. */
  readonly emptyState: string;
}

/**
 * Primary sidebar order is fixed by the visual specification:
 * Libraries, Models, Results, Figures, Documents, Elements.
 */
export const SIDEBAR_SECTIONS: readonly SidebarSection[] = Object.freeze([
  {
    id: "modelicaStudio.libraries",
    title: "Libraries",
    emptyState: "No Modelica libraries are loaded yet.",
  },
  {
    id: "modelicaStudio.models",
    title: "Models",
    emptyState: "No Modelica models were found in this workspace.",
  },
  {
    id: "modelicaStudio.results",
    title: "Results",
    emptyState: "No simulation has produced results yet.",
  },
  {
    id: "modelicaStudio.figures",
    title: "Figures",
    emptyState: "No figures have been created yet.",
  },
  {
    id: "modelicaStudio.documents",
    title: "Documents",
    emptyState: "No documents are attached to this workspace.",
  },
  {
    id: "modelicaStudio.elements",
    title: "Elements",
    emptyState: "Open a Modelica class to inspect its elements.",
  },
] as const);
