export const AccessReason = {
  SignedOut: 'signed_out',
  MfaRequired: 'mfa_required',
  TermsRequired: 'terms_required',
  TermsUnavailable: 'terms_unavailable',
  WrongRole: 'wrong_role',
  Blocked: 'blocked',
  Unavailable: 'unavailable',
} as const;
export type AccessReason = (typeof AccessReason)[keyof typeof AccessReason];
export const accessReasonMessages = {
  signed_out: 'Confirme seu acesso para continuar.',
  mfa_required: 'Conclua a segunda confirmação de acesso para continuar.',
  terms_required: 'Leia e confirme os termos vigentes para continuar.',
  terms_unavailable: 'Os termos estão indisponíveis no momento. Tente novamente.',
  wrong_role: 'Este endereço não está disponível para seu perfil.',
  blocked: 'Seu acesso está indisponível. Entre em contato com a CALI.',
  unavailable: 'Não foi possível confirmar seu acesso. Tente novamente.',
} satisfies Record<AccessReason, string>;

export function parseAccessReason(value: string | undefined): AccessReason {
  // Motivos externos desconhecidos preservam a mensagem genérica.
  switch (value) {
    case 'signed_out':
    case 'mfa_required':
    case 'terms_required':
    case 'terms_unavailable':
    case 'wrong_role':
    case 'blocked':
      return value;
    default:
      return 'unavailable';
  }
}
