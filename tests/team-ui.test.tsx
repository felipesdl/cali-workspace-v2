import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from '@tanstack/react-router';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../src/app/App';
import { createAppRouter } from '../src/app/router';
import { createSessionController } from '../src/app/session/controller';
import { createQueryClient } from '../src/api/query-client';
import { type WorkspaceAccessState } from '../src/api/access/session';
import { type TeamService } from '../src/api/shared/team/hosted';
import { professionalRecord } from '../src/api/shared/team/schemas';

const companyA = '9c5ab148-78b8-4410-9338-58c44222a5db';
const companyB = '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
const member = professionalRecord.parse({
  id: '10000000-0000-4000-8000-000000000002',
  company_id: companyB,
  employee_code: 'QA-B',
  full_name: 'Pessoa sintética B',
  job_title: 'Analista',
  department: 'Operações',
  manager_code: null,
  admission_date: '2026-10-01',
  status: 'active',
  archived_at: null,
  work_email: null,
  work_phone: null,
  seniority: null,
  team_area: null,
  is_leader: false,
  employment_type: 'clt',
  weekly_hours: null,
  work_model: null,
  location: null,
  leave_reason: null,
  leave_start_date: null,
  expected_return_date: null,
  termination_date: null,
  termination_initiative: null,
  termination_reason: null,
  notice_type: null,
  updated_at: '2026-11-04T12:00:00Z',
});

describe('Equipe conectada', () => {
  it('deriva a empresa da sessão, abre a ficha e consulta privados só por ação explícita', async () => {
    const team: TeamService = {
      list: vi.fn(async () => ({
        companyId: companyB,
        companyName: 'Empresa B',
        total: 1,
        members: [{ ...member, manager_name: null }],
      })),
      member: vi.fn(async () => member),
      readPrivate: vi.fn(async () => ({
        member_id: member.id,
        company_id: companyB,
        updated_at: null,
        salary: 1000,
        salary_review_date: null,
        gender: null,
        gender_detail: null,
        has_children: null,
      })),
      writePrivate: vi.fn(),
      save: vi.fn(),
      archive: vi.fn(),
      previewImport: vi.fn(),
      confirmImport: vi.fn(),
      history: vi.fn(),
      structure: vi.fn(),
    };
    const access: WorkspaceAccessState = {
      status: 'ready',
      profile: {
        id: '20000000-0000-4000-8000-000000000001',
        company_id: companyB,
        role: 'client',
        active: true,
      },
      companyStatus: 'active',
      termsAccepted: true,
      terms: {
        version: 'qa-team',
        title: 'Termos sintéticos',
        content: 'Conteúdo sintético',
        contentHash: 'a'.repeat(64),
      },
    };
    const cache = createQueryClient();
    const session = createSessionController(
      { read: async () => access, signOut: async () => {} },
      cache,
    );
    const router = createAppRouter(
      createMemoryHistory({
        initialEntries: [`/cliente/equipe?companyId=${companyA}`],
      }),
      cache,
      session,
    );
    router.update({ context: { ...router.options.context, team } });
    await act(async () => {
      await router.load();
    });
    render(<App router={router} />);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Ver ficha de Pessoa sintética B' }),
    );
    await screen.findByRole('heading', { name: member.full_name });
    expect(team.list).toHaveBeenCalledWith(companyB, expect.any(Object), expect.any(AbortSignal));
    expect(team.member).toHaveBeenCalledWith(companyB, member.id, expect.any(AbortSignal));
    expect(team.readPrivate).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Ver dados privados' }));
    await screen.findByText('Remuneração');
    expect(team.readPrivate).toHaveBeenCalledWith(companyB, member.id, expect.any(AbortSignal));
    await user.click(screen.getByRole('button', { name: 'Ocultar dados privados' }));
    expect(screen.queryByText('Remuneração')).toBeNull();
  });
});
