import { type CompanyDetails } from '../../api/modules/companies/schemas';
import {
  emptyRegistration,
  type CompanyRegistrationRecord,
  type UpdateRegistration,
  type RegistrationEvent,
} from '../../api/modules/companies/registration-schemas';

// Estado por instância, sem persistência nem efeitos financeiros/documentais.
export function createRegistrationState() {
  const records = new Map<string, CompanyRegistrationRecord>();
  const events: RegistrationEvent[] = [];
  function read(company: CompanyDetails) {
    const record = records.get(company.id) ?? emptyRegistration(company);
    records.set(company.id, record);
    return record;
  }
  return {
    read,
    history: (companyId: string) => events.filter((event) => event.companyId === companyId),
    update(input: UpdateRegistration, company: CompanyDetails) {
      const previous = read(company);
      if (previous.revision !== input.expectedRevision)
        throw new Error('O cadastro mudou. Descarte o rascunho e recarregue antes de editar.');
      if (JSON.stringify(previous.values) === JSON.stringify(input.values)) return previous;
      const current = {
        companyId: input.companyId,
        revision: previous.revision + 1,
        values: structuredClone(input.values),
      };
      const event: RegistrationEvent = {
        id: crypto.randomUUID(),
        companyId: input.companyId,
        previous: structuredClone(previous),
        current: structuredClone(current),
        recordedBy: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        recordedAt: new Date().toISOString(),
      };
      records.set(input.companyId, current);
      events.push(event);
      return current;
    },
  };
}
