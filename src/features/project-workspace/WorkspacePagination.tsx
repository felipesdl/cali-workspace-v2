import { Button } from '../../components/ds/button/Button';

export function WorkspacePagination({
  total,
  page,
  change,
}: {
  total: number;
  page: number;
  change: (page: number) => void;
}) {
  const last = Math.max(1, Math.ceil(total / 25));
  if (last === 1 && page === 1) return null;
  return (
    <nav aria-label="Paginação" className="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
      <Button variant="secondary" disabled={page <= 1} onClick={() => change(page - 1)}>
        Anterior
      </Button>
      <span>
        Página {page} de {last}
      </span>
      <Button variant="secondary" disabled={page >= last} onClick={() => change(page + 1)}>
        Próxima
      </Button>
    </nav>
  );
}
