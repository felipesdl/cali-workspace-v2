import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ownProfileMediaKey,
  type ProfileMediaService,
  type ProfileMedia,
} from '../../api/access/profile-media';
import { prepareProfileImage } from './prepare-profile-image';
import { Button } from '../ds/button/Button';
import { Field } from '../ds/field/Field';
import { Input, Select } from '../ds/field/Controls';
import { FileInput } from '../ds/field/FileInput';
import { FeedbackState } from '../ds/feedback/FeedbackState';
import { FeedbackMessage } from '../ds/feedback/FeedbackMessage';

function MediaFields({
  actor,
  service,
  initial,
  name,
}: {
  actor: string;
  service: ProfileMediaService;
  initial: ProfileMedia;
  name: string;
}) {
  const cache = useQueryClient();
  const [draft, setDraft] = useState(initial);
  const [expected, setExpected] = useState(initial);
  const [avatar, setAvatar] = useState<Blob | null>(null);
  const [signature, setSignature] = useState<Blob | null>(null);
  const [preview, setPreview] = useState({
    avatar: initial.avatar_url ?? '',
    signature: initial.signature_url ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  useEffect(() => {
    return () => {
      if (preview.avatar.startsWith('blob:')) URL.revokeObjectURL(preview.avatar);
      if (preview.signature.startsWith('blob:')) URL.revokeObjectURL(preview.signature);
    };
  }, [preview.avatar, preview.signature]);

  async function select(file: File | undefined, kind: 'avatar' | 'signature') {
    if (!file) return;
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const image = await prepareProfileImage(file, kind);
      const url = URL.createObjectURL(image);
      if (kind === 'avatar') {
        setAvatar(image);
        setPreview((value) => ({ ...value, avatar: url }));
        setDraft((value) => ({
          ...value,
          avatar_position_x: 50,
          avatar_position_y: 50,
          avatar_zoom: 1,
        }));
        setCropOpen(false);
      } else {
        setSignature(image);
        setPreview((value) => ({ ...value, signature: url }));
        setDraft((value) => ({ ...value, signature_mode: 'uploaded' }));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível preparar a imagem.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="tw:grid tw:min-w-0 tw:gap-4"
      aria-label="Editar foto e assinatura"
      onSubmit={(event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError('');
        setSaved(false);
        void (async () => {
          const next = { ...draft };
          // Mantém as URLs já enviadas no rascunho para não repetir upload após falha da gravação.
          if (avatar) {
            next.avatar_url = await service.upload(actor, 'avatar', avatar);
            setDraft({ ...next });
            setPreview((value) => ({ ...value, avatar: next.avatar_url ?? '' }));
            setAvatar(null);
          }
          if (signature) {
            next.signature_url = await service.upload(actor, 'signature', signature);
            setDraft({ ...next });
            setPreview((value) => ({ ...value, signature: next.signature_url ?? '' }));
            setSignature(null);
          }
          setDraft(next);
          const result = await service.save(expected, next);
          cache.setQueryData(ownProfileMediaKey(actor), result);
          setExpected(result);
          setDraft(result);
          setSaved(true);
          setPreview({ avatar: result.avatar_url ?? '', signature: result.signature_url ?? '' });
        })()
          .catch((cause) =>
            setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.'),
          )
          .finally(() => setBusy(false));
      }}
    >
      <div className="tw:grid tw:gap-4 tw:wide:grid-cols-2">
        <div className="tw:grid tw:content-start tw:gap-3">
          <h3 className="tw:m-0 tw:text-body tw:font-semibold">Foto do perfil</h3>
          <div className="tw:text-3xl tw:grid tw:h-32 tw:w-32 tw:place-items-center tw:overflow-hidden tw:rounded-control tw:bg-brand tw:font-semibold tw:text-panel">
            {preview.avatar ? (
              <img
                src={preview.avatar}
                alt="Prévia da sua foto"
                className="tw:col-start-1 tw:row-start-1 tw:h-full tw:w-full tw:object-cover"
                style={{
                  objectPosition: `${draft.avatar_position_x}% ${draft.avatar_position_y}%`,
                  transform: `scale(${draft.avatar_zoom})`,
                }}
              />
            ) : (
              <span aria-label={`Iniciais de ${name}`}>
                {name
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0]?.toLocaleUpperCase('pt-BR'))
                  .join('') || 'C'}
              </span>
            )}
          </div>
          <Field id="profile-avatar" label="Escolher foto">
            <FileInput
              id="profile-avatar"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={(event) => void select(event.currentTarget.files?.[0], 'avatar')}
            />
          </Field>
          {preview.avatar && (
            <>
              <Button
                type="button"
                variant="secondary"
                aria-expanded={cropOpen}
                onClick={() => setCropOpen((open) => !open)}
              >
                {cropOpen ? 'Fechar ajuste' : 'Ajustar enquadramento'}
              </Button>
              {cropOpen &&
                (['avatar_zoom', 'avatar_position_x', 'avatar_position_y'] as const).map((key) => (
                  <Field
                    key={key}
                    id={key}
                    label={
                      key === 'avatar_zoom'
                        ? 'Zoom da foto'
                        : key === 'avatar_position_x'
                          ? 'Posição horizontal'
                          : 'Posição vertical'
                    }
                  >
                    <Input
                      id={key}
                      type="range"
                      min={key === 'avatar_zoom' ? 1 : 0}
                      max={key === 'avatar_zoom' ? 3 : 100}
                      step={key === 'avatar_zoom' ? 0.05 : 1}
                      value={draft[key]}
                      disabled={busy}
                      onChange={(event) => {
                        const value = Number(event.currentTarget.value);
                        setDraft((previous) => ({ ...previous, [key]: value }));
                        setSaved(false);
                      }}
                    />
                  </Field>
                ))}
            </>
          )}
        </div>
        <div className="tw:grid tw:content-start tw:gap-3">
          <h3 className="tw:m-0 tw:text-body tw:font-semibold">Assinatura</h3>
          <Field id="signature-mode" label="Tipo de assinatura">
            <Select
              id="signature-mode"
              value={draft.signature_mode}
              disabled={busy}
              onChange={(event) => {
                const mode = event.currentTarget.value === 'uploaded' ? 'uploaded' : 'generated';
                setDraft((value) => ({ ...value, signature_mode: mode }));
                setSaved(false);
              }}
            >
              <option value="generated">Gerada com meu nome</option>
              <option value="uploaded">Imagem enviada</option>
            </Select>
          </Field>
          {draft.signature_mode === 'generated' ? (
            <p className="tw:text-section tw:text-brand tw:italic">{name}</p>
          ) : (
            <>
              {preview.signature && (
                <img
                  src={preview.signature}
                  alt="Prévia da sua assinatura"
                  className="tw:max-h-32 tw:max-w-full tw:object-contain"
                />
              )}
              <Field id="profile-signature" label="Escolher imagem da assinatura">
                <FileInput
                  id="profile-signature"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={busy}
                  onChange={(event) => void select(event.currentTarget.files?.[0], 'signature')}
                />
              </Field>
            </>
          )}
        </div>
      </div>
      <Button type="submit" pending={busy}>
        Salvar foto e assinatura
      </Button>
      {saved && <FeedbackMessage tone="success">Foto e assinatura atualizadas.</FeedbackMessage>}
      {error && <FeedbackMessage tone="error">{error}</FeedbackMessage>}
    </form>
  );
}

export function ProfileMediaEditor({
  actor,
  name,
  service,
}: {
  actor: string;
  name: string;
  service: ProfileMediaService;
}) {
  const query = useQuery({
    queryKey: ownProfileMediaKey(actor),
    queryFn: ({ signal }) => service.read(actor, signal),
  });
  return (
    <section className="tw:grid tw:gap-4 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4">
      <h2 className="tw:m-0 tw:text-section tw:text-brand">Foto e assinatura</h2>
      {query.isPending && (
        <FeedbackState kind="loading">Consultando foto e assinatura…</FeedbackState>
      )}
      {query.isError && (
        <FeedbackState kind="error" onRetry={() => void query.refetch()}>
          Não foi possível consultar foto e assinatura.
        </FeedbackState>
      )}
      {query.isSuccess && (
        <MediaFields key={actor} actor={actor} name={name} service={service} initial={query.data} />
      )}
    </section>
  );
}
