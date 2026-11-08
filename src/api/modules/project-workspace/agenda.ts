import { z } from 'zod';
import { type WorkspaceClient } from '../../supabase';
import { decodePdf, encodePdf, pdfPayload } from './pdf-payload';

const slot = z.object({ startsAt: z.string(), endsAt: z.string() });
export const absenceCategory = z.enum([
  'client',
  'cali',
  'external',
  'health',
  'travel_vacation',
  'other',
]);
const changeKind = z.enum(['cancel', 'reschedule']);
const change = z.object({
  id: z.uuid(),
  action: changeKind,
  status: z.enum(['pending', 'approved', 'declined']),
  reason: z.string(),
  slots: z.array(slot),
  note: z.string().nullable(),
});
export type AppointmentChange = z.infer<typeof change>;
const localSlot = z.object({
  start: z.iso.datetime({ local: true }),
  end: z.iso.datetime({ local: true }),
});
const appointments = z.array(
  z.object({
    id: z.uuid(),
    title: z.string(),
    status: z.string(),
    request_mode: z.enum(['remote', 'in_person']),
    created_at: z.string(),
    admin_note: z.string().nullable(),
    requested_slots: z.array(slot),
    admin_proposed_slots: z.array(slot),
    sync_status: z.string().nullable(),
    meetingAt: z.string().nullable().optional(),
    canReadMaterial: z.boolean().optional(),
    canManageGuests: z.boolean().optional(),
    minutes: z.string().nullish(),
    minutesVersion: z.string().nullish(),
    participants: z
      .array(
        z.object({
          id: z.uuid(),
          name: z.string().nullable(),
          role: z.enum(['admin', 'client', 'external']),
          status: z.enum(['pending', 'accepted', 'declined', 'tentative']),
          canRemove: z.boolean().optional(),
        }),
      )
      .optional(),
    canRequestChange: z.boolean().optional(),
    canComplete: z.boolean().optional(),
    absenceEventId: z.uuid().nullish(),
    replacementEventId: z.uuid().nullish(),
    replacementPending: z.boolean().optional(),
    latestChange: change.nullable().optional(),
  }),
);
export type AppointmentParticipant = NonNullable<
  z.infer<typeof appointments>[number]['participants']
>[number];
const materialItem = z.object({
  id: z.uuid(),
  label: z.string().nullable(),
  url: z.url({ protocol: /^https$/ }).nullable(),
});
const agendaMaterial = z.object({ link: materialItem.optional(), pdf: materialItem.optional() });
type MaterialChange =
  | { kind: 'link'; label: string; url: string }
  | { kind: 'pdf'; file: File }
  | { kind: 'link' | 'pdf'; remove: true };
const request = z.object({
  mode: z.enum(['remote', 'in_person']),
  title: z.string().trim().min(2).max(160),
  purpose: z.string().trim().max(2000),
  location: z.string().trim().max(400),
  slots: z.array(localSlot).min(1).max(2),
});
export type AppointmentRequest = z.infer<typeof request>;

const cents = z.number().int().nonnegative().nullable();
const extraAction = z.enum([
  'book-visit',
  'offer',
  'decline',
  'fee',
  'confirm',
  'counter',
  'cancel',
  'reschedule',
]);
export type ExtraAgendaAction = z.infer<typeof extraAction>;
export const extraExpenseKind = z.enum(['transport', 'parking', 'food', 'extra_hours']);
const extraRequest = request.omit({ slots: true }).extend({
  title: z.string().trim().min(2).max(149),
  starts: z.tuple([z.iso.datetime({ local: true }), z.iso.datetime({ local: true })]),
  minutes: z.union([z.literal(60), z.literal(90), z.literal(240)]),
  ackName: z.string().trim().min(5).max(160),
  acknowledged: z.literal(true),
});
type ExtraRequest = z.infer<typeof extraRequest>;
const expenseInput = z.object({
  kind: extraExpenseKind,
  cents: z.number().int().min(1).max(100000000),
  note: z.string().trim().max(2000),
  hours: z.number().min(0.01).max(999.99).nullable(),
  approval: z.string().trim().max(2000),
});
const extras = z.object({
  canRequest: z.boolean().optional(),
  total: z.number().int().nonnegative(),
  entries: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      status: z.string(),
      requestedAt: z.string(),
      mode: z.enum(['remote', 'in_person']),
      amountCents: cents,
      acceptedAt: z.string().nullable(),
      cancellationCents: cents,
      quoteTerms: z.string().nullish(),
      quoteVersion: z.string().nullish(),
      version: z.string().nullish(),
      requestedSlots: z.array(slot).nullish(),
      offeredSlots: z.array(slot).nullish(),
      actions: z.array(extraAction).nullish(),
      canQuote: z.boolean().optional(),
      canRecordExpense: z.boolean().optional(),
      canCompleteVisit: z.boolean().optional(),
      expenses: z
        .array(
          z.object({
            id: z.uuid(),
            kind: extraExpenseKind,
            amountCents: z.number().int().positive(),
            protocol: z.string().nullable(),
            fileName: z.string().nullable(),
          }),
        )
        .nullish(),
    }),
  ),
});
export type AgendaExtra = z.infer<typeof extras>['entries'][number];

export function createAgendaOperations(client: WorkspaceClient) {
  return {
    async requestExtra(company: string, requestId: string, input: ExtraRequest) {
      const values = extraRequest.parse(input);
      const { data, error } = await client.rpc('v2_request_pilot_extra_appointment', {
        p_company_id: company,
        p_request_id: requestId,
        p_mode: values.mode,
        p_title: values.title,
        p_purpose: values.purpose,
        p_location: values.location,
        p_starts: values.starts,
        p_minutes: values.minutes,
        p_ack_name: values.ackName,
        p_acknowledged: values.acknowledged,
      });
      if (error?.code === '22023' || error?.code === 'P0001')
        throw new Error('Confira o nome cadastrado, as condições e as duas opções de horário.');
      if (error) throw new Error('Não foi possível abrir o pedido adicional.');
      return z.uuid().parse(data);
    },
    async quoteExtra(
      company: string,
      id: string,
      requestId: string,
      version: string,
      amount: number,
      note: string,
    ) {
      const { data, error } = await client.rpc('v2_quote_pilot_extra', {
        p_company_id: company,
        p_appointment_id: id,
        p_request_id: requestId,
        p_expected: version,
        p_amount_cents: amount,
        p_note: note,
      });
      if (error?.code === '22023' || error?.code === 'P0001')
        throw new Error('Confira o valor e as condições. Atualize a agenda se o pedido mudou.');
      if (error) throw new Error('Não foi possível salvar o orçamento.');
      return z.literal(id).parse(data);
    },
    async recordExtraExpense(
      company: string,
      id: string,
      requestId: string,
      input: z.infer<typeof expenseInput>,
    ) {
      const values = expenseInput.parse(input);
      const { data, error } = await client.rpc('v2_record_pilot_extra_expense', {
        p_company_id: company,
        p_appointment_id: id,
        p_request_id: requestId,
        p_kind: values.kind,
        p_amount_cents: values.cents,
        p_note: values.note,
        p_hours: values.hours,
        p_approval: values.approval,
      });
      if (error?.code === '22023' || error?.code === 'P0001')
        throw new Error('Confira a realização da visita e os dados da despesa.');
      if (error) throw new Error('Não foi possível registrar a despesa.');
      return z.string().min(1).parse(data);
    },
    async saveExtraExpensePdf(company: string, expense: string, requestId: string, file: File) {
      const { data, error } = await client.rpc('v2_save_pilot_extra_expense_pdf', {
        p_company_id: company,
        p_expense_id: expense,
        p_request_id: requestId,
        p_file_name: file.name,
        p_pdf_base64: await encodePdf(file),
      });
      if (error?.code === '22023') throw new Error('Confira o arquivo PDF.');
      if (error?.code === '40001') throw new Error('A despesa mudou. Atualize a agenda.');
      if (error) throw new Error('Não foi possível anexar o comprovante.');
      return z.literal(expense).parse(data);
    },
    async downloadExtraExpensePdf(company: string, expense: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_read_pilot_extra_expense_pdf', { p_company_id: company, p_expense_id: expense })
        .abortSignal(signal);
      if (error) throw new Error('Comprovante indisponível.');
      return decodePdf(pdfPayload.parse(data));
    },
    async actOnExtra(
      company: string,
      id: string,
      requestId: string,
      version: string,
      action: ExtraAgendaAction,
      input: {
        index: number | null;
        note: string;
        slots: z.infer<typeof localSlot>[];
        charge: boolean | null;
      },
    ) {
      const { data, error } = await client.rpc('v2_act_pilot_extra_appointment', {
        p_company_id: company,
        p_appointment_id: id,
        p_request_id: requestId,
        p_expected: version,
        p_action: action,
        p_index: input.index,
        p_note: z.string().trim().max(2000).parse(input.note),
        p_slots: z.array(localSlot).max(2).parse(input.slots),
        p_charge: input.charge,
      });
      if (error?.code === '22023' || error?.code === 'P0001')
        throw new Error('Confira o estado, o horário e as condições do pedido.');
      if (error) throw new Error('Não foi possível registrar a decisão do encontro adicional.');
      return z.literal(id).parse(data);
    },
    async material(company: string, id: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_read_pilot_agenda_material', {
          p_company_id: company,
          p_appointment_id: id,
        })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar os materiais da ata.');
      return agendaMaterial.parse(data);
    },
    async downloadMaterial(company: string, id: string, pdfId: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_read_pilot_agenda_material', {
          p_company_id: company,
          p_appointment_id: id,
          p_pdf_id: pdfId,
        })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível baixar o PDF da ata.');
      return decodePdf(pdfPayload.parse(data));
    },
    async saveMaterial(
      company: string,
      id: string,
      requestId: string,
      version: string | null,
      input: MaterialChange,
    ) {
      let label = null;
      let value = null;
      if (!('remove' in input)) {
        if (input.kind === 'link') {
          label = input.label.trim();
          value = z.url({ protocol: /^https$/ }).parse(input.url.trim());
        } else {
          label = input.file.name;
          value = await encodePdf(input.file);
        }
      }
      const { data, error } = await client.rpc('v2_save_pilot_agenda_material', {
        p_company_id: company,
        p_appointment_id: id,
        p_request_id: requestId,
        p_kind: input.kind,
        p_expected: version,
        p_label: label,
        p_value: value,
      });
      if (error?.code === '22023')
        throw new Error('Confira o arquivo, o link e a versão atual da ata.');
      if (error) throw new Error('Não foi possível salvar o material da ata.');
      return z.uuid().parse(data);
    },
    async changeGuest(
      company: string,
      id: string,
      requestId: string,
      guest: { id: string } | { name: string; email: string },
    ) {
      const { data, error } = await client.rpc('v2_change_pilot_agenda_guest', {
        p_company_id: company,
        p_appointment_id: id,
        p_request_id: requestId,
        p_guest_id: 'id' in guest ? guest.id : null,
        p_name: 'name' in guest ? guest.name.trim() : null,
        p_email: 'email' in guest ? z.email().parse(guest.email.trim()) : null,
      });
      if (error?.code === '22023')
        throw new Error('Confira os dados. Este e-mail pode já estar na reunião.');
      if (error) throw new Error('Não foi possível alterar os convidados.');
      return z.uuid().parse(data);
    },
    async saveMinutes(
      company: string,
      id: string,
      requestId: string,
      version: string,
      text: string,
    ) {
      const { data, error } = await client.rpc('v2_save_pilot_meeting_minutes', {
        p_company_id: company,
        p_appointment_id: id,
        p_request_id: requestId,
        p_expected: version,
        p_minutes: z.string().trim().min(1).max(6000).parse(text),
      });
      if (error?.code === '40001')
        throw new Error('A ata mudou. Atualize a agenda e revise o texto.');
      if (error) throw new Error('Não foi possível salvar a ata.');
      return z.literal(id).parse(data);
    },
    async acceptOnlineQuote(company: string, id: string, version: string) {
      const { data, error } = await client.rpc('v2_accept_pilot_online_extra_quote', {
        p_company_id: company,
        p_appointment_id: id,
        p_expected: version,
      });
      if (error?.code === '22023')
        throw new Error('O orçamento mudou ou deixou de estar disponível. Atualize a agenda.');
      if (error) throw new Error('Não foi possível aceitar o orçamento.');
      return z.literal(id).parse(data);
    },
    async listExtras(company: string, page: number, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_list_pilot_agenda_extras', { p_company_id: company, p_page: page })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar os encontros adicionais.');
      return extras.parse(data);
    },
    async list(company: string, page: number, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_list_pilot_appointments', {
          p_company_id: company,
          p_page: page,
        })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar os pedidos de agenda.');
      return appointments.parse(data);
    },
    async request(company: string, id: string, input: AppointmentRequest) {
      const fields = request.parse(input);
      const { data, error } = await client.rpc('v2_request_pilot_appointment', {
        p_company_id: company,
        p_request_id: id,
        p_mode: fields.mode,
        p_title: fields.title,
        p_purpose: fields.purpose,
        p_location: fields.location,
        p_slots: fields.slots,
      });
      if (error?.code === '22023')
        throw new Error('Confira as opções e a cobertura do encontro no contrato.');
      if (error) throw new Error('Não foi possível registrar a solicitação.');
      return z.uuid().parse(data);
    },
    async requestChange(
      company: string,
      appointment: string,
      id: string,
      action: AppointmentChange['action'],
      reason: string,
      slots: z.infer<typeof localSlot>[],
    ) {
      const { data, error } = await client.rpc('v2_request_pilot_agenda_change', {
        p_company_id: company,
        p_appointment_id: appointment,
        p_request_id: id,
        p_action: action,
        p_reason: z.string().trim().min(5).max(2000).parse(reason),
        p_slots: z
          .array(localSlot)
          .length(action === 'reschedule' ? 2 : 0)
          .parse(slots),
      });
      if (error?.code === '40001')
        throw new Error('Já existe um pedido em análise ou a reunião mudou.');
      if (error?.code === '22023' || error?.code === '22007' || error?.code === '22008')
        throw new Error('Confira o motivo e os horários disponíveis para remarcar.');
      if (error) throw new Error('Não foi possível pedir a alteração.');
      return z.uuid().parse(data);
    },
    async decideChange(
      company: string,
      id: string,
      approve: boolean,
      note: string,
      index: number | null,
    ) {
      const { data, error } = await client.rpc('v2_decide_pilot_agenda_change', {
        p_company_id: company,
        p_change_id: id,
        p_approve: approve,
        p_note: z.string().trim().min(5).max(2000).parse(note),
        p_index: index,
      });
      if (error?.code === '40001')
        throw new Error('A reunião ou a disponibilidade mudou. Confira a agenda.');
      if (error) throw new Error('Não foi possível registrar a decisão.');
      return z.literal(id).parse(data);
    },
    async complete(company: string, id: string) {
      const { data, error } = await client.rpc('v2_complete_pilot_appointment', {
        p_company_id: company,
        p_appointment_id: id,
      });
      if (error?.code === '40001' || error?.code === '42501')
        throw new Error('Confira o horário e a situação atual da reunião.');
      if (error) throw new Error('Não foi possível registrar a realização.');
      return z.literal(id).parse(data);
    },
    async offerReplacement(
      company: string,
      appointment: string,
      event: string,
      requestId: string,
      start: string,
      note: string,
    ) {
      const { data, error } = await client.rpc('v2_offer_pilot_appointment_replacement', {
        p_company_id: company,
        p_appointment_id: appointment,
        p_event_id: event,
        p_request_id: requestId,
        p_start: localSlot.shape.start.parse(start),
        p_note: z.string().trim().max(2000).parse(note),
      });
      if (error?.code === '40001')
        throw new Error('Confira a situação do pedido e a cobertura do horário escolhido.');
      if (error?.code === '22023')
        throw new Error('Escolha um horário futuro dentro da cobertura contratual.');
      if (error) throw new Error('Não foi possível oferecer a reposição.');
      return z.literal(appointment).parse(data);
    },
    async markAbsent(
      company: string,
      id: string,
      event: string,
      category: string,
      justified: boolean,
      note: string,
    ) {
      const { data, error } = await client.rpc('v2_mark_pilot_appointment_absent', {
        p_company_id: company,
        p_appointment_id: id,
        p_event_id: event,
        p_category: absenceCategory.parse(category),
        p_justified: justified,
        p_note: z.string().trim().min(3).max(1000).parse(note),
      });
      if (error?.code === '40001' || error?.code === '42501')
        throw new Error('Confira o horário e a situação atual da reunião.');
      if (error) throw new Error('Não foi possível registrar a reunião não realizada.');
      return z.literal(id).parse(data);
    },
    async respond(
      company: string,
      id: string,
      action: 'offer' | 'decline' | 'confirm',
      index: number | null,
      note: string,
    ) {
      const { data, error } = await client.rpc('v2_respond_pilot_appointment', {
        p_company_id: company,
        p_appointment_id: id,
        p_action: action,
        p_note: z.string().trim().max(2000).parse(note),
        p_index: index,
      });
      if (error?.code === '40001')
        throw new Error('A situação ou a disponibilidade mudou. Confira a agenda.');
      if (error) throw new Error('Não foi possível registrar a decisão de agenda.');
      return z.uuid().parse(data);
    },
  };
}
export type AgendaOperations = ReturnType<typeof createAgendaOperations>;
