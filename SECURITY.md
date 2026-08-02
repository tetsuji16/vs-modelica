# Security policy

## Reporting

Report vulnerabilities through a private GitHub security advisory on this repository.
Do not open a public issue for an unpatched vulnerability. Expect an acknowledgement
within seven days.

## Security model

- The VS Code extension host is the only trusted component. It owns the filesystem,
  processes, secrets and network access.
- Webviews are untrusted presentation processes: strict CSP, nonce scripts, no inline
  script or style, no Node integration, and `localResourceRoots` restricted to `media`.
- All webview traffic uses versioned message contracts. Webviews request typed domain
  operations and never receive API keys or arbitrary filesystem paths.
- AI output is untrusted. Every proposal is validated for schema, path containment,
  document revision, Modelica names, operation count and scope, and requires explicit
  user acceptance before it touches source.
- API keys live only in VS Code `SecretStorage`. They must never appear in settings,
  logs, prompts, traces or webview state.
- Processes are spawned with argv arrays. Shell string concatenation is forbidden and
  is blocked by an ESLint rule.
- OpenModelica is never downloaded automatically and is never bundled.

## Supported versions

Pre-1.0: only the latest published version receives fixes.
