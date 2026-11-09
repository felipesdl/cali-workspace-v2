import { workspaceRole } from '../../access/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { companyKeys } from '../keys';
import { type UpdateCompanyBasics } from '../schemas';
import { useCompaniesScope } from './useCompaniesScope';

export function useUpdateCompanyBasics() {
  const scope = useCompaniesScope();
  const { session } = useRouteContext({ from: '__root__' });
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateCompanyBasics) => {
      const state = session?.getSnapshot();
      if (
        session &&
        (state?.phase !== 'resolved' ||
          state.access.status !== 'ready' ||
          state.access.profile?.role !== workspaceRole.Admin)
      )
        throw new Error('Não foi possível confirmar sua permissão para editar.');
      return scope.service.updateBasics(input);
    },
    // Sem atualização otimista ou repopulação de cache após logout/troca de identidade.
    // Somente queries existentes do ator da operação são invalidadas.
    onSuccess: () => cache.invalidateQueries({ queryKey: companyKeys.all(scope.actor) }),
    retry: false,
  });
}
