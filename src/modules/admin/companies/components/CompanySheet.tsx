import { useRouteContext } from '@tanstack/react-router';
import { CompanyResponsiblesEditor } from './CompanyResponsiblesEditor';
import { useId, useRef, type KeyboardEvent } from 'react';
import { Button } from '../../../../components/ds/button/Button';
import { HostedBrand } from './HostedBrand';
import { HostedRegistration } from './HostedRegistration';
import { CompanyContractDocuments } from './CompanyContractDocuments';
import { CompanyRegistrationData } from './CompanyRegistrationData';
import { CompanyAdministration } from './CompanyAdministration';
import { CompanyBasics } from './CompanyBasics';
import { CompanyAdhesions } from './CompanyAdhesions';
import { CompanyAccessPanel } from './CompanyAccessPanel';
import { CompanyCycles } from './CompanyCycles';
import { PreRegistrationAdmin } from './PreRegistrationAdmin';

const tabs = ['Cadastro', 'Contrato', 'Acessos'] as const;
type CompanyTab = (typeof tabs)[number];

export function CompanySheet({
  companyId,
  canManage,
  focusOnMount,
  onClose,
  tab,
  onTab,
}: {
  companyId: string;
  canManage: boolean;
  focusOnMount: boolean;
  onClose: () => void;
  tab: CompanyTab;
  onTab: (tab: CompanyTab) => void;
}) {
  const prefix = useId();
  const { adminRead } = useRouteContext({ from: '__root__' });
  const buttons = useRef<Partial<Record<CompanyTab, HTMLButtonElement | null>>>({});

  function handleKeys(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = tabs.length - 1;
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (index + last) % tabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (next === null) return;
    const item = tabs[next];
    if (!item) return;
    event.preventDefault();
    onTab(item);
    buttons.current[item]?.focus();
  }

  return (
    <section className="tw:grid tw:min-w-0 tw:gap-3" aria-labelledby={prefix + 'title'}>
      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2">
        <h2 id={prefix + 'title'} className="tw:m-0 tw:text-section tw:text-brand">
          Ficha da empresa
        </h2>
        <Button variant="secondary" onClick={onClose}>
          Fechar ficha
        </Button>
      </div>
      <div role="tablist" aria-label="Seções da ficha" className="tw:flex tw:flex-wrap tw:gap-2">
        {tabs.map((item, index) => (
          <Button
            key={item}
            ref={(node) => {
              buttons.current[item] = node;
            }}
            id={prefix + 'tab-' + item}
            role="tab"
            aria-selected={tab === item}
            aria-controls={prefix + 'pane-' + item}
            tabIndex={tab === item ? 0 : -1}
            variant={tab === item ? 'primary' : 'secondary'}
            onClick={() => onTab(item)}
            onKeyDown={(event) => handleKeys(event, index)}
          >
            {item}
          </Button>
        ))}
      </div>
      {tabs.map((item) => (
        <div
          key={item}
          id={prefix + 'pane-' + item}
          role="tabpanel"
          aria-labelledby={prefix + 'tab-' + item}
          hidden={tab !== item}
          className={tab === item ? 'tw:grid tw:gap-4' : undefined}
        >
          {tab === item &&
            (item === 'Cadastro' ? (
              <>
                <CompanyBasics companyId={companyId} focusOnMount={focusOnMount} />
                <HostedRegistration companyId={companyId} />
                <HostedBrand companyId={companyId} />
                <CompanyRegistrationData companyId={companyId} />
                {adminRead && <CompanyResponsiblesEditor company={companyId} service={adminRead} />}
              </>
            ) : item === 'Contrato' ? (
              <>
                <CompanyAdministration companyId={companyId} />
                <CompanyContractDocuments companyId={companyId} />
                <CompanyAdhesions companyId={companyId} />
                <CompanyCycles companyId={companyId} />
              </>
            ) : (
              <>
                <PreRegistrationAdmin company={companyId} />
                <CompanyAccessPanel companyId={companyId} canManage={canManage} onClose={onClose} />
              </>
            ))}
        </div>
      ))}
    </section>
  );
}
