import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HourCapacity } from '../src/components/hours/HoursWorkspace';
import { ProjectOverview } from '../src/components/projects/ProjectOverview';
import type { ProjectDetail } from '../src/api/shared/workspace/schemas';

describe('apresentação de projetos e horas', () => {
  it('destaca situação, datas e prazo da revisão no resumo do projeto', () => {
    const project = {
      id: '10000000-0000-4000-8000-000000000001',
      name: 'Projeto sintético',
      protocol: 'PRJ-TESTE',
      planning_status: 'active',
      execution_status: 'normal',
      roadmap_start_date: '2026-11-01',
      roadmap_end_date: '2026-12-01',
      description: 'Descrição do ciclo.',
    } satisfies ProjectDetail['project'];

    render(
      <ProjectOverview
        project={project}
        review={{
          id: '20000000-0000-4000-8000-000000000001',
          status: 'pending',
          number: 1,
          dueAt: '2026-11-12T18:00:00Z',
          pastDue: true,
          note: null,
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Projeto sintético' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Situação do projeto' })).toBeTruthy();
    expect(screen.getByText('Meta')).toBeTruthy();
    expect(screen.getByText(/Prazo vencido/)).toBeTruthy();
  });

  it('mostra excedente numérico sem ultrapassar o limite visual da barra', () => {
    render(
      <HourCapacity
        contractedMinutes={600}
        consumedMinutes={720}
        remainingMinutes={0}
        overMinutes={120}
      />,
    );

    const progress = screen.getByRole('progressbar', {
      name: 'Consumo da capacidade mensal contratada',
    });
    expect(progress.getAttribute('value')).toBe('100');
    expect(progress.getAttribute('aria-valuetext')).toBe('120% consumido');
    expect(screen.getByText('Excedente')).toBeTruthy();
  });
});
