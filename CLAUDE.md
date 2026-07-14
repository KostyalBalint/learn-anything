# CLAUDE.md

Personal study site. Static Astro build, deployed to GitHub Pages at
`https://kostyalbalint.github.io/learn-anything/`.

The core rule of this repo: **content drives everything**. Navigation, routes,
the home page and the search index are all derived from the content tree.
Never hand-edit navigation, and never add a route for a new page or subject.

---

## 1. How the project is structured

```
src/
  content/subjects/<subject-slug>/     ← a subject is a FOLDER
    _meta.yaml                         ← subject metadata (not a page)
    01-intro.mdx                       ← a page directly in the subject
    02-....mdx
    <section-slug>/                    ← OPTIONAL: a section is a FOLDER too
      _meta.yaml                       ← section metadata
      01-....mdx                       ← a page inside the section
  content.config.ts                    ← the two collections + frontmatter schema
  lib/nav.ts                           ← buildNav(): the single source of truth for nav
  lib/mermaid.ts                       ← build-time Mermaid renderer (shared engine)
  layouts/PageLayout.astro             ← header + sidebar + <main data-pagefind-body>
  components/                          ← Sidebar, Search, Diagram, Quiz, Flashcard, Simulation, Chart
  pages/
    index.astro                        ← subject cards, from _meta
    [subject]/[...page].astro          ← every content page, via getStaticPaths
astro.config.mjs                       ← site + base (GitHub Pages), integrations
.github/workflows/deploy.yml           ← build + publish to Pages
```

### The content tree

Exactly three levels, no deeper:

```
subject → page
subject → section → page
```

A page nested deeper than one section is **skipped with a `[nav]` warning** — it
won't silently half-work.

| Level | Lives in | Fields |
| --- | --- | --- |
| Subject | `<subject>/_meta.yaml` | `title`, `summary`, `order` (among subjects), `icon` (Lucide name, defaults `book-open`) |
| Section | `<subject>/<section>/_meta.yaml` | `title`, `order`, `icon` (defaults `folder`). `summary` is ignored. |
| Page | MDX frontmatter | `title`, `order`, `summary?`, `draft?` |

Two collections in `src/content.config.ts`:

- `subjects` — the pages. Glob `**/[^_]*.mdx`, so **any file starting with `_` is
  never a page**.
- `subjectMeta` — glob `**/_meta.yaml`. Whether a `_meta.yaml` describes a subject
  or a section comes from its **depth**, not from a field.

Subject and section are **derived from the folder names**, never declared in
frontmatter. A page id is `<subject>/<page>` or `<subject>/<section>/<page>`.

### Navigation

`src/lib/nav.ts` → `buildNav()` returns ordered subjects. Each subject has:

- `items` — its children in display order, each either a page or a section
  (`item.kind`). **Loose pages and sections share one ordering space**, so a
  section can sit between two pages just by choosing an `order` between theirs.
- `pages` — every page in the subject, flattened in display order (used for the
  sidebar count and prev/next).

The sidebar, home page and `getStaticPaths` all read from it — one place,
one ordering. `flatPages()` gives the flat ordered list across all subjects, and
tags each page with its `subject` and (if any) `section`.

Ordering: the `order` field is canonical. The filename numeric prefix (`01-`) is
a human aid and only a tiebreaker.

Missing `_meta.yaml` never breaks the build: a subject or section without one
falls back to a titleized folder name, sorts last, and (for subjects) logs a
`[nav]` warning.

### Search

Pagefind, via `astro-pagefind`. The index is written to `dist/pagefind/` during
`astro build` — no separate step. Only `<main data-pagefind-body>` in
`PageLayout.astro` is indexed; header, sidebar and pagination carry
`data-pagefind-ignore` so nav text stays out of results.

**Search only works in a production build** (`npm run build && npm run preview`),
never in `astro dev`.

### Deployment

`astro.config.mjs` sets `site: 'https://kostyalbalint.github.io'` and
`base: '/learn-anything'`. A wrong `base` breaks every asset path *and*
Pagefind's index fetch. Build all internal links through `withBase()` from
`src/lib/nav.ts` — never hard-code `/learn-anything/...`.

---

## 2. How to add a new subject

**One new folder. Nothing else.** No config edit, no route, no nav entry.

```
src/content/subjects/databases/
  _meta.yaml
  01-intro.mdx
  02-indexes.mdx
```

`_meta.yaml`:

```yaml
title: Databases
summary: One line — shown on the home page card.
order: 2          # position among subjects (kubernetes is 1)
icon: database    # any Lucide icon name — https://lucide.dev/icons
```

### Adding a section inside a subject

A section is just a folder inside the subject, with its own `_meta.yaml`. It adds
one collapsible level to the sidebar. Optional — a subject with only loose pages
is perfectly fine.

```
src/content/subjects/kubernetes/
  _meta.yaml
  01-architecture.mdx        order: 1
  02-workloads.mdx           order: 2
  03-scaling.mdx             order: 3
  networking/                ← section
    _meta.yaml               order: 4   ← same ordering space as the pages above
    01-services.mdx          order: 1   ← ordering restarts inside the section
    02-dns.mdx               order: 2
```

Section `_meta.yaml` — same shape as a subject's, minus `summary`:

```yaml
title: Networking
order: 4          # where the section sits among the subject's pages
icon: network     # optional, defaults to `folder`
```

Two things to know:

- **Pages and sections share one ordering space.** The section above has
  `order: 4`, so it lands after `03-scaling`. Give it `order: 2` and it would sit
  between `01-architecture` and `02-workloads`. Page `order` restarts at 1 inside
  a section.
- **Sections do not nest.** A page may sit in a subject or in one section, no
  deeper. A deeper file is skipped at build with a `[nav]` warning naming it.

Routes follow the folders: `/learn-anything/kubernetes/networking/01-services/`.
Prev/next threads through the whole subject in display order, crossing into and
out of sections. Copy `src/content/subjects/kubernetes/networking/` as the
worked example.

Note the deeper relative import path from inside a section:
`../../../../components/Quiz` (four levels, not three).

### Icons

No emoji anywhere. Icons come from the local `@iconify-json/lucide` set via
`astro-icon`, inlined as SVG at build time (no icon font, no network fetch, no
client JS):

```astro
import { Icon } from 'astro-icon/components';
<Icon name="lucide:ship-wheel" class="size-4" />
```

`<Icon>` only works in `.astro` files. React islands use the hand-rolled Lucide
glyphs in `src/components/icons.tsx` — add to that file rather than pulling in a
React icon package.

Each page, e.g. `01-intro.mdx`:

```mdx
---
title: How packets find a Pod
order: 1                      # canonical ordering within the subject
summary: Optional one-liner.  # optional
draft: false                  # optional — drafts show in dev, excluded from build
---

Prose here. Markdown works as normal.
```

Then `npm run dev` — the subject appears on the home page and in the sidebar,
and its pages are routed at `/learn-anything/networking/01-intro/`.

**Adding a page to an existing subject is the same, minus the folder and
`_meta.yaml`:** drop one MDX file in, pick an `order`, done.

Copy `src/content/subjects/kubernetes/` as the worked example — it exercises
every component.

### Using components in a page

Import from `src/components/` with a relative path (`../../../components/…`).
React islands **must** be hydrated with `client:visible`, so their JS only loads
on pages that use them.

```mdx
import Diagram from '../../../components/Diagram.astro';
import Chart from '../../../components/Chart';
import Quiz from '../../../components/Quiz';
import Flashcard from '../../../components/Flashcard';
import Simulation from '../../../components/Simulation';
```

| Component | Notes |
| --- | --- |
| `<Diagram chart={\`flowchart LR ...\`} caption="..." />` | Mermaid → inline SVG **at build time**. No `client:` directive; ships zero JS. |
| `<Chart client:visible type="line\|bar\|area" data={…} xKey="x" series={[{ key, label }]} />` | Recharts wrapper. Colors come from CSS vars, so it follows dark mode. |
| `<Quiz client:visible questions={[{ q, options, answer, explain }]} />` | `answer` is an index into `options`. |
| `<Flashcard client:visible cards={[{ front, back }]} />` | Also accepts a single `front`/`back`. |
| `<Simulation client:visible model="hpa" />` | Sliders → recomputed readouts + chart. |

### Three traps

1. **Mermaid must be a prop, not slot content.** `<Diagram chart={\`...\`} />`.
   Slot content is HTML-escaped, which turns `-->` into `--&gt;` and the Mermaid
   parser dies at build time.
2. **`<Simulation>` picks a model by name.** Props crossing an island boundary
   must be serializable, so a `compute` function cannot be passed from MDX. Add
   new models to the `MODELS` map in `src/components/Simulation.tsx`, then use
   `model="your-key"`.
3. **Static chart data is computed at build time, not in the browser.** Export it
   from the MDX module body and pass the result as props — see
   `02-workloads.mdx`:

   ```mdx
   export const rollout = (() => { /* runs during astro build */ })();

   <Chart client:visible type="area" data={rollout} xKey="step" series={[…]} />
   ```

---

## Commands

```bash
npm run dev                        # dev server (no search index)
npm run build                      # static build + Pagefind index
npm run preview                    # serve the build — the only way to test search
npm run check                      # astro check (types)
npx playwright install chromium    # once — Mermaid renders in a headless browser
```
