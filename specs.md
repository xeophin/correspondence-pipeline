# Correspondence Toolchain

This repository is used to create a toolchain for written correspondence:
(motivation) letters, offers, invoices and invoice attachments (timesheet reports).

Instead of using Microsoft Word or Apple Pages (which I don't like), or InDesign or Affinity Publisher (which I like, but which seem a bit over the top and have the additional problem that in the future I might not have the software to open these files), I'd like to create a toolchain that turns simple Markdown files into PDFs via a HTML-and-CSS templating system.

Accounting happens in **Banana Accounting Plus** (Advanced plan). Invoices, offers and timesheets are recorded there; Banana's own printouts look bad, so this toolchain takes the *data* from Banana and does the *layout* itself.

## Goals

- One command turns a Markdown file, wherever it lives on disk, into a PDF next to it.
- All document types share one visual design, authored as HTML/CSS (Astro components).
- Invoices take their line items, totals and payment data from Banana, so Banana stays the single source of truth for money.
- Swiss invoices carry a valid QR-bill.
- Source files stay plain text that any editor can open in 20 years.

## Non-goals

- No WYSIWYG editing, no web publishing of letters.
- Correspondence content (letters, addresses, amounts) is **not** stored in this repo; only layouts, the CLI, the Banana extension and fictional examples are.
- Reminders (Mahnungen), delivery notes etc. stay in Banana's own layouts for now.
- **Offers are deferred** to a later version. Banana estimates use the same JSON object as invoices, so they should slot in as a third type later (header "Offerte / Offer", `::items`, no QR-bill).
- No editor-specific syntax (Obsidian wikilinks/callouts, Logseq `key:: value` properties).
- PDF/A is nice to have, not required.

## Anti-goals (failure even if it "works")

- An amount in the PDF differs from Banana. → The template never recomputes totals; it prints what Banana calculated.
- The address is partly hidden by the envelope window, or the subject line shows through it.
- Regenerating an old PDF requires software I no longer have.
- A missing font, file or field silently produces a wrong-looking PDF instead of an error.

## Process

```
Banana Accounting Plus ──(own extension: export JSON)──┐
                                                       ▼
~/…/client/2026-12-11-rechnung.md ──► letter CLI ──► Astro build (1 page) ──► Chromium (Playwright) ──► ~/…/client/2026-12-11-rechnung.pdf
                         ▲                                                                           
          frontmatter references invoice/timesheet JSON (paths relative to the .md)
```

1. For invoices: create the invoice in Banana as usual. Run the toolchain's Banana extension to export the invoice JSON (and, if needed, the timesheet JSON for a project and period) into the client folder.
2. Write the letter as Markdown with YAML frontmatter.
3. Run `letter path/to/file.md`. The PDF is written next to it with the same base name. An existing PDF is overwritten (it can always be regenerated).

## Architecture (decided 2026-11-17)

- **Merge:** Astro does the merging. A custom content loader reads the one Markdown file passed to the CLI (and the JSON files its frontmatter references) and Astro builds exactly one HTML page.
- **PDF:** the CLI opens the built page in headless Chromium via Playwright and prints it (`preferCSSPageSize`). Running header, footer and page numbers use native `@page` margin boxes; their per-document text (document number, file name) is written into the page's CSS at build time.
- **Why Chromium:** the components use `text-box` trimming, `rlh`, subgrid and CSS nesting; Chromium is the only print engine that renders all of them. Vivliostyle (also Chromium-based, fuller paged-media support) is the fallback if native margin boxes hit a limit. WeasyPrint was rejected: it would require rewriting the CSS, for PDF/A only.
- **CLI:** a Node bin in this repo (`letter`), installed globally with `pnpm link`. Build happens in a temp directory; nothing is written into the repo per run.
- **Preview:** `pnpm dev` renders the fictional examples in `examples/` for layout work.

## Document types

| `type`    | Header line 2 (de / en)   | Data from Banana  | QR-bill | Attachment          |
|-----------|---------------------------|-------------------|---------|---------------------|
| `letter`  | — (or `title:` if set)    | —                 | no      | —                   |
| `invoice` | Rechnung / Invoice        | invoice JSON      | yes     | optional timesheet  |

Motivation letters are `letter` with `sender: personal`.

## Frontmatter

```yaml
type: invoice            # letter | invoice (required)
sender: business         # business (default) | personal
lang: de                 # de (default) | en
date: 2026-12-11         # letter: required; invoice: defaults to Banana document date
subject: Unterhalt kibo-physio.ch 2026/27   # letter: required; invoice: defaults to Banana document title
recipient: |             # required for letters; for invoices defaults to Banana customer address
  Kibo Sportrehabilitation GmbH
  Hessstrasse 105
  3000 Köniz / Liebefeld
invoice: ./2026-042.json        # invoice: required. Path relative to the .md file
timesheet: ./2026-11-hours.json # invoice only, optional
project: KIBO            # invoice only, optional; defaults to the timesheet's project id
period: { start: 2026-11-01, end: 2026-11-30 }  # invoice only, optional service period; defaults to the timesheet's period
signature: false         # optional, default false
title: Bewerbung         # optional header line 2 for letters
```

If a value exists both in frontmatter and Banana JSON, frontmatter wins (lets me fix an address without touching Banana). *(My call.)*

Unknown keys or invalid values are an error.

## Body

- CommonMark + GFM tables (tables may span the full width).
- The body contains the whole letter: salutation, text, closing.
- `::items` (a remark leaf directive) marks where the line-items table with subtotal, VAT and total goes. Without the marker, the table follows the body. Any other directive is an error. Room left for options later (`::items{vat=false}`).
- QR-bill and timesheet attachment need no marker; their position is fixed (below).

## Sender

- `business`: header `example.org/studio`, second line = document type (see table).
- `personal`: header `hanna/beispiel`, same style, no type line.
- Return address, footer address and contact details are the same for both. *(My call; correct if not.)*

## Page layout

Format DIN A4, folded once into a **DIN C5 envelope with a right-hand window** (SN 010130). Positions measured from the top-left corner of the page, taken from Swiss Post's ePost layout specification (p. 2, "Kuvert FE rechts"); **verify against a real envelope before treating as final**:

| Zone | horizontal | vertical |
|---|---|---|
| Always visible in window → address goes here | 117–196 mm | 47–81 mm |
| Possibly visible (sheet slides in envelope) | 98–215 mm | 33–95 mm |

Page 1, top to bottom:

1. **Header**: first element on the page. Must stay above 33 mm in the right half (x > 98 mm); may extend lower on the left.
2. **Address**: one-line return address (small, rule below) + recipient, inside the always-visible zone. The block must fit 34 mm in height; the CLI fails if it overflows.
3. **Date | subject**: date in the side column, subject in the main column. Starts below 95 mm.
4. **Body**, including the `::items` table.
5. **QR-bill** (invoices): on its own page, see below.

Pages 2+:

- **Running header** (except on the QR-bill page): brand plus subject (e.g. `example.org/studio / Unterhalt muster-ag.ch`), placed where the address window is on page 1.
- **Footer** on every page except the QR-bill page: page `x / y`, name and address, contact, and the Markdown file name (base name only).

The existing grid (aside column + main column, `--column-width`, `--gutter-width`) remains the basis.

## Invoice details

- Line items and the total come from the Banana invoice JSON (Banana's "Invoice Json Object", version 1.0) and are printed as-is. Only `item_type: item` rows are supported; others are an error.
- The header's second line reads `Rechnung`. Pro-forma invoices (`total_to_pay` 0) get no QR-bill.
- **QR-bill**: generated from the invoice JSON (creditor/IBAN, amount, currency, reference, debtor) as SVG, using `swissqrbill`. The creditor IBAN comes from Banana (`supplier_info.iban_number`), the creditor address from the `sender` in the user config. With a QR-IBAN (bank number 30000–31999) the bill carries a 27-digit QR reference built exactly like Banana's CH10 layout (customer number padded to 18 digits, invoice number without separators padded to 25, `0`, modulo-10-recursive check digit), so Banana can match payments; customer and invoice numbers must then be at most 7 digits. Banana's optional ISR subscriber number is not supported. With a normal IBAN there is no reference. Labels follow `lang`. It always gets **its own page** after the letter and before the attachment: no page margins, no footer or running header, with the 210 × 105 mm bill flush with the bottom edge. (Decided 2026-11-17: on a shared page the footer's bottom margin would lift the bill off the edge, and CSS paged media can't give a single page a different margin without a page break.)
- **Timesheet attachment** (optional): starts on a new page, after the QR-bill page. Title like "Stundenrapport November 2026 / kibo-physio.ch". One row per entry: date, description, hours; total at the end. No separate billable column (hours and billable hours are the same here).

## Language

- `lang: de | en`, default `de`.
- One translation table holds every fixed label: document types, table headings, total, "Seite x von y" / "Page x of y", attachment title, QR-bill headings.
- Dates and numbers formatted via `Intl` for `de-CH` / `en-CH` (e.g. `11. Dezember 2026`, `CHF 1'234.50`).

## VAT

No VAT (decided 2026-11-17): the business is below the registration threshold. Invoices show no VAT and no subtotal, only line items and the total.

## Banana extension

A Banana Accounting Plus extension of our own, kept in this repo (`banana/`), with two commands:

1. **Export invoice JSON**: writes the selected invoice's Invoice JSON object unchanged to a file.
2. **Export timesheet JSON**: asks for project and period; reads matching rows of the Journal table and writes our own format:

```json
{
  "project": { "id": "KIBO", "description": "kibo-physio.ch" },
  "period": { "start": "2026-11-01", "end": "2026-11-30" },
  "entries": [ { "date": "2026-11-04", "resource": "KM", "notes": "Plugin-Updates", "hours": 1.5 } ],
  "total": 6.5
}
```

Journal column names (`Date`, `Notes`, `ProjectsId`, `ResourcesId`, `TimeDayTotal`, `TimeDueDay`, …) are taken from Banana's own timesheet extension source, not from documentation. Verify them in the real file. How per-project detail rows (`RowType D`) map to entries must be checked too.

## Signature

Optional (`signature: true`), default off. The image is placed above the name in the closing. The image file must not be committed to the repo; the CLI finds it via a user config or environment variable *(builder's call which)*.

## Errors

The CLI exits non-zero with a clear message, and writes no PDF, when:

- a referenced JSON file is missing or invalid
- a required field is missing, a key is unknown, or a directive is unknown
- the address block overflows the window zone
- the configured font is not available (no silent fallback)

## Left to the builder

- Content loader mechanics (how the CLI passes the file path to Astro, e.g. environment variable).
- Where the licensed font (Unica 77 LL) is loaded from; it must not be committed if the license forbids it.
- Exact typographic values, beyond the constraints above.
- Whether to turn on PDF/A or tagged-PDF output if Chromium/Playwright offers it cheaply.
- A `--keep-html` style debug option.

## Verification status

- **Verified (2026-11-17):** Chromium `@page` margin boxes with `counter(page)` / `counter(pages)`, a different first page (`@page :first`, including its own top margin) and a named page without margins (`@page qrbill`). See `tests/print.test.ts`.
- **Open:** envelope window numbers against a real C5 envelope (print `examples/letter.pdf` at 100 %, fold once, check).
- **Open:** Banana Journal column names in a real timesheet file (`banana/net.xeophin.letter.export-timesheet.js`, `COLUMNS`), and both extensions writing files.
