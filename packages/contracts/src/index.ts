export * from "./scene.js";

export const CONTRACT_VERSION = 1 as const;

export type DocumentRevision = number;
export type StableId = string;

export interface SourceRange {
  readonly start: number;
  readonly end: number;
}

export interface Diagnostic {
  readonly severity: "error" | "warning" | "information";
  readonly message: string;
  readonly file: string;
  readonly range?: SourceRange;
  readonly source: "parser" | "omc" | "simulation" | "ai";
}

export interface ProposedEdit {
  readonly id: StableId;
  readonly baseRevision: DocumentRevision;
  readonly title: string;
  readonly preview: string;
  readonly operations: readonly DomainOperation[];
}

export type DomainOperation =
  | {
      readonly kind: "addComponent";
      readonly className: string;
      readonly instanceName: string;
      readonly placement?: Placement;
    }
  | {
      readonly kind: "updateComponent";
      readonly instanceName: string;
      readonly modification: string;
    }
  | { readonly kind: "removeComponent"; readonly instanceName: string }
  | {
      // Expressed as a delta rather than an absolute position on purpose: the
      // patch engine rewrites the existing extent in place, so a drag never has
      // to reconstruct — and therefore never reformats — the whole Placement.
      readonly kind: "moveComponent";
      readonly instanceName: string;
      readonly dx: number;
      readonly dy: number;
    }
  | {
      readonly kind: "connect";
      readonly from: string;
      readonly to: string;
      readonly points?: readonly Point[];
    }
  | { readonly kind: "disconnect"; readonly from: string; readonly to: string }
  | { readonly kind: "setAnnotation"; readonly target: string; readonly annotation: string };

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Placement {
  readonly origin: Point;
  readonly extent: readonly [Point, Point];
  readonly rotation: number;
  readonly visible: boolean;
}

export type HostToWebviewMessage =
  | {
      readonly version: typeof CONTRACT_VERSION;
      readonly type: "document/snapshot";
      readonly revision: DocumentRevision;
      readonly payload: unknown;
    }
  | {
      readonly version: typeof CONTRACT_VERSION;
      readonly type: "document/diagnostics";
      readonly payload: readonly Diagnostic[];
    }
  | {
      readonly version: typeof CONTRACT_VERSION;
      readonly type: "proposal/show";
      readonly payload: ProposedEdit;
    };

export type WebviewToHostMessage =
  | {
      readonly version: typeof CONTRACT_VERSION;
      readonly type: "document/apply";
      readonly revision: DocumentRevision;
      readonly payload: readonly DomainOperation[];
    }
  | {
      readonly version: typeof CONTRACT_VERSION;
      readonly type: "proposal/accept";
      readonly proposalId: StableId;
    }
  | {
      readonly version: typeof CONTRACT_VERSION;
      readonly type: "proposal/reject";
      readonly proposalId: StableId;
    };
