#!/usr/bin/env node

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';

const API_URL = 'https://figpad.ai/api/gallery';
const INSPIRATION_URL = 'https://figpad.ai/inspiration';
const ROOT = new URL('..', import.meta.url).pathname;
const SYNC_DATE = process.env.SYNC_DATE || new Date().toISOString().slice(0, 10);

const CATEGORY_LABELS = {
  'mechanisms-pathways': 'Mechanisms & Pathways',
  'process-workflow': 'Process & Workflow',
  'graphical-abstracts': 'Graphical Abstracts',
  'lab-apparatus': 'Lab Apparatus',
  'micro-structures': 'Micro Structures',
  'systems-networks': 'Systems & Networks',
  'journal-covers': 'Journal Covers',
  'cross-sections-layers': 'Cross-Sections & Layers',
  'environments-ecologies': 'Environments & Ecologies',
};

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

function byCategoryThenOrder(a, b) {
  const categoryDelta =
    CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
  if (categoryDelta !== 0) return categoryDelta;
  if ((a.sortOrder ?? 0) !== (b.sortOrder ?? 0)) {
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  }
  return String(a.id).localeCompare(String(b.id));
}

function asSlug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function shortId(id) {
  return String(id).replace(/-/g, '').slice(0, 8);
}

function imageExtension(url, contentType) {
  const fromPath = extname(new URL(url).pathname).toLowerCase();
  if (fromPath && fromPath.length <= 6) return fromPath;
  if (contentType?.includes('jpeg')) return '.jpg';
  if (contentType?.includes('webp')) return '.webp';
  if (contentType?.includes('png')) return '.png';
  return '.png';
}

function titleFromPrompt(prompt) {
  const firstLine = String(prompt || '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) return 'Untitled research figure';

  const cleaned = firstLine
    .replace(/^Create a scientific figure about:\s*/i, '')
    .replace(/^Create a graphical abstract for\s*/i, '')
    .replace(/^Create a technical cutaway diagram of\s*/i, '')
    .replace(/^Create an?\s*/i, '')
    .replace(/\.$/, '')
    .trim();

  return cleaned.length > 120 ? `${cleaned.slice(0, 117).trim()}...` : cleaned;
}

function markdownFence(text) {
  const value = String(text || '').trim();
  const fence = value.includes('```') ? '````' : '```';
  return `${fence}text\n${value}\n${fence}`;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText} ${url}`);
  }
  return response.json();
}

async function fetchAllItems() {
  const items = [];
  let cursor = null;

  do {
    const url = new URL(API_URL);
    url.searchParams.set('category', 'all');
    url.searchParams.set('limit', '200');
    url.searchParams.set('includePrompt', 'true');
    if (cursor) url.searchParams.set('cursor', cursor);

    const payload = await fetchJson(url);
    if (payload.code !== 0) {
      throw new Error(`FigPad API returned code ${payload.code}: ${payload.message}`);
    }

    items.push(...payload.data);
    cursor = payload.meta?.nextCursor || null;
  } while (cursor);

  return items.sort(byCategoryThenOrder);
}

async function downloadImage(url, outputPath) {
  try {
    const existing = await readFile(outputPath);
    if (existing.length > 0) return;
  } catch {
    // Missing files are expected on the first sync.
  }

  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Image download failed: ${response.status} ${response.statusText} ${url}`);
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await pipeline(response.body, createWriteStream(outputPath));
}

function normalizeItems(items) {
  return items.map((item, index) => {
    const title = titleFromPrompt(item.prompt);
    const number = String(item.sortOrder ?? index + 1).padStart(3, '0');
    const fileBase = `${number}-${asSlug(title) || shortId(item.id)}-${shortId(item.id)}`;
    const ext = imageExtension(item.imageUrl, item.contentType);
    const imagePath = `images/${item.category}/${fileBase}${ext}`;

    return {
      id: item.id,
      category: item.category,
      categoryLabel: CATEGORY_LABELS[item.category] || item.category,
      title,
      prompt: item.prompt,
      image: imagePath,
      sourceImageUrl: item.imageUrl,
      sourceThumbnailUrl: item.thumbnailUrl,
      aspectRatio: item.aspectRatio || null,
      sortOrder: item.sortOrder ?? null,
      source: INSPIRATION_URL,
    };
  });
}

function categoryCounts(items) {
  return CATEGORY_ORDER.map((slug) => ({
    slug,
    label: CATEGORY_LABELS[slug],
    count: items.filter((item) => item.category === slug).length,
    file: `categories/${slug}.md`,
  })).filter((category) => category.count > 0);
}

function renderReadme(items, categories) {
  const total = items.length;
  const categoryTable = categories
    .map(
      (category) =>
        `| ${category.label} | ${category.count} | [Browse](${category.file}) |`
    )
    .join('\n');

  const gallery = categories
    .map((category) => {
      const samples = items.filter((item) => item.category === category.slug).slice(0, 3);
      const cells = samples
        .map(
          (item) =>
            `<a href="${category.file}#${asSlug(item.title)}"><img src="${item.image}" width="240" alt="${item.title}"></a>`
        )
        .join(' ');
      return `### ${category.label}\n\n${cells}\n\n[See all ${category.count} prompts ->](${category.file})`;
    })
    .join('\n\n');

  return `# Awesome Research Figure Prompts [![Awesome](https://awesome.re/badge.svg)](https://awesome.re)

<div align="center">

[![License: CC0](https://img.shields.io/badge/License-CC0_1.0-lightgrey.svg)](LICENSE)
[![Prompts](https://img.shields.io/badge/Prompts-${total}_Research_Figures-111111)](README.md)
[![Categories](https://img.shields.io/badge/Categories-${categories.length}_Scientific_Styles-2f6f7e)](README.md)
[![Source](https://img.shields.io/badge/Source-FigPad_Inspiration-3b82f6)](${INSPIRATION_URL})

</div>

A curated collection of publication-ready AI prompts and output images for research figures, scientific diagrams, graphical abstracts, lab apparatus, microstructures, systems, journal covers, cross-sections, and ecological visuals.

The image and prompt records in this repository were synced from the public [FigPad inspiration library](${INSPIRATION_URL}) on ${SYNC_DATE}.

## Contents

- [Categories](#categories)
- [Gallery Preview](#gallery-preview)
- [Repository Layout](#repository-layout)
- [How to Use](#how-to-use)
- [Sync](#sync)
- [License](#license)

## Categories

| Category | Prompts | Collection |
| :-- | --: | :-- |
${categoryTable}

## Gallery Preview

${gallery}

## Repository Layout

- \`images/<category>/\` stores the downloaded figure images.
- \`categories/<category>.md\` contains every image and prompt in that category.
- \`data/inspirations.json\` is the complete machine-readable dataset.
- \`data/categories.json\` contains the category list and counts.
- \`scripts/sync-figpad-inspiration.mjs\` can refresh the static files from FigPad.

## How to Use

Browse a category, pick a figure close to the scientific story you want to tell, then copy and adapt the prompt. Most prompts are intentionally specific: replace the subject, organism, pathway, instrument, or material while keeping the layout, labeling, and visual-quality constraints.

## Sync

\`\`\`bash
node scripts/sync-figpad-inspiration.mjs
\`\`\`

The sync script downloads current FigPad inspiration items, writes JSON metadata, regenerates category pages, and updates this README.

## License

The repository license is [CC0 1.0 Universal](LICENSE). The source inspiration library is FigPad; verify redistribution rights for generated images before publishing mirrors outside your own projects.
`;
}

function renderCategoryPage(category, items) {
  const entries = items.filter((item) => item.category === category.slug);
  const body = entries
    .map((item, index) => {
      const caseNumber = String(index + 1).padStart(3, '0');
      return `## ${item.title}

![${item.title}](../${item.image})

**Prompt**

${markdownFence(item.prompt)}

**Metadata**

| Field | Value |
| :-- | :-- |
| ID | \`${item.id}\` |
| Category | ${item.categoryLabel} |
| Aspect ratio | ${item.aspectRatio || 'Unknown'} |
| Source image | [Open original](${item.sourceImageUrl}) |

`;
    })
    .join('\n');

  return `# ${category.label}

[Back to README](../README.md)

${entries.length} research figure prompts synced from [FigPad inspiration](${INSPIRATION_URL}).

${body}`;
}

async function main() {
  const rawItems = await fetchAllItems();
  const items = normalizeItems(rawItems);
  const categories = categoryCounts(items);

  await rm(join(ROOT, 'images'), { recursive: true, force: true });
  await rm(join(ROOT, 'categories'), { recursive: true, force: true });
  await rm(join(ROOT, 'data'), { recursive: true, force: true });

  await mkdir(join(ROOT, 'images'), { recursive: true });
  await mkdir(join(ROOT, 'categories'), { recursive: true });
  await mkdir(join(ROOT, 'data'), { recursive: true });

  for (const item of items) {
    const outputPath = join(ROOT, item.image);
    process.stdout.write(`Downloading ${basename(outputPath)}\n`);
    await downloadImage(item.sourceImageUrl, outputPath);
  }

  await writeFile(
    join(ROOT, 'data', 'inspirations.json'),
    `${JSON.stringify(
      {
        source: INSPIRATION_URL,
        syncedAt: SYNC_DATE,
        total: items.length,
        items,
      },
      null,
      2
    )}\n`
  );

  await writeFile(
    join(ROOT, 'data', 'categories.json'),
    `${JSON.stringify(
      {
        source: INSPIRATION_URL,
        syncedAt: SYNC_DATE,
        total: categories.length,
        categories,
      },
      null,
      2
    )}\n`
  );

  for (const category of categories) {
    await writeFile(
      join(ROOT, category.file),
      renderCategoryPage(category, items)
    );
  }

  await writeFile(join(ROOT, 'README.md'), renderReadme(items, categories));

  process.stdout.write(
    `Done. Synced ${items.length} items across ${categories.length} categories.\n`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
