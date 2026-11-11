import { ProfileMediaEditor } from './ProfileMediaEditor';
import { useRef, useState } from 'react';
import { Button } from '../ds/button/Button';
import { FeedbackMessage } from '../ds/feedback/FeedbackMessage';
import { OwnProfileEditor } from './OwnProfileEditor';
import { useOwnProfileQuery } from '../../api/access/hooks/useOwnProfileQuery';
import { workspaceRole } from '../../api/access/schemas';
import { FeedbackState } from '../ds/feedback/FeedbackState';

export function OwnProfilePage() {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const { ownProfile, actor, query } = useOwnProfileQuery();
  if (!ownProfile || !actor?.active)
    return <FeedbackState kind="empty">Perfil indisponível para este acesso.</FeedbackState>;
  if (query.isPending) return <FeedbackState kind="loading">Carregando seu perfil…</FeedbackState>;
  if (query.isError)
    return (
      <FeedbackState kind="error" onRetry={() => void query.refetch()}>
        Não foi possível consultar seu perfil.
      </FeedbackState>
    );
  if (!query.data)
    return <FeedbackState kind="empty">Seu perfil não foi encontrado.</FeedbackState>;

  const { full_name, job_title, email, phone, whatsapp } = query.data;
  const fields = [
    ['Nome', full_name],
    ['Cargo', job_title],
    ['E-mail', email],
    ['Telefone', phone],
    ['WhatsApp', whatsapp],
    ['Área de acesso', actor.role === workspaceRole.Admin ? 'Admin' : 'Cliente'],
  ];

  return (
    <div className="tw:grid tw:gap-4">
      <section
        aria-labelledby="own-profile-title"
        className="tw:grid tw:min-w-0 tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4 tw:wrap-anywhere"
      >
        <h2
          id="own-profile-title"
          ref={heading}
          tabIndex={-1}
          className="tw:m-0 tw:text-section tw:font-bold tw:text-brand"
        >
          Dados do seu perfil
        </h2>
        {ownProfile.update && editing ? (
          <OwnProfileEditor
            key={actor.id}
            profile={query.data}
            update={ownProfile.update}
            close={(confirmed) => {
              setEditing(false);
              setSaved(confirmed);
              heading.current?.focus();
            }}
            reload={() => {
              setEditing(false);
              setSaved(false);
              heading.current?.focus();
              void query.refetch();
            }}
          />
        ) : (
          <>
            <p className="tw:m-0">
              {ownProfile.update
                ? 'Confira seus dados. Para alterar o e-mail de acesso, fale com a CALI.'
                : 'Confira seus dados. Para solicitar uma correção, fale com a CALI.'}
            </p>
            <dl className="tw:m-0 tw:grid tw:gap-3 tw:wide:grid-cols-2">
              {fields.map(([label, value]) => (
                <div key={label}>
                  <dt className="tw:text-caption tw:text-muted-copy">{label}</dt>
                  <dd className="tw:m-0 tw:font-medium">{value?.trim() || 'Não informado'}</dd>
                </div>
              ))}
            </dl>
            {ownProfile.update && (
              <Button
                variant="secondary"
                className="tw:justify-self-start"
                onClick={() => {
                  setSaved(false);
                  setEditing(true);
                }}
              >
                Editar perfil
              </Button>
            )}
            {saved && <FeedbackMessage tone="success">Perfil atualizado.</FeedbackMessage>}
          </>
        )}
      </section>
      {ownProfile.media && (
        <ProfileMediaEditor
          actor={actor.id}
          name={query.data.full_name ?? ''}
          service={ownProfile.media}
        />
      )}
    </div>
  );
}
