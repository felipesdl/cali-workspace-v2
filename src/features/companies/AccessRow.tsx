import { useRef, useState } from 'react';
import { type CompanyAccess } from '../../api/modules/companies/schemas';
import { useChangeCompanyAccess } from '../../api/modules/companies/hooks/useCompanyManagement';
import { Button } from '../../components/ds/button/Button';
import { formatCalendarDate } from '../../lib/dates';
import { AccessName } from './AccessName';

export function AccessRow({
  access,
  canAuthorize,
}: {
  access: CompanyAccess;
  canAuthorize: boolean;
}) {
  const [mode, setMode] = useState<{
    kind: 'rename' | 'revoke' | 'reauthorize';
    requestId: string;
    original: CompanyAccess;
  } | null>(null);
  const [notice, setNotice] = useState('');
  const region = useRef<HTMLLIElement>(null);
  const change = useChangeCompanyAccess();
  const finish = (saved: boolean) => {
    setMode(null);
    setNotice(saved ? 'Alteração registrada na demonstração.' : '');
    requestAnimationFrame(() => region.current?.focus());
  };
  const begin = (kind: 'rename' | 'revoke' | 'reauthorize') => {
    change.reset();
    setNotice('');
    setMode({ kind, requestId: crypto.randomUUID(), original: structuredClone(access) });
  };
  async function confirm() {
    if (!mode || mode.kind === 'rename') return;
    const original = mode.original;
    try {
      await change.mutateAsync({
        requestId: mode.requestId,
        companyId: original.companyId,
        accessId: original.id,
        expected: { name: original.name, email: original.email, status: original.status },
        values: { name: original.name, status: mode.kind === 'revoke' ? 'revoked' : 'active' },
      });
      finish(true);
    } catch {
      /* Confirmação permanece visível; não há retry automático. */
    }
  }
  return (
    <li
      ref={region}
      tabIndex={-1}
      className="tw:grid tw:gap-2 tw:border-b tw:border-border-default tw:py-4 tw:wrap-anywhere"
    >
      <strong>{access.name}</strong>
      <div>{access.email}</div>
      <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
        {access.status === 'active' ? 'Autorizado' : 'Revogado'} ·{' '}
        {access.invitedOn
          ? `Convite em ${formatCalendarDate(access.invitedOn)}`
          : 'Convite não enviado'}
      </p>
      {!mode && (
        <div className="tw:flex tw:flex-wrap tw:gap-3">
          <Button
            variant="secondary"
            aria-label={`Editar nome de ${access.email}`}
            onClick={() => begin('rename')}
          >
            Editar nome
          </Button>
          {access.status === 'active' ? (
            <Button
              variant="secondary"
              aria-label={`Revogar acesso de ${access.email}`}
              onClick={() => begin('revoke')}
            >
              Revogar acesso
            </Button>
          ) : (
            <Button
              variant="secondary"
              disabled={!canAuthorize}
              aria-label={`Reautorizar acesso de ${access.email}`}
              onClick={() => begin('reauthorize')}
            >
              Autorizar novamente
            </Button>
          )}
        </div>
      )}
      {mode?.kind === 'rename' && <AccessName access={mode.original} onClose={finish} />}
      {mode && mode.kind !== 'rename' && (
        <div
          role="group"
          aria-label={`Confirmar alteração de ${access.email}`}
          className="tw:grid tw:gap-3"
        >
          <p className="tw:m-0">
            {mode.kind === 'revoke'
              ? 'Revogar esta autorização? Os demais acessos da empresa serão preservados.'
              : 'Autorizar novamente este acesso? Nenhum convite será enviado.'}
          </p>
          {change.isError && <p role="alert">{change.error.message}</p>}
          <div className="tw:flex tw:flex-wrap tw:gap-3">
            <Button autoFocus pending={change.isPending} onClick={() => void confirm()}>
              {mode.kind === 'revoke' ? 'Confirmar revogação' : 'Confirmar reautorização'}
            </Button>
            <Button variant="secondary" disabled={change.isPending} onClick={() => finish(false)}>
              Cancelar alteração
            </Button>
          </div>
        </div>
      )}
      {notice && (
        <p role="status" className="tw:m-0 tw:text-caption">
          {notice}
        </p>
      )}
    </li>
  );
}
