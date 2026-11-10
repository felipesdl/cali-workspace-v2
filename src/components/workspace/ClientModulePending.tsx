import { Link } from '@tanstack/react-router';
import { clientPaths } from '../../app/navigation';
export function ClientModulePending() {
  return (
    <div>
      <p>
        Esta área do Workspace está em preparação. As informações serão disponibilizadas após a
        integração e validação do módulo.
      </p>
      <Link
        className="tw:text-brand tw:underline tw:underline-offset-4 tw:visited:text-brand tw:focus-visible:outline-2 tw:focus-visible:outline-offset-3 tw:focus-visible:outline-focus"
        to={clientPaths.overview}
      >
        Voltar ao início
      </Link>
    </div>
  );
}
