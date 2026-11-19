# `letter new`: scaffold a document (design)

Approved 2026-11-19.

## Intent
Starting a letter or invoice should not require opening the docs to recall the frontmatter keys. `letter new` writes a Markdown file into the current directory with every key already listed.

## Goals / non-goals / anti-goals
- Goal: the generated file shows all keys that apply to its type, with allowed values.
- Non-goal: interactive prompts, a `--personal` flag, config-driven templates.
- Anti-goal: a scaffold that silently builds a wrong-looking PDF, or one that drifts from the schema in `src/lib/document.ts`.

## Design
- Syntax: `letter new [letter|invoice] [name]`; type defaults to `letter`. `letter <file.md>` is unchanged.
- File: `<today>-<name>.md` (name defaults to the type) in the cwd. Never overwrites; an existing file is a `LetterError`.
- Letter: required keys filled (`type`, `date` today, `recipient` placeholder block, empty `subject`); optional keys as commented-out lines with allowed values (`sender`, `lang`, `title`, `signature`); body with salutation and closing placeholders.
- Invoice: as above plus `invoice: ./invoice.json`, commented `timesheet`, `project`, `period`, and an `::items` marker. Comments say which values fall back to Banana.
- The empty `subject` must fail validation until filled in.
- Code: `src/cli/new.ts`, dispatch in `src/cli/letter.ts`. Test: the scaffold, with placeholders filled, passes `loadDocument`. Update `CLAUDE.md` and `specs.md`.

## Approaches
Considered: a static template file per type, a generator from the zod schema, template strings in code. Chose template strings in code with a schema-conformance test: the schema carries no comments or fallback notes, so generating from it would lose the useful part.

## Left to the builder
Exact placeholder wording, German-language placeholders to match the examples.
