import { getCollection, type CollectionEntry } from 'astro:content';

export type NavPage = {
  kind: 'page';
  /** Page path within the subject: `01-intro`, or `networking/01-dns` inside a section. */
  slug: string;
  href: string;
  title: string;
  order: number;
  summary?: string;
  entry: CollectionEntry<'subjects'>;
};

export type NavSection = {
  kind: 'section';
  /** Folder name, e.g. `networking`. */
  slug: string;
  title: string;
  /** Lucide icon name. */
  icon: string;
  order: number;
  pages: NavPage[];
};

/** A subject's children, in display order: loose pages and sections, interleaved. */
export type NavItem = NavPage | NavSection;

export type NavSubject = {
  /** Folder name, e.g. `kubernetes`. */
  slug: string;
  /** Link to the subject's first page. */
  href: string;
  title: string;
  summary: string;
  /** Lucide icon name. */
  icon: string;
  order: number;
  items: NavItem[];
  /** Every page in the subject, flattened in display order. */
  pages: NavPage[];
};

/**
 * Join path segments onto the configured `base`. Routes get a trailing slash;
 * files (anything with an extension, e.g. favicon.svg) must not.
 */
export function withBase(...segments: string[]): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const path = segments
    .map((s) => s.replace(/^\/|\/$/g, ''))
    .filter(Boolean)
    .join('/');
  if (!path) return `${base}/`;
  const isFile = /\.[a-z0-9]+$/i.test(path);
  return isFile ? `${base}/${path}` : `${base}/${path}/`;
}

function titleize(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** `order` is canonical; the filename prefix only breaks ties. */
function byOrder(a: { order: number; slug: string }, b: { order: number; slug: string }) {
  return a.order - b.order || a.slug.localeCompare(b.slug);
}

let cached: NavSubject[] | undefined;

/**
 * The single source of truth for navigation: sidebar, home page and
 * `getStaticPaths` all read from here. Nothing is hand-maintained.
 *
 * The tree is exactly two levels deep inside a subject:
 *   subject → page
 *   subject → section → page
 */
export async function buildNav(): Promise<NavSubject[]> {
  if (cached) return cached;

  const entries = await getCollection('subjects', ({ data }) => !data.draft || import.meta.env.DEV);
  const metas = await getCollection('subjectMeta');

  // `kubernetes/_meta` → `kubernetes`; `kubernetes/networking/_meta` → `kubernetes/networking`.
  const metaByFolder = new Map(metas.map((m) => [m.id.replace(/\/_meta$/, ''), m.data]));

  type Draft = { pages: NavPage[]; sections: Map<string, NavPage[]> };
  const drafts = new Map<string, Draft>();
  const draftFor = (subject: string) => {
    let d = drafts.get(subject);
    if (!d) drafts.set(subject, (d = { pages: [], sections: new Map() }));
    return d;
  };

  for (const entry of entries) {
    const parts = entry.id.split('/');

    if (parts.length < 2) {
      console.warn(
        `[nav] "${entry.id}.mdx" sits at the root of src/content/subjects/ — pages must live in a subject folder. Skipped.`,
      );
      continue;
    }
    if (parts.length > 3) {
      console.warn(
        `[nav] "${entry.id}.mdx" is nested too deep — a page may sit in a subject or in one section, no further. Skipped.`,
      );
      continue;
    }

    const [subject] = parts as [string, ...string[]];
    const slug = parts.slice(1).join('/');
    const page: NavPage = {
      kind: 'page',
      slug,
      href: withBase(subject, slug),
      title: entry.data.title,
      order: entry.data.order,
      summary: entry.data.summary,
      entry,
    };

    const draft = draftFor(subject);
    if (parts.length === 2) {
      draft.pages.push(page);
    } else {
      const section = parts[1]!;
      const list = draft.sections.get(section) ?? [];
      list.push(page);
      draft.sections.set(section, list);
    }
  }

  const subjects: NavSubject[] = [...drafts.entries()].map(([slug, draft]) => {
    const meta = metaByFolder.get(slug);
    if (!meta) {
      console.warn(
        `[nav] subject "${slug}" has no _meta.yaml — falling back to defaults. ` +
          `Add src/content/subjects/${slug}/_meta.yaml with title, summary, order.`,
      );
    }

    const sections: NavSection[] = [...draft.sections.entries()].map(([sectionSlug, pages]) => {
      const sectionMeta = metaByFolder.get(`${slug}/${sectionSlug}`);
      const sectionPages = pages.sort(byOrder);
      return {
        kind: 'section',
        slug: sectionSlug,
        title: sectionMeta?.title ?? titleize(sectionSlug),
        icon: sectionMeta?.icon ?? 'folder',
        // A section with no _meta.yaml sorts after everything with one.
        order: sectionMeta?.order ?? 999,
        pages: sectionPages,
      };
    });

    // Pages and sections share one ordering space, so a section can sit between
    // two loose pages just by picking an `order` between theirs.
    const items: NavItem[] = [...draft.pages, ...sections].sort(byOrder);
    const pages = items.flatMap((item) => (item.kind === 'page' ? [item] : item.pages));

    return {
      slug,
      href: pages[0]?.href ?? withBase(slug),
      title: meta?.title ?? titleize(slug),
      summary: meta?.summary ?? '',
      icon: meta?.icon ?? 'book-open',
      order: meta?.order ?? 999,
      items,
      pages,
    };
  });

  cached = subjects.sort(byOrder);
  return cached;
}

/** Flat, ordered list of every page — used for routing and prev/next links. */
export async function flatPages(): Promise<Array<NavPage & { subject: NavSubject; section?: NavSection }>> {
  const nav = await buildNav();
  return nav.flatMap((subject) =>
    subject.items.flatMap((item) =>
      item.kind === 'page'
        ? [{ ...item, subject }]
        : item.pages.map((page) => ({ ...page, subject, section: item })),
    ),
  );
}
