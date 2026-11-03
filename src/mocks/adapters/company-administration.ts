import {
  emptyAdministration,
  type CompanyAdministration,
  type UpdateAdministration,
  type AdministrationEvent,
} from '../../api/modules/companies/administration-schemas';

// Estado por instância, sem persistência nem efeitos financeiros/documentais.
export function createAdministrationState() {
  const records = new Map<string, CompanyAdministration>();
  const events: AdministrationEvent[] = [];
  function read(companyId: string) {
    const record = records.get(companyId) ?? emptyAdministration(companyId);
    records.set(companyId, record);
    return record;
  }
  return {
    read,
    history: (companyId: string) => events.filter((event) => event.companyId === companyId),
    update(input: UpdateAdministration) {
      const previous = read(input.companyId);
      if (previous.revision !== input.expectedRevision)
        throw new Error('A ficha mudou. Descarte o rascunho e recarregue antes de editar.');
      if (JSON.stringify(previous.values) === JSON.stringify(input.values)) return previous;
      const current = {
        companyId: input.companyId,
        revision: previous.revision + 1,
        values: structuredClone(input.values),
      };
      const event: AdministrationEvent = {
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
