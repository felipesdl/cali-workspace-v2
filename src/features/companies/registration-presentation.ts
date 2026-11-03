import { type RegistrationValues } from '../../api/modules/companies/registration-schemas';
import { type RegistrationFieldDefinition } from './registration-fields';
import { formatCalendarDate } from '../../lib/dates';
export function formatRegistrationValue(
  field: RegistrationFieldDefinition,
  values: RegistrationValues,
) {
  const value = values[field.name];
  if (value === null || value === '') return 'Não informado';
  if (Array.isArray(value)) return value.join('\n') || 'Não informadas';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'number')
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 10 }).format(value);
  if (field.control === 'date') return formatCalendarDate(value);
  return value;
}
