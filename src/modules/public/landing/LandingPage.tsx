import './landing-page.css';
import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  FolderOpen,
  Gauge,
  Instagram,
  LayoutDashboard,
  Leaf,
  LineChart,
  Linkedin,
  Mail,
  Menu,
  MessageCircle,
  ShieldCheck,
  Target,
  Users,
  Workflow,
  X,
  ArrowUpRight,
} from 'lucide-react';
import { patiWavePoster, patiWaveVideo } from './media/patiWaveMedia';

const carouselPhotoModules = import.meta.glob<string>('./media/carousel/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
});

const workspaceScreenModules = import.meta.glob<string>('./media/screens/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
});

const CAROUSEL_PHOTO_URLS = Object.entries(carouselPhotoModules)
  .sort(([a], [b]) => a.localeCompare(b, 'pt-BR', { numeric: true }))
  .map(([, url]) => url);

const WORKSPACE_SCREEN_URLS = Object.entries(workspaceScreenModules)
  .sort(([a], [b]) => a.localeCompare(b, 'pt-BR', { numeric: true }))
  .map(([, url]) => url);

type ScreenSlot = {
  label: string;
  eyebrow: string;
  description: string;
  src?: string;
  fallbackSrc?: string;
};

const WA_LINK =
  'https://wa.me/5541987791933?text=' +
  encodeURIComponent(
    'Olá, Patrícia. Vim pela apresentação do CALI Workspace e quero entender melhor a assessoria da CALI.',
  );

const DEFAULT_SCREENSHOTS: ScreenSlot[] = [
  {
    label: 'Início',
    eyebrow: 'ÁREA DO CLIENTE',
    description: 'Visão executiva do ciclo, entregas, horas e frentes ativas.',
    src: '/landing/client-home.svg?v=9',
  },
  {
    label: 'Planejamento',
    eyebrow: 'AGENDA & PRÓXIMOS PASSOS',
    description: 'Reuniões, validações, prazos e próximos compromissos.',
    src: '/landing/client-planejamento.svg?v=9',
  },
  {
    label: 'Entregáveis',
    eyebrow: 'CRONOGRAMA COMPARTILHADO',
    description: 'Frentes, entregáveis, aprovações e sequência de implantação.',
    src: '/landing/client-entregaveis.svg?v=9',
  },
  {
    label: 'Horas do ciclo',
    eyebrow: 'TRANSPARÊNCIA DO SERVIÇO',
    description: 'Consumo, saldo disponível e registros do período.',
    src: '/landing/client-horas.svg?v=9',
  },
  {
    label: 'Ocorrências',
    eyebrow: 'CANAL COM A CALI',
    description: 'Solicitações, status e histórico.',
    src: '/landing/client-ocorrencias.svg?v=9',
  },
  {
    label: 'Documentos',
    eyebrow: 'GOVERNANÇA',
    description: 'Acervo, busca, versões aprovadas e documentos.',
    src: '/landing/client-documentos.svg?v=9',
  },
];

const SCREEN_DESCRIPTIONS = [
  {
    label: 'Visão geral',
    description: 'Prioridades, entregas e horas do ciclo reunidas na entrada da empresa.',
  },
  {
    label: 'Conversa com a Pati',
    description: 'Um canal direto para dúvidas e pedidos que precisam de acompanhamento.',
  },
  {
    label: 'Planejamento',
    description: 'Reuniões, prazos e próximos passos publicados em um lugar só.',
  },
  {
    label: 'Entregáveis',
    description: 'Cronograma para acompanhar, comentar e aprovar o que está sendo construído.',
  },
  {
    label: 'Detalhe da entrega',
    description: 'Prazo, versão, arquivos e aprovação da entrega no mesmo lugar.',
  },
  {
    label: 'Horas do ciclo',
    description: 'Consumo e saldo do período com o detalhe do trabalho realizado.',
  },
  {
    label: 'Ocorrências',
    description: 'Solicitações e situações acompanhadas com status e histórico.',
  },
  {
    label: 'Histórico da solicitação',
    description: 'A conversa com a CALI permanece junto da solicitação.',
  },
  {
    label: 'Documentos',
    description: 'Versões aprovadas e arquivos da empresa organizados para consulta.',
  },
];

const SCREENSHOTS: ScreenSlot[] = WORKSPACE_SCREEN_URLS.length
  ? WORKSPACE_SCREEN_URLS.map((src, index) => ({
      label: SCREEN_DESCRIPTIONS[index]?.label ?? `Tela do Workspace ${index + 1}`,
      eyebrow: 'CALI WORKSPACE',
      description: SCREEN_DESCRIPTIONS[index]?.description ?? 'Tela real do CALI Workspace.',
      src,
    }))
  : DEFAULT_SCREENSHOTS;

type PhotoSlot = {
  title: string;
  mark: 'oak' | 'lime';
  src?: string;
  objectPosition?: string;
};

const DEFAULT_PHOTO_SLOTS: PhotoSlot[] = [
  {
    title: 'Foto CALI 1',
    mark: 'oak',
    src: '/landing/pati-mic.webp?v=9',
    objectPosition: '50% 34%',
  },
  {
    title: 'Foto CALI 2',
    mark: 'lime',
    src: '/landing/pati-presentation.webp?v=9',
    objectPosition: '62% 50%',
  },
  {
    title: 'Foto CALI 3',
    mark: 'oak',
    src: '/landing/pati-conarh.webp?v=9',
    objectPosition: '50% 32%',
  },
  {
    title: 'Foto CALI 4',
    mark: 'lime',
    src: '/landing/pati-speaking.webp?v=9',
    objectPosition: '65% 44%',
  },
];

const PHOTO_SLOTS: PhotoSlot[] = CAROUSEL_PHOTO_URLS.length
  ? CAROUSEL_PHOTO_URLS.map((src, index) => ({
      title: `Foto CALI ${index + 1}`,
      mark: index % 2 === 0 ? 'oak' : 'lime',
      src,
      objectPosition: '50% 50%',
    }))
  : DEFAULT_PHOTO_SLOTS;

const MODULES = [
  {
    icon: LayoutDashboard,
    title: 'Visão geral',
    text: 'O que está acontecendo agora, sem caçar informação em várias telas.',
  },
  {
    icon: Workflow,
    title: 'Projetos e entregáveis',
    text: 'Execução, status, aprovações, ajustes e conversas vinculadas à entrega.',
  },
  {
    icon: Clock3,
    title: 'Horas',
    text: 'Acompanhamento do ciclo com contexto — não controle de ponto.',
  },
  {
    icon: CalendarDays,
    title: 'Planejamento',
    text: 'Cronograma, reuniões e marcos compartilhados com a empresa.',
  },
  {
    icon: FolderOpen,
    title: 'Documentos',
    text: 'Arquivos finais, validade e histórico organizados para governança.',
  },
  {
    icon: FileText,
    title: 'Relatórios',
    text: 'Leitura executiva do período, com resultado, risco e próximos passos.',
  },
  {
    icon: MessageCircle,
    title: 'Conversas no contexto',
    text: 'Decisão e alinhamento ficam junto do projeto, documento ou entrega.',
  },
  {
    icon: Gauge,
    title: 'Indicadores',
    text: 'Dados que ajudam a liderança a decidir, sem relatório montado por montar.',
  },
  {
    icon: ClipboardCheck,
    title: 'Validações',
    text: 'O cliente acompanha, comenta, aprova e solicita ajustes com histórico.',
  },
];

const STEPS = [
  {
    n: '01',
    icon: Target,
    title: 'Direção',
    text: 'A CALI entende o momento do negócio, define prioridade e organiza o ciclo.',
  },
  {
    n: '02',
    icon: Workflow,
    title: 'Planejamento',
    text: 'Projetos, marcos, reuniões e entregáveis entram no Workspace com clareza.',
  },
  {
    n: '03',
    icon: Users,
    title: 'Execução conjunta',
    text: 'A CALI conduz. A liderança acompanha, participa e valida sem operar um SaaS de RH.',
  },
  {
    n: '04',
    icon: LineChart,
    title: 'Leitura executiva',
    text: 'O ciclo fecha com resultado, riscos, decisões tomadas e próximos movimentos.',
  },
];

const PACKAGE_FEATURES = {
  partner: [
    'Reunião mensal com founders, diretoria ou RH',
    'Indicadores, desenvolvimento e apoio às decisões críticas',
    'Políticas e processos priorizados conforme escopo e complexidade',
    'Acesso ao CALI Workspace durante o contrato',
  ],
  full: [
    '1 visita presencial fixa por mês',
    'Acompanhamento quinzenal com a liderança',
    'Cargos & Salários, People Analytics nível 3 e desenvolvimento',
    'Políticas, processos e projetos conforme complexidade e escopo',
    'Acesso ao CALI Workspace durante o contrato',
  ],
};

function BrandSlot({
  title,
  mark = 'oak',
  src,
  objectPosition = '50% 50%',
}: {
  title: string;
  mark?: 'oak' | 'lime';
  src?: string;
  objectPosition?: string;
}) {
  return (
    <div className={`lp-photo-slot ${src ? 'has-photo' : ''}`}>
      {src ? (
        <img className="lp-photo-user" src={src} alt={title} style={{ objectPosition }} />
      ) : (
        <img
          className="lp-photo-brand-mark"
          src={mark === 'oak' ? '/brand/cali-oak-mark-light.svg' : '/brand/cali-lime-mark.svg'}
          alt=""
          aria-hidden="true"
        />
      )}
      {!src && (
        <div className="lp-photo-caption" aria-hidden="true">
          <small>imagem CALI</small>
        </div>
      )}
    </div>
  );
}

function ScreenVisual({ slot }: { slot: ScreenSlot }) {
  if (slot.src) {
    return (
      <img
        className="lp-screen-image"
        src={slot.src}
        alt={slot.label}
        decoding="async"
        onError={(event) => {
          if (!slot.fallbackSrc) return;
          const image = event.currentTarget;
          if (image.dataset.fallbackApplied === 'true') return;
          image.dataset.fallbackApplied = 'true';
          image.src = slot.fallbackSrc;
        }}
      />
    );
  }

  return (
    <div
      className="lp-screen-placeholder"
      aria-label={`Espaço reservado para print: ${slot.label}`}
    >
      <img src="/brand/cali-oak-mark-light.svg" alt="" aria-hidden="true" />
      <span>{slot.eyebrow}</span>
      <strong>{slot.label}</strong>
      <small>print reservado para inserir depois</small>
    </div>
  );
}

export function LandingPage() {
  const [activeScreen, setActiveScreen] = useState(0);
  const heroScreenRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 40);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  useEffect(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.cali-landing [data-lp-reveal], .cali-landing [data-lp-flow]',
      ),
    );
    const revealAll = () => nodes.forEach((node) => node.classList.add('is-visible'));
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !('IntersectionObserver' in window)
    ) {
      revealAll();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const interval = window.setTimeout(() => {
      setActiveScreen((value) => (value + 1) % SCREENSHOTS.length);
    }, 4600);
    return () => window.clearTimeout(interval);
  }, [activeScreen]);

  return (
    <main className="cali-landing">
      <header className={`lp-site-header ${scrolled ? 'scrolled' : ''}`}>
        <div className="lp-site-nav-shell">
          <a
            href="https://calirh.com"
            className="lp-site-brand"
            aria-label="CALI RH, ir para a página inicial"
          >
            <img src="/brand/cali-logo-light.svg" alt="CALI RH" />
          </a>
          <nav
            className={`lp-site-nav-links ${menuOpen ? 'open' : ''}`}
            aria-label="Menu principal"
          >
            <a href="https://calirh.com">Início</a>
            <a href="https://calirh.com/assessoria">Assessoria mensal</a>
            <a href="https://calirh.com/projetos">Projetos e soluções</a>
            <a href="https://calirh.com/sobre">A CALI</a>
            <a href="https://comuni.calirh.com/" target="_blank" rel="noopener noreferrer">
              ComuniCALI
            </a>
            <div className="lp-site-mobile-utility">
              <a href="https://portal.calirh.com">
                Portal CALI <ArrowUpRight size={16} />
              </a>
              <Link to="/" onClick={() => setMenuOpen(false)}>
                CALI Workspace <ArrowUpRight size={16} />
              </Link>
              <div className="lp-site-mobile-social">
                <a
                  href="https://www.instagram.com/calirh_/"
                  aria-label="Instagram"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Instagram size={24} />
                </a>
                <a
                  href="https://www.linkedin.com/in/patriciaazumi/"
                  aria-label="LinkedIn"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Linkedin size={24} />
                </a>
                <a href="mailto:patricia@calirh.com" aria-label="E-mail">
                  <Mail size={24} />
                </a>
              </div>
            </div>
            <a
              className="lp-site-mobile-contact"
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
            >
              Fale com a Pati
            </a>
          </nav>
          <div className="lp-site-nav-utilities">
            <a href="https://portal.calirh.com">Portal CALI</a>
            <Link to="/" aria-current="page">
              Workspace
            </Link>
            <span className="lp-site-nav-social">
              <a
                href="https://www.instagram.com/calirh_/"
                aria-label="Instagram"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Instagram size={21} />
              </a>
              <a
                href="https://www.linkedin.com/in/patriciaazumi/"
                aria-label="LinkedIn"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Linkedin size={21} />
              </a>
              <a href="mailto:patricia@calirh.com" aria-label="E-mail">
                <Mail size={21} />
              </a>
            </span>
          </div>
          <a
            className="lp-site-nav-contact"
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
          >
            Vamos conversar <ArrowUpRight size={16} />
          </a>
          <button
            className="lp-site-menu-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      <section className="lp-hero" id="inicio">
        <div className="lp-shell lp-hero-grid">
          <div className="lp-hero-copy" data-lp-reveal="left">
            <span className="lp-eyebrow">CALI WORKSPACE</span>
            <h1>
              Acompanhe seus projetos <span>com o app da CALI.</span>
            </h1>
            <p className="lp-hero-lead">
              Entregas, horas, agenda, documentos e decisões da sua empresa com a CALI, no mesmo
              lugar e com histórico.
            </p>
            <div className="lp-hero-ctas">
              <Link className="lp-hero-login" to="/login">
                Entrar no Workspace <ArrowUpRight size={19} aria-hidden="true" />
              </Link>
              <a className="lp-hero-secondary" href="#workspace">
                Ver o app por dentro <ArrowRight size={17} aria-hidden="true" />
              </a>
            </div>
            <ul className="lp-hero-proof" aria-label="O que o Workspace reúne">
              <li>
                <strong>Entregas</strong>
                <span>aprovação e histórico</span>
              </li>
              <li>
                <strong>Horas</strong>
                <span>consumo do ciclo</span>
              </li>
              <li>
                <strong>Documentos</strong>
                <span>versões aprovadas</span>
              </li>
            </ul>
          </div>

          <div className="lp-hero-product" data-lp-reveal="right">
            <div className="lp-hero-screen-float">
              <div
                className="lp-hero-screen-stage"
                ref={heroScreenRef}
                onPointerMove={(event) => {
                  if (
                    event.pointerType === 'touch' ||
                    window.matchMedia('(prefers-reduced-motion: reduce)').matches
                  )
                    return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  const x = (event.clientX - rect.left) / rect.width - 0.5;
                  const y = (event.clientY - rect.top) / rect.height - 0.5;
                  heroScreenRef.current?.style.setProperty('--tilt-x', `${-y * 7}deg`);
                  heroScreenRef.current?.style.setProperty('--tilt-y', `${x * 9}deg`);
                }}
                onPointerLeave={() => {
                  heroScreenRef.current?.style.setProperty('--tilt-x', '0deg');
                  heroScreenRef.current?.style.setProperty('--tilt-y', '0deg');
                }}
              >
                <img
                  src={WORKSPACE_SCREEN_URLS[0] || '/landing/cali-workspace-login-v2.jpg?v=1'}
                  alt="Visão geral do CALI Workspace"
                />
                <div className="lp-hero-chip lp-hero-chip-a" aria-hidden="true">
                  <span className="dot" />
                  <div>
                    <small>VALIDAÇÃO</small>
                    <strong>1 entrega aguarda você</strong>
                  </div>
                </div>
                <div className="lp-hero-chip lp-hero-chip-b" aria-hidden="true">
                  <div>
                    <small>HORAS DO MÊS</small>
                    <strong>1h30 de 20h</strong>
                  </div>
                  <i>
                    <b style={{ width: '18%' }} />
                  </i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section lp-section-light" id="cali">
        <div className="lp-shell lp-about-grid">
          <div className="lp-section-copy" data-lp-reveal="left">
            <span className="lp-kicker">A CALI RH</span>
            <h2>A plataforma organiza o trabalho. A condução continua sendo da CALI.</h2>
            <p>
              A CALI atua como <strong>People Advisory Executive</strong> junto à liderança. O
              Workspace registra prioridades, entregas e decisões sem transformar o cliente em
              operador de software.
            </p>
            <p>
              <strong>A CALI conduz.</strong> O cliente enxerga o ciclo, valida o que importa e
              decide com contexto.
            </p>
            <a className="lp-text-link" href="https://calirh.com" target="_blank" rel="noreferrer">
              Ver a atuação da CALI <ArrowRight size={15} />
            </a>
          </div>

          <div className="lp-principles" data-lp-reveal="right">
            <article>
              <Leaf size={21} />
              <span>Direção</span>
              <strong>prioridade antes de atividade</strong>
            </article>
            <article>
              <BarChart3 size={21} />
              <span>Leitura</span>
              <strong>dados antes de opinião solta</strong>
            </article>
            <article>
              <Users size={21} />
              <span>Proximidade</span>
              <strong>ao lado da liderança</strong>
            </article>
            <article>
              <ShieldCheck size={21} />
              <span>Governança</span>
              <strong>registro sem burocracia</strong>
            </article>
          </div>
        </div>

        <div className="lp-photo-rail" aria-label="Galeria de fotos da CALI">
          <div className="lp-photo-track">
            {PHOTO_SLOTS.flatMap((slot) => [
              { ...slot, railCopy: 'primary' },
              { ...slot, railCopy: 'loop' },
            ]).map((slot) => (
              <BrandSlot
                key={`${slot.title}-${slot.railCopy}`}
                title={slot.title}
                mark={slot.mark}
                src={slot.src}
                objectPosition={slot.objectPosition}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section lp-section-burgundy" id="workspace">
        <div className="lp-shell">
          <div className="lp-section-heading lp-section-heading-dark" data-lp-reveal>
            <span className="lp-kicker">DENTRO DO WORKSPACE</span>
            <h2>O que precisa estar visível para a decisão não depender de memória.</h2>
            <p>
              Projetos, horas, documentos, conversas e indicadores ficam no mesmo contexto, com
              histórico e responsabilidade claros.
            </p>
          </div>

          <div className="lp-module-grid">
            {MODULES.map((module, index) => {
              const Icon = module.icon;
              return (
                <article
                  className="lp-module-card"
                  key={module.title}
                  data-lp-reveal={index % 3 === 0 ? 'left' : index % 3 === 1 ? 'up' : 'right'}
                  style={{ transitionDelay: `${index * 55}ms` }}
                >
                  <Icon size={21} />
                  <h3>{module.title}</h3>
                  <p>{module.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="lp-section lp-section-ivory">
        <div className="lp-shell">
          <div className="lp-section-heading" data-lp-reveal>
            <span className="lp-kicker">UM LOGIN · DOIS AMBIENTES</span>
            <h2>Um login. Papéis diferentes. A mesma fonte de verdade.</h2>
          </div>

          <div className="lp-audience-grid">
            <article className="lp-audience-card" data-lp-reveal="left">
              <span className="lp-card-index">01</span>
              <div className="lp-audience-icon">
                <Users size={23} />
              </div>
              <small>AMBIENTE DO CLIENTE</small>
              <h3>Visibilidade sem virar operador da ferramenta.</h3>
              <p>
                Cronograma, entregáveis, horas, documentos e relatórios ficam disponíveis para
                consulta, comentários, aprovações e ajustes com histórico.
              </p>
              <div className="lp-mini-list">
                <span>
                  <Check size={15} /> acompanhar
                </span>
                <span>
                  <Check size={15} /> participar
                </span>
                <span>
                  <Check size={15} /> validar
                </span>
                <span>
                  <Check size={15} /> avaliar
                </span>
              </div>
            </article>

            <article className="lp-audience-card lp-audience-card-dark" data-lp-reveal="right">
              <span className="lp-card-index">02</span>
              <div className="lp-audience-icon">
                <LayoutDashboard size={23} />
              </div>
              <small>AMBIENTE CALI</small>
              <h3>A operação inteira no mesmo sistema.</h3>
              <p>
                Carteira, projetos, agenda, documentos, relatórios, Mapa de People e propostas ficam
                integrados à operação conduzida pela CALI.
              </p>
              <div className="lp-mini-list">
                <span>
                  <Check size={15} /> administrar
                </span>
                <span>
                  <Check size={15} /> executar
                </span>
                <span>
                  <Check size={15} /> interpretar
                </span>
                <span>
                  <Check size={15} /> decidir
                </span>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="lp-section lp-screens-section">
        <div className="lp-shell">
          <div
            className="lp-screen-carousel"
            role="region"
            aria-roledescription="carrossel"
            aria-label="Telas do CALI Workspace na prática"
            data-lp-reveal="zoom"
          >
            <div className="lp-screen-frame">
              {SCREENSHOTS.map((slot, index) => (
                <div
                  className={`lp-screen-slide ${index === activeScreen ? 'is-active' : ''}`}
                  key={slot.label}
                  aria-hidden={index !== activeScreen}
                >
                  <ScreenVisual slot={slot} />
                </div>
              ))}
            </div>

            <div className="lp-screen-controls">
              <button
                type="button"
                aria-label="Tela anterior"
                onClick={() =>
                  setActiveScreen((value) => (value - 1 + SCREENSHOTS.length) % SCREENSHOTS.length)
                }
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                aria-label="Próxima tela"
                onClick={() => setActiveScreen((value) => (value + 1) % SCREENSHOTS.length)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="lp-screen-dots" aria-label="Selecionar tela">
              {SCREENSHOTS.map((slot, index) => (
                <button
                  type="button"
                  key={slot.label}
                  aria-label={`Ver ${slot.label}`}
                  aria-current={index === activeScreen ? 'true' : undefined}
                  className={index === activeScreen ? 'is-active' : ''}
                  onClick={() => setActiveScreen(index)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section lp-video-section" id="fale-com-a-pati">
        <img
          className="lp-video-art lp-video-art-oak"
          src="/brand/cali-oak-mark-light.svg"
          alt=""
          aria-hidden="true"
        />
        <img
          className="lp-video-art lp-video-art-lime"
          src="/brand/cali-lime-mark.svg"
          alt=""
          aria-hidden="true"
        />
        <div className="lp-shell lp-video-grid">
          <div className="lp-video-copy" data-lp-reveal="left">
            <span className="lp-kicker">FALE COM A PATI</span>
            <h2>Tem gente de verdade do outro lado.</h2>
            <p>
              Quando algo pede contexto, a conversa não vira ticket. Você fala com a Pati, com a
              mesma proximidade que orienta o trabalho da CALI.
            </p>
            <a
              className="lp-button lp-button-light"
              href={WA_LINK}
              target="_blank"
              rel="noreferrer"
            >
              Falar com a Pati <MessageCircle size={17} />
            </a>
          </div>

          <div className="lp-video-media" data-lp-reveal="right">
            <div className="lp-video-card">
              <video
                className="lp-pati-video"
                src={patiWaveVideo}
                poster={patiWavePoster}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-label="Vídeo da Patrícia, CALI RH"
              />
            </div>
            <div className="lp-video-identity">
              <strong>Patrícia Lima</strong>
              <span>People Advisory Executive · CALI RH</span>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section lp-section-light" id="como-funciona">
        <div className="lp-shell">
          <div className="lp-section-heading lp-section-heading-centered" data-lp-reveal="up">
            <span className="lp-kicker">COMO FUNCIONA</span>
            <h2>Da direção à leitura executiva.</h2>
          </div>

          <div className="lp-steps" data-lp-flow>
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <article
                  key={step.n}
                  data-lp-reveal={index % 2 === 0 ? 'left' : 'right'}
                  style={{ transitionDelay: `${index * 80}ms` }}
                >
                  <div className="lp-step-number">
                    <span>{step.n}</span>
                    <i>
                      <Icon size={20} />
                    </i>
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="lp-section lp-packages" id="pacotes">
        <div className="lp-shell">
          <div className="lp-section-heading lp-section-heading-centered" data-lp-reveal>
            <span className="lp-kicker">ASSESSORIA ESTRATÉGICA MENSAL</span>
            <h2>Uma assessoria. Duas formas de estar perto.</h2>
            <p>
              Escolha o ritmo de acompanhamento da sua empresa. O escopo é definido em proposta.
            </p>
          </div>

          <div className="lp-package-grid">
            <article className="lp-package-card" data-lp-reveal="left">
              <div className="lp-package-top">
                <div>
                  <h3>CALI Partner</h3>
                </div>
                <span className="lp-term-badge">8 meses</span>
              </div>
              <p className="lp-package-intro">
                Direção sênior para organizar prioridades e apoiar decisões de pessoas, com
                acompanhamento online.
              </p>
              <div className="lp-package-capacity">
                <strong>10–15h</strong>
                <span>de referência por mês</span>
              </div>
              <div className="lp-package-list">
                {PACKAGE_FEATURES.partner.map((item) => (
                  <span key={item}>
                    <Check size={15} />
                    {item}
                  </span>
                ))}
              </div>
              <a
                className="lp-package-link"
                href="https://calirh.com/assessoria"
                target="_blank"
                rel="noopener noreferrer"
              >
                Conhecer o Partner <ArrowRight size={16} />
              </a>
            </article>

            <article className="lp-package-card lp-package-card-featured" data-lp-reveal="right">
              <div className="lp-package-ribbon">MAIOR PROXIMIDADE</div>
              <div className="lp-package-top">
                <div>
                  <h3>CALI Full</h3>
                </div>
                <span className="lp-term-badge">12 meses</span>
              </div>
              <p className="lp-package-intro">
                Mais presença para decisões complexas, com ritmo quinzenal e uma visita presencial
                fixa por mês.
              </p>
              <div className="lp-package-capacity">
                <strong>20–25h</strong>
                <span>de referência por mês</span>
              </div>
              <div className="lp-package-list">
                {PACKAGE_FEATURES.full.map((item) => (
                  <span key={item}>
                    <Check size={15} />
                    {item}
                  </span>
                ))}
              </div>
              <a
                className="lp-package-link"
                href="https://calirh.com/assessoria"
                target="_blank"
                rel="noopener noreferrer"
              >
                Conhecer o Full <ArrowRight size={16} />
              </a>
            </article>
          </div>
        </div>
      </section>

      <section className="lp-final-cta">
        <img className="lp-final-art" src="/brand/cali-lime-mark.svg" alt="" aria-hidden="true" />
        <div className="lp-shell lp-final-grid" data-lp-reveal="up">
          <div>
            <span className="lp-eyebrow">JÁ É CLIENTE CALI?</span>
            <h2>O trabalho continua aqui.</h2>
            <p>Entre com seu e-mail cadastrado e retome o ciclo de onde parou.</p>
          </div>
          <div className="lp-final-actions">
            <Link className="lp-button lp-button-light" to="/login">
              Acessar Workspace <ArrowRight size={17} />
            </Link>
            <a
              className="lp-text-link lp-text-link-light"
              href={WA_LINK}
              target="_blank"
              rel="noreferrer"
            >
              Ainda não é cliente? Fale com a CALI <MessageCircle size={15} />
            </a>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-shell">
          <a href="https://calirh.com" aria-label="CALI RH, ir para o site">
            <img src="/brand/cali-logo-light.svg" alt="CALI RH" />
          </a>
          <nav className="lp-footer-site-links" aria-label="Links CALI">
            <a href="https://calirh.com/assessoria">Assessoria mensal</a>
            <a href="https://calirh.com/projetos">Projetos</a>
            <a href="https://calirh.com/sobre">A CALI</a>
            <a href="https://comuni.calirh.com/" target="_blank" rel="noopener noreferrer">
              ComuniCALI
            </a>
            <a href="https://portal.calirh.com">Portal de propostas</a>
            <Link to="/login">Acesso ao app</Link>
            <a href="https://calirh.com/privacidade.html">Privacidade</a>
          </nav>
          <div className="lp-footer-social">
            <a
              href="https://www.instagram.com/calirh_/"
              aria-label="Instagram"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Instagram size={24} />
            </a>
            <a
              href="https://www.linkedin.com/in/patriciaazumi/"
              aria-label="LinkedIn"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Linkedin size={24} />
            </a>
            <a href="mailto:patricia@calirh.com" aria-label="E-mail">
              <Mail size={24} />
            </a>
          </div>
          <div className="lp-footer-copy">
            <span>
              © {new Date().getFullYear()} CALI RH · HRB — RH para o Negócio · Todos os direitos
              reservados.
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}
