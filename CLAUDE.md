# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Repository state

This is a new repository with its first commit consisting only of `README.md` (title: "NoteManegment"). There is currently no source code, build configuration, or test suite. The `.gitignore` covers IntelliJ IDEA, Python, Node.js, and common project artifacts.

## Initial setup

The repository uses IntelliJ IDEA (`.idea/` directory present). No other IDE configuration or package manager setup is in place yet.

## Adding source code

To add code to this repository:

1. Add source files under an appropriate directory (e.g., `src/`, `lib/`, `app/`)
2. If using Python: add `pyproject.toml`, `setup.py`, or `requirements.txt` as needed
3. If using Node.js: add `package.json` and install dependencies with `npm install` / `pnpm install`
4. Run `git add . && git commit -m "add source"` to commit

## When source code exists

Once source files are present, common tasks will include:

- **Building** — check for `package.json` scripts (`npm run build`), Maven/Gradle goals, or Python build tools
- **Linting** — look for ESLint, Flake8, ruff, or other linter configs; run via project scripts
- **Testing** — look for test configuration (`pytest`, `jest`, `vitest`); single tests can be run with their respective runners
- **Type checking** — look for TypeScript config or mypy/pyright setup

## Current workspace

- `.idea/` — IntelliJ IDEA project files (covered by `.gitignore`)
- `.gitignore` — git excludes for IntelliJ, Python, Node.js, OS artifacts
- `README.md` — project title only