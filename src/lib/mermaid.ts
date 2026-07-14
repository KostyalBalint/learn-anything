import { createMermaidRenderer } from 'mermaid-isomorphic';

/**
 * One renderer for the whole build: it keeps a single headless Chromium alive
 * across every diagram instead of booting one per call.
 *
 * `rehype-mermaid` handles fenced ```mermaid blocks in MDX, but its rehype pass
 * never sees the output of an .astro component — so <Diagram> renders through
 * the same underlying engine here instead. Both paths produce inline SVG at
 * build time; neither ships client JS.
 */
const render = createMermaidRenderer();

/** Keep this in sync with the `mermaidConfig` passed to rehype-mermaid. */
export const MERMAID_CONFIG = { theme: 'neutral' } as const;

export async function renderMermaid(definition: string): Promise<string> {
  const [result] = await render([definition], { mermaidConfig: MERMAID_CONFIG });
  if (!result || result.status === 'rejected') {
    const reason = result && 'reason' in result ? result.reason : 'unknown error';
    throw new Error(`Mermaid diagram failed to render: ${reason}\n\n${definition}`);
  }
  return result.value.svg;
}
