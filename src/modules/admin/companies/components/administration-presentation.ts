import { type AdministrationValues } from '../../../../api/admin/companies/administration-schemas';
import { formatCalendarDate } from '../../../../lib/dates';
import { type AdministrationFieldDefinition } from './administration-fields';

export function formatAdministrationValue(
  field: AdministrationFieldDefinition,
  values: AdministrationValues,
) {
  const value = values[field.name];
  if (value === null || value === '') return 'Não informado';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'number') {
    if (field.name === 'contractValue')
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 10 }).format(value);
  }
  if (field.control === 'date') return formatCalendarDate(value);
  if (field.control === 'select')
    return field.options.find((option) => option.value === value)?.label ?? value;
  return value;
}
