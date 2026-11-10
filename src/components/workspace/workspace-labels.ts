const labels: Readonly<Record<string, string>> = {
  todo: 'A fazer',
  doing: 'Em execução',
  done: 'Concluída',
  received: 'Recebida',
  pause: 'Pausa',
  suspend: 'Suspensão',
  cancel: 'Cancelamento',
  resume: 'Retomada',
  draft: 'Rascunho',
  review: 'Em revisão interna',
  planned: 'Planejado',
  client_review: 'Em revisão do Cliente',
  adjustment_requested: 'Ajuste solicitado',
  approved: 'Aprovado',
  accepted: 'Aceito',
  rejected: 'Recusado',
  active: 'Ativo',
  rebriefing: 'Revisão de escopo',
  closed: 'Encerrado',
  pending: 'Pendente',
  not_started: 'Não iniciado',
  in_progress: 'Em execução',
  standby: 'Em espera',
  internal_review: 'Em revisão interna',
  cancelled: 'Cancelado',
  normal: 'Em andamento',
  paused: 'Pausado',
  suspended: 'Suspenso',
  published: 'Publicado',
  sent: 'Disponibilizado',
  archived: 'Arquivado',
  meeting: 'Reunião',
  occurred: 'Realizado',
  not_occurred: 'Não realizado',
  ended: 'Encerrada',
};
export const workspaceLabel = (status: string) => labels[status] ?? status;

export const recordStatusLabels = {
  in_progress: 'Em atendimento',
  waiting_client: 'Aguardando Cliente',
  standby: 'Em espera',
  completed: 'Finalizada',
  cancelled: 'Cancelada',
} as const;

export function isRecordStatus(status: string): status is keyof typeof recordStatusLabels {
  return Object.prototype.hasOwnProperty.call(recordStatusLabels, status);
}

export const recordStatusLabel = (status: string) =>
  isRecordStatus(status) ? recordStatusLabels[status] : workspaceLabel(status);

const appointmentStatus: Readonly<Record<string, string>> = {
  submitted: 'Aguardando análise da CALI',
  client_review: 'Aguardando Cliente',
  confirmed: 'Confirmado na agenda',
  completed: 'Realizado',
  declined: 'Recusado',
  cancelled: 'Cancelado no Workspace',
  not_occurred: 'Não realizado',
  reschedule_review: 'Remarcação em análise',
};
export const appointmentStatusLabel = (status: string) => appointmentStatus[status] ?? status;
