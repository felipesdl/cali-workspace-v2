import { useState, type ReactNode } from 'react';
import type { ProjectDetail } from '../../api/modules/project-workspace/schemas';
import { Button } from '../../components/ds/button/Button';
import { workspaceLabel } from './workspace-labels';

type Row = ProjectDetail['items']['rows'][number];
type Props = {
  rows: Row[];
  grouped: boolean;
  admin: boolean;
  renderRow: (row: Row) => ReactNode;
};

const listStyle = 'tw:grid tw:gap-3';

export function ProjectDeliverableList({ rows, grouped, admin, renderRow }: Props) {
  const [board, setBoard] = useState(false);
  const showBoard = admin && board;
  if (!grouped) return <ul className={listStyle}>{rows.map(renderRow)}</ul>;

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
      <div className={showBoard ? 'tw:xl:grid-cols-3 tw:grid tw:items-start tw:gap-3' : listStyle}>
        {Array.from(groups, ([key, items]) => (
          <section
            key={key ?? 'unassigned'}
            className="tw:grid tw:min-w-0 tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:p-3"
          >
            <h3 className="tw:font-semibold">
              {showBoard
                ? workspaceLabel(items[0].status)
                : (items[0].workstream_name ??
                  (key ? 'Frente vinculada' : 'Entregáveis sem frente'))}
            </h3>
            <ul className={listStyle}>{items.map(renderRow)}</ul>
          </section>
        ))}
      </div>
    </div>
  );
}
