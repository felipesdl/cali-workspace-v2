import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type OwnProfileService } from '../own-profile';
import { type OwnProfilePatch, type OwnProfileValues } from '../own-profile-schemas';

export const ownProfileKey = (actor?: string) => ['own-profile', actor] as const;

export function useUpdateOwnProfile(
  actor: string,
  update: NonNullable<OwnProfileService['update']>,
  expected: OwnProfileValues,
) {
  const cache = useQueryClient();
  const queryKey = ownProfileKey(actor);
  return useMutation({
    mutationFn: (patch: OwnProfilePatch) => update(actor, expected, patch),
    onSuccess: async (result) => {
      if (result.status !== 'saved') return;
      await cache.cancelQueries({ queryKey });
      cache.setQueryData(queryKey, (current) => (current ? result.profile : current));
    },
  });
}
