import { useRef, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { type CompanyAccess } from '../../api/modules/companies/schemas';
import { companyAccessFieldsSchema } from '../../api/modules/companies/management-schemas';
import {
  useAddCompanyAccess,
  useChangeCompanyAccess,
  useCompanyAdhesions,
  useCompanyAccessHistory,
} from '../../api/modules/companies/hooks/useCompanyManagement';
import { useCompanyQuery } from '../../api/modules/companies/hooks/useCompanyQuery';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';
import { formatCalendarDate, formatServerInstant } from '../../lib/dates';

function NewAccess({
  companyId,
  onClose,
}: {
  companyId: string;
  onClose: (saved: boolean) => void;
}) {
  const [requestId] = useState(() => crypto.randomUUID());
  const add = useAddCompanyAccess();
  const form = useForm({
    defaultValues: { name: '', email: '' },
    validators: { onChange: companyAccessFieldsSchema, onSubmit: companyAccessFieldsSchema },
    onSubmit: async ({ value }) => {
      try {
        await add.mutateAsync({ requestId, companyId, values: value });
        onClose(true);
      } catch {
        /* Preserva rascunho; a fronteira de dados verifica adesão/limite novamente. */
      }
    },
  });
  return (
    <form
      aria-label="Autorizar acesso"
      className="tw:my-4 tw:grid tw:gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <div className="tw:grid tw:grid-cols-2 tw:gap-4 tw:mobile:grid-cols-1">
        {(
          [
            ['name', 'Nome da pessoa'],
            ['email', 'E-mail do acesso'],
          ] as const
        ).map(([name, label]) => (
          <form.Field key={name} name={name}>
            {(field) => {
              const error = field.state.meta.errors[0]?.message;
              const id = `new-access-${name}`;
              return (
                <Field id={id} label={label} error={error}>
                  <input
                    id={id}
                    type={name === 'email' ? 'email' : 'text'}
                    autoFocus={name === 'name'}
                    required
                    autoComplete="off"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    disabled={add.isPending}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${id}-error` : undefined}
                  />
                </Field>
              );
            }}
          </form.Field>
        ))}
      </div>
      {add.isError && <p role="alert">{add.error.message}</p>}
      <div className="tw:flex tw:flex-wrap tw:gap-3">
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
          {([canSubmit, submitting]) => (
            <Button type="submit" disabled={!canSubmit} pending={submitting || add.isPending}>
              Confirmar autorização
            </Button>
          )}
        </form.Subscribe>
        <Button variant="secondary" disabled={add.isPending} onClick={() => onClose(false)}>
          Cancelar autorização
        </Button>
      </div>
    </form>
  );
}
function AccessName({
  access,
  onClose,
}: {
  access: CompanyAccess;
  onClose: (saved: boolean) => void;
}) {
  const [original] = useState(() => structuredClone(access));
  const [requestId] = useState(() => crypto.randomUUID());
  const change = useChangeCompanyAccess();
  const form = useForm({
    defaultValues: { name: original.name },
    validators: {
      onChange: companyAccessFieldsSchema.pick({ name: true }),
      onSubmit: companyAccessFieldsSchema.pick({ name: true }),
    },
    onSubmit: async ({ value }) => {
      try {
        await change.mutateAsync({
          requestId,
          companyId: original.companyId,
          accessId: original.id,
          expected: { name: original.name, email: original.email, status: original.status },
          values: { name: value.name, status: original.status },
        });
        onClose(true);
      } catch {
        /* Não substitui rascunho após erro ou conflito. */
      }
    },
  });
  return (
    <form
      aria-label={`Editar nome de ${access.email}`}
      className="tw:mt-3 tw:grid tw:gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Field name="name">
        {(field) => {
          const id = `access-name-${access.id}`;
          const error = field.state.meta.errors[0]?.message;
          return (
            <Field id={id} label="Nome do acesso" error={error}>
              <input
                id={id}
                autoFocus
                required
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                disabled={change.isPending}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${id}-error` : undefined}
              />
            </Field>
          );
        }}
      </form.Field>
      {change.isError && <p role="alert">{change.error.message}</p>}
      <div className="tw:flex tw:flex-wrap tw:gap-3">
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
          {([canSubmit, submitting]) => (
            <Button type="submit" disabled={!canSubmit} pending={submitting || change.isPending}>
              Salvar nome
            </Button>
          )}
        </form.Subscribe>
        <Button variant="secondary" disabled={change.isPending} onClick={() => onClose(false)}>
          Cancelar nome
        </Button>
      </div>
    </form>
  );
}
function AccessRow({ access, canAuthorize }: { access: CompanyAccess; canAuthorize: boolean }) {
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
const actionLabels = {
  authorized: 'Autorização registrada',
  renamed: 'Nome alterado',
  revoked: 'Autorização revogada',
  reauthorized: 'Autorização restabelecida',
} as const;
function AccessHistory({ companyId }: { companyId: string }) {
  const history = useCompanyAccessHistory(companyId);
  return (
    <details className="tw:mt-5">
      <summary className="tw:cursor-pointer tw:font-semibold tw:text-brand">
        Histórico dos acessos
      </summary>
      {history.isPending && <p role="status">Carregando histórico…</p>}
      {history.isError && (
        <div role="alert">
          <p>Não foi possível carregar o histórico.</p>
          <Button variant="secondary" onClick={() => void history.refetch()}>
            Recarregar histórico
          </Button>
        </div>
      )}
      {history.isSuccess &&
        (history.data.length === 0 ? (
          <p>Nenhuma alteração registrada nesta demonstração.</p>
        ) : (
          <ol className="tw:grid tw:gap-3 tw:pl-5 tw:[&_li]:wrap-anywhere">
            {[...history.data].reverse().map((item) => (
              <li key={item.id}>
                <strong>
                  {actionLabels[item.action]} · {item.current.name}
                </strong>
                <div>{item.current.email}</div>
                {item.action === 'renamed' && item.previous && (
                  <div>Nome anterior: {item.previous.name}</div>
                )}
                <div className="tw:text-caption tw:text-muted-copy">
                  Admin demonstrativo · {formatServerInstant(item.recordedAt)}
                </div>
              </li>
            ))}
          </ol>
        ))}
    </details>
  );
}
export function CompanyAccessManagement({
  companyId,
  accesses,
}: {
  companyId: string;
  accesses: CompanyAccess[];
}) {
  const adhesions = useCompanyAdhesions(companyId);
  const company = useCompanyQuery(companyId);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState('');
  const usage = useRef<HTMLParagraphElement>(null);
  const activeCount = accesses.filter((item) => item.status === 'active').length;
  const hasAdhesion = adhesions.isSuccess && adhesions.data.length > 0;
  const companyEligible = company.isSuccess && ['active', 'paused'].includes(company.data.status);
  const canAuthorize = hasAdhesion && companyEligible && activeCount < 4;
  return (
    <div>
      <p id="access-usage" ref={usage} tabIndex={-1} className="tw:font-semibold">
        {activeCount} de 4 autorizações utilizadas
      </p>
      {adhesions.isPending && <p role="status">Confirmando a adesão…</p>}
      {adhesions.isError && (
        <p role="alert">Não foi possível confirmar a adesão para novas autorizações.</p>
      )}
      {adhesions.isSuccess && !hasAdhesion && (
        <p>Novas autorizações exigem o registro da adesão desta empresa.</p>
      )}
      {company.isError && <p role="alert">Não foi possível confirmar a situação da empresa.</p>}
      {company.isSuccess && !companyEligible && (
        <p>Não é possível autorizar novos acessos enquanto a empresa estiver indisponível.</p>
      )}
      {activeCount >= 4 && (
        <p>Limite de quatro acessos atingido. Revogue um acesso para disponibilizar uma vaga.</p>
      )}
      <Button
        variant="secondary"
        disabled={!canAuthorize || adding}
        onClick={() => {
          setNotice('');
          setAdding(true);
        }}
      >
        Adicionar acesso
      </Button>
      {adding && (
        <NewAccess
          companyId={companyId}
          onClose={(saved) => {
            setAdding(false);
            setNotice(
              saved ? 'Autorização registrada na demonstração. Nenhum convite foi enviado.' : '',
            );
            requestAnimationFrame(() => usage.current?.focus());
          }}
        />
      )}
      {notice && <p role="status">{notice}</p>}
      {accesses.length === 0 ? (
        <p>Nenhum acesso nesta empresa.</p>
      ) : (
        <ul className="tw:m-0 tw:mt-4 tw:list-none tw:p-0">
          {accesses.map((access) => (
            <AccessRow key={access.id} access={access} canAuthorize={canAuthorize} />
          ))}
        </ul>
      )}
      <AccessHistory companyId={companyId} />
    </div>
  );
}
