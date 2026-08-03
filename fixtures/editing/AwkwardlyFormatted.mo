within Fixtures.Editing;

// A deliberately awkwardly formatted model. Every oddity here is a trap for a
// patch engine that reformats instead of editing:
//
//   - inconsistent indentation (2, 4 and tab)
//   - a line comment between components
//   - a block comment inside the equation section
//   - a component with no annotation at all
//   - a component whose annotation has no Placement
//   - an annotation carrying a vendor-specific entry we must never drop
//   - a component declared with a modification spanning several lines
//   - a nested equation section with a plain variable
//   - a top-level annotation containing embedded HTML
model AwkwardlyFormatted "A model that is hard to edit without damaging it"

  parameter Real gain = 2.5 "Controller gain";

  // This comment must survive an edit to the component below it.
  Modelica.Blocks.Sources.Step step(
    height = 120,
    startTime = 0.1)
    annotation (Placement(transformation(extent = {{-100, 30}, {-80, 50}})));

	Modelica.Blocks.Continuous.FirstOrder lag(
      k = 1,
      T = 0.005)
    annotation (Placement(transformation(extent={{-10,30},{10,50}}),
      __OpenModelica_vendorSpecific = "must not be dropped"));

  Modelica.Blocks.Math.Gain noAnnotation(k = gain);

  Modelica.Blocks.Math.Add sum annotation (
    Documentation(info = "<html>no placement here</html>"));

  Real x;

equation
  /* This block comment sits between equations and must not move. */
  x = step.y - lag.y;

  connect(step.y, lag.u)
    annotation (Line(points = {{-79, 40}, {-12, 40}}, color = {0, 0, 127}));

  connect(lag.y, sum.u1) annotation (Line(points = {{11, 40}, {20, 40}}));

  annotation (
    uses(Modelica(version = "4.0.0")),
    Diagram(coordinateSystem(preserveAspectRatio = false)),
    Documentation(info = "<html>
<p>Top-level annotation with embedded markup that must be preserved.</p>
</html>"));
end AwkwardlyFormatted;
