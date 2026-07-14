# learn-anything

A personal study site. Subjects are folders; pages are MDX files. Navigation,
search and routing are all derived from the content tree — there is no nav file
to edit, ever.

Astro (static) · MDX · Tailwind v4 · React islands · Recharts · Mermaid · Lucide icons · Pagefind · GitHub Pages.

## Run locally

```bash
npm install
npx playwright install chromium   # once — Mermaid renders diagrams in a headless browser at build time
npm run dev                       # http://localhost:4321/learn-anything/
npm run build && npm run preview  # production build; the only way to test search
```

## Add a page

Drop one MDX file into a subject folder. Nothing else.

```mdx
---
title: Services and networking   # required
order: 4                         # required — canonical ordering within the subject
summary: How a Service IP finds a Pod.   # optional
draft: false                     # optional — drafts show in dev, are excluded from builds
---

Prose goes here.
```

The filename prefix (`04-`) is only a hint to humans and a tiebreaker; `order` is
what actually sorts the sidebar.

## Add a subject

Create one folder under `src/content/subjects/` with a `_meta.yaml` and its pages:

```
src/content/subjects/networking/
  _meta.yaml
  01-intro.mdx
  02-services.mdx
```

```yaml
# _meta.yaml
title: Networking
summary: One line, shown on the home page card.
order: 2          # position among subjects
icon: network     # Lucide icon name (https://lucide.dev/icons), defaults to book-open
```

Icons are Lucide, inlined as SVG at build time by `astro-icon` from the local
`@iconify-json/lucide` set. In `.astro` files use
`<Icon name="lucide:ship-wheel" />`; React islands use the glyphs in
`src/components/icons.tsx`.

Files starting with `_` are never treated as pages. If you forget `_meta.yaml`
the build still works — the subject falls back to a titleized folder name and
sorts last, with a warning.

## Add a section (optional)

A subject can group pages into sections. A section is a folder inside the
subject with its own `_meta.yaml`, and it adds one collapsible level to the
sidebar:

```
src/content/subjects/kubernetes/
  _meta.yaml
  01-architecture.mdx     order: 1
  02-workloads.mdx        order: 2
  03-scaling.mdx          order: 3
  networking/             ← section
    _meta.yaml            order: 4   ← same ordering space as the pages above
    01-services.mdx       order: 1   ← ordering restarts inside the section
    02-dns.mdx            order: 2
```

```yaml
# networking/_meta.yaml — like a subject's, minus summary
title: Networking
order: 4
icon: network     # optional, defaults to `folder`
```

Pages and sections share one ordering space, so a section can sit between two
loose pages just by picking an `order` between theirs. Routes follow the folders
(`/kubernetes/networking/01-services/`), and prev/next threads through the whole
subject, crossing into and out of sections.

**Sections do not nest.** A page lives in a subject or in one section, no deeper;
a deeper file is skipped at build with a warning naming it. Imports from inside a
section go up one more level: `../../../../components/Quiz`.

Copy `src/content/subjects/kubernetes/` as a worked example: it uses prose, a
Mermaid diagram, a build-time-computed chart, a flashcard deck, a slider
simulation and a quiz.

## Components

Import from `src/components/` in any MDX file. React islands must be hydrated —
use `client:visible` so their JS only loads on pages that use them.

| Component | Usage |
| --- | --- |
| `<Quiz client:visible questions={[{ q, options, answer, explain }]} />` | Multiple choice, tracks score. |
| `<Flashcard client:visible cards={[{ front, back }]} />` | Click or Enter to flip. Also takes a single `front`/`back`. |
| `<Simulation client:visible model="hpa" />` | Sliders → recomputed readouts + chart. Models live in `Simulation.tsx` (props crossing an island boundary can't be functions, so a page picks a model by name). |
| `<Chart client:visible type="line\|bar\|area" data={…} xKey series={[{ key, label }]} />` | Recharts wrapper. |
| `<Diagram chart={\`flowchart LR …\`} />` | Mermaid → inline SVG **at build time**. No `client:` directive; ships zero JS. |

Mermaid definitions must be passed as the `chart` prop, not as slot content —
slot content is HTML-escaped, which mangles `-->` arrows.

**Charts with static data: compute at build time.** Export the data from the MDX
module body and pass the result in as props, so no arithmetic ships to the
browser — see `02-workloads.mdx`:

```mdx
export const rollout = (() => { /* runs during astro build */ })();

<Chart client:visible type="area" data={rollout} xKey="step" series={[…]} />
```

## Search

Pagefind, indexed at build time by the `astro-pagefind` integration. Press
**Cmd/Ctrl+K** anywhere.

**Search only works in a production build.** `astro dev` never generates an
index, so the search box will find nothing there:

```bash
npm run build && npm run preview
```

Only `<main data-pagefind-body>` in `PageLayout.astro` is indexed; the header,
sidebar and pagination carry `data-pagefind-ignore`, so nav text stays out of
results. Results link straight to the page (and to the nearest heading anchor).

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` builds on every push to `main` and publishes with
`actions/deploy-pages`. `astro build` writes the Pagefind index into
`dist/pagefind/` itself, so there is no separate index step.

`astro.config.mjs` pins the Pages URL:

```js
site: 'https://kostyalbalint.github.io',
base: '/learn-anything',
```

A wrong `base` breaks every asset path *and* Pagefind's index fetch. If the repo
is renamed, change `base` to match.

**One manual step:** in the repo, go to **Settings → Pages → Build and
deployment → Source: GitHub Actions**. Without it the workflow builds but has
nowhere to publish.
