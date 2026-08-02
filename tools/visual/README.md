# Visual harness

Phase 0 captures a deterministic **vector** baseline of the empty diagram canvas for
every viewport fixture in `viewports.json`. The renderer is a pure function, so the
output is byte-identical on Windows, Linux and CI without pinning fonts or a browser.

```bash
pnpm test:visual          # verify
pnpm test:visual:update   # regenerate, then review every diff manually
```

Phase 2 extends this harness with pinned-Chromium pixel capture of the real scene
graph, adding the nine baselines listed in `docs/04-visual-spec.md` section 7.
Baselines live in `baselines/` and are excluded from Prettier formatting.
