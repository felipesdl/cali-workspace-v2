import { describe, expect, it } from 'vitest';
import {
  requestAccessCodeSchema,
  requestAccessCodeResponseSchema,
  verifyAccessCodeSchema,
  verifyAccessCodeResponseSchema,
  workspaceProfileRecordSchema,
  termsAcceptanceRecordSchema,
} from '../src/api/modules/access/schemas';
import {
  companyIdentityRecordSchema,
  clientInviteIdentityRecordSchema,
} from '../src/api/modules/companies/records';
import {
  registerWorkspaceAdhesionSchema,
  workspaceAdhesionRecordSchema,
} from '../src/api/modules/access/adhesion';

const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const companyId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('contratos mínimos de acesso e empresa', () => {
  it('registra solicitação de adesão sem aceitar autoria/instante/permissão fornecidos pelo cliente', () => {
    const request = { companyId, evidenceReference: '  Referência sintética AD-001  ' };
    expect(registerWorkspaceAdhesionSchema.parse(request)).toEqual({
      companyId,
      evidenceReference: 'Referência sintética AD-001',
    });
    for (const extra of [
      { recordedBy: actorId },
      { recordedAt: '2026-10-28T12:00:00Z' },
      { role: 'admin' },
    ]) {
      expect(registerWorkspaceAdhesionSchema.safeParse({ ...request, ...extra }).success).toBe(
        false,
      );
    }
  });

  it('exige referência não vazia, sem inventar assinatura digital ou upload obrigatório', () => {
    expect(
      registerWorkspaceAdhesionSchema.safeParse({ companyId, evidenceReference: '  ' }).success,
    ).toBe(false);
  });

  it('exige autoria e instante no record de adesão, sem confundir isso com autenticação', () => {
    const record = {
      id: actorId,
      companyId,
      evidenceReference: 'Referência sintética AD-001',
      recordedBy: actorId,
      recordedAt: '2026-10-28T12:00:00Z',
    };
    expect(workspaceAdhesionRecordSchema.parse(record)).toEqual(record);
    expect(
      workspaceAdhesionRecordSchema.safeParse({
        id: actorId,
        companyId,
        evidenceReference: 'Referência sintética AD-001',
      }).success,
    ).toBe(false);
  });

  it('normaliza e-mail e não permite que a solicitação atribua papel ou empresa', () => {
    expect(
      requestAccessCodeSchema.parse({ action: 'request', email: ' ADMIN@example.test ' }),
    ).toEqual({ action: 'request', email: 'admin@example.test' });
    for (const extra of [{ role: 'admin' }, { company_id: companyId }, { active: true }]) {
      expect(
        requestAccessCodeSchema.safeParse({
          action: 'request',
          email: 'client@example.test',
          ...extra,
        }).success,
      ).toBe(false);
    }
  });

  it('aceita resposta genérica sem concluir que o e-mail é elegível ou que houve envio', () => {
    expect(requestAccessCodeResponseSchema.parse({ ok: true })).toEqual({ ok: true });
    expect(requestAccessCodeResponseSchema.parse({ ok: true, challenge: 'code' })).toEqual({
      ok: true,
      challenge: 'code',
    });
  });

  it.each(['12345', '1234567', '12a456', ' 123456', ''])(
    'recusa código fora do contrato: %j',
    (code) => {
      expect(
        verifyAccessCodeSchema.safeParse({ action: 'verify', email: 'client@example.test', code })
          .success,
      ).toBe(false);
    },
  );

  it('preserva zeros no código e exige token/papel na resposta de verificação', () => {
    expect(
      verifyAccessCodeSchema.parse({
        action: 'verify',
        email: 'client@example.test',
        code: '001234',
      }).code,
    ).toBe('001234');
    expect(verifyAccessCodeResponseSchema.safeParse({ ok: true }).success).toBe(false);
    expect(
      verifyAccessCodeResponseSchema.safeParse({ ok: true, role: 'admin', token_hash: '' }).success,
    ).toBe(false);
    expect(
      verifyAccessCodeResponseSchema.safeParse({
        ok: true,
        role: 'superadmin',
        token_hash: 'local-token',
      }).success,
    ).toBe(false);
    expect(verifyAccessCodeResponseSchema.parse({ error: 'Código inválido ou expirado.' })).toEqual(
      { error: 'Código inválido ou expirado.' },
    );
  });

  it('representa perfil inativo/sem vínculo sem transformar parse em autorização', () => {
    expect(
      workspaceProfileRecordSchema.parse({
        id: actorId,
        company_id: null,
        role: 'client',
        active: false,
      }),
    ).toEqual({ id: actorId, company_id: null, role: 'client', active: false });
    expect(
      workspaceProfileRecordSchema.safeParse({ id: actorId, role: 'admin', active: true }).success,
    ).toBe(false);
  });

  it('exige versão e timestamp com fuso; data civil não satisfaz o contrato', () => {
    expect(
      termsAcceptanceRecordSchema.parse({
        user_id: actorId,
        version: 'local-test-v1',
        accepted_at: '2026-10-28T09:00:00-03:00',
      }).version,
    ).toBe('local-test-v1');
    expect(
      termsAcceptanceRecordSchema.safeParse({
        user_id: actorId,
        version: '',
        accepted_at: '2026-10-28',
      }).success,
    ).toBe(false);
  });

  it.each(['active', 'paused', 'blocked', 'closed', 'archived'])(
    'representa o estado de empresa observado: %s',
    (status) => {
      expect(
        companyIdentityRecordSchema.parse({
          id: companyId,
          display_name: 'Empresa sintética',
          legal_name: 'Empresa sintética',
          status,
        }).status,
      ).toBe(status);
    },
  );

  it('mantém convite, perfil e hierarquia comercial como conceitos separados', () => {
    const invite = clientInviteIdentityRecordSchema.parse({
      id: actorId,
      company_id: companyId,
      email: 'client@example.test',
      full_name: 'Contato sintético',
      active: false,
      platform_access: false,
      is_primary: true,
    });
    expect(invite.active).toBe(false);
    expect(invite.platform_access).toBe(false);
    expect(invite.is_primary).toBe(true);
  });
});
