# Clean-room and licensing policy

This is an engineering policy, not legal advice. Obtain counsel before public release if the project markets itself as compatible with a named proprietary product.

## 1. Findings recorded on 2026-08-02

- The installed Modex VS Code extension is version 0.1.10.
- Its bundled `LICENSE.txt` states that it is proprietary and prohibits copying, modification, derivative works, reverse engineering, decompilation, disassembly, and attempts to derive source.
- Publicly observable inputs used for this plan are the Marketplace description, commands/settings exposed as ordinary VS Code contribution metadata, the user's screenshots, ordinary interactive behavior, and public support material.
- No source code is published by the referenced Modex GitHub organization; its public repositories are feedback/release artifacts.
- OpenModelica 1.27.0 is installed locally. The OpenModelica project offers core program code under AGPLv3 or OSMC-PL modes; its runtime has additional BSD-3-Clause availability. Exact file headers control any copied file.

## 2. Permitted specification sources

- Modelica Language Specification and public Modelica documentation;
- OpenModelica public user guide and scripting API;
- public VS Code API/documentation;
- public Modex Marketplace feature list and documentation;
- user-authored descriptions, screenshots, and black-box acceptance observations;
- independently created fixtures and UI assets;
- behavior of standard `.mo` files and installed MSL packages.

## 3. Prohibited sources/actions

- inspecting `dist/extension.js`, source maps, minified logic, internal strings/schemas, or network internals from the proprietary VSIX;
- decompiling/debugging the extension to discover implementation;
- copying any proprietary resource, icon, style sheet, prompt, test, or asset;
- using a model to translate proprietary code into a new language or paraphrased form;
- importing proprietary figure/document formats based only on reverse engineering;
- telling contributors to install or inspect the reference implementation's internals.

The initial inventory inspected only top-level license/privacy/readme and normal VS Code manifest contributions to determine the lawful boundary. Implementation agents must not inspect the package further.

## 4. OpenModelica use policy

Default architecture is process separation:

- require users to install OpenModelica;
- spawn `omc` and communicate using its documented interactive/scripting interface;
- do not bundle, statically/dynamically link, or copy OMC/OMEdit code;
- link to OpenModelica installation and license documentation;
- label OpenModelica and Modelica names as third-party marks.

This minimizes license coupling but does not eliminate attribution/compatibility obligations. Any proposal to copy OpenModelica or OMEdit source must:

1. identify exact files and headers;
2. state chosen OSMC usage mode or other license;
3. analyze distribution/source obligations, including AGPL if chosen;
4. add notices and `OSMC-USAGE-MODE.txt` where required;
5. receive maintainer approval before code enters the repository.

Until that review passes, “OpenModelica code reuse” means use of documented APIs and data formats, not source copying.

## 5. Project identity

Use `Modelica Studio OSS` as a working name. Before Marketplace publication, run trademark and name-availability review. Include a notice similar to:

> Modelica Studio OSS is an independent project and is not affiliated with or endorsed by Modex, the Modelica Association, Microsoft, or the Open Source Modelica Consortium.

Do not use `modex` in extension IDs, commands, settings, namespaces, file extensions, logos, or Marketplace keywords except accurate nominative compatibility discussion approved for release.

## 6. Dependency intake

Every production dependency requires:

| Field        | Required value                                        |
| ------------ | ----------------------------------------------------- |
| name/version | exact package and lockfile version                    |
| source       | canonical repository URL                              |
| license      | SPDX identifier plus unusual terms                    |
| purpose      | why it is needed                                      |
| distribution | extension host, webview bundle, optional, or dev-only |
| review       | maintainer and date                                   |

Reject unknown licenses, source-available restrictions, and AGPL dependencies by default. Automated scanning does not replace header review for copied code.

## 7. Contributor provenance

PR template must require the contributor to affirm that the work is original or derived only from recorded compatible sources. Keep a `docs/provenance/` note for each externally specified compatibility behavior. If a contributor has inspected prohibited internals, isolate them from implementing the corresponding component and have another contributor implement from a written behavioral spec.

## 8. Release checklist

- independent name/logo review complete;
- LICENSE, notices, dependency report, privacy policy, security policy present;
- no proprietary bytes/strings/assets detected by provenance audit;
- OpenModelica is not bundled and installer clearly states it is required;
- all external links and trademarks correctly attributed;
- AI data flow and OpenRouter retention choices documented;
- Marketplace description avoids claims of endorsement or exact proprietary identity.
