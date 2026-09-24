# AGENTS.md

Read this file before you change the repository. Update it when the
architecture or the workflow changes.

`CLAUDE.md` is a symlink to this file. Claude, Codex, and Kimi read the same
contract.

## What this project is

<!-- One paragraph. What it does and who uses it. -->
TODO

## Stack

<!-- Language, framework, build tool, database. Delete the rows that do not apply. -->
| Layer | Choice |
|---|---|
| Language | TODO |
| Build | TODO |
| Test | TODO |

## Setup

```sh
# TODO: the commands that take a fresh clone to a running state
```

## Run locally

```sh
# TODO: the command that starts the app, and the URL it serves
```

## Verify

Run these before you open a pull request. Put the output in the pull request
body.

```sh
# TODO: build
# TODO: test
# TODO: lint and type check
```

## Git workflow

`main` is stable. `dev` is the integration branch. One branch for each task,
branched from `dev`, merged into `dev` by a pull request.

Full rules: `~/dotfiles/claude/WORKFLOW.md`. The rules are enforced by
`~/dotfiles/claude/hooks/guard-git.sh`, not by this paragraph.

An agent never merges a pull request.

## Agent roles

| Agent | Owns |
|---|---|
| Claude | Planning, review, architecture decisions |
| Codex | Implementation against an approved plan |
| Kimi | Frontend work and research |

One agent owns one branch. Two agents never share a branch.

## Constraints

<!-- The rules an agent must not break in this repository. Be specific. -->
- TODO

## More

| Document | Holds |
|---|---|
| `docs/architecture.md` | Structure, modules, data flow |
| `docs/decisions.md` | Decisions taken and the reason for each |
| `docs/workflow.md` | Anything about the process that is specific to this repository |
| `~/dotfiles/claude/WORKFLOW.md` | Branch, commit, pull request, and CI rules shared by every repository |

Continuous integration follows the shared policy: light checks on a pull
request, the expensive build and deploy only on a version tag. Do not restate it
here. Record a deviation in `docs/workflow.md` with its reason.

## Current state

<!-- What is in progress now. Keep it short. Delete what is complete. -->
- TODO
