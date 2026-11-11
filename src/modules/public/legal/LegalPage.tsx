/* Páginas públicas /privacidade, /termos e /politica-do-site: abertas sem login (links na entrada e no perfil). */
import { Link } from '@tanstack/react-router';
import { LegalDocument } from './components/LegalDocument';
import {
  LEGAL_UPDATED_AT,
  legalEnabled,
  privacyPolicy,
  sitePolicy,
  termsOfUse,
} from './legal-texts';
import './legal.css';

export function LegalPage({ kind }: { kind: 'privacy' | 'terms' | 'site' }) {
  const privacy = kind === 'privacy';
  return (
    <main className="v2-legal-page">
      <header className="v2-legal-top">
        <Link
          to="/login"
          className="v2-legal-brand"
          aria-label="Ir para a entrada do CALI Workspace"
        >
          <b>CALI</b> WORKSPACE
        </Link>
        <nav aria-label="Documentos">
          <Link to="/privacidade" className={kind === 'privacy' ? 'on' : ''}>
            Política de Privacidade
          </Link>
          <Link to="/termos" className={kind === 'terms' ? 'on' : ''}>
            Termos de Uso
          </Link>
          <Link to="/politica-do-site" className={kind === 'site' ? 'on' : ''}>
            Site, Mapa e Portal
          </Link>
        </nav>
      </header>
      {kind === 'site' ? (
        <LegalDocument source={sitePolicy()} idPrefix={kind} />
      ) : legalEnabled() ? (
        <LegalDocument source={privacy ? privacyPolicy() : termsOfUse()} idPrefix={kind} />
      ) : (
        <article className="v2-legal-doc">
          <h2>{privacy ? 'Política de Privacidade' : 'Termos de Uso'}</h2>
          <p>Documento em publicação. Em caso de dúvida, fale com a CALI RH.</p>
        </article>
      )}
      <footer className="v2-legal-foot">
        CALI RH · AKAYKO AZUMI RH LTDA ·{' '}
        {kind === 'site'
          ? 'Última atualização: 21 de agosto de 2026'
          : `Última atualização: ${LEGAL_UPDATED_AT}`}
      </footer>
    </main>
  );
}
