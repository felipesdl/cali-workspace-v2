import { useSearch } from '@tanstack/react-router';

export function AccessGatePage() {
  const { reason } = useSearch({ from: '/acesso' });
  const message =
    reason === 'signed_out'
      ? 'Confirme seu acesso para continuar.'
      : reason === 'mfa_required'
        ? 'Conclua a segunda confirmação de acesso para continuar.'
        : reason === 'terms_required'
          ? 'Leia e confirme os termos vigentes para continuar.'
          : reason === 'terms_unavailable'
            ? 'Os termos estão indisponíveis no momento. Tente novamente.'
            : reason === 'wrong_role'
              ? 'Este endereço não está disponível para seu perfil.'
              : reason === 'blocked'
                ? 'Seu acesso está indisponível. Entre em contato com a CALI.'
                : 'Não foi possível confirmar seu acesso. Tente novamente.';
  return (
    <main className="tw:m-6 tw:text-body tw:text-copy" role="alert">
      <h1 className="tw:text-section tw:font-bold">Acesso indisponível</h1>
      <p>{message}</p>
    </main>
  );
}
