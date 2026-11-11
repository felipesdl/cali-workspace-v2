import { Link } from '@tanstack/react-router';
import { skipToken, useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronDown, ChevronRight } from 'lucide-react';
import { useRef } from 'react';
import { useOwnProfileQuery } from '../api/access/hooks/useOwnProfileQuery';
import { ownProfileMediaKey } from '../api/access/profile-media';

export function WorkspaceProfileMenu({
  admin,
  onLogout,
}: {
  admin: boolean;
  onLogout: () => void;
}) {
  const { ownProfile, actor, query } = useOwnProfileQuery();
  const mediaService = ownProfile?.media;
  const { data: media } = useQuery({
    queryKey: ownProfileMediaKey(actor?.id),
    queryFn:
      mediaService && actor?.active
        ? ({ signal }) => mediaService.read(actor.id, signal)
        : skipToken,
    retry: false,
  });
  const menu = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const profile = query.isSuccess ? query.data : undefined;
  const name = profile?.full_name?.trim() || 'Minha conta';
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toLocaleUpperCase('pt-BR');
  function close() {
    if (menu.current) menu.current.open = false;
  }
  if (!ownProfile)
    return (
      <button type="button" className="workspace-profile-trigger" onClick={onLogout}>
        Sair
      </button>
    );
  return (
    <details
      ref={menu}
      className="workspace-profile-menu"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !menu.current?.open) return;
        event.preventDefault();
        close();
        trigger.current?.focus();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
    >
      <summary ref={trigger} className="workspace-profile-trigger" aria-label="Menu do perfil">
        <span className="workspace-profile-avatar" aria-hidden="true">
          <span>{initials}</span>
          {media?.avatar_url && (
            <img
              key={media.avatar_url}
              src={media.avatar_url}
              alt=""
              style={{
                objectPosition: `${media.avatar_position_x}% ${media.avatar_position_y}%`,
                transform: `scale(${media.avatar_zoom})`,
              }}
              onError={(event) => (event.currentTarget.hidden = true)}
            />
          )}
        </span>
        <span className="workspace-profile-name">{name}</span>
        <ChevronDown size={13} aria-hidden="true" />
      </summary>
      <div className="workspace-profile-dropdown">
        <Link to={admin ? '/admin/minha-conta' : '/cliente/minha-conta'} onClick={close}>
          Ver meu perfil <ChevronRight size={14} aria-hidden="true" />
        </Link>
        {!admin && (
          <Link to="/cliente/ajuda" onClick={close}>
            Dúvidas frequentes <ChevronRight size={14} aria-hidden="true" />
          </Link>
        )}
        <button type="button" onClick={onLogout}>
          Sair <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    </details>
  );
}
