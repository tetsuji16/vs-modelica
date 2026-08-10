# Samples

An end-to-end sample used to prove the whole path works: the compiler bridge,
the annotation decoder, the diagram renderer and the simulation path.

## `SpeedControlledDCMotorDrive.mo`

A speed-controlled permanent-magnet DC drive built from MSL 4.0.0 components. A
limited PI controller drives a first-order inverter lag on the armature voltage
of an `Electrical.Machines` DC machine; a load inertia sits on the shaft and a
torque step at 0.6 s disturbs it.

It was chosen over a simpler circuit deliberately. It spans four MSL packages
(`Blocks`, `Electrical.Analog`, `Electrical.Machines`, `Mechanics.Rotational`),
mixes causal signal connections with acausal electrical and rotational ones,
uses rotated placements and a non-default diagram extent — so it exercises the
parts of the annotation decoder that a resistor-and-source example never
reaches.

## Running it

```bash
pnpm sample
```

The runner resolves `omc` exactly the way the extension does (setting, then
`OPENMODELICAHOME`, then `PATH`, then the standard install locations), so a
regression in the resolver fails here too.

Without a supported OpenModelica installed it prints a skip and exits 0 —
contributors should not need OMC to run the rest of the suite. CI installs OMC
and sets `MODELICA_STUDIO_REQUIRE_OMC=1`, which turns that skip into a failure.

To point at a specific compiler:

```bash
MODELICA_STUDIO_OMC_PATH=/path/to/omc pnpm sample
```

Or drive the script directly:

```bash
cd samples && omc run-sample.mos
```

Simulation build output (generated C, makefile, executable, result file) goes to
`samples/build/`, which is git-ignored. The script `cd`s there after loading the
model, so the sample directory itself stays sources-only.

## What it asserts

`run-sample.mos` does not just check that the model compiles. It reads the
result file back and asserts the physics:

| Assertion   | Meaning                                                                         |
| ----------- | ------------------------------------------------------------------------------- |
| `tracking`  | shaft speed is within 2 rad/s of the 120 rad/s command before the disturbance   |
| `rejection` | the loop returns to the command after the 0.6 s load torque step                |
| `alive`     | the drive actually drew armature current, so this is not a trivially dead model |

The script prints the requested sample times alongside the values, so it cannot
silently assert against the wrong point on the trajectory. It also reads and
prints the point count to prove the result is non-empty. The assertions use
OMC's scalar `val` query rather than loading whole result arrays into scripting
variables: OMC echoes assignment values, so the latter would dump every sample
to the transcript and make log size grow with the result file.

`omc` exits 0 even when a script statement fails, so the runner treats the
transcript as the signal and requires `SAMPLE OK`.

## Reference output

```text
--- checkModel ---
Check of SpeedControlledDCMotorDrive completed successfully.
Class SpeedControlledDCMotorDrive has 249 equation(s) and 249 variable(s).

--- simulate ---
LOG_SUCCESS       | info    | The initialization finished successfully without homotopy method.
LOG_SUCCESS       | info    | The simulation finished successfully.

--- results ---
points   = 508
t[track] = 0.55 s, w = 120.287 rad/s
t[end]   = 1.5 s, w = 120 rad/s
tracking  OK
rejection OK
alive     OK
SAMPLE OK
```
