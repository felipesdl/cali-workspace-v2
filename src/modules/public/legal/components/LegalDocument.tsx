/* Mostra um texto jurídico (Política de Privacidade ou Termos de Uso) escrito em markdown simples:
   títulos (#, ##, ###), parágrafos, listas, tabelas e **negrito**. */
import { Fragment, type ReactNode } from 'react';

function stableKeys<T>(values: T[], prefix: string, identity: (value: T) => string) {
  const seen = new Map<string, number>();
  return values.map((value) => {
    const valueIdentity = identity(value);
    const occurrence = seen.get(valueIdentity) ?? 0;
    seen.set(valueIdentity, occurrence + 1);
    return { value, key: `${prefix}-${valueIdentity}-${occurrence}` };
  });
}

function inline(text: string): ReactNode {
  return stableKeys(text.split(/(\*\*[^*]+\*\*)/g), 'part', (part) => part).map(({ value, key }) =>
    value.startsWith('**') && value.endsWith('**') && value.length > 4 ? (
      <strong key={key}>{value.slice(2, -2)}</strong>
    ) : (
      <Fragment key={key}>{value}</Fragment>
    ),
  );
}
const plain = (text: string) => text.replace(/\*\*/g, '').trim();

export function LegalDocument({ source, idPrefix }: { source: string; idPrefix: string }) {
  const lines = source.split('\n');
  const out: ReactNode[] = [];
  const lineKeys = new Map<string, number>();
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const occurrence = lineKeys.get(line) ?? 0;
    lineKeys.set(line, occurrence + 1);
    const key = `${idPrefix}-${line}-${occurrence}`;
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (line.startsWith('### ')) {
      out.push(<h4 key={key}>{plain(line.slice(4))}</h4>);
      index += 1;
      continue;
    }
    if (line.startsWith('## ')) {
      out.push(<h3 key={key}>{plain(line.slice(3))}</h3>);
      index += 1;
      continue;
    }
    if (line.startsWith('# ')) {
      out.push(<h2 key={key}>{plain(line.slice(2)).replace(/^\d+\.\s+/, '')}</h2>);
      index += 1;
      continue;
    }
    if (line.trim().startsWith('|')) {
      const rows: string[][] = [];
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        const cells = lines[index]
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((cell) => cell.trim());
        if (!cells.every((cell) => /^:?-*:?$/.test(cell))) rows.push(cells);
        index += 1;
      }
      const body = rows.filter((row) => row.some(Boolean));
      const [head, ...rest] = body;
      if (!head) continue;
      out.push(
        <div className="v2-legal-table" key={key}>
          <table>
            <thead>
              <tr>
                {stableKeys(head, 'head', (cell) => cell).map(({ value, key: cellKey }) => (
                  <th key={cellKey}>{plain(value)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stableKeys(rest, 'row', (row) => row.join('|')).map(
                ({ value: row, key: rowKey }) => (
                  <tr key={rowKey}>
                    {stableKeys(row, 'cell', (cell) => cell).map(
                      ({ value: cell, key: cellKey }) => (
                        <td key={cellKey}>{inline(cell)}</td>
                      ),
                    )}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*-\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*-\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*-\s+/, ''));
        index += 1;
      }
      out.push(
        <ul key={key}>
          {stableKeys(items, 'item', (item) => item).map(({ value, key: itemKey }) => (
            <li key={itemKey}>{inline(value)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ''));
        index += 1;
      }
      out.push(
        <ol key={key}>
          {stableKeys(items, 'item', (item) => item).map(({ value, key: itemKey }) => (
            <li key={itemKey}>{inline(value)}</li>
          ))}
        </ol>,
      );
      continue;
    }
    out.push(<p key={key}>{inline(line)}</p>);
    index += 1;
  }
  return <article className="v2-legal-doc">{out}</article>;
}
