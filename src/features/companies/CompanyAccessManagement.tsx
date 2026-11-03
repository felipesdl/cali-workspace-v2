import { adhesionEvidenceStatus } from '../../api/modules/companies/evidence-schemas';
import { useRef, useState } from 'react';
import { companyStatus, type CompanyAccess } from '../../api/modules/companies/schemas';
import { useAdhesionEvidence } from '../../api/modules/companies/hooks/useCompanyManagement';
import { useCompanyQuery } from '../../api/modules/companies/hooks/useCompanyQuery';
import { Button } from '../../components/ds/button/Button';
import { NewAccess } from './NewAccess';
import { AccessRow } from './AccessRow';
import { AccessHistory } from './AccessHistory';

export function CompanyAccessManagement({
  companyId,
  accesses,
}: {
  companyId: string;
  accesses: CompanyAccess[];
}) {
  const evidence = useAdhesionEvidence(companyId);
  const company = useCompanyQuery(companyId);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState('');
  const usage = useRef<HTMLParagraphElement>(null);
  const activeCount = accesses.filter((item) => item.status === 'active').length;
  const hasAdhesion =
    evidence.isSuccess &&
    evidence.data.some((item) => item.status === adhesionEvidenceStatus.Valid);
  const companyEligible =
    company.isSuccess &&
    (company.data.status === companyStatus.Active || company.data.status === companyStatus.Paused);
  const canAuthorize = hasAdhesion && companyEligible && activeCount < 4;
  return (
    <div>
      <p id="access-usage" ref={usage} tabIndex={-1} className="tw:font-semibold">
        {activeCount} de 4 autorizações utilizadas
      </p>
      {evidence.isPending && <p role="status">Confirmando a adesão…</p>}
      {evidence.isError && (
        <p role="alert">Não foi possível confirmar a adesão para novas autorizações.</p>
      )}
      {evidence.isSuccess && !hasAdhesion && (
        <p>Novas autorizações exigem comprovação administrativa vigente da adesão desta empresa.</p>
      )}
      {company.isError && <p role="alert">Não foi possível confirmar a situação da empresa.</p>}
      {company.isSuccess && !companyEligible && (
        <p>Não é possível autorizar novos acessos enquanto a empresa estiver indisponível.</p>
      )}
      {activeCount >= 4 && (
        <p>Limite de quatro acessos atingido. Revogue um acesso para disponibilizar uma vaga.</p>
      )}
      <Button
        variant="secondary"
        disabled={!canAuthorize || adding}
        onClick={() => {
          setNotice('');
          setAdding(true);
        }}
      >
        Adicionar acesso
      </Button>
      {adding && (
        <NewAccess
          companyId={companyId}
          onClose={(saved) => {
            setAdding(false);
            setNotice(
              saved ? 'Autorização registrada na demonstração. Nenhum convite foi enviado.' : '',
            );
            requestAnimationFrame(() => usage.current?.focus());
          }}
        />
      )}
      {notice && <p role="status">{notice}</p>}
      {accesses.length === 0 ? (
        <p>Nenhum acesso nesta empresa.</p>
      ) : (
        <ul className="tw:m-0 tw:mt-4 tw:list-none tw:p-0">
          {accesses.map((access) => (
            <AccessRow key={access.id} access={access} canAuthorize={canAuthorize} />
          ))}
        </ul>
      )}
      <AccessHistory companyId={companyId} />
    </div>
  );
}
