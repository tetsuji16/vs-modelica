import type { AnnotationSource } from "@modelica-studio/modelica";
import type { OmcSession } from "@modelica-studio/omc";

/**
 * Adapts a live {@link OmcSession} to the scene builder's `AnnotationSource`
 * port. Keeping the adapter here means `@modelica-studio/modelica` stays free of
 * any dependency on a running compiler and can be tested against recorded
 * replies.
 */
export function annotationSource(session: OmcSession): AnnotationSource {
  return {
    getIconAnnotation: (className) => session.getIconAnnotation(className),
    getDiagramAnnotation: (className) => session.getDiagramAnnotation(className),
    getComponentsRaw: (className) => session.getComponents(className),
    getElementAnnotationsRaw: (className) => session.getElementAnnotations(className),
    getConnectionCount: (className) => session.getConnectionCount(className),
    getNthConnectionRaw: (className, index) =>
      session.callRaw("getNthConnection", [
        { kind: "identifier", value: className },
        { kind: "number", value: index },
      ]),
    getNthConnectionAnnotationRaw: (className, index) =>
      session.callRaw("getNthConnectionAnnotation", [
        { kind: "identifier", value: className },
        { kind: "number", value: index },
      ]),
    getInheritedClassesRaw: (className) =>
      session.callRaw("getInheritedClasses", [{ kind: "identifier", value: className }]),
  };
}
