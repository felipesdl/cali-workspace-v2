import { companyService, companySegments } from '../../api/modules/companies/registration-schemas';
import { type RegistrationDraft } from './registration-draft';
import { type CompanyFieldDefinition } from './CompanyField';
export type RegistrationFieldDefinition = CompanyFieldDefinition<
  Exclude<keyof RegistrationDraft, 'logo'>
>;
export const registrationGroups = [
  {
    title: 'Serviço e segmento',
    description: 'Condições cadastrais. Alterar serviço não ativa agenda, cobrança ou acesso.',
    fields: [
      {
        name: 'service',
        label: 'Serviço contratado',
        help: 'Serviços CALI atualizam o plano correspondente; demais opções mantêm o plano já cadastrado.',
        control: 'select',
        options: [
          { value: '', label: 'Não informado' },
          ...Object.values(companyService).map((value) => ({ value, label: value })),
        ],
      },
      {
        name: 'monthlyHours',
        label: 'Horas mensais contratadas',
        control: 'decimal',
        help: 'Vírgula ou ponto decimal, sem separador de milhar. Zero representa não informado.',
      },
      {
        name: 'segment',
        label: 'Segmento da empresa',
        control: 'suggestion',
        options: companySegments.map((value) => ({ value, label: value })),
        help: 'Escolha uma sugestão ou informe outro segmento.',
      },
    ],
  },
  {
    title: 'Endereço e filiais',
    description: 'Localização informada, sem consulta externa ou geolocalização.',
    fields: [
      { name: 'addressStreet', label: 'Endereço e complemento', control: 'text' },
      { name: 'addressNumber', label: 'Número', control: 'text' },
      { name: 'neighborhood', label: 'Bairro', control: 'text' },
      { name: 'city', label: 'Cidade', control: 'text' },
      { name: 'state', label: 'Estado (sigla)', control: 'text' },
      {
        name: 'hasBranches',
        label: 'Possui filiais',
        control: 'select',
        options: [
          { value: 'no', label: 'Não' },
          { value: 'yes', label: 'Sim' },
        ],
      },
      {
        name: 'branches',
        label: 'Localidades das filiais',
        control: 'textarea',
        help: 'Uma localidade por linha. Ao salvar sem filiais, as localidades serão removidas.',
      },
    ],
  },
  {
    title: 'Contato comercial',
    description:
      'Contato administrativo da empresa. Não cria login, convite, hierarquia ou envio de mensagens.',
    fields: [
      { name: 'contactName', label: 'Nome do contato comercial', control: 'text' },
      { name: 'contactJobTitle', label: 'Cargo do contato comercial', control: 'text' },
      { name: 'contactEmail', label: 'E-mail comercial', control: 'email' },
      { name: 'contactPhone', label: 'Telefone comercial', control: 'text' },
      { name: 'contactWhatsapp', label: 'WhatsApp comercial', control: 'text' },
      { name: 'contactBirthday', label: 'Aniversário do contato', control: 'date' },
    ],
  },
] as const satisfies readonly {
  title: string;
  description: string;
  fields: readonly RegistrationFieldDefinition[];
}[];
