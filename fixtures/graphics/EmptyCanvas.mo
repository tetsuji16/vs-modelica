// Original fixture. Provenance: written for this repository, MIT licensed.
// Backs the phase-0 deterministic empty-canvas baseline.
// Expected OMC range: >=1.27. Visual output: stable.
model EmptyCanvas "Class with a coordinate system and no graphical primitives"
  annotation (
    Diagram(coordinateSystem(extent = {{-100, -100}, {100, 100}}, grid = {2, 2})),
    Icon(coordinateSystem(extent = {{-100, -100}, {100, 100}})));
end EmptyCanvas;
