# Fixtures

Store small, redistributable Modelica fixtures and their expected canonical scene graphs here.
Do not copy proprietary example models. Prefer original test models and Modelica Standard
Library examples whose license and attribution are recorded.

Every fixture file header must record:

1. provenance and license;
2. expected OMC/MSL version range;
3. whether visual output is stable.

## Current suites

| Path                      | Purpose                                                               | Phase |
| ------------------------- | --------------------------------------------------------------------- | ----- |
| `syntax/MinimalModel.mo`  | smallest loadable class for discovery/load tests                      | 0-1   |
| `graphics/EmptyCanvas.mo` | coordinate system with no primitives; backs the empty-canvas baseline | 0     |
| `syntax/BrokenModel.mo`   | unresolvable component type; backs the live diagnostics test          | 1     |

Planned suites (`connections/`, `editing/`, `simulation/`, `ai/`, `performance/`) are added by
the phase that first needs them, per `docs/07-test-strategy.md` section 2.
