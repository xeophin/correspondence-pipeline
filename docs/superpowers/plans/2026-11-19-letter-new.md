# `letter new` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `letter new [letter|invoice] [name]` writes a Markdown scaffold with all frontmatter keys into the current directory.

**Architecture:** A pure module `src/lib/scaffold.ts` builds the file name and content from (type, name, today). `src/cli/letter.ts` dispatches on `args[0] === 'new'`, writes the file with exclusive-create, and prints the path. Templates are strings in code, checked against the zod schema by a test.

**Tech Stack:** Node (erasable TS, `.ts` imports), Vitest, existing `loadDocument` and `LetterError`.

**Spec:** `docs/superpowers/specs/2026-11-19-letter-new-design.md`

## Global Constraints

- Syntax `letter new [letter|invoice] [name]`; type defaults to `letter`; `letter <file.md>` unchanged.
- File name `<YYYY-MM-DD>-<name>.md`, name defaults to the type; written in the cwd; never overwrites.
- Empty `subject` so the scaffold fails validation until filled in; German placeholders like the examples.
- User-facing errors are `LetterError`. Code style: tabs, no semicolons, single quotes, width 120; `pnpm lint` and `pnpm format:check` pass.
- pnpm and tests run outside the sandbox.

## Review Focus

- `letter new` twice on the same day: second run fails with a `LetterError`, first file untouched.
- `letter new invoice` with no name: file is `<date>-invoice.md`.
- Name with a path separator or `.md` suffix (`letter new letter foo/bar`, `foo.md`): rejected / not doubled.
- Unknown type (`letter new offer`): usage error, no file.
- A file called `new` is still reachable as `./new`.

---

### Task 1: Scaffold module

**Files:**
- Create: `src/lib/scaffold.ts`
- Test: `tests/scaffold.test.ts`

**Interfaces:**
- Produces: `scaffold(type: 'letter' | 'invoice', name: string | undefined, today: string): { fileName: string; content: string }`. Throws `LetterError` if `name` contains `/` or `\`, or is empty. Strips a trailing `.md` from `name`.

- [ ] **Step 1: Write failing tests** in `tests/scaffold.test.ts`:
  - `scaffold('letter', undefined, '2026-11-19').fileName === '2026-11-19-letter.md'`; with `'invoice'` → `'2026-11-19-invoice.md'`; name `'foo.md'` → `'2026-11-19-foo.md'`.
  - `scaffold('letter', 'a/b', …)` throws `LetterError` matching `/name/`.
  - Letter content, written to a temp dir and passed to `loadDocument` after replacing `subject:` with `subject: Test`: loads with `type === 'letter'`, `date === '2026-11-19'`.
  - Unmodified letter content: `loadDocument` throws `LetterError` matching `/subject/`.
  - Invoice content: references `./invoice.json`; with `examples/invoice/invoice.json` copied into the temp dir and `subject` untouched, `loadDocument` succeeds and `hasItemsMarker === true`; the recipient/subject/date keys in the invoice scaffold are commented out (Banana supplies them).
  - Every key of the frontmatter schema (`type sender lang date subject recipient invoice timesheet project period signature title`) appears in the letter or invoice scaffold, as an active or commented key.
- [ ] **Step 2: Run** `pnpm exec vitest run tests/scaffold.test.ts` — expect FAIL (module missing).
- [ ] **Step 3: Implement `scaffold`** in `src/lib/scaffold.ts`. Letter: active `type`, `date`, `recipient` (block, placeholder lines `Muster AG` / `Frau Erika Muster` / `Musterstrasse 12` / `3000 Bern`), empty `subject:`; commented `# sender: personal`, `# lang: en`, `# title:`, `# signature: true`, each with a comment listing allowed values and default; body `Sehr geehrte Frau Muster`, blank, `Text`, blank, `Freundliche Grüsse`. Invoice: active `type: invoice`, `invoice: ./invoice.json`; commented `date`, `subject`, `recipient`, `timesheet`, `project`, `period` plus the shared optional keys, each noting its Banana/timesheet fallback; body ends with `::items` marker between text lines. Note: the invoice example JSON must produce a non-empty title and customer address, or the test adapts to supply them.
- [ ] **Step 4: Run** the test file — expect PASS.
- [ ] **Step 5: Commit** `git add src/lib/scaffold.ts tests/scaffold.test.ts && git commit -m "feat: add document scaffold templates"`

### Task 2: `letter new` command

**Files:**
- Modify: `src/cli/letter.ts` (dispatch before the `args.length !== 1` check; update usage message to `letter <file.md> | letter new [letter|invoice] [name]`)
- Test: `tests/cli.test.ts` (new tests; reuse `CLI`, `spawnSync`, `mkdtempSync`)

**Interfaces:**
- Consumes: `scaffold` from Task 1.
- Produces: `async function newDocument(args: string[]): Promise<void>` in `letter.ts` (or `src/cli/new.ts` if cleaner): parses `[type] [name]`, where `args[0]` is `letter`/`invoice` only if it is one of those, otherwise it is the name with type `letter`; more than two args or unknown type → `LetterError('usage: letter new [letter|invoice] [name]')`. Writes with `writeFile(path, content, { flag: 'wx' })`; `EEXIST` → `LetterError('<fileName> already exists')`. Prints the file name to stdout. Must not load user config or start a build.

- [ ] **Step 1: Write failing CLI tests** (spawn with `cwd` = fresh temp dir, args `new …`):
  - `new` → status 0, file `<today>-letter.md` exists in cwd, stdout contains its name.
  - `new invoice kibo` → `<today>-kibo.md` contains `type: invoice`.
  - Second `new` in same dir → status 1, stderr matches `/already exists/`, file content unchanged.
  - `new offer x y` → status 1, stderr matches `/usage/`, no `.md` created.
  - Runs without `LETTER_CONFIG` set (no config error).
  - Today's date comes from local time: compute expected with `new Date()` formatted `YYYY-MM-DD` in local time (use the existing helper in `src/lib/dates.ts` if one exists, else `toLocaleDateString('sv')`).
- [ ] **Step 2: Run** `pnpm exec vitest run tests/cli.test.ts -t "new"` — expect FAIL.
- [ ] **Step 3: Implement** the dispatch and `newDocument` as specified above.
- [ ] **Step 4: Run** `pnpm exec vitest run tests/cli.test.ts tests/scaffold.test.ts` — expect PASS; then `pnpm lint && pnpm format:check`.
- [ ] **Step 5: Commit** `git commit -m "feat: add letter new command"`

### Task 3: Docs

**Files:**
- Modify: `CLAUDE.md` (Commands: add `letter new [letter|invoice] [name]`; Structure: `src/lib/scaffold.ts`; Decision log entry dated 2026-11-19: scaffold in code with schema-conformance test, no `--personal` flag, placeholder `subject` left empty on purpose)
- Modify: `specs.md` (a short "Starting a document" paragraph under Process)

- [ ] **Step 1:** Make the edits.
- [ ] **Step 2:** Run the full `pnpm test` — expect all pass.
- [ ] **Step 3: Commit** `git commit -m "docs: document letter new"`

---

Self-review: spec coverage complete (syntax, file name, no overwrite, both templates, comments with fallbacks, failing placeholder, tests, docs). Names consistent (`scaffold`, `newDocument`).
