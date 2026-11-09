import { Link, useRouteContext } from '@tanstack/react-router';
import { useRef } from 'react';
import { clientAccountPaths } from '../../app/navigation';
import { TeamMonthlyReminder } from '../team/TeamMonthlyReminder';
import { teamSearchSchema } from '../../api/modules/team/schemas';
const linkClass =
  'tw:text-brand tw:underline tw:underline-offset-4 tw:visited:text-brand tw:focus-visible:outline-2 tw:focus-visible:outline-offset-3 tw:focus-visible:outline-focus';
export function ClientOverview() {
  const { team } = useRouteContext({ from: '__root__' });
  const accountHeading = useRef<HTMLHeadingElement>(null);
  return (
    <div className="tw:grid tw:gap-6">
      <TeamMonthlyReminder fallbackFocus={accountHeading} />
      <section aria-labelledby="client-account-access-title">
        <h2
          id="client-account-access-title"
          ref={accountHeading}
          tabIndex={-1}
          className="tw:mt-0 tw:text-section tw:text-brand"
        >
          Sua empresa no Workspace
        </h2>
        <p>
          Seu acesso foi confirmado. Consulte a identificação da sua empresa e os documentos de uso
          e privacidade.
        </p>
        <ul className="tw:grid tw:gap-3 tw:pl-5">
          {team && (
            <li>
              <Link className={linkClass} to="/cliente/equipe" search={teamSearchSchema.parse({})}>
                Consultar equipe
              </Link>
            </li>
          )}
          <li>
            <Link className={linkClass} to={clientAccountPaths.company}>
              Consultar minha empresa
            </Link>
          </li>
          <li>
            <Link className={linkClass} to={clientAccountPaths.terms}>
              Consultar termos e privacidade
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
