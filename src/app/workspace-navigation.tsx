import { cloneElement, type ComponentProps, type ReactElement, type ReactNode } from 'react';
import { WorkspaceNavLabel } from './WorkspaceNavLabel';

type ModuleLabel = ComponentProps<typeof WorkspaceNavLabel>['label'];
type ModuleLinkElement = ReactElement<{
  children?: ReactNode;
  activeOptions?: { exact: boolean; includeSearch: boolean };
}>;

export type WorkspaceModuleLink = { label: ModuleLabel; element: ReactElement };

export function workspaceModuleLink(
  label: ModuleLabel,
  link: ModuleLinkElement,
): WorkspaceModuleLink {
  return {
    label,
    element: cloneElement(
      link,
      { activeOptions: { exact: true, includeSearch: false } },
      <WorkspaceNavLabel label={label} />,
    ),
  };
}
