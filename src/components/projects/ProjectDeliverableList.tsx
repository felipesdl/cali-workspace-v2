import { useState, type ReactNode } from 'react';
import type { ProjectDetail } from '../../api/shared/workspace/schemas';
import { Button } from '../ds/button/Button';
import { workspaceLabel } from '../workspace/workspace-labels';

type Row = ProjectDetail['items']['rows'][number];
type Props = {
  rows: Row[];
  grouped: boolean;
  admin: boolean;
  renderRow: (row: Row) => ReactNode;
};

const listStyle = 'tw:grid tw:gap-3';
const rowsStyle = `${listStyle} tw:m-0 tw:min-w-0 tw:list-none tw:p-0 tw:wrap-anywhere`;

export function ProjectDeliverableList({ rows, grouped, admin, renderRow }: Props) {
  const [board, setBoard] = useState(false);
  const showBoard = admin && board;
  if (!grouped) return <ul className={rowsStyle}>{rows.map(renderRow)}</ul>;

  const groups = new Map<string | null, Row[]>();
  for (const row of rows) {
    const key = showBoard ? row.status : (row.workstream_id ?? null);
    const items = groups.get(key);
    if (items) items.push(row);
    else groups.set(key, [row]);
  }
  return (
    <div className={listStyle}>
      {admin && (
        <nav aria-label="Exibição dos entregáveis" className="tw:flex tw:flex-wrap tw:gap-2">
          <Button variant="secondary" aria-pressed={!showBoard} onClick={() => setBoard(false)}>
            Lista
          </Button>
          <Button variant="secondary" aria-pressed={showBoard} onClick={() => setBoard(true)}>
            Kanban
          </Button>
        </nav>
      )}
      <div className={showBoard ? `${listStyle} tw:items-start tw:wide:grid-cols-3` : listStyle}>
        {Array.from(groups, ([key, items]) => (
          <section
            key={key ?? 'unassigned'}
            className="tw:grid tw:min-w-0 tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:p-3 tw:wrap-anywhere"
          >
            <h3 className="tw:font-semibold">
              {showBoard
                ? workspaceLabel(items[0].status)
                : (items[0].workstream_name ??
                  (key ? 'Frente vinculada' : 'Entregáveis sem frente'))}
            </h3>
            <ul className={rowsStyle}>{items.map(renderRow)}</ul>
          </section>
        ))}
      </div>
    </div>
  );
}
