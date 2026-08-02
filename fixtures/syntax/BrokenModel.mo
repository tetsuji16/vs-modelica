// Original fixture. Provenance: written for this repository, MIT licensed.
// Deliberately references a missing class so getErrorString() produces a
// located diagnostic. Expected OMC range: >=1.27. Visual output: n/a.
model BrokenModel "Model with an unresolvable component type"
  ThisClassDoesNotExist broken;
equation
  broken.x = 0;
end BrokenModel;
