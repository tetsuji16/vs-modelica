## Phase gate and slice

- Phase:
- Vertical slice:

## Acceptance criteria (state before coding)

-

## Evidence

- [ ] `pnpm check`
- [ ] `pnpm test`
- [ ] `pnpm test:visual` (baselines reviewed manually)
- [ ] Tested against installed OpenModelica; exact `getVersion()` output:
- [ ] Fixture added or updated before implementation

## Boundaries

- [ ] No `.mo` text is mutated from a webview or provider adapter
- [ ] No secrets in settings, logs, prompts, traces or webview state
- [ ] No OpenModelica code inspected, copied or bundled
- [ ] Feature matrix / `docs/DECISIONS.md` updated when a boundary changed
