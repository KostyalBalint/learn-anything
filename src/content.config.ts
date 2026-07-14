import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const SUBJECTS_DIR = './src/content/subjects';

/**
 * Pages. One MDX file per page.
 *
 *   subjects/<subject>/01-intro.mdx              → a page directly in the subject
 *   subjects/<subject>/<section>/01-dns.mdx      → a page inside a section
 *
 * The `[^_]*` glob means `_`-prefixed files (like `_meta.yaml`) are never pages.
 * Subject and section are derived from the folders — never declared in frontmatter.
 * Nesting stops at one section deep; anything deeper is skipped with a warning.
 */
const subjects = defineCollection({
  loader: glob({ pattern: '**/[^_]*.mdx', base: SUBJECTS_DIR }),
  schema: z.object({
    title: z.string(),
    /** Canonical ordering within the subject (or within the section). */
    order: z.number(),
    summary: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

/**
 * Folder metadata — one `_meta.yaml` per subject folder, and optionally one per
 * section folder. Which it is comes from its depth, not from a field.
 *
 *   subjects/<subject>/_meta.yaml            → subject metadata
 *   subjects/<subject>/<section>/_meta.yaml  → section metadata
 */
const subjectMeta = defineCollection({
  loader: glob({ pattern: '**/_meta.yaml', base: SUBJECTS_DIR }),
  schema: z.object({
    title: z.string(),
    /** Shown on the home page card. Subjects only; sections ignore it. */
    summary: z.string().default(''),
    /** Ordering among sibling subjects, or among a subject's pages and sections. */
    order: z.number(),
    /** A Lucide icon name, e.g. `ship-wheel`. See https://lucide.dev/icons */
    icon: z.string().default('book-open'),
  }),
});

export const collections = { subjects, subjectMeta };
