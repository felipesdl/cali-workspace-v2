import { teamFilters } from '../../api/modules/team/schemas';

export const teamStatusLabels = {
  [teamFilters.All]: 'Todas as situações atuais',
  [teamFilters.Active]: 'Ativa',
  [teamFilters.Leave]: 'Afastada',
  [teamFilters.Terminated]: 'Desligada',
  [teamFilters.Archived]: 'Arquivada',
} as const;

export const teamContractLabels = {
  clt: 'CLT',
  pj: 'PJ',
  intern: 'Estágio',
  temporary: 'Temporário',
  outsourced: 'Terceirizado',
  other: 'Outro',
} as const;
export const teamLeaveLabels = {
  vacation: 'Férias',
  medical_leave: 'Afastamento / licença',
  parental_leave: 'Licença maternidade / paternidade',
  unpaid_leave: 'Licença não remunerada',
  other: 'Outro',
} as const;
export const teamWorkModels = {
  hibrido: 'Híbrido',
  presencial: 'Presencial',
  remoto: 'Remoto',
} as const;

export function teamLabel(labels: Readonly<Record<string, string>>, code: string | null) {
  return code && Object.prototype.hasOwnProperty.call(labels, code) ? labels[code] : code;
}
