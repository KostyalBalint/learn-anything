// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import pagefind from 'astro-pagefind';
import icon from 'astro-icon';
import tailwindcss from '@tailwindcss/vite';
import rehypeMermaid from 'rehype-mermaid';
import { MERMAID_CONFIG } from './src/lib/mermaid.ts';

// GitHub Pages: https://<user>.github.io/<repo>
// A wrong `base` breaks every asset path AND the Pagefind index fetch.
export default defineConfig({
  site: 'https://kostyalbalint.github.io',
  base: '/learn-anything',
  output: 'static',
  // Icons are inlined as SVG at build time from the local @iconify-json/lucide
  // set — no icon font, no network request, no client JS.
  integrations: [mdx(), react(), icon({ include: { lucide: ['*'] } }), pagefind()],
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    // Handles fenced ```mermaid blocks. The <Diagram> component renders through
    // the same engine (src/lib/mermaid.ts) because a rehype pass never sees the
    // output of an .astro component. Both produce inline SVG at build time
    // (headless Chromium via Playwright), so diagram pages ship zero client JS.
    rehypePlugins: [
      [rehypeMermaid, { strategy: 'inline-svg', mermaidConfig: MERMAID_CONFIG }],
    ],
  },
});
