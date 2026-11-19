# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Purpose

This repo holds the parts of a correspondence pipeline:

1. Letters are written as Markdown files; the text is the body, and metadata (recipient, date, subject, etc.) lives in YAML frontmatter.
2. The Markdown files act as the data source and are combined with an HTML template.
3. The resulting HTML page is turned into a PDF.

Astro is used to author the HTML templates (layouts). Full spec: `specs.md`; implementation plan: `docs/superpowers/plans/2026-11-17-letter-cli.md`.

## Commands

Package manager is pnpm (Node >= 22.23.4). Astro 7.

- `pnpm install` — install dependencies
- `pnpm dev` — dev server (see AGENTS.md: use `astro dev --background` and manage it with `astro dev stop|status|logs`)
- `pnpm build` — static build to `dist/`
- `pnpm preview` — serve the build
- `pnpm astro check` — type check (only works once `@astrojs/check` and `typescript` are installed; not currently a dependency)
- `pnpm lint` — oxlint (config: `.oxlintrc.json`); `pnpm format` / `pnpm format:check` — oxfmt (config: `.oxfmtrc.json`: tabs, no semicolons, single quotes, print width 120). Examples, fixtures and docs are not formatted.
- `pnpm test` — Vitest. Most tests build a real PDF and check text positions in mm (`src/cli/pdf-text.ts`); they need Unica 77 LL installed.
- `pnpm exec playwright install chromium` — once, after install
- `node src/cli/letter.ts <file.md>` — the CLI. Global install: `pnpm setup` (adds pnpm's bin dir to PATH), then `pnpm add -g link:$PWD`, then `letter <file.md>`
- Dev preview of one document: `LETTER_FILE=examples/bewerbung.md astro dev --background` (default: `examples/letter.md`)

pnpm and fnm's Node are not readable inside Claude Code's sandbox; pnpm commands run outside it.

## Structure

- `src/lib/` — plain TS run by Node directly (erasable syntax only, `.ts` import extensions): document model and validation, Banana mapping, i18n, page CSS, QR-bill, signature, user config (`~/.config/letter/config.json` or `$LETTER_CONFIG`: sender, header brands, signature)
- `src/cli/` — the `letter` command: build (Astro into `.astro/builds/`, cwd = repo, because Astro's prerender step must sit inside cwd), serve, print, verify layout against the envelope window
- `src/layouts/Document.astro`, `src/components/` — the templates; `src/styles/tables.css` styles every table (items, timesheet, Markdown body)
- `banana/` — Banana Accounting extensions that export invoice and timesheet JSON
- `examples/` — fictional documents for tests and preview. The repo must hold no real personal or client data: the sender lives in the user config, everything else is fictional (Hanna Beispiel, Muster AG)

User-facing errors are `LetterError`; anything that must fail with a clear message has to be checked before the Astro build (errors thrown inside Astro lose their type).

## Architecture

The full spec is in `specs.md`. In short: a `letter <file.md>` CLI passes one Markdown file (living outside this repo) to Astro. A custom content loader reads it plus any Banana Accounting JSON it references, and Astro builds one page. Playwright/Chromium prints that page to a PDF next to the Markdown file.

## Keeping context across sessions

Claude's own session memory is not part of the repo, so durable project knowledge must be written down here.

- Record decisions (and why) in the **Decision log** below, as they are made.
- Keep this file current: when commands, structure, or conventions change, update it in the same change.
- Put detailed material (template placeholder spec, frontmatter schema, PDF/print CSS notes) in `docs/` and link it from here rather than growing this file.

## Decision log

- 2026-11-17: Repo initialised from the Astro minimal template; pipeline concept defined (see Purpose). Merge strategy and PDF engine still open.
- 2026-11-17: Merge in Astro (custom content loader, one page per document), not placeholders filled by a separate process: Astro already templates, and dev preview keeps working.
- 2026-11-17: PDF via headless Chromium (Playwright). The components use `text-box`, `rlh`, subgrid and nesting, which only Chromium renders. Vivliostyle is the fallback; WeasyPrint was rejected (CSS rewrite only to gain PDF/A).
- 2026-11-17: Banana Accounting Plus is the source for invoice/offer/timesheet data, via our own Banana extension that exports JSON. The template never recomputes amounts.
- 2026-11-17: No VAT: the business is below the registration threshold. Invoices show line items and the total only (no VAT rows, no subtotal). The QR-bill always gets its own page (a shared page's footer margin would lift it off the bottom edge).
- 2026-11-18: No font check before printing: the CSS has a fallback, and a missing Unica 77 LL is the user's to notice.
- 2026-11-18: Running header is brand / subject; `/` is the separator everywhere (header, footer, timesheet title). Invoices may omit `subject`; it falls back to Banana's `document_info.title`.
- 2026-11-18: Pro-forma invoices (`total_to_pay` 0) get no QR-bill.
- 2026-11-18: Invoices list invoice number, project, customer number, due date and service period left of the address (`PropertyList`); rows without a value are left out. Banana's invoice JSON has no project or period, so they come from the frontmatter or, failing that, the timesheet. Due date is `payment_info.due_date`. The timesheet title is just "Stundenrapport"; project id, name and period sit in a `PropertyList` below it.
- 2026-11-19: Sender (name, address, email, phone) and header brands moved out of the code into the user config and are required; the repo and its examples, fixtures and docs use a fictional sender. Tests point `LETTER_CONFIG` at `examples/config.json` (`tests/helpers/setup.ts`). Banana extension IDs (`net.xeophin.letter.*`) and `@publisher` are kept on purpose, not anonymised.
