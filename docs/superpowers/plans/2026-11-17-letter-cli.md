# Letter CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `letter path/to/file.md` turns a Markdown letter or invoice (with optional Banana JSON) into an A4 PDF next to the source file.

**Architecture:** The CLI validates the Markdown file in plain TypeScript, then runs `astro build` into a temp dir. A custom content loader reads the same file and stores the rendered parts. The CLI serves the build on localhost and prints it with Playwright/Chromium. It verifies the address position from the PDF's text coordinates, and writes the PDF only if every check passes.

**Tech Stack:** Node ≥ 22.23.4 (native TS type stripping), pnpm, Astro 7, Playwright (Chromium), `yaml`, `zod`, `swissqrbill`, `unpdf`, Vitest.

**Spec:** `specs.md` (approved 2026-11-17). Read it before any task.

**Branch:** work on `feat/letter-cli`, not `main`.

## Global Constraints

- Node runs `src/lib/**` and `src/cli/**` directly: only erasable TS syntax (no `enum`, no parameter properties, no namespaces), and relative imports use the `.ts` extension.
- All user-facing failures throw `LetterError` (from `src/lib/errors.ts`). The CLI prints `letter: <message>`, exits 1 and writes no PDF.
- Amounts are never recomputed: totals and line amounts come from the Banana JSON as given. No VAT and no subtotal (user decision 2026-11-17).
- `lang: de | en`, default `de`. Intl locales `de-CH` / `en-CH`.
- Envelope zones (mm from the page's top-left): address always-visible 117–196 × 47–81. Possibly-visible 98–215 × 33–95. Subject starts at ≥ 95. Header right of x = 98 stays above y = 33.
- Header brand: `business` → `example.org/studio` with the type line; `personal` → `hanna/beispiel` without a type line. Plain letters have no type line unless `title:` is set.
- No real correspondence data in the repo: examples and fixtures are fictional.
- Body font family: `"Unica 77 LL"`. A missing font is an error, never a fallback.

## Review Focus

1. **File names with spaces, umlauts or quotes** (`Bewerbung "Müller".md`). The PDF lands next to the file, and the footer shows the name verbatim, with no CSS string break. → Task 2 (`cssString`) and Task 6.
2. **Running from another working directory.** JSON paths resolve relative to the `.md` file, never relative to cwd. → Task 3 and Task 6.
3. **Addresses that are too long or too tall** (6 lines, or a 70-character company name). This is an error, not a clipped window. → Task 6.
4. **Misplaced markers.** `::items` in a plain letter, `::items` twice, `::item` misspelt or `::table` → an error naming the line. → Task 3.
5. **Timesheet whose `total` ≠ the sum of its entries** (a manually edited export). → Error. → Task 3.

---

### Task 1: Test harness and print pipeline proof

Proves the spec's "verify early" items for Chromium: margin boxes with `counter(page)`/`counter(pages)` and `@page :first`.

**Files:**
- Modify: `package.json` (add deps; scripts `"test": "vitest run"`)
- Create: `vitest.config.ts` (testTimeout 120000, `include: ['tests/**/*.test.ts']`)
- Create: `src/cli/serve.ts`, `src/cli/print.ts`
- Create: `tests/helpers/pdf.ts`
- Test: `tests/print.test.ts`, fixture `tests/fixtures/margin-boxes.html`

**Interfaces:**
- Produces:
  - `serveDir(dir: string): Promise<{ url: string; close(): Promise<void> }>`: `node:http` static server on 127.0.0.1, ephemeral port, correct MIME types for html/css/js/svg/png/woff2.
  - `withPage<T>(url: string, fn: (page: Page) => Promise<T>): Promise<T>`: launches Chromium, opens the url, waits for `document.fonts.ready`, and always closes the browser.
  - `printPdf(page: Page): Promise<Uint8Array>`: `page.pdf({ preferCSSPageSize: true, printBackground: true })`.
  - `checkFont(page: Page, family: string): Promise<boolean>`: compares the canvas `measureText` width of a sample string in `"<family>", monospace` against plain `monospace`; returns true if they differ.
  - test helper `pdfPages(pdf: Uint8Array): Promise<TextItem[][]>` where `TextItem = { str: string; xMm: number; topMm: number; rightMm: number; bottomMm: number }`, built from `unpdf`'s `getDocumentProxy` + `getTextContent`; pt→mm = `× 25.4 / 72`, top measured from the page's top edge.

- [ ] **Step 1:** Add deps: `pnpm add playwright yaml zod swissqrbill unpdf` and `pnpm add -D vitest`. Then run `pnpm exec playwright install chromium`. (`pnpm` may be blocked in the sandbox; if so, ask the user to run it with `!`.)
- [ ] **Step 2: Write the failing test** `tests/print.test.ts`. The fixture is two pages of A4 (forced `break-before: page`), with `@page { size: A4; margin: 20mm; @bottom-right { content: "Seite " counter(page) " von " counter(pages) } @top-left { content: "RUNNING" } }` and `@page :first { @top-left { content: none } }`.
  ```ts
  test('margin boxes number pages and skip the running header on page 1', async () => {
    const pages = await printFixture('margin-boxes.html') // serveDir + withPage + printPdf + pdfPages
    expect(pages).toHaveLength(2)
    expect(pages[0].map(i => i.str).join(' ')).toContain('Seite 1 von 2')
    expect(pages[1].map(i => i.str).join(' ')).toContain('Seite 2 von 2')
    expect(pages[0].some(i => i.str.includes('RUNNING'))).toBe(false)
    expect(pages[1].some(i => i.str.includes('RUNNING'))).toBe(true)
  })
  test('checkFont tells an installed font from a missing one', async () => {
    // inside withPage on the fixture:
    expect(await checkFont(page, 'Unica 77 LL')).toBe(true)
    expect(await checkFont(page, 'No Such Font 123')).toBe(false)
  })
  ```
- [ ] **Step 3:** Run `pnpm test tests/print.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 4:** Implement `serve.ts`, `print.ts` and `tests/helpers/pdf.ts` per the Interfaces.
- [ ] **Step 5:** Run `pnpm test tests/print.test.ts`. Expected: PASS. **If margin boxes do not render,** stop and report: the spec names Vivliostyle as the fallback, and that's a user decision.
- [ ] **Step 6: Commit** `feat: print pipeline with Playwright and PDF test helpers`

### Task 2: Labels, formatting, page CSS

**Files:**
- Create: `src/lib/errors.ts`, `src/lib/i18n.ts`, `src/lib/page-css.ts`
- Test: `tests/i18n.test.ts`, `tests/page-css.test.ts`

**Interfaces:**
- Produces:
  - `class LetterError extends Error`
  - `type Lang = 'de' | 'en'`
  - `t(lang: Lang, key: LabelKey, vars?: Record<string, string>): string`, with `{name}` substitution. Keys and values (de / en):
    `type.invoice` Rechnung / Invoice · `items.description` Beschreibung / Description · `items.quantity` Menge / Qty · `items.unitPrice` Preis / Price · `items.amount` Betrag / Amount · `totals.total` Total / Total · `page` Seite / Page · `page.of` von / of · `timesheet.title` Stundenrapport {period} · {project} / Timesheet {period} · {project} · `timesheet.date` Datum / Date · `timesheet.description` Tätigkeit / Activity · `timesheet.hours` Stunden / Hours · `timesheet.total` Total / Total
  - `formatDate(lang: Lang, iso: string): string`, a long date.
  - `formatMonth(lang: Lang, iso: string): string`, giving `November 2026`.
  - `formatAmount(lang: Lang, n: number): string`: two decimals, Intl grouping, no currency.
  - `cssString(s: string): string`: a quoted CSS string with `\` → `\\`, `"` → `\"` and newline → `\A `.
  - `pageCss(o: { runningHeader: string; fileName: string; footerLines: string[]; lang: Lang }): string`: the `@page` rules, with A4 size, the page counter in the footer (`t('page')` + `counter(page)` + `t('page.of')` + `counter(pages)`), the file name and footer lines in the bottom margin boxes, the running header in a top margin box, and `@page :first` clearing the running header. Margin values are the builder's call within the envelope constraints.

- [ ] **Step 1: Write failing tests:**
  ```ts
  expect(formatDate('de', '2026-12-11')).toBe('11. Dezember 2026')
  expect(formatDate('en', '2026-12-11')).toBe('11 December 2026')
  expect(formatAmount('de', 1234.5)).toBe("1'234.50")          // ASCII apostrophe, Intl de-CH
  expect(cssString('Bewerbung "Müller"\\x.md')).toBe('"Bewerbung \\"Müller\\"\\\\x.md"')
  const css = pageCss({ runningHeader: 'example.org/studio · Rechnung 2026-042', fileName: 'a "b".md', footerLines: ['Hanna Beispiel'], lang: 'en' })
  expect(css).toContain('"Page " counter(page) " of " counter(pages)')
  expect(css).toContain('"a \\"b\\".md"')
  expect(css).toMatch(/@page\s*:first\s*{[^}]*@top-/)
  ```
- [ ] **Step 2:** Run `pnpm test tests/i18n.test.ts tests/page-css.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement per the Interfaces.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat: labels, formatting and page CSS`

### Task 3: Document model (frontmatter, body, timesheet)

**Files:**
- Create: `src/lib/document.ts`, `src/lib/timesheet.ts`
- Test: `tests/document.test.ts`, `tests/timesheet.test.ts`, fixtures in `tests/fixtures/docs/`

**Interfaces:**
- Consumes: `LetterError`, `Lang` (Task 2); `toInvoiceView`, `InvoiceView` (Task 4). Write Task 4 first if you prefer; Task 3 only calls `toInvoiceView(JSON.parse(file))`.
- Produces:
  ```ts
  interface Timesheet { project: { id: string; description: string }; period: { start: string; end: string };
    entries: { date: string; resource: string; notes: string; hours: number }[]; total: number }
  parseTimesheet(json: unknown): Timesheet   // zod strict; throws LetterError if |total − Σhours| > 0.001
  interface LetterDocument {
    sourcePath: string; fileName: string; type: 'letter' | 'invoice'; sender: 'business' | 'personal'; lang: Lang
    date: string; subject: string; title?: string; recipient: string[]; signature: boolean
    bodyBefore: string; bodyAfter: string; hasItemsMarker: boolean
    invoice?: InvoiceView; timesheet?: Timesheet }
  loadDocument(mdPath: string): LetterDocument   // sync; resolves mdPath to absolute
  ```
- Rules: frontmatter is split with `/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/` and parsed with `yaml`, then validated with a zod `.strict()` schema (keys exactly as in the spec's Frontmatter section, minus `offer`). `invoice`/`timesheet` paths resolve against `dirname(mdPath)`. `type: letter` requires `date` and `recipient`, and rejects `invoice`/`timesheet`. `type: invoice` requires `invoice`; `date` defaults to `invoice.date` and `recipient` to `invoice.customerAddress`, with frontmatter winning. `timesheet` needs `type: invoice`. A line equal to `::items` splits the body; any other line matching `/^::\w/` → error naming the line number; `::items` in a letter or twice → error. Every error message names the file.

- [ ] **Step 1: Write failing tests**, one per rule, against small fixtures. They must include:
  ```ts
  test('resolves JSON relative to the md file, not cwd', () => {
    process.chdir(os.tmpdir())
    expect(loadDocument(fixture('invoice/invoice.md')).invoice?.number).toBe('2026-042')
  })
  test('rejects ::item typo with line number', () =>
    expect(() => loadDocument(fixture('typo.md'))).toThrow(/line 7.*::item/))
  test('rejects ::items in a letter', ...)        // toThrow(LetterError)
  test('rejects a second ::items', ...)
  test('rejects unknown frontmatter key', ...)     // toThrow(/unknown.*colour/i) for key `colour`
  test('frontmatter recipient wins over Banana address', ...)
  test('timesheet total mismatch', () =>
    expect(() => parseTimesheet({ ...valid, total: 7 })).toThrow(/total/))
  ```
- [ ] **Step 2:** Run `pnpm test tests/document.test.ts tests/timesheet.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement per the Interfaces and Rules.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat: document model with frontmatter and body validation`

### Task 4: Banana invoice mapping, sender data, user config

**Files:**
- Create: `src/lib/banana.ts`, `src/lib/sender.ts`, `src/lib/config.ts`
- Create: `examples/invoice/invoice.json`. Use the example JSON from Banana's "Invoice Json Object" page (https://www.banana.ch/doc/en/node/8833), with fictional names, number `2026-042` and currency CHF.
- Create: `examples/config.json` (IBAN `CH93 0076 2011 6238 5295 7`, a public example)
- Test: `tests/banana.test.ts`, `tests/config.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface QrAddress { name: string; address: string; buildingNumber?: string; zip: string; city: string; country: string }
  interface InvoiceItem { description: string; quantity: number | null; unit: string; unitPrice: number | null; amount: number }
  interface InvoiceView { number: string; date: string; currency: string; customerAddress: string[]; debtor: QrAddress;
    items: InvoiceItem[]; total: number }
  toInvoiceView(json: unknown): InvoiceView   // throws LetterError naming the missing JSON field
  // sender.ts: the constants already used in index.astro/Address.astro
  const SENDER: { name: 'Hanna Beispiel'; street: 'Beispielweg 1'; zip: '8000'; city: 'Zürich'; country: 'CH';
    email: 'hanna@example.org'; phone: '+41 44 000 00 00' }
  interface UserConfig { iban: string; signature?: string /* absolute after loading */ }
  loadUserConfig(): UserConfig   // reads $LETTER_CONFIG, else ~/.config/letter/config.json; a relative signature path resolves against the config file; missing file → LetterError explaining where it is looked for
  ```
- Mapping: use the field names on the Banana page (e.g. `document_info.number`, `customer_info.*`, `items[]`, `billing_info.*`). Amounts arrive as strings; convert them with `Number` and reject `NaN`. If the page's names differ from the ones above, the page wins: note it in the test file header.

- [ ] **Step 1: Write failing tests:** the example maps to the expected number, date, item count, `total` (equal to the JSON's total to pay) and customer lines; deleting `billing_info` throws `/billing_info/`; `LETTER_CONFIG=examples/config.json` loads the IBAN; a missing config throws `/config\.json/`.
- [ ] **Step 2:** Run `pnpm test tests/banana.test.ts tests/config.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat: Banana invoice mapping and user config`

### Task 5: Astro loader, build, letter layout

**Files:**
- Create: `src/lib/letter-loader.ts`, `src/content.config.ts`, `src/cli/build.ts`, `src/layouts/Document.astro`, `src/components/PageRules.astro`
- Modify: `src/pages/index.astro` (becomes: get the entry, render `<Document>`), `src/components/Header.astro` (props `sender`, `typeLine?`), `src/components/Address.astro` (prop `recipient: string[]`, return address from `SENDER`, recipient lines `white-space: nowrap`), `src/components/Subject.astro` (formatted date)
- Create: `examples/letter.md` (fictional business letter, `lang: de`), `examples/bewerbung.md` (`sender: personal`, `lang: en`)
- Test: `tests/letter-layout.test.ts`, helper `tests/helpers/render.ts`

**Interfaces:**
- Consumes: `loadDocument` (Task 3); `pageCss`, `formatDate`, `t` (Task 2); `serveDir`, `withPage`, `printPdf` (Task 1); `SENDER` (Task 4).
- Produces:
  - `letterLoader(): Loader`: reads `process.env.LETTER_FILE ?? 'examples/letter.md'`, calls `loadDocument`, renders `bodyBefore`/`bodyAfter` with the loader context's `renderMarkdown`, and stores one entry with id `current` and data `{ doc: LetterDocument, htmlBefore: string, htmlAfter: string }`. It watches the file in dev.
  - `buildDocument(mdPath: string): Promise<{ dir: string; cleanup(): Promise<void> }>`: `mkdtemp`, then sets `process.env.LETTER_FILE` and calls Astro's `build({ root: <repo root>, outDir: <tmp>/dist, cacheDir: <tmp>/cache, logLevel: 'error' })`. It cleans up on failure too.
  - test helper `renderPdf(mdPath): Promise<{ pdf: Uint8Array; pages: TextItem[][] }>`.
- `Document.astro` order: `PageRules`, `Header`, `Address`, `Subject`, body html (`set:html`), and the slots where Tasks 8–11 add items, QR-bill, attachment and signature.

- [ ] **Step 1: Write failing tests** on `examples/letter.md` (recipient's first line `Muster AG`, subject `Testbrief`):
  ```ts
  const { pages } = await renderPdf('examples/letter.md')
  const p1 = pages[0]
  const recipient = p1.filter(i => ['Muster AG', /* every recipient line */].includes(i.str))
  for (const i of recipient) { expect(i.xMm).toBeGreaterThanOrEqual(117); expect(i.rightMm).toBeLessThanOrEqual(196)
    expect(i.topMm).toBeGreaterThanOrEqual(47); expect(i.bottomMm).toBeLessThanOrEqual(81) }
  expect(p1.find(i => i.str === 'Testbrief')!.topMm).toBeGreaterThanOrEqual(95)
  expect(p1.filter(i => i.xMm > 98 && i.topMm < 33 ... /* header items */)).toEqual(/* all header items' bottomMm < 33 */)
  ```
  Also: `examples/bewerbung.md` shows `hanna` and `beispiel`, no `studio` and no type line, and its date is formatted in English.
- [ ] **Step 2:** Run `pnpm test tests/letter-layout.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the loader, build and components. Keep the existing grid (`.columns`, `--column-width`, `--gutter-width`). Position the address block absolutely, or with fixed offsets, in mm on page 1.
- [ ] **Step 4:** Run the same command. Expected: PASS. Also check that `LETTER_FILE=examples/bewerbung.md astro dev --background` renders in the browser.
- [ ] **Step 5: Commit** `feat: Astro loader and letter layout`

### Task 6: The `letter` CLI

**Files:**
- Create: `src/cli/letter.ts` (shebang `#!/usr/bin/env node`), `src/cli/verify.ts`
- Modify: `package.json` (`"bin": { "letter": "src/cli/letter.ts" }`)
- Test: `tests/cli.test.ts` (spawns `node src/cli/letter.ts <file>` with `cwd` set to a temp dir)

**Interfaces:**
- Consumes: Tasks 1, 3 and 5.
- Produces: `verifyLayout(pages: TextItem[][], doc: LetterDocument): void`. It throws `LetterError` if any recipient line is not found as a single text item inside the always-visible zone, or if the subject's top is < 95 mm. Message: `address does not fit the envelope window`.
- Flow: `loadDocument` → `buildDocument` → `serveDir` → `withPage` (`checkFont` for `Unica 77 LL`, else `LetterError('font "Unica 77 LL" is not installed')`) → `printPdf` → `verifyLayout` → write `<dir>/<basename>.pdf` (overwrite). Cleanup runs in `finally`. A `LetterError` prints `letter: <message>` and exits 1; any other error prints its stack and exits 2.

- [ ] **Step 1: Write failing tests:**
  - `examples/letter.md` copied to `tmp/Bewerbung "Müller".md` and run with cwd elsewhere → exit 0, `tmp/Bewerbung "Müller".pdf` exists, footer text contains `Bewerbung "Müller".md`
  - a letter with 6 recipient lines → exit 1, stderr matches `/envelope window/`, no PDF
  - a letter whose recipient line is 70 characters → the same
  - a missing invoice JSON → exit 1, stderr names the path
  - an existing PDF is overwritten (its mtime changes)
- [ ] **Step 2:** Run `pnpm test tests/cli.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the same command. Expected: PASS. Then run `pnpm link --global` and `letter examples/letter.md` from `~`.
- [ ] **Step 5: Commit** `feat: letter CLI`

### Task 7: Footer and running header

**Files:**
- Modify: `src/components/PageRules.astro`, `src/layouts/Document.astro`; remove the inline `<footer>` from `index.astro`
- Create: `examples/long-letter.md` (body long enough for 2 pages)
- Test: `tests/page-furniture.test.ts`

**Interfaces:**
- Consumes: `pageCss` (Task 2).
- Running header: `<brand> · <type label> <invoice number>` for invoices, `<brand>` alone for letters (brand = `example.org/studio` or `hanna/beispiel`). Footer lines: name + street + zip/city, and email + phone (from `SENDER`).

- [ ] **Step 1: Write failing tests** on `examples/long-letter.md`: 2 pages; each page contains `Seite n von 2`, `long-letter.md` and `Beispielweg 1`; page 2 contains `example.org/studio`, and its top is < 33 mm. The running header text does not appear twice on page 1.
- [ ] **Step 2:** Run `pnpm test tests/page-furniture.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `pnpm test`. Expected: all PASS.
- [ ] **Step 5: Commit** `feat: footer and running header`

### Task 8: Invoice items table

**Files:**
- Create: `src/components/ItemsTable.astro`, `examples/invoice/invoice.md` (with `::items`)
- Modify: `src/layouts/Document.astro` (the table between `htmlBefore` and `htmlAfter`, or after the body if there's no marker; header type line `t('type.invoice')`)
- Test: `tests/invoice.test.ts`

**Interfaces:**
- Consumes: `InvoiceView` (Task 4), `formatAmount`, `t` (Task 2).
- The table spans the full width (`FullWidth`). Columns: description, quantity + unit, unit price, amount. One total row, with the currency on it. No VAT, no subtotal. `break-inside: avoid` on rows.

- [ ] **Step 1: Write failing tests:** page 1 contains `Rechnung`; the intro paragraph's top < the first item's top < the closing paragraph's top; the total text equals `formatAmount('de', view.total)`; the `en` variant shows `Invoice` and `Total`; an invoice without a marker puts the table after the last paragraph.
- [ ] **Step 2:** Run `pnpm test tests/invoice.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `pnpm test`. Expected: all PASS.
- [ ] **Step 5: Commit** `feat: invoice items table`

### Task 9: QR-bill page

QR-bill on its own page: confirmed by the user on 2026-11-17 (see specs.md, Invoice details).

**Files:**
- Create: `src/components/QrBill.astro`, `src/lib/qr.ts`
- Modify: `src/layouts/Document.astro`, `src/lib/page-css.ts` (named page `qrbill`: margin 0, no margin boxes)
- Test: `tests/qr.test.ts`

**Interfaces:**
- Consumes: `InvoiceView.debtor/total/currency/number/creditorIban` (missing IBAN → `LetterError`), `SENDER`.
- Produces: `qrBillSvg(view: InvoiceView, iban: string, lang: Lang): string`, using `swissqrbill/svg` with `language: 'DE' | 'EN'`, no reference (a plain IBAN), and message `<type label> <number>`. Invalid data → `LetterError` carrying swissqrbill's message.
- Layout: a page of its own (`page: qrbill`), with the 210 × 105 mm bill flush with the bottom edge. It comes after the letter and before any attachment.

- [ ] **Step 1: Write failing tests:** the last page of `examples/invoice/invoice.md` contains `Empfangsschein` and `Zahlteil`, with tops ≥ 192 mm, and has no `Seite` text; the `en` variant contains `Receipt`; an IBAN `CH00` → `LetterError`.
- [ ] **Step 2:** Run `pnpm test tests/qr.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `pnpm test`. Expected: all PASS.
- [ ] **Step 5: Commit** `feat: Swiss QR-bill page`

### Task 10: Timesheet attachment

**Files:**
- Create: `src/components/TimesheetAttachment.astro`, `examples/invoice/timesheet.json` (fictional, 5 entries, total 6.5)
- Modify: `examples/invoice/invoice.md` (add `timesheet:`), `src/layouts/Document.astro`
- Test: `tests/timesheet-attachment.test.ts`

**Interfaces:**
- Consumes: `Timesheet` (Task 3), `formatDate`, `formatMonth`, `formatAmount`, `t` (Task 2).
- Starts with `break-before: page`, after the QR-bill page. Title `t('timesheet.title', { period: formatMonth(lang, period.start), project: project.description })`. If the period spans more than one month, the period is `formatDate(start) – formatDate(end)`. Columns: date, notes, hours. Then a total row.

- [ ] **Step 1: Write failing tests:** the page after the QR-bill page contains `Stundenrapport November 2026 · <description>`, every entry's notes, and a total of `6.50`; it has the running header and the footer.
- [ ] **Step 2:** Run `pnpm test tests/timesheet-attachment.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `pnpm test`. Expected: all PASS.
- [ ] **Step 5: Commit** `feat: timesheet attachment`

### Task 11: Optional signature

**Files:**
- Create: `tests/fixtures/signature.png` (a fictional scribble), `tests/fixtures/config-signature.json`
- Modify: `src/lib/letter-loader.ts` (with `signature: true`, copy the image into the build as a data URI), `src/layouts/Document.astro` (the image after the body's last paragraph, before the name; the exact position is the builder's call)
- Test: `tests/signature.test.ts`

- [ ] **Step 1: Write failing tests:** with `signature: true` and `LETTER_CONFIG` pointing at a config with a signature, the PDF contains an image (`unpdf`'s `extractImages(pdf, 1)` is non-empty); `signature: true` without a configured signature → `LetterError` matching `/signature/`; `signature: false` → no image.
- [ ] **Step 2:** Run `pnpm test tests/signature.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `pnpm test`. Expected: all PASS.
- [ ] **Step 5: Commit** `feat: optional signature`

### Task 12: Banana export extension

**Files:**
- Create: `banana/package.json` (`{"type":"commonjs"}`), `banana/timesheet-core.js`, `banana/ch.xeophin.letter.export.js`
- Test: `tests/banana-extension.test.ts`

**Interfaces:**
- Produces: `buildTimesheet(rows, opts): Timesheet-shaped object` in `timesheet-core.js`. `rows: { date, projectId, projectDescription, resourceId, notes, hours, rowType }[]`, and `opts: { projectId, start, end }` are inclusive ISO dates. It filters by project and period, sorts by date and sums the total. It is exported via `if (typeof module !== 'undefined') module.exports = { buildTimesheet }` so that Banana's `// @includejs = timesheet-core.js` still works.
- The extension (`@task = app.command`, `@api = 1.0`, `@id = ch.xeophin.letter.export`) offers two commands: export the selected invoice's `ObjectJSonData` from `Banana.document.invoicesCustomers()` unchanged, and export a timesheet (dialogs for project and period; it reads `Banana.document.table('Journal')` columns `Date`, `ProjectsId`, `ProjectsDescription`, `ResourcesId`, `Notes`, `TimeDayTotal`, `RowType`). Both save via a file dialog. Check the API names against https://www.banana.ch/doc/en/node/4714 and the invoice export example https://www.banana.ch/doc/en/node/9749.

- [ ] **Step 1: Write failing tests:** `buildTimesheet` filters other projects and dates outside the period, and `parseTimesheet(buildTimesheet(...))` (Task 3) succeeds, so both sides agree on the format.
- [ ] **Step 2:** Run `pnpm test tests/banana-extension.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the core and the extension.
- [ ] **Step 4:** Run `pnpm test`. Expected: all PASS.
- [ ] **Step 5: Manual check with the user** (it can't be automated): they install the extension in Banana, export a real invoice and a month of hours into a client folder, and run `letter` on a Markdown file there. Confirm the journal column names. Fix the mapping if they differ, and note the real names in `specs.md`. Real exports are not committed.
- [ ] **Step 6: Commit** `feat: Banana export extension`

### Task 13: Docs and the physical check

**Files:**
- Modify: `CLAUDE.md` (Commands: `pnpm test`, `letter <file.md>`, `pnpm link --global`, `pnpm exec playwright install chromium`; drop "no test setup yet"; drop "untouched starter"), `README.md` (usage, frontmatter cheatsheet, config file location), `specs.md` (move resolved "To verify early" items into the body)

- [ ] **Step 1:** Update the docs.
- [ ] **Step 2: Manual check with the user:** print `examples/letter.pdf` and `examples/invoice/invoice.pdf` at 100 %, fold them once, and put them in a C5 right-window envelope. The address must be fully visible and the subject hidden, even when the sheet is shifted. Record the result in the CLAUDE.md decision log.
- [ ] **Step 3:** Run `pnpm test` and `pnpm build`. Expected: both pass.
- [ ] **Step 4: Commit** `docs: letter CLI usage and setup`
