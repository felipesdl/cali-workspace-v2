import {
  Activity,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ClipboardList,
  Clock3,
  FileChartColumn,
  Fingerprint,
  Folder,
  History,
  LayoutDashboard,
  MessageSquare,
  Network,
  ShieldCheck,
  Star,
  Users,
  UsersRound,
} from 'lucide-react';

const icons = {
  Início: LayoutDashboard,
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
  Ocorrências: MessageSquare,
  Documentos: Folder,
  Relatórios: FileChartColumn,
  Avisos: Bell,
  'Frentes contratadas': Network,
  Privacidade: ShieldCheck,
  Formulários: ClipboardList,
  Propostas: BriefcaseBusiness,
  'Mapa de People': Activity,
  'Equipe CALI': UsersRound,
  Auditoria: History,
  Satisfação: Star,
};

export function WorkspaceNavLabel({ label }: { label: keyof typeof icons }) {
  const Icon = icons[label];
  return (
    <span title={label} className="tw:flex tw:min-w-0 tw:items-center tw:gap-3">
      <Icon size={17} aria-hidden="true" className="tw:shrink-0" />
      <span className="workspace-nav-label">{label}</span>
    </span>
  );
}
