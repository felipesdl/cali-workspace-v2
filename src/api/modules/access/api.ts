import { z } from 'zod';
import { type WorkspaceClient } from '../../supabase';
import { readHostedCompanyIdentity } from '../companies/identity';
import {
  requestAccessCodeSchema,
  requestAccessCodeResponseSchema,
  verifyAccessCodeSchema,
  verifyAccessCodeResponseSchema,
  workspaceProfileRecordSchema,
  termsAcceptanceRecordSchema,
} from './schemas';
import { currentTermsSchema, acceptCurrentTermsSchema } from './session';
import { hostedLegalContent, hostedLegalTitle, hostedLegalVersion } from './legal';
import { createAccessStateSource } from './service';

const unavailable = () => new Error('Não foi possível confirmar seu acesso. Tente novamente.');

export function createHostedAccessApi(
  client: WorkspaceClient,
  url: string,
  publishableKey: string,
) {
  let legal: ReturnType<typeof currentTermsSchema.parse> | null = null;
  async function currentTerms() {
    if (!legal) {
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(hostedLegalContent),
      );
      legal = currentTermsSchema.parse({
        version: hostedLegalVersion,
        title: hostedLegalTitle,
        content: hostedLegalContent,
        contentHash: Array.from(new Uint8Array(digest), (b) =>
          b.toString(16).padStart(2, '0'),
        ).join(''),
      });
    }
    return legal;
  }
  async function identity() {
    const session = await client.auth.getSession();
    if (session.error) throw unavailable();
    if (!session.data.session) return null;
    const user = await client.auth.getUser();
    if (user.error || !user.data.user) throw unavailable();
    return { id: user.data.user.id };
  }
  const source = createAccessStateSource({
    identity,
    async profile(id, signal) {
      const { data, error } = await client
        .from('profiles')
        .select('id,company_id,role,active')
        .eq('id', id)
        .abortSignal(signal)
        .maybeSingle();
      if (error) throw unavailable();
      return data ? workspaceProfileRecordSchema.parse(data) : null;
    },
    company: (id, signal) => readHostedCompanyIdentity(client, id, signal),
    async adminMfaReady() {
      const factors = await client.auth.mfa.listFactors();
      const level = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (factors.error || level.error) throw unavailable();
      return (
        level.data.currentLevel === 'aal2' && factors.data.totp.some((f) => f.status === 'verified')
      );
    },
    currentTerms,
    async accepted(id, version, signal) {
      const { data, error } = await client
        .from('terms_acceptances')
        .select('user_id,version,accepted_at')
        .eq('user_id', id)
        .eq('version', version)
        .abortSignal(signal)
        .maybeSingle();
      if (error) throw unavailable();
      const result = data ? termsAcceptanceRecordSchema.parse(data) : null;
      return result?.user_id === id && result.version === version;
    },
    async signOut() {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw unavailable();
    },
  });
  async function codeRequest(
    body: z.infer<typeof requestAccessCodeSchema> | z.infer<typeof verifyAccessCodeSchema>,
  ) {
    const response = await fetch(`${url}/functions/v1/workspace-access`, {
      method: 'POST',
      headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const payload =
      body.action === 'request'
        ? requestAccessCodeResponseSchema.parse(await response.json())
        : verifyAccessCodeResponseSchema.parse(await response.json());
    if (!response.ok || 'error' in payload) {
      throw new Error(
        response.status === 429
          ? 'Aguarde dois minutos antes de pedir outro código.'
          : 'Não foi possível confirmar o código. Confira os dados e tente novamente.',
      );
    }
    return payload;
  }
  let callback: Promise<void> | null = null;
  return {
    ...source,
    async requestCode(email: string) {
      await codeRequest(requestAccessCodeSchema.parse({ action: 'request', email, website: '' }));
    },
    async verifyCode(email: string, code: string) {
      const result = verifyAccessCodeResponseSchema.parse(
        await codeRequest(
          verifyAccessCodeSchema.parse({ action: 'verify', email, code, website: '' }),
        ),
      );
      if ('error' in result) throw unavailable();
      // Compatibilidade com a Edge hospedada atual; o laboratório V2 devolve sessão admitida.
      const { error } =
        'session' in result
          ? await client.auth.setSession(result.session)
          : await client.auth.verifyOtp({ token_hash: result.token_hash, type: 'email' });
      if (error) throw unavailable();
    },
    async factors() {
      const { data, error } = await client.auth.mfa.listFactors();
      if (error) throw unavailable();
      return data.all
        .filter((f) => f.factor_type === 'totp')
        .map((f) => ({ id: f.id, verified: f.status === 'verified' }));
    },
    async enrollMfa() {
      const { data, error } = await client.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'CALI Workspace',
        friendlyName: 'CALI V2',
      });
      if (error) throw unavailable();
      return { id: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
    },
    async verifyMfa(factorId: string, code: string) {
      z.uuid().parse(factorId);
      z.string()
        .regex(/^\d{6}$/)
        .parse(code);
      const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code });
      if (error)
        throw new Error(
          'Não foi possível confirmar o autenticador. Confira o código e tente novamente.',
        );
    },
    async acceptTerms(input: z.infer<typeof acceptCurrentTermsSchema>) {
      const selected = acceptCurrentTermsSchema.parse(input);
      const terms = await currentTerms();
      if (selected.version !== terms.version || selected.contentHash !== terms.contentHash)
        throw unavailable();
      const user = await identity();
      if (!user) throw unavailable();
      // O hospedado registra versão/instante; ainda não persiste digest do conteúdo.
      const { error } = await client.from('terms_acceptances').insert({
        user_id: user.id,
        version: terms.version,
        user_agent: navigator.userAgent.slice(0, 300),
      });
      if (error && error.code !== '23505') throw unavailable();
      const confirmed = await source.read(new AbortController().signal);
      if (!confirmed.termsAccepted) throw unavailable();
    },
    completeCallback(code: string) {
      callback ??= (async () => {
        if (!code || code.length > 2048) throw unavailable();
        const { error } = await client.auth.exchangeCodeForSession(code);
        if (error) throw unavailable();
      })();
      return callback;
    },
    subscribe(listener: (invalidate: boolean) => void) {
      let observedUserId: string | null | undefined;
      const { data } = client.auth.onAuthStateChange((event, session) => {
        const userId = session?.user.id ?? null;
        const invalidate =
          event === 'SIGNED_OUT' || (observedUserId !== undefined && observedUserId !== userId);
        observedUserId = userId;
        setTimeout(() => listener(invalidate), 0);
      });
      const focus = () => listener(false);
      const visibility = () => {
        if (document.visibilityState === 'visible') listener(false);
      };
      window.addEventListener('focus', focus);
      document.addEventListener('visibilitychange', visibility);
      const interval = window.setInterval(() => listener(false), 60000);
      return () => {
        data.subscription.unsubscribe();
        clearInterval(interval);
        window.removeEventListener('focus', focus);
        document.removeEventListener('visibilitychange', visibility);
      };
    },
  };
}
export type HostedAccessApi = ReturnType<typeof createHostedAccessApi>;
