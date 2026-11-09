import { FeedbackMessage } from '../../../../components/ds/feedback/FeedbackMessage';
import { Input, Select } from '../../../../components/ds/field/Controls';
import { useEffect, useId, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PartnerPilot, PartnerTimerCommand } from '../../../../api/partner/pilot';
import { Button } from '../../../../components/ds/button/Button';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';
import { Field } from '../../../../components/ds/field/Field';
import { formatServerInstant } from '../../../../lib/dates';

export function PartnerTimer({
  api,
  actor,
  company,
}: {
  api: PartnerPilot;
  actor: string;
  company: string;
}) {
  const formId = useId();
  const stopButton = useRef<HTMLButtonElement>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  const [description, setDescription] = useState('');
  const [targetKey, setTargetKey] = useState('');
  const receipt = useRef<{ command: string; id: string } | null>(null);
  const cache = useQueryClient();
  const timerKey = ['partner-timer', actor, company];
  const query = useQuery({
    queryKey: timerKey,
    queryFn: ({ signal }) => api.timer(company, signal),
    refetchInterval: 15000,
  });
  const change = useMutation({
    mutationFn: (command: PartnerTimerCommand) => {
      const fingerprint = JSON.stringify(command);
      if (receipt.current?.command !== fingerprint) {
        receipt.current = { command: fingerprint, id: crypto.randomUUID() };
      }
      return api.changeTimer(company, receipt.current.id, command);
    },
    onSuccess: async (result) => {
      receipt.current = null;
      if (result.status === 'active') {
        setDescription('');
        setTargetKey('');
      }
      await Promise.all([
        cache.invalidateQueries({ queryKey: timerKey }),
        cache.invalidateQueries({ queryKey: ['partner-items', actor, company, 'hours'] }),
      ]);
    },
  });
  const { isError, data: result } = change;
  const activeTimer = query.data?.active;
  useEffect(() => {
    if (document.activeElement !== document.body) return;
    if (result?.status === 'active' && activeTimer) stopButton.current?.focus();
    else if (isError || result) feedback.current?.focus();
  }, [activeTimer, isError, result]);

  if (query.isPending) return <FeedbackState kind="loading">Consultando cronômetro…</FeedbackState>;
  if (query.isError) {
    return (
      <FeedbackState kind="error" onRetry={() => void query.refetch()}>
        Não foi possível consultar o cronômetro.
      </FeedbackState>
    );
  }

  const { active, targets } = query.data;
  const key = (target: (typeof targets)[number]) => `${target.kind}:${target.id}`;
  const target = targets.find((option) => key(option) === targetKey);
  return (
    <section
      className="tw:grid tw:gap-3 tw:border-t tw:border-border-default tw:pt-4"
      aria-label="Cronômetro"
    >
      <h3 className="tw:font-semibold">Cronômetro</h3>
      {active ? (
        <>
          <p>
            {active.description} · Iniciado {formatServerInstant(active.startedAt)}
          </p>
          <div>
            <Button
              ref={stopButton}
              pending={change.isPending}
              onClick={() => change.mutate({ action: 'stop', id: active.id })}
            >
              Encerrar trecho
            </Button>
          </div>
        </>
      ) : (
        <form
          className="tw:grid tw:gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (change.isPending || (targetKey && !target)) return;
            change.mutate({ action: 'start', description: description.trim(), target });
          }}
        >
          <Field id={`${formId}-description`} label="Descrição da atividade">
            <Input
              id={`${formId}-description`}
              value={description}
              required
              minLength={3}
              maxLength={500}
              disabled={change.isPending}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          <Field id={`${formId}-target`} label="Vínculo do cronômetro">
            <Select
              id={`${formId}-target`}
              value={targetKey}
              disabled={change.isPending}
              onChange={(event) => setTargetKey(event.target.value)}
            >
              <option value="">Sem vínculo</option>
              {targets.map((option) => (
                <option key={key(option)} value={key(option)}>
                  {option.title}
                </option>
              ))}
              {targetKey && !target && <option value={targetKey}>Vínculo indisponível</option>}
            </Select>
          </Field>
          <div>
            <Button
              type="submit"
              pending={change.isPending}
              disabled={description.trim().length < 3 || Boolean(targetKey && !target)}
            >
              Iniciar cronômetro
            </Button>
          </div>
        </form>
      )}
      {change.error && (
        <FeedbackMessage ref={feedback} tone="error" tabIndex={-1}>
          {change.error.message}
        </FeedbackMessage>
      )}
      {result?.status === 'discarded' && (
        <p ref={feedback} role="status" tabIndex={-1}>
          Trecho descartado: menos de 30 segundos.
        </p>
      )}
      {result?.status === 'stopped' && (
        <FeedbackMessage ref={feedback} tone="success" tabIndex={-1}>
          Trecho registrado: {result.minutes} min.
        </FeedbackMessage>
      )}
    </section>
  );
}
