import { LifeBuoy, Mail } from 'lucide-react';
import { accessSupportLink } from '../../../../lib/cali-contacts';

export function AccessHelp() {
  return (
    <details className="cali-access-help">
      <summary>
        <LifeBuoy size={15} aria-hidden="true" />
        Não consigo acessar
      </summary>
      <div className="cali-access-help-panel">
        <ol>
          <li>Use o e-mail cadastrado pela sua empresa no Workspace.</li>
          <li>Procure o código na caixa de spam ou promoções.</li>
          <li>Para pedir outro código, aguarde dois minutos.</li>
        </ol>
        <p>
          Por segurança, o Workspace não informa se um e-mail está cadastrado. Se precisar de ajuda,
          fale com a CALI.
        </p>
        <div className="cali-access-help-links">
          <a href={accessSupportLink}>
            <Mail size={15} aria-hidden="true" />
            Problemas de acesso
          </a>
        </div>
      </div>
    </details>
  );
}
