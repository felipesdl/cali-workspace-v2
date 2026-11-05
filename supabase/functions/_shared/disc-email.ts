const EMAIL_LOGO = 'https://app.calirh.com/brand/cali-workspace-transparent.svg';
const ALLOWED_LINK_ORIGINS = new Set([
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5181',
  'http://127.0.0.1:5182',
]);

export type DiscEmailInput = {
  kind: string;
  title: string;
  name?: string;
  url?: string;
  deadline?: string;
  message?: string;
};

type EmailCopy = { subject: string; heading: string; paragraphs: string[]; action?: string };

function plainText(value: string): string {
  return Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : character;
  })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeLink(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!ALLOWED_LINK_ORIGINS.has(url.origin) || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function emailCopy(input: DiscEmailInput, title: string, name: string): EmailCopy {
  const hasLink = Boolean(safeLink(input.url));
  const deadline = input.deadline ? ` Prazo: ${plainText(input.deadline)}.` : '';
  switch (input.kind) {
    case 'invite':
      return {
        subject: `Convite para responder ao Perfil Comportamental · ${title}`,
        heading: 'Você recebeu um convite',
        paragraphs: [
          `Olá${name ? `, ${name}` : ''}. A equipe da CALI RH convidou você a responder ao Perfil Comportamental. Suas respostas são confidenciais e você receberá seu próprio relatório em PDF por e-mail.${deadline}`,
        ],
        action: hasLink ? 'Responder ao convite' : undefined,
      };
    case 'reminder1':
    case 'reminder2':
    case 'reminder3':
      return {
        subject: `Lembrete do Perfil Comportamental · ${title}`,
        heading: 'Seu convite continua disponível',
        paragraphs: [
          `Olá${name ? `, ${name}` : ''}. Este é um lembrete para responder ao convite recebido da CALI RH.${deadline}`,
        ],
        action: hasLink ? 'Continuar resposta' : undefined,
      };
    case 'focal_eve':
      return {
        subject: `O prazo do convite termina amanhã · ${title}`,
        heading: 'Acompanhamento do convite',
        paragraphs: [
          'O prazo de resposta termina amanhã. Esta mensagem informa apenas o andamento do convite; não inclui respostas ou resultados individuais.',
        ],
        action: hasLink ? 'Acompanhar convite' : undefined,
      };
    case 'focal_close':
    case 'close':
      return {
        subject: `O prazo do convite foi encerrado · ${title}`,
        heading: 'Prazo encerrado',
        paragraphs: [
          'O prazo do convite foi encerrado. Esta mensagem informa apenas o estado do convite; não inclui respostas ou resultados individuais.',
        ],
      };
    case 'respondent_pdf':
    case 'report_ready':
    case 'profile_report_ready':
      return {
        subject: 'Seu relatório do Perfil Comportamental está pronto',
        heading: 'Seu PDF está pronto',
        paragraphs: [
          `Olá${name ? `, ${name}` : ''}. Seu relatório individual segue em PDF anexo. Este e-mail não mostra resultados; o arquivo é destinado somente a você.`,
        ],
      };
    case 'gestao_pdf':
    case 'management_pdf':
      return {
        subject: `Relatório de gestão · ${title}`,
        heading: 'Relatório de gestão da CALI RH',
        paragraphs: [
          `Olá${name ? `, ${name}` : ''}. O PDF aprovado do relatório de gestão está anexado a esta mensagem. O relatório apresenta somente leitura agregada do grupo.`,
        ],
      };
    case 'gestao_released':
    case 'management_released':
    case 'released':
      return {
        subject: `Relatório de gestão disponível · ${title}`,
        heading: 'O relatório de gestão foi liberado',
        paragraphs: [
          `Olá${name ? `, ${name}` : ''}. A CALI RH liberou o relatório de gestão da empresa no aplicativo. Esta mensagem não inclui resultados individuais.`,
        ],
        action: hasLink ? 'Abrir relatório de gestão' : undefined,
      };
    default:
      return {
        subject: `Atualização do Perfil Comportamental · ${title}`,
        heading: 'Atualização da CALI RH',
        paragraphs: [
          'A CALI RH enviou uma atualização relacionada ao Perfil Comportamental. Nenhum resultado individual está incluído neste e-mail.',
        ],
      };
  }
}

export function renderDiscEmail(input: DiscEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const title = plainText(input.title) || 'Perfil Comportamental';
  const name = input.name ? plainText(input.name) : '';
  const copy = emailCopy(input, title, name);
  const url = safeLink(input.url);
  const action =
    copy.action && url
      ? `<p style="margin:28px 0 24px;text-align:center"><a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 21px;border-radius:6px;background:#5A1E2D;color:#FFFFFF;text-decoration:none;font:700 14px/20px Arial,Helvetica,sans-serif">${escapeHtml(copy.action)}</a></p>`
      : '';
  const paragraphs = copy.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 14px;color:#2B2B2B;font:15px/24px Arial,Helvetica,sans-serif">${escapeHtml(paragraph)}</p>`,
    )
    .join('');
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(copy.subject)}</title></head><body bgcolor="#F7F3EE" style="margin:0;padding:0;background:#F7F3EE;color:#2B2B2B;font-family:Arial,Helvetica,sans-serif"><div style="display:none!important;max-height:0;overflow:hidden;opacity:0">[TESTE V2] Homologação sintética</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#F7F3EE" style="width:100%;border-collapse:collapse;background:#F7F3EE"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#FFFFFF" style="max-width:640px;background:#FFFFFF;border:1px solid #E8DDD4;border-collapse:separate;border-spacing:0;border-radius:12px"><tr><td bgcolor="#5A1E2D" style="padding:24px 32px;background:#5A1E2D;border-radius:11px 11px 0 0"><img src="${EMAIL_LOGO}" alt="CALI RH" width="145" style="display:block;width:145px;max-width:100%;height:auto;border:0;color:#FFFFFF;font:700 17px Arial,Helvetica,sans-serif"></td></tr><tr><td style="padding:30px 34px 12px"><p style="margin:0 0 10px;color:#B58C52;font:700 11px/17px Arial,Helvetica,sans-serif;letter-spacing:1.2px">[TESTE V2] HOMOLOGAÇÃO SINTÉTICA</p><h1 style="margin:0 0 18px;color:#5A1E2D;font:700 25px/33px Georgia,'Times New Roman',serif">${escapeHtml(copy.heading)}</h1>${paragraphs}${action}${url && copy.action ? `<p style="margin:0 0 20px;color:#8C807A;font:12px/19px Arial,Helvetica,sans-serif;word-break:break-all">${escapeHtml(url)}</p>` : ''}</td></tr><tr><td style="padding:0 34px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #E8DDD4"><tr><td style="padding:18px 0 24px"><p style="margin:0 0 5px;color:#5A1E2D;font:700 12px/19px Arial,Helvetica,sans-serif">CALI RH</p><p style="margin:0;color:#8C807A;font:11px/18px Arial,Helvetica,sans-serif">Mensagem automática de homologação sintética. Não responda.</p></td></tr></table></td></tr></table></td></tr></table></body></html>`;
  const text = [
    '[TESTE V2] Homologação sintética',
    copy.heading,
    ...copy.paragraphs,
    copy.action && url ? `${copy.action}: ${url}` : '',
    'CALI RH · Mensagem automática de homologação sintética.',
  ]
    .filter(Boolean)
    .join('\n\n');
  return { subject: `[TESTE V2] ${plainText(copy.subject)}`, html, text };
}
