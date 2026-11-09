import {
  staffDraftModule,
  type DomainOperations,
} from '../../api/modules/project-workspace/domain-operations';
import { Field } from '../../components/ds/field/Field';
import { ActionForm } from './ActionForm';

const labels = {
  records: 'Ocorrências',
  projects: 'Projetos e entregas',
  hours: 'Horas',
  calendar: 'Calendário',
  documents: 'Documentos',
  reports: 'Relatórios',
  notices: 'Avisos',
  team: 'Equipe do cliente',
  people_map: 'Mapa de People',
};

type StaffDraft = { id: string; revision: string; name: string; modules: string[] };

export function StaffDraftEditor({
  company,
  operations,
  draft,
  saved,
}: {
  company: string;
  operations: DomainOperations;
  draft?: StaffDraft;
  saved: () => Promise<void>;
}) {
  return (
    <details>
      <summary>{draft ? 'Gerenciar rascunho' : 'Novo rascunho de equipe'}</summary>
      <div className="tw:mt-2 tw:grid tw:gap-2">
        <ActionForm
          label={draft ? 'Salvar rascunho de equipe' : 'Criar rascunho de equipe'}
          submit={async (fields, request) => {
            const modules = staffDraftModule.array().min(1).safeParse(fields.getAll('modules'));
            if (!modules.success) throw new Error('Selecione pelo menos um módulo.');
            const id = await operations.saveStaffDraft(company, request, draft ?? null, {
              name: String(fields.get('name') ?? ''),
              modules: modules.data,
            });
            await saved();
            return id;
          }}
        >
          {(prefix) => (
            <>
              <Field id={prefix + 'name'} label="Nome fictício">
                <input
                  id={prefix + 'name'}
                  name="name"
                  minLength={2}
                  maxLength={96}
                  required
                  defaultValue={draft?.name}
                />
              </Field>
              <fieldset className="tw:m-0 tw:grid tw:min-w-0 tw:gap-1 tw:border-0 tw:p-0">
                <legend>Módulos</legend>
                {staffDraftModule.options.map((module) => (
                  <label key={module} className="tw:flex tw:gap-2">
                    <input
                      type="checkbox"
                      name="modules"
                      value={module}
                      defaultChecked={draft?.modules.includes(module)}
                    />
                    {labels[module]}
                  </label>
                ))}
              </fieldset>
            </>
          )}
        </ActionForm>
        {draft && (
          <ActionForm
            label="Remover vínculo com esta empresa"
            submit={async (_, request) => {
              const id = await operations.saveStaffDraft(company, request, draft, null);
              await saved();
              return id;
            }}
          />
        )}
      </div>
    </details>
  );
}

export function StaffActivation({
  company,
  member,
  revision,
  active,
  operations,
  saved,
}: {
  company: string;
  member: string;
  revision: string;
  active: boolean;
  operations: DomainOperations;
  saved: () => Promise<void>;
}) {
  return (
    <ActionForm
      label={active ? 'Desativar membro de teste' : 'Ativar membro de teste'}
      submit={async (_, request) => {
        const id = await operations.setStaffActive(company, request, member, revision, !active);
        await saved();
        return id;
      }}
    />
  );
}
