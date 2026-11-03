import {
  contractType,
  contractModel,
  penaltyBase,
  paymentDayRule,
  billingFrequency,
  paymentMethod,
  billingDueRule,
} from '../../api/modules/companies/administration-schemas';
import { type AdministrationDraft } from './administration-draft';

type Option = { value: string; label: string };
type FieldBase = { name: keyof AdministrationDraft; label: string; help?: string };
export type AdministrationFieldDefinition = FieldBase &
  (
    | { control: 'select'; options: readonly Option[] }
    | { control: 'text' | 'date' | 'decimal' | 'integer' | 'textarea' }
  );
const options = (labels: Record<string, string>): Option[] =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));
const optionalOptions = (labels: Record<string, string>) => [
  { value: '', label: 'Não informado' },
  ...options(labels),
];
const yesNo = [
  { value: 'no', label: 'Não' },
  { value: 'yes', label: 'Sim' },
];
export const contractFields = [
  { name: 'startDate', label: 'Início do contrato', control: 'date' },
  { name: 'endDate', label: 'Término do contrato', control: 'date' },
  {
    name: 'contractType',
    label: 'Tipo de contrato',
    control: 'select',
    options: optionalOptions(
      Object.fromEntries(Object.values(contractType).map((value) => [value, value])),
    ),
  },
  {
    name: 'contractModel',
    label: 'Modelo do contrato',
    control: 'select',
    options: optionalOptions(
      Object.fromEntries(Object.values(contractModel).map((value) => [value, value])),
    ),
  },
  {
    name: 'autoRenew',
    label: 'Renovação automática, conforme contrato',
    control: 'select',
    options: yesNo,
  },
  {
    name: 'penaltyEnabled',
    label: 'Multa de encerramento prevista',
    control: 'select',
    options: yesNo,
  },
  {
    name: 'penaltyBase',
    label: 'Base da multa de encerramento',
    control: 'select',
    options: options({
      [penaltyBase.TextOnly]: 'Somente regra textual',
      [penaltyBase.RemainingBalance]: '% sobre saldo restante',
      [penaltyBase.ContractTotal]: '% sobre valor total estimado',
      [penaltyBase.FixedAmount]: 'Valor fixo',
      [penaltyBase.MonthlyMultiple]: 'Múltiplos da mensalidade',
    }),
  },
  {
    name: 'penaltyValue',
    label: 'Parâmetro da multa de encerramento',
    control: 'decimal',
    help: 'Conforme a base contratual; não gera cálculo nesta demonstração.',
  },
  { name: 'terminationPaymentDays', label: 'Prazo após o distrato (dias)', control: 'integer' },
  {
    name: 'terminationPaymentRule',
    label: 'Contagem do prazo de distrato',
    control: 'select',
    options: options({
      [paymentDayRule.Calendar]: 'Dias corridos',
      [paymentDayRule.Business]: 'Dias úteis',
    }),
  },
  { name: 'penaltyText', label: 'Regra ou cláusula de encerramento', control: 'textarea' },
] as const satisfies readonly AdministrationFieldDefinition[];
export const financeFields = [
  {
    name: 'contractValue',
    label: 'Valor do contrato (R$)',
    control: 'decimal',
    help: 'Use vírgula ou ponto decimal, sem separador de milhar.',
  },
  {
    name: 'billingFrequency',
    label: 'Recorrência de cobrança',
    control: 'select',
    options: optionalOptions({
      [billingFrequency.Monthly]: 'Mensal',
      [billingFrequency.Single]: 'Única',
      [billingFrequency.Quarterly]: 'Trimestral',
      [billingFrequency.Custom]: 'Personalizada',
    }),
  },
  {
    name: 'paymentMethod',
    label: 'Forma de pagamento',
    control: 'select',
    options: optionalOptions({
      [paymentMethod.Pix]: 'Pix',
      [paymentMethod.Boleto]: 'Boleto',
      [paymentMethod.Transfer]: 'Transferência',
      [paymentMethod.Card]: 'Cartão',
      [paymentMethod.Other]: 'Outra',
    }),
  },
  {
    name: 'billingDueRule',
    label: 'Regra de vencimento',
    control: 'select',
    options: optionalOptions({
      [billingDueRule.FixedDay]: 'Dia fixo',
      [billingDueRule.FirstBusinessDay]: 'Primeiro dia útil',
      [billingDueRule.LastBusinessDay]: 'Último dia útil',
      [billingDueRule.Custom]: 'Personalizada',
    }),
  },
  {
    name: 'billingDay',
    label: 'Dia fixo de vencimento',
    control: 'integer',
    help: 'De 1 a 31; utilizado somente quando a regra for dia fixo.',
  },
  { name: 'billingLeadDays', label: 'Antecedência do aviso (dias)', control: 'integer' },
  { name: 'paymentTermDays', label: 'Prazo para pagamento (dias)', control: 'integer' },
  { name: 'lateFeePercent', label: 'Multa por atraso (%)', control: 'decimal' },
  { name: 'dailyInterestPercent', label: 'Juros diário (%)', control: 'decimal' },
  { name: 'financialNote', label: 'Observação financeira', control: 'textarea' },
] as const satisfies readonly AdministrationFieldDefinition[];
export const documentFields = [
  {
    name: 'driveUrl',
    label: 'Link da pasta documental',
    control: 'text',
    help: 'Somente referência http(s); não será aberta ou sincronizada automaticamente.',
  },
  { name: 'documentOwner', label: 'Responsável documental', control: 'text' },
  { name: 'documentNotes', label: 'Observação documental', control: 'textarea' },
] as const satisfies readonly AdministrationFieldDefinition[];
export const administrationGroups = [
  {
    title: 'Contrato',
    description:
      'Vigência e condições registradas, sem projeção de distrato ou alteração dos acessos.',
    fields: contractFields,
  },
  {
    title: 'Financeiro',
    description:
      'Registro das condições. Salvar não emite cobrança, agenda aviso ou registra pagamento.',
    fields: financeFields,
  },
  {
    title: 'Documentos',
    description:
      'Referências administrativas; não são upload, assinatura ou comprovação da adesão.',
    fields: documentFields,
  },
];
