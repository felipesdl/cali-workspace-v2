import { createClient } from '@supabase/supabase-js';

export function createWorkspaceClient(url: string, publishableKey: string) {
  return createClient(url, publishableKey, {
    db: { schema: 'cali_workspace' },
    auth: {
      storageKey: `cali-v2-${new URL(url).hostname.split('.')[0]}-auth`,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
}
export type WorkspaceClient = ReturnType<typeof createWorkspaceClient>;
