import { describe, expect, it, vi } from "vitest";
import type { OmcService } from "../src/omcService.js";
import type { SimulationResult } from "@modelica-studio/omc";

vi.mock("vscode", () => {
  const withProgress = async (
    _options: unknown,
    task: (p: unknown, token: unknown) => Promise<unknown>,
  ): Promise<unknown> => task({}, { isCancellationRequested: false });
  class EventEmitter<T> {
    private readonly listeners: ((value: T) => void)[] = [];
    event = (listener: (value: T) => void): void => {
      this.listeners.push(listener);
    };
    fire(value: T): void {
      for (const listener of this.listeners) listener(value);
    }
    dispose(): void {
      this.listeners.length = 0;
    }
  }
  class ThemeIcon {
    constructor(readonly id: string) {}
  }
  class TreeItem {
    description?: string;
    iconPath?: unknown;
    tooltip?: string;
    command?: unknown;
    constructor(
      readonly label: string,
      readonly collapsibleState: number,
    ) {}
  }
  return {
    EventEmitter,
    ThemeIcon,
    TreeItem,
    ProgressLocation: { Notification: 15, Window: 1 },
    TreeItemCollapsibleState: { None: 0 },
    window: { withProgress },
    CancellationTokenSource: class {},
  };
});

import { SimulationRunner, ResultsTreeProvider } from "../src/simulation.js";

function fakeOmc(result: SimulationResult): OmcService {
  return {
    withCancellableSession: vi.fn(async () => result),
  } as unknown as OmcService;
}

describe("SimulationRunner", () => {
  it("records a successful simulation with a result file", async () => {
    const omc = fakeOmc({
      resultFile: "Model_res.mat",
      errorMessage: "",
      simulationOptions: "startTime=0",
      messages: "simulation finished",
    });
    const runner = new SimulationRunner(omc);
    const entry = await runner.run("Model");
    expect(entry.ok).toBe(true);
    expect(entry.resultFile).toBe("Model_res.mat");
    expect(runner.list()).toHaveLength(1);
    expect(runner.list()[0]!.className).toBe("Model");
  });

  it("records a failed simulation without a result file", async () => {
    const omc = fakeOmc({
      resultFile: "",
      errorMessage: "build error",
      simulationOptions: "",
      messages: "",
    });
    const runner = new SimulationRunner(omc);
    const entry = await runner.run("Broken");
    expect(entry.ok).toBe(false);
    expect(entry.messages).toBe("build error");
    expect(runner.list()).toHaveLength(1);
  });

  it("clears its history on request", async () => {
    const omc = fakeOmc({
      resultFile: "Model_res.mat",
      errorMessage: "",
      simulationOptions: "",
      messages: "",
    });
    const runner = new SimulationRunner(omc);
    await runner.run("Model");
    runner.clear();
    expect(runner.list()).toHaveLength(0);
  });
});

describe("ResultsTreeProvider", () => {
  it("surfaces the runner's entries as tree items", async () => {
    const omc = fakeOmc({
      resultFile: "Model_res.mat",
      errorMessage: "",
      simulationOptions: "",
      messages: "",
    });
    const runner = new SimulationRunner(omc);
    await runner.run("Model");
    const provider = new ResultsTreeProvider(runner);
    const children = provider.getChildren();
    expect(children).toHaveLength(1);
    const item = provider.getTreeItem(children[0]!);
    expect(item.label).toBe("Model");
    expect(item.description).toBe("ok");
  });

  it("returns no children for a leaf entry", () => {
    const runner = new SimulationRunner(
      fakeOmc({
        resultFile: "Model_res.mat",
        errorMessage: "",
        simulationOptions: "",
        messages: "",
      }),
    );
    const provider = new ResultsTreeProvider(runner);
    expect(
      provider.getChildren({ className: "x", resultFile: "", ok: true, messages: "", when: 0 }),
    ).toEqual([]);
  });
});
