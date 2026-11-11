import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ClipboardList,
  Clock3,
  FileBarChart2,
  Fingerprint,
  FolderOpen,
  History,
  CircleHelp,
  LayoutDashboard,
  MessageCircleMore,
  Megaphone,
  Network,
  ShieldCheck,
  Star,
  Users,
  Target,
  UserCog,
} from 'lucide-react';

const icons = {
  Início: LayoutDashboard,
  Ajuda: CircleHelp,
  'Minha empresa': Building2,
  'Minha conta': Users,
  'Termos e privacidade': ShieldCheck,
  'Empresas e acessos': Building2,
  Equipe: Users,
  'Perfil comportamental': Fingerprint,
  Projetos: BriefcaseBusiness,
  Horas: Clock3,
  'Minhas horas': Clock3,
  Agenda: CalendarDays,
  Ocorrências: MessageCircleMore,
  Documentos: FolderOpen,
  Relatórios: FileBarChart2,
  Avisos: Megaphone,
  'Frentes contratadas': Network,
  Privacidade: ShieldCheck,
  Formulários: ClipboardList,
  Propostas: BriefcaseBusiness,
  'Mapa de People': Target,
  'Equipe CALI': UserCog,
  Auditoria: History,
  Satisfação: Star,
};

export function WorkspaceNavLabel({ label }: { label: keyof typeof icons }) {
  const Icon = icons[label];
  return (
    <span title={label} className="tw:flex tw:min-w-0 tw:items-center tw:gap-3">
      <Icon size={17} strokeWidth={1.6} aria-hidden="true" className="tw:shrink-0" />
      <span className="workspace-nav-label">{label}</span>
    </span>
  );
}
