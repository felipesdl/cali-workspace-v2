import { Input } from '../../../../components/ds/field/Controls';
import { CheckboxInput } from '../../../../components/ds/checkbox/Checkbox';
import {
  staffDraftModule,
  type DomainOperations,
} from '../../../../api/shared/workspace/domain-operations';
import { Field } from '../../../../components/ds/field/Field';
import { ActionForm } from '../../../../components/workspace/ActionForm';
import { staffModuleLabels } from '../staff-module-labels';

type StaffDraft = { id: string; revision: string; name: string; modules: string[] };

export function StaffDraftEditor({
  company,
  operations,
  draft,
  saved,
}: {
  company: string;
  operations: Pick<DomainOperations, 'saveStaffDraft'>;
  draft?: StaffDraft;
  saved: () => Promise<void>;
}) {
  return (
    <div className="tw:grid tw:gap-2">
      <ActionForm
        label={draft ? 'Salvar rascunho de equipe' : 'Criar rascunho de equipe'}
        dialog={{
          title: draft ? 'Editar vínculo da equipe CALI' : 'Adicionar pessoa à equipe CALI',
          trigger: draft ? 'Editar vínculo' : 'Adicionar pessoa à equipe',
        }}
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
              <Input
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
                  <CheckboxInput
                    name="modules"
                    value={module}
                    defaultChecked={draft?.modules.includes(module)}
                  />
                  {staffModuleLabels[module]}
                </label>
              ))}
            </fieldset>
          </>
        )}
      </ActionForm>
      {draft && (
        <details>
          <summary>Outras ações do rascunho</summary>
          <div className="tw:mt-2">
            <ActionForm
              label="Remover vínculo com esta empresa"
              submit={async (_, request) => {
                const id = await operations.saveStaffDraft(company, request, draft, null);
                await saved();
                return id;
              }}
            />
          </div>
        </details>
      )}
    </div>
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
