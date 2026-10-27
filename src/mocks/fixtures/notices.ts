export type Notice = {
  id: string;
  title: string;
  category: string;
  date: string;
  time?: string;
  coverage?: string;
  description: string;
  author: string;
  calendar: boolean;
  image?: string;
};
export const noticeSamples: Notice[] = [
  {
    id: 'AV-101',
    title: 'Feriado nacional · Nossa Senhora Aparecida',
    category: 'Feriado',
    date: '2026-10-12',
    coverage: 'Nacional',
    description:
      'Em 12 de outubro não haverá atendimento regular da CALI. Demandas em andamento serão retomadas no próximo dia útil; entregas críticas serão combinadas antecipadamente.',
    author: 'CALI · Assessoria',
    calendar: true,
    image:
      'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'AV-102',
    title: 'Atendimento em horário reduzido',
    category: 'Atendimento',
    date: '2026-10-16',
    time: '09:00 às 13:00',
    coverage: 'Equipe CALI',
    description:
      'Na sexta-feira, o atendimento da CALI acontecerá até 13h. Solicitações recebidas depois desse período serão acompanhadas no próximo expediente.',
    author: 'CALI · Assessoria',
    calendar: true,
    image:
      'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'AV-103',
    title: 'Próxima leitura executiva do ciclo',
    category: 'Comunicado',
    date: '2026-10-22',
    description:
      'O fechamento do mês consolidará atividades executadas, decisões e próximos passos da parceria.',
    author: 'CALI · Assessoria',
    calendar: false,
    image:
      'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=80',
  },
];
