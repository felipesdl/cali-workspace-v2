import { LifeBuoy, Mail, MessageCircle } from 'lucide-react';

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
          <a
            href="https://wa.me/5541987791933?text=Preciso%20de%20ajuda%20com%20o%20CALI%20Workspace"
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle size={15} aria-hidden="true" />
            WhatsApp
          </a>
          <a href="mailto:patricia@calirh.com?subject=Acesso%20ao%20CALI%20Workspace">
            <Mail size={15} aria-hidden="true" />
            E-mail
          </a>
        </div>
      </div>
    </details>
  );
}
