import { FeedbackMessage } from '../../../../components/ds/feedback/FeedbackMessage';
import { Input, Select, TextArea } from '../../../../components/ds/field/Controls';
import { useRef, useState, type FormEvent } from 'react';
import {
  DISC_PILOT_COMPANY_IDS,
  type DiscCampaign,
  type DiscCommandDraft,
  type DiscCommandInput,
  type DiscInvite,
  type DiscManagement,
  type DiscStyle,
} from '../../../../api/shared/disc/schemas';
import { Button } from '../../../../components/ds/button/Button';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';
import { Field } from '../../../../components/ds/field/Field';
import { useDiscAdmin } from '../../../../api/shared/disc/hooks';
import {
  DiscPdfDownloadButton,
  ManagementReport,
} from '../../../../components/disc/ManagementReport';
import { inviteProgressLabel, inviteStatusLabel } from '../invite-presentation';
import { LegacyDiscHistory } from './LegacyDiscHistory';

const styles: DiscStyle[] = ['D', 'I', 'S', 'C'];
const styleNames: Record<DiscStyle, string> = {
  D: 'Dominância',
  I: 'Influência',
  S: 'Estabilidade',
  C: 'Conformidade',
};
const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('pt-BR', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'America/Sao_Paulo',
      })
    : '—';
type ManagementFields = { goal: string; note: string; moment: string; sector: string };

function managementFields(management: DiscManagement): ManagementFields {
  return {
    goal: management.goal ?? '',
    note: management.note ?? '',
    moment: management.moment ?? '',
    sector: management.sector ?? '',
  };
}

type AdminDiscPageProps = {
  campaignId?: string | null;
  onCampaignChange?: (campaignId: string | null) => void;
};

export function AdminDiscPage({ campaignId, onCampaignChange }: AdminDiscPageProps) {
  const [localCampaignId, setLocalCampaignId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const requestIds = useRef(new Map<string, string>());
  const selectedId = campaignId === undefined ? localCampaignId : campaignId;
  const disc = useDiscAdmin(selectedId);
  const [notice, setNotice] = useState('');
  const selected = disc.data?.selected ?? null;

  function selectCampaign(id: string | null) {
    setLocalCampaignId(id);
    onCampaignChange?.(id);
    setNotice('');
  }

  async function run(input: DiscCommandDraft) {
    setNotice('');
    try {
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(
          JSON.stringify([input.campaignId, input.expected, input.kind, input.fields]),
        ),
      );
      const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
      let requestId = requestIds.current.get(fingerprint);
      if (!requestId) {
        requestIds.current.clear();
        requestId = crypto.randomUUID();
        requestIds.current.set(fingerprint, requestId);
      }
      const commandInput: DiscCommandInput = { ...input, requestId };
      const result = await disc.command.mutateAsync(commandInput);
      requestIds.current.delete(fingerprint);
      setNotice('Alteração confirmada pelo servidor.');
      return result;
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Não foi possível confirmar a alteração. Confira o estado atual e tente novamente.',
      );
      return null;
    }
  }

  return (
    <div
      data-feature="disc-admin"
      className="tw:mx-auto tw:grid tw:w-full tw:max-w-6xl tw:gap-5 tw:text-body tw:text-copy"
    >
      <header className="tw:grid tw:gap-2 tw:border-b tw:border-border-default tw:pb-4">
        <p className="tw:m-0 tw:text-caption tw:font-bold tw:tracking-widest tw:text-brand tw:uppercase">
          Backoffice / CALI RH
        </p>
        <h1 className="tw:m-0 tw:text-section tw:font-semibold tw:text-brand">
          Perfil comportamental
        </h1>
        <p className="tw:m-0 tw:max-w-3xl tw:text-body tw:text-muted-copy">
          Administre campanhas, convites, avaliações internas e liberação da leitura de gestão.
        </p>
      </header>

      <LegacyDiscHistory />

      {!disc.available ? (
        <FeedbackState kind="empty">
          Gestão DISC disponível apenas no piloto local autorizado, com sessão Admin ativa.
        </FeedbackState>
      ) : disc.isPending ? (
        <FeedbackState kind="loading">Carregando campanhas DISC…</FeedbackState>
      ) : disc.isError ? (
        <FeedbackState kind="error" onRetry={() => void disc.refetch()}>
          Não foi possível carregar as campanhas DISC.
        </FeedbackState>
      ) : (
        <>
          <div className="tw:grid tw:grid-cols-[minmax(12rem,1fr)_auto] tw:items-end tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4">
            <Field id="disc-campaign" label="Campanha">
              <Select
                id="disc-campaign"
                value={selectedId ?? ''}
                onChange={(event) => selectCampaign(event.target.value || null)}
              >
                <option value="">Selecione campanha</option>
                {disc.data?.campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.title} · {campaign.organization}
                  </option>
                ))}
              </Select>
            </Field>
            {disc.processJobs.isPending ? (
              <Button disabled pending>
                Processando envios
              </Button>
            ) : (
              <Button
                variant="secondary"
                disabled={!selected}
                onClick={() => {
                  setNotice('');
                  disc.processJobs.mutate(undefined, {
                    onSuccess: (result) =>
                      setNotice(
                        `Processamento concluído: ${result.processed} processados; ${result.failed} com falha.`,
                      ),
                    onError: () => setNotice('Não foi possível processar os envios de teste.'),
                  });
                }}
              >
                Processar envios de teste
              </Button>
            )}
          </div>

          {!creating && Boolean(disc.data?.campaigns.length) && (
            <Button variant="secondary" onClick={() => setCreating(true)}>
              Criar campanha
            </Button>
          )}
          {(creating || !disc.data?.campaigns.length) && (
            <CreateCampaign
              onSubmit={async (fields) => {
                const result = await run({
                  campaignId: null,
                  expected: null,
                  kind: 'create',
                  fields,
                });
                if (result) {
                  selectCampaign(result.id);
                  setCreating(false);
                }
              }}
              pending={disc.command.isPending}
            />
          )}

          {disc.data?.campaigns.length && !selected ? (
            <FeedbackState kind="empty">
              Selecione uma campanha para consultar convites, avaliações e gestão.
            </FeedbackState>
          ) : selected ? (
            <section
              className="tw:grid tw:gap-5"
              aria-label={`Campanha ${selected.campaign.title}`}
            >
              <CampaignHeader
                campaign={selected.campaign}
                pending={disc.command.isPending}
                onClose={() =>
                  void run({
                    campaignId: selected.campaign.id,
                    expected: selected.campaign.revision,
                    kind: 'close',
                    fields: {},
                  })
                }
                onReopen={(reason) =>
                  void run({
                    campaignId: selected.campaign.id,
                    expected: selected.campaign.revision,
                    kind: 'reopen',
                    fields: { reason },
                  })
                }
              />

              <InvitePanel
                campaign={selected.campaign}
                invites={selected.invites}
                pending={disc.command.isPending}
                onInvite={(fields) =>
                  void run({
                    campaignId: selected.campaign.id,
                    expected: selected.campaign.revision,
                    kind: 'invite',
                    fields,
                  })
                }
                onQueue={(inviteId) =>
                  void run({
                    campaignId: selected.campaign.id,
                    expected: selected.campaign.revision,
                    kind: 'queue',
                    fields: { inviteId },
                  })
                }
              />

              <section className="tw:grid tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-5 tw:shadow-sm">
                <h3 className="tw:m-0 tw:text-body tw:font-semibold">
                  Avaliações individuais · uso interno CALI
                </h3>
                {selected.evaluations.length ? (
                  <ul className="tw:m-0 tw:grid tw:gap-3 tw:p-0">
                    {selected.evaluations.map((evaluation) => (
                      <li
                        key={evaluation.id}
                        className="tw:list-none tw:border-t tw:border-border-default tw:pt-3"
                      >
                        <details>
                          <summary className="tw:cursor-pointer tw:font-semibold">
                            {evaluation.person_name} · {styleNames[evaluation.primary_style]} /{' '}
                            {styleNames[evaluation.secondary_style]}
                          </summary>
                          <div className="tw:grid tw:gap-2 tw:pt-3">
                            <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
                              {evaluation.job_title ? `${evaluation.job_title} · ` : ''}
                              {formatDate(evaluation.created_at)} · Protocolo {evaluation.protocol}
                            </p>
                            <ScoreTable title="Dia comum" values={evaluation.scores.natural} />
                            <ScoreTable
                              title="Semana difícil"
                              values={evaluation.scores.pressure}
                            />
                            <DiscPdfDownloadButton
                              campaignId={selected.campaign.id}
                              resultId={evaluation.id}
                              filename={`disc-avaliador-${evaluation.id}.pdf`}
                            />
                          </div>
                        </details>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <FeedbackState kind="empty">Ainda não há avaliações concluídas.</FeedbackState>
                )}
              </section>

              <ManagementEditor
                key={selected.campaign.id}
                campaign={selected.campaign}
                management={selected.management}
                responseCount={selected.evaluations.length}
                pending={disc.command.isPending}
                onSave={(fields, expected) =>
                  run({
                    campaignId: selected.campaign.id,
                    expected,
                    kind: 'edit',
                    fields,
                  })
                }
                onApprove={(expected) =>
                  run({
                    campaignId: selected.campaign.id,
                    expected,
                    kind: 'approve',
                    fields: {},
                  })
                }
                onRelease={(expected) =>
                  run({
                    campaignId: selected.campaign.id,
                    expected,
                    kind: 'release',
                    fields: {},
                  })
                }
                onReopen={(reason, expected) =>
                  run({
                    campaignId: selected.campaign.id,
                    expected,
                    kind: 'reopen',
                    fields: { reason },
                  })
                }
                onSchedule={(expected) =>
                  run({
                    campaignId: selected.campaign.id,
                    expected,
                    kind: 'schedule',
                    fields: {},
                  })
                }
                onManagerPdf={(fields, expected) =>
                  run({
                    campaignId: selected.campaign.id,
                    expected,
                    kind: 'manager_pdf',
                    fields,
                  })
                }
              />

              <section className="tw:grid tw:gap-3 tw:border tw:border-border-default tw:bg-panel tw:p-5">
                <h3 className="tw:m-0 tw:text-body tw:font-semibold">Processamento e histórico</h3>
                <h4 className="tw:m-0 tw:text-caption tw:font-semibold">Tarefas de envio</h4>
                {selected.jobs.length ? (
                  selected.jobs.map((job) => (
                    <p key={job.id} className="tw:m-0 tw:text-caption">
                      {job.kind} · {job.state} · {formatDate(job.created_at)}
                      {job.error ? ` · ${job.error}` : ''}
                    </p>
                  ))
                ) : (
                  <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
                    Nenhuma tarefa de envio.
                  </p>
                )}
                <h4 className="tw:m-0 tw:text-caption tw:font-semibold">Histórico</h4>
                {selected.history.length ? (
                  selected.history.map((event) => (
                    <p key={event.id} className="tw:m-0 tw:text-caption">
                      {event.kind} · revisão {event.revision} · {formatDate(event.created_at)}
                      {event.reason ? ` · ${event.reason}` : ''}
                    </p>
                  ))
                ) : (
                  <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
                    Nenhum evento registrado.
                  </p>
                )}
              </section>
            </section>
          ) : null}

          {(disc.command.error || disc.processJobs.error || notice) && (
            <p
              role={disc.command.error || disc.processJobs.error ? 'alert' : 'status'}
              className="tw:m-0 tw:text-caption tw:text-action-primary"
            >
              {notice ||
                'Não foi possível confirmar a operação. Atualize os dados antes de tentar novamente.'}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function CreateCampaign({
  onSubmit,
  pending,
}: {
  onSubmit: (fields: {
    title: string;
    companyId: string | null;
    organization: string;
    purpose: string;
    focalName: string;
    focalEmail: string;
    goal: string;
  }) => void;
  pending: boolean;
}) {
  const [title, setTitle] = useState('');
  const [companyId, setCompanyId] = useState<string | null>(DISC_PILOT_COMPANY_IDS[0]);
  const [organization, setOrganization] = useState('');
  const [purpose, setPurpose] = useState('');
  const [focalName, setFocalName] = useState('');
  const [focalEmail, setFocalEmail] = useState('');
  const [goal, setGoal] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ title, companyId, organization, purpose, focalName, focalEmail, goal });
  }
  return (
    <form
      onSubmit={submit}
      className="tw:grid tw:gap-4 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-5 tw:shadow-sm"
    >
      <h3 className="tw:m-0 tw:text-body tw:font-semibold">Criar campanha DISC</h3>
      <div className="tw:tablet:grid-cols-2 tw:grid tw:grid-cols-1 tw:gap-4">
        <Field id="disc-title" label="Nome da campanha">
          <Input
            id="disc-title"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
        <Field id="disc-company" label="Vínculo da empresa">
          <Select
            id="disc-company"
            value={companyId ?? ''}
            onChange={(event) => setCompanyId(event.target.value || null)}
          >
            <option value="">Sem conta vinculada</option>
            <option value={DISC_PILOT_COMPANY_IDS[0]}>Empresa A · piloto</option>
            <option value={DISC_PILOT_COMPANY_IDS[1]}>Empresa B · piloto</option>
          </Select>
        </Field>
        <Field id="disc-organization" label="Organização">
          <Input
            id="disc-organization"
            required
            value={organization}
            onChange={(event) => setOrganization(event.target.value)}
          />
        </Field>
        <Field id="disc-goal" label="Resultado que a empresa busca">
          <TextArea
            id="disc-goal"
            required
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
          />
        </Field>
        <Field id="disc-purpose" label="Objetivo do levantamento">
          <TextArea
            id="disc-purpose"
            required
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
          />
        </Field>
        <Field id="disc-focal-name" label="Pessoa focal">
          <Input
            id="disc-focal-name"
            required
            value={focalName}
            onChange={(event) => setFocalName(event.target.value)}
          />
        </Field>
        <Field id="disc-focal-email" label="E-mail da pessoa focal">
          <Input
            id="disc-focal-email"
            type="email"
            required
            value={focalEmail}
            onChange={(event) => setFocalEmail(event.target.value)}
          />
        </Field>
      </div>
      <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
        O envio será processado somente por tarefa do servidor para destinatários de teste
        autorizados.
      </p>
      <Button type="submit" pending={pending}>
        Criar campanha
      </Button>
    </form>
  );
}

function CampaignHeader({
  campaign,
  pending,
  onClose,
  onReopen,
}: {
  campaign: DiscCampaign;
  pending: boolean;
  onClose: () => void;
  onReopen: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  function reopen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onReopen(reason.trim());
  }
  return (
    <section className="tw:grid tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-5 tw:shadow-sm">
      <div className="tw:flex tw:flex-wrap tw:items-start tw:justify-between tw:gap-3">
        <div className="tw:grid tw:gap-1">
          <h3 className="tw:m-0 tw:text-body tw:font-semibold">{campaign.title}</h3>
          <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
            {campaign.organization} · revisão {campaign.revision}
          </p>
        </div>
        <span className="tw:font-semibold">
          {campaign.status === 'open' ? 'Recebendo respostas' : 'Encerrada'}
        </span>
      </div>
      <p className="tw:m-0 tw:text-copy">{campaign.purpose}</p>
      <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
        Pessoa focal: {campaign.focal_name ?? '—'}
        {campaign.focal_email ? ` · ${campaign.focal_email}` : ''}
      </p>
      {campaign.status === 'open' ? (
        <Button variant="secondary" pending={pending} onClick={onClose}>
          Encerrar recebimento
        </Button>
      ) : (
        <form
          onSubmit={reopen}
          className="tw:grid tw:grid-cols-[minmax(12rem,1fr)_auto] tw:items-end tw:gap-3"
        >
          <Field id="disc-campaign-reopen-reason" label="Motivo da reabertura">
            <Input
              id="disc-campaign-reopen-reason"
              required
              minLength={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          <Button
            type="submit"
            variant="secondary"
            pending={pending}
            disabled={reason.trim().length < 3}
          >
            Reabrir recebimento
          </Button>
        </form>
      )}
    </section>
  );
}

function InvitePanel({
  campaign,
  invites,
  pending,
  onInvite,
  onQueue,
}: {
  campaign: DiscCampaign;
  invites: Array<{
    id: string;
    person_name: string;
    email: string;
    state: DiscInvite['state'];
    deadline_at: string | null;
    last_block: number | null;
  }>;
  pending: boolean;
  onInvite: (fields: { name: string; email: string }) => void;
  onQueue: (inviteId: string) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onInvite({ name, email });
    setName('');
    setEmail('');
  }
  return (
    <section className="tw:grid tw:gap-4 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-5 tw:shadow-sm">
      <h3 className="tw:m-0 tw:text-body tw:font-semibold">Convites</h3>
      <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
        Convites vencem ao fim do sétimo dia em Brasília. Até três lembretes, em dias úteis, entre
        8h e 18h.
      </p>
      <form
        onSubmit={submit}
        className="tw:tablet:grid-cols-[1fr_1fr_auto] tw:grid tw:grid-cols-1 tw:items-end tw:gap-3"
      >
        <Field id="disc-invite-name" label="Nome do respondente">
          <Input
            id="disc-invite-name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field id="disc-invite-email" label="E-mail do respondente">
          <Input
            id="disc-invite-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Button type="submit" pending={pending} disabled={campaign.status !== 'open'}>
          Cadastrar convite
        </Button>
      </form>
      {invites.length ? (
        <ul className="tw:m-0 tw:grid tw:gap-3 tw:p-0">
          {invites.map((invite) => (
            <li
              key={invite.id}
              className="tw:flex tw:list-none tw:flex-wrap tw:items-center tw:justify-between tw:gap-3 tw:border-t tw:border-border-default tw:pt-3"
            >
              <div>
                <strong>{invite.person_name}</strong>
                <p className="tw:m-0 tw:text-caption">
                  {invite.email} · {inviteStatusLabel(invite.state)} · prazo{' '}
                  {formatDate(invite.deadline_at)}
                  {inviteProgressLabel(invite.state, invite.last_block)
                    ? ` · ${inviteProgressLabel(invite.state, invite.last_block)}`
                    : ''}
                </p>
              </div>
              {invite.state === 'created' && (
                <Button
                  variant="secondary"
                  pending={pending}
                  disabled={campaign.status !== 'open'}
                  onClick={() => onQueue(invite.id)}
                >
                  Agendar envio
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <FeedbackState kind="empty">Nenhum convite nesta campanha.</FeedbackState>
      )}
    </section>
  );
}

function ManagementEditor({
  campaign,
  management,
  responseCount,
  pending,
  onSave,
  onApprove,
  onRelease,
  onReopen,
  onSchedule,
  onManagerPdf,
}: {
  campaign: DiscCampaign;
  management: DiscManagement;
  responseCount: number;
  pending: boolean;
  onSave: (
    fields: ManagementFields,
    expected: number,
  ) => Promise<{ id: string; revision: number } | null>;
  onApprove: (expected: number) => Promise<{ id: string; revision: number } | null>;
  onRelease: (expected: number) => Promise<{ id: string; revision: number } | null>;
  onReopen: (reason: string, expected: number) => Promise<{ id: string; revision: number } | null>;
  onSchedule: (expected: number) => Promise<{ id: string; revision: number } | null>;
  onManagerPdf: (
    fields: { name: string; email: string },
    expected: number,
  ) => Promise<{ id: string; revision: number } | null>;
}) {
  const initialFields = managementFields(management);
  const [original, setOriginal] = useState({ revision: campaign.revision, fields: initialFields });
  const [draft, setDraft] = useState(initialFields);
  const [managerName, setManagerName] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const conflict = campaign.revision !== original.revision;
  const dirty =
    draft.goal !== original.fields.goal ||
    draft.note !== original.fields.note ||
    draft.moment !== original.fields.moment ||
    draft.sector !== original.fields.sector;
  const canApprove =
    responseCount >= 5 &&
    original.fields.goal.trim().length > 0 &&
    original.fields.note.trim().length >= 20 &&
    !dirty &&
    !conflict;

  function reload() {
    const fields = managementFields(management);
    setDraft(fields);
    setOriginal({ revision: campaign.revision, fields });
  }

  async function persist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = {
      goal: draft.goal.trim(),
      note: draft.note.trim(),
      moment: draft.moment.trim(),
      sector: draft.sector.trim(),
    };
    const result = await onSave(fields, original.revision);
    if (result) {
      setDraft(fields);
      setOriginal({ revision: result.revision, fields });
    }
  }

  async function managerPdf(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await onManagerPdf(
      { name: managerName, email: managerEmail },
      original.revision,
    );
    if (result) {
      setManagerName('');
      setManagerEmail('');
      setOriginal({ revision: result.revision, fields: original.fields });
    }
  }

  async function applyRevision(operation: Promise<{ id: string; revision: number } | null>) {
    const result = await operation;
    if (result) setOriginal({ revision: result.revision, fields: original.fields });
  }
  return (
    <section className="tw:grid tw:gap-4 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-5 tw:shadow-sm">
      <div className="tw:grid tw:gap-1">
        <h3 className="tw:m-0 tw:text-body tw:font-semibold">Relatório de gestão</h3>
        <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
          Estado: {management.approved_at ? 'aprovado' : 'rascunho'} · revisão salva{' '}
          {original.revision}
        </p>
      </div>
      {conflict && (
        <div className="tw:grid tw:gap-2">
          <FeedbackMessage tone="error">
            A campanha mudou desde a leitura desta revisão. Seu rascunho local foi preservado e não
            será enviado.
          </FeedbackMessage>
          <p className="tw:m-0 tw:text-caption">
            Recarregar descarta o rascunho local e traz a revisão atual do servidor.
          </p>
          <Button variant="secondary" onClick={reload}>
            Recarregar conteúdo da gestão
          </Button>
        </div>
      )}
      {!conflict && dirty && (
        <p className="tw:m-0 tw:text-caption tw:text-muted-copy" role="status">
          Rascunho local não salvo. A prévia abaixo mostra conteúdo persistido.
        </p>
      )}
      <form onSubmit={(event) => void persist(event)} className="tw:grid tw:gap-3">
        <Field id="disc-management-goal" label="Resultado que a empresa busca">
          <TextArea
            id="disc-management-goal"
            value={draft.goal}
            disabled={pending}
            onChange={(event) => setDraft({ ...draft, goal: event.target.value })}
          />
        </Field>
        <Field id="disc-management-note" label="Parecer da CALI">
          <TextArea
            id="disc-management-note"
            value={draft.note}
            disabled={pending}
            onChange={(event) => setDraft({ ...draft, note: event.target.value })}
          />
        </Field>
        <div className="tw:tablet:grid-cols-2 tw:grid tw:grid-cols-1 tw:gap-3">
          <Field id="disc-management-moment" label="Momento da análise">
            <Input
              id="disc-management-moment"
              value={draft.moment}
              disabled={pending}
              onChange={(event) => setDraft({ ...draft, moment: event.target.value })}
            />
          </Field>
          <Field id="disc-management-sector" label="Setor">
            <Input
              id="disc-management-sector"
              value={draft.sector}
              disabled={pending}
              onChange={(event) => setDraft({ ...draft, sector: event.target.value })}
            />
          </Field>
        </div>
        <Button type="submit" variant="secondary" pending={pending} disabled={!dirty || conflict}>
          Salvar conteúdo
        </Button>
      </form>
      <ManagementReport report={management} audience="admin" campaignId={campaign.id} />
      <div className="tw:flex tw:flex-wrap tw:gap-3">
        {!management.approved_at && (
          <Button
            pending={pending}
            disabled={!canApprove}
            onClick={() => void applyRevision(onApprove(original.revision))}
          >
            Aprovar e assinar
          </Button>
        )}
        {management.approved_at && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void applyRevision(onReopen(reopenReason.trim(), original.revision));
            }}
            className="tw:grid tw:grid-cols-[minmax(12rem,1fr)_auto] tw:items-end tw:gap-3"
          >
            <Field id="disc-management-reopen-reason" label="Motivo para reabrir a gestão">
              <Input
                id="disc-management-reopen-reason"
                required
                minLength={3}
                value={reopenReason}
                disabled={pending || conflict}
                onChange={(event) => setReopenReason(event.target.value)}
              />
            </Field>
            <Button
              type="submit"
              variant="secondary"
              pending={pending}
              disabled={conflict || reopenReason.trim().length < 3}
            >
              {management.released_at
                ? 'Retirar liberação e reabrir gestão'
                : 'Reabrir para edição'}
            </Button>
          </form>
        )}
        {management.approved_at && campaign.company_id && !management.released_at && (
          <Button
            variant="secondary"
            pending={pending}
            disabled={conflict || dirty}
            onClick={() => void applyRevision(onRelease(original.revision))}
          >
            Liberar para Cliente
          </Button>
        )}
        {management.approved_at && (
          <Button
            variant="secondary"
            pending={pending}
            disabled={conflict || dirty}
            onClick={() => void applyRevision(onSchedule(original.revision))}
          >
            Agendar lembretes
          </Button>
        )}
      </div>
      {!canApprove && !management.approved_at && !dirty && !conflict && (
        <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
          Para aprovar, são necessárias pelo menos cinco respostas, objetivo definido e parecer CALI
          com 20 caracteres ou mais.
        </p>
      )}
      {management.approved_at && !campaign.company_id && (
        <form
          onSubmit={(event) => void managerPdf(event)}
          className="tw:tablet:grid-cols-[1fr_1fr_auto] tw:grid tw:grid-cols-1 tw:items-end tw:gap-3"
        >
          <Field id="disc-manager-name" label="Nome do gestor">
            <Input
              id="disc-manager-name"
              required
              disabled={conflict || pending}
              value={managerName}
              onChange={(event) => setManagerName(event.target.value)}
            />
          </Field>
          <Field id="disc-manager-email" label="E-mail do gestor">
            <Input
              id="disc-manager-email"
              type="email"
              required
              disabled={conflict || pending}
              value={managerEmail}
              onChange={(event) => setManagerEmail(event.target.value)}
            />
          </Field>
          <Button type="submit" variant="secondary" pending={pending} disabled={conflict || dirty}>
            Agendar PDF por e-mail
          </Button>
        </form>
      )}
    </section>
  );
}

function ScoreTable({
  title,
  values,
}: {
  title: string;
  values: Record<DiscStyle, { raw: number; pct: number }>;
}) {
  return (
    <div className="tw:grid tw:gap-2">
      <h4 className="tw:m-0 tw:text-caption tw:font-semibold">{title}</h4>
      {styles.map((style) => (
        <p key={style} className="tw:m-0 tw:text-caption">
          {styleNames[style]} · {values[style].pct}% (escore bruto {values[style].raw})
        </p>
      ))}
    </div>
  );
}
