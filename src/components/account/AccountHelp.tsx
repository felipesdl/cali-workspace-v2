import { Link } from '@tanstack/react-router';
import { type ReactNode } from 'react';
import { accessSupportLink, privacySupportLink } from '../../lib/cali-contacts';
import { Panel } from '../ds/panel/Panel';

export function AccountHelp({
  admin = false,
  children,
}: {
  admin?: boolean;
  children?: ReactNode;
}) {
  return (
    <>
      <Panel aria-labelledby="account-help-title" className="tw:grid tw:gap-3">
        <h2 id="account-help-title" className="tw:m-0 tw:text-section tw:text-brand">
          Ajuda e contato
        </h2>
        <Link to={admin ? '/admin/registros' : '/cliente/registros'}>Acompanhar um assunto</Link>
        <a href={accessSupportLink}>Problemas de acesso</a>
        <a href={children ? '#meus-pedidos-de-dados' : privacySupportLink}>
          Pedidos sobre meus dados
        </a>
      </Panel>
      {children && (
        <div id="meus-pedidos-de-dados" className="tw:scroll-mt-20">
          {children}
        </div>
      )}
      <Panel aria-labelledby="account-about-title" className="tw:grid tw:gap-3">
        <h2 id="account-about-title" className="tw:m-0 tw:text-section tw:text-brand">
          Sobre a CALI
        </h2>
        <ul className="tw:m-0 tw:flex tw:list-none tw:flex-wrap tw:gap-4 tw:p-0">
          <li>
            <a href="https://www.instagram.com/calirh_/" target="_blank" rel="noreferrer">
              Instagram
            </a>
          </li>
          <li>
            <a href="https://br.linkedin.com/company/cali-rh" target="_blank" rel="noreferrer">
              LinkedIn
            </a>
          </li>
        </ul>
      </Panel>
    </>
  );
}
