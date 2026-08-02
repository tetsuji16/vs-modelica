import { describe, expect, it } from "vitest";
import { matchesQuery, rankMatches, scoreMatch } from "../src/views/match.js";

const MSL = [
  "Modelica.Electrical.Analog.Basic.Resistor",
  "Modelica.Electrical.Analog.Basic.Capacitor",
  "Modelica.Electrical.Analog.Ideal.IdealDiode",
  "Modelica.Electrical.Machines.BasicMachines.DCMachines.DC_PermanentMagnet",
  "Modelica.Mechanics.Rotational.Components.Inertia",
  "Modelica.Blocks.Continuous.LimPID",
  "Modelica.Thermal.HeatTransfer.Components.ThermalResistor",
];

describe("scoreMatch", () => {
  it("shows everything when there is no query", () => {
    expect(scoreMatch("Modelica.Blocks.Continuous.LimPID", "")).toBeGreaterThan(0);
    expect(scoreMatch("Modelica.Blocks.Continuous.LimPID", "   ")).toBeGreaterThan(0);
  });

  it("is case-insensitive", () => {
    expect(matchesQuery("Modelica.Blocks.Continuous.LimPID", "limpid")).toBe(true);
    expect(matchesQuery("Modelica.Blocks.Continuous.LimPID", "LIMPID")).toBe(true);
  });

  it("ranks an exact leaf above a prefix, and a prefix above a substring", () => {
    const exact = scoreMatch("A.Resistor", "resistor");
    const prefix = scoreMatch("A.ResistorArray", "resistor");
    const inside = scoreMatch("A.ThermalResistor", "resistor");
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(inside);
  });

  it("ranks a class hit above a hit that is only in an ancestor package", () => {
    // `Machines` appears in the path but the user is looking for a class.
    const inClass = scoreMatch("Modelica.Electrical.Machines", "machines");
    const inPath = scoreMatch("Modelica.Electrical.Machines.BasicMachines.Utilities", "electrical");
    expect(inClass).toBeGreaterThan(inPath);
  });

  it("prefers the shorter name at equal quality, without flipping tiers", () => {
    expect(scoreMatch("A.Resistor", "resis")).toBeGreaterThan(
      scoreMatch("A.ResistorLong", "resis"),
    );
    // Length must never let a substring match overtake a prefix match.
    expect(scoreMatch("A.ResistorVeryLongName", "resis")).toBeGreaterThan(
      scoreMatch("A.Th", "th") - 100,
    );
    expect(scoreMatch("A.ResistorVeryVeryLongName", "resis")).toBeGreaterThan(
      scoreMatch("A.XresisX", "resis"),
    );
  });

  it("returns 0 for a name that does not contain the query", () => {
    expect(scoreMatch("Modelica.Blocks.Continuous.LimPID", "resistor")).toBe(0);
    expect(matchesQuery("Modelica.Blocks.Continuous.LimPID", "resistor")).toBe(false);
  });
});

describe("dotted queries", () => {
  it("consumes pieces in order across path segments", () => {
    // The point of the feature: type the shape of the path, not the whole path.
    expect(matchesQuery("Modelica.Electrical.Analog.Basic.Resistor", "el.an.res")).toBe(true);
    expect(matchesQuery("Modelica.Electrical.Analog.Basic.Resistor", "mo.res")).toBe(true);
  });

  it("respects order, so a reversed query does not match", () => {
    expect(matchesQuery("Modelica.Electrical.Analog.Basic.Resistor", "res.an")).toBe(false);
  });

  it("does not let one segment satisfy two pieces", () => {
    // Each dotted piece must consume its own segment, so a query with more
    // pieces than the name has segments cannot match.
    expect(matchesQuery("Modelica", "mo.mo")).toBe(false);
    expect(matchesQuery("Modelica.Blocks", "mod.blo.cont")).toBe(false);
  });

  it("ranks a query landing on the leaf above one stopping mid-path", () => {
    const onLeaf = scoreMatch("Modelica.Electrical.Analog.Basic.Resistor", "analog.resistor");
    const midPath = scoreMatch("Modelica.Electrical.Analog.Basic.Resistor", "modelica.analog");
    expect(onLeaf).toBeGreaterThan(midPath);
  });
});

describe("rankMatches", () => {
  it("filters and orders, best first", () => {
    const results = rankMatches(MSL, "resistor").map((m) => m.qualifiedName);
    expect(results).toEqual([
      "Modelica.Electrical.Analog.Basic.Resistor",
      "Modelica.Thermal.HeatTransfer.Components.ThermalResistor",
    ]);
  });

  it("breaks ties alphabetically so the order is stable", () => {
    const results = rankMatches(["B.Thing", "A.Thing", "C.Thing"], "thing").map(
      (m) => m.qualifiedName,
    );
    expect(results).toEqual(["A.Thing", "B.Thing", "C.Thing"]);
  });

  it("honours the limit", () => {
    expect(rankMatches(MSL, "", 3)).toHaveLength(3);
    expect(rankMatches(MSL, "")).toHaveLength(MSL.length);
  });

  it("returns nothing when nothing matches", () => {
    expect(rankMatches(MSL, "zzzz")).toEqual([]);
  });

  it("finds a deeply nested class from an abbreviated path", () => {
    const results = rankMatches(MSL, "mach.dc").map((m) => m.qualifiedName);
    expect(results).toContain(
      "Modelica.Electrical.Machines.BasicMachines.DCMachines.DC_PermanentMagnet",
    );
  });
});
