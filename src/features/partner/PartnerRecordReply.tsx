import { useId, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { PartnerPilot } from '../../api/modules/partner/pilot';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';

export function PartnerRecordReply({
  api,
  company,
  record,
  onSent,
}: {
  api: PartnerPilot;
  company: string;
  record: string;
  onSent: () => Promise<void>;
}) {
  const id = useId();
  const [body, setBody] = useState('');
  const receipt = useRef<{ body: string; id: string } | null>(null);
  const reply = useMutation({
    mutationFn: (message: string) => {
      if (receipt.current?.body !== message)
        receipt.current = { body: message, id: crypto.randomUUID() };
      return api.replyRecord(company, receipt.current.id, record, message);
    },
    onSuccess: async () => {
      receipt.current = null;
      setBody('');
      await onSent();
    },
  });

  return (
    <form
      aria-label="Responder ocorrência"
      className="tw:grid tw:gap-3 tw:border-t tw:border-border-default tw:pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (body.trim() && !reply.isPending) reply.mutate(body.trim());
      }}
    >
      <Field id={id} label="Resposta para o Cliente">
        <textarea
          id={id}
          rows={3}
          value={body}
          required
          maxLength={4000}
          disabled={reply.isPending}
          onChange={(event) => setBody(event.target.value)}
        />
      </Field>
      <div>
        <Button type="submit" pending={reply.isPending} disabled={!body.trim()}>
          Enviar resposta
        </Button>
      </div>
      {reply.isError && <p role="alert">{reply.error.message}</p>}
      {reply.isSuccess && <p role="status">Resposta publicada na conversa.</p>}
    </form>
  );
}
