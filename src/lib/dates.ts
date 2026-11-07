import { format, isValid, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Datas civis não devem ser interpretadas como meia-noite UTC.
export function formatCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Data indisponível';
  const date = parseISO(value);
  return isValid(date) ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : 'Data indisponível';
}

// Instantes de servidor são apresentados no fuso operacional CALI, independentemente do host.
export function formatServerInstant(value: string) {
  const date = new Date(value);
  return isValid(date)
    ? new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(date)
    : 'Data indisponível';
}

export function toBrasiliaDateTimeInput(instant: string | null) {
  if (!instant) return '';
  // O formulário edita o horário contratual de Brasília, sem depender do fuso do navegador.
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(instant));
  return parts.replace(' ', 'T');
}
