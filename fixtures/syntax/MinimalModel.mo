// Original fixture. Provenance: written for this repository, MIT licensed.
// Expected OMC range: >=1.27. Visual output: stable.
model MinimalModel "Smallest loadable class used by discovery and load tests"
  Real x(start = 1.0);
equation
  der(x) = -x;
  annotation (
    Documentation(info = "<html><p>Original minimal fixture.</p></html>"));
end MinimalModel;
