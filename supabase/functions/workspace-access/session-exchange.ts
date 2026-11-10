import { z } from 'zod';

export const loginSubjectSchema = z.object({
  email: z.email(),
  role: z.enum(['admin', 'client']),
  userId: z.uuid(),
  authorizationId: z.uuid(),
});
export const issuedSessionSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  user: z.object({ id: z.uuid() }),
});
type ExchangePorts = {
  authenticate: (email: string) => Promise<z.infer<typeof issuedSessionSchema>>;
  admit: (authorizationId: string, sessionId: string) => Promise<boolean>;
  revoke: (accessToken: string) => Promise<void>;
};

// A resposta vem do Auth interno, não de um JWT fornecido pelo navegador.
// A admissão também confere proprietário/existência da sessão no banco.
export function createSessionExchange(ports: ExchangePorts) {
  return async (input: z.infer<typeof loginSubjectSchema>) => {
    const subject = loginSubjectSchema.parse(input);
    const session = issuedSessionSchema.parse(await ports.authenticate(subject.email));
    try {
      const encoded = session.access_token.split('.')[1];
      const claims = z
        .object({ sub: z.uuid(), session_id: z.uuid() })
        .parse(JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))));
      if (session.user.id !== subject.userId || claims.sub !== subject.userId)
        throw new Error('Identidade incompatível.');
      if (!(await ports.admit(subject.authorizationId, claims.session_id)))
        throw new Error('Autorização de acesso indisponível.');
      return { access_token: session.access_token, refresh_token: session.refresh_token };
    } catch {
      // Mesmo se o Auth estiver indisponível, nenhuma credencial é devolvida.
      // A guarda SQL nega a sessão sem admissão ou com prova anterior ao corte.
      await ports.revoke(session.access_token).catch(() => {});
      throw new Error('Não foi possível confirmar a sessão.');
    }
  };
}
