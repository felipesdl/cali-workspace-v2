import { cloneElement, type ComponentProps, type ReactElement, type ReactNode } from 'react';
import { WorkspaceNavLabel } from './WorkspaceNavLabel';

type ModuleLabel = ComponentProps<typeof WorkspaceNavLabel>['label'];
type ModuleLinkElement = ReactElement<{
  children?: ReactNode;
  title?: string;
  activeOptions?: { exact: boolean; includeSearch: boolean };
  'data-workspace-module'?: ModuleLabel;
  'aria-expanded'?: boolean;
  'aria-controls'?: string;
}>;

export type WorkspaceModuleSection = {
  label: string;
  active: boolean;
  element: ReactElement<{
    children?: ReactNode;
    className?: string;
    'aria-current'?: 'page';
  }>;
};

export type WorkspaceModuleLink = {
  label: ModuleLabel;
  element: ModuleLinkElement;
  sections?: readonly WorkspaceModuleSection[];
};

export function workspaceModuleLink(
  label: ModuleLabel,
  link: ModuleLinkElement,
  sections?: readonly WorkspaceModuleSection[],
): WorkspaceModuleLink {
  return {
    label,
    sections,
    element: cloneElement(
      link,
      {
        activeOptions: { exact: true, includeSearch: false },
        'data-workspace-module': label,
        title: label,
      },
      <WorkspaceNavLabel label={label} />,
    ),
  };
}
