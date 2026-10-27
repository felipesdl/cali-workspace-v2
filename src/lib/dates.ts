import { format, isValid, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Datas civis não devem ser interpretadas como meia-noite UTC.
export function formatCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Data indisponível';
  const date = parseISO(value);
  return isValid(date) ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : 'Data indisponível';
}
