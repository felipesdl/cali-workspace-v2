import { type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { CalendarDays, FileText, FolderKanban, Leaf } from 'lucide-react';
import './access-shell.css';

const modules = [
  { icon: FolderKanban, label: 'Projetos, entregas e aprovações' },
  { icon: CalendarDays, label: 'Agenda, horas e capacidade' },
  { icon: FileText, label: 'Documentos e relatórios do ciclo' },
];

export function AccessShell({ children, busy }: { children: ReactNode; busy?: boolean }) {
  return (
    <main className="cali-access">
      <section className="cali-access-brand" aria-label="CALI Workspace">
        <img
          className="cali-access-art cali-access-oak-top"
          src="/brand/cali-oak-mark.svg"
          alt=""
        />
        <img className="cali-access-art cali-access-lime" src="/brand/cali-lime-mark.svg" alt="" />
        <img
          className="cali-access-art cali-access-oak-bottom"
          src="/brand/cali-oak-mark.svg"
          alt=""
        />
        <Link to="/" className="cali-access-logo" aria-label="Página inicial CALI Workspace">
          <img src="/brand/cali-workspace-transparent.svg" alt="CALI Workspace" />
        </Link>
        <div className="cali-access-intro">
          <p className="cali-access-headline">
            O trabalho
            <br />
            continua aqui<span>.</span>
          </p>
          <div className="cali-access-intro-details">
            <p>
              Acompanhe o ciclo, valide o que importa e decida com contexto, sem depender de e-mails
              e planilhas.
            </p>
            <ul aria-label="O que está no Workspace">
              {modules.map(({ icon: Icon, label }) => (
                <li key={label}>
                  <Icon size={16} aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="cali-access-signature">
          <Leaf size={30} aria-hidden="true" />
          <p>
            Pessoas como estratégia.
            <br />
            Negócios que evoluem.
          </p>
        </div>
      </section>
      <div className="cali-access-stage">
        <section className="cali-access-card" aria-labelledby="access-title" aria-busy={busy}>
          {children}
        </section>
      </div>
      <footer className="cali-access-footer">
        <span>© 2026 CALI RH</span>
        <nav aria-label="Políticas e contato">
          <Link to="/termos">Termos</Link>
          <Link to="/privacidade">Privacidade</Link>
          <Link to="/politica-do-site">Site, Mapa e Portal</Link>
          <a href="https://calirh.com" target="_blank" rel="noreferrer">
            calirh.com
          </a>
        </nav>
      </footer>
    </main>
  );
}
