import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const file = path.join(directory, entry.name);
      return entry.isDirectory() ? markdownFiles(file) : entry.name.endsWith('.md') ? [file] : [];
    }),
  );
  return nested.flat();
}
const files = ['README.md', 'AGENTS.md', ...(await markdownFiles('docs'))];
const failures = [];
let links = 0;
const slug = (heading) =>
  heading
    .replace(/[*`_]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}_\- ]/gu, '')
    .replaceAll(' ', '-');
for (const file of files) {
  const text = await readFile(file, 'utf8');
  if ((text.match(/^```/gm) ?? []).length % 2) failures.push(`${file}: bloco de código aberto`);
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const url = match[1].replace(/^<|>$/g, '');
    if (url.includes('://') || url.startsWith('mailto:')) continue;
    links += 1;
    const [target, anchor] = url.split('#');
    const destination = target ? path.resolve(path.dirname(file), target) : path.resolve(file);
    try {
      await access(destination);
      if (anchor && destination.endsWith('.md')) {
        const content = await readFile(destination, 'utf8');
        const anchors = new Set([
          ...[...content.matchAll(/^#{1,6}\s+(.+)$/gm)].map((heading) => slug(heading[1])),
          ...[...content.matchAll(/<a\s+id=["']([^"']+)/g)].map((item) => item[1]),
        ]);
        if (!anchors.has(anchor)) failures.push(`${file}: âncora inexistente ${url}`);
      }
    } catch {
      failures.push(`${file}: arquivo inexistente ${url}`);
    }
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`${files.length} documentos; ${links} links locais válidos.`);
}
