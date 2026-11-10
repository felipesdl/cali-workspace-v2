import { FormActions } from '../ds/button/FormActions';
import { TeamPrivate } from './TeamPrivate';
import { useState } from 'react';
import { z } from 'zod';
import { type TeamSaveRow } from '../../api/shared/team/maintenance';
import { type ProfessionalRecord } from '../../api/shared/team/schemas';
import { Button } from '../ds/button/Button';
import { FeedbackState } from '../ds/feedback/FeedbackState';
import { TeamEditor, TeamMonthField } from './TeamEditor';
import { TeamMemberDetails } from './TeamMemberDetails';

type Save = (month: string, row: TeamSaveRow) => Promise<void>;

export function TeamCreate({ onSave, pending }: { onSave: Save; pending: boolean }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Button onClick={() => setOpen(true)}>Cadastrar pessoa</Button>;
  return (
    <TeamEditor
      member={null}
      pending={pending}
      onCancel={() => setOpen(false)}
      onSave={async (month, row) => {
        await onSave(month, row);
        setOpen(false);
      }}
    />
  );
}

function ArchiveForm({
  member,
  pending,
  onArchive,
  onCancel,
}: {
  member: ProfessionalRecord;
  pending: boolean;
  onArchive: (month: string, member: ProfessionalRecord) => Promise<void>;
  onCancel: () => void;
}) {
  const [error, setError] = useState('');
  const [original] = useState(member);
  return (
    <form
      aria-label="Confirmar arquivamento"
      className="tw:mt-4 tw:grid tw:max-w-md tw:gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setError('');
        const month = z.iso.date().parse(new FormData(event.currentTarget).get('month'));
        try {
          await onArchive(month, original);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'Não foi possível arquivar a ficha.');
        }
      }}
    >
      <p>
        {member.full_name} sairá do diretório atual. A ficha e as movimentações continuam no
        histórico.
      </p>
      <TeamMonthField id="team-archive-month" />
      {error && <FeedbackState kind="error">{error}</FeedbackState>}
      <FormActions className="tw:max-w-md">
        <Button type="submit" pending={pending}>
          Confirmar arquivamento
        </Button>
        <Button variant="secondary" disabled={pending} onClick={onCancel}>
          Cancelar
        </Button>
      </FormActions>
    </form>
  );
}

export function TeamMaintenance({
  member,
  saving,
  archiving,
  onSave,
  onArchive,
}: {
  member: ProfessionalRecord;
  saving: boolean;
  archiving: boolean;
  onSave: Save;
  onArchive: (month: string, member: ProfessionalRecord) => Promise<void>;
}) {
  const [action, setAction] = useState<'view' | 'edit' | 'archive'>('view');
  if (action === 'edit')
    return (
      <TeamEditor
        member={member}
        pending={saving}
        onCancel={() => setAction('view')}
        onSave={async (month, row) => {
          await onSave(month, row);
          setAction('view');
        }}
      />
    );
  return (
    <>
      <TeamMemberDetails member={member} />
      {action === 'view' && <TeamPrivate member={member} />}
      {action === 'archive' ? (
        <ArchiveForm
          member={member}
          pending={archiving}
          onCancel={() => setAction('view')}
          onArchive={async (month, record) => {
            await onArchive(month, record);
            setAction('view');
          }}
        />
      ) : (
        <div className="tw:mt-4 tw:flex tw:flex-wrap tw:gap-3">
          <Button variant="secondary" onClick={() => setAction('edit')}>
            {member.archived_at ? 'Reativar ficha' : 'Editar ficha'}
          </Button>
          {!member.archived_at && (
            <Button variant="secondary" onClick={() => setAction('archive')}>
              Arquivar ficha
            </Button>
          )}
        </div>
      )}
    </>
  );
}
