export const teamTerminationCodes = {
  '01': { label: 'Justa causa', initiative: 'company' },
  '02': { label: 'Sem justa causa', initiative: 'company' },
  '03': { label: 'Rescisão antecipada pela empresa', initiative: 'company' },
  '04': { label: 'Rescisão antecipada pela pessoa', initiative: 'employee' },
  '06': { label: 'Término de contrato a termo', initiative: 'contract_end' },
  '07': { label: 'Desligamento a pedido da pessoa', initiative: 'employee' },
  '17': { label: 'Rescisão indireta', initiative: 'other' },
  '33': { label: 'Acordo entre as partes', initiative: 'other' },
} as const;

export function parseTerminationReason(value: string | null | undefined) {
  const match = value?.match(/^\[eSocial:(\d{2})\]\s*(.*)$/s);
  return { code: match?.[1] ?? '', reason: match?.[2] ?? value ?? '' };
}
export function formatTerminationReason(code: string, reason: string) {
  return [code ? `[eSocial:${code}]` : '', reason.trim()].filter(Boolean).join(' ') || null;
}
