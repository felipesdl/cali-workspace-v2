// Layout Cliente V3 da publicação 83. A ação de entrada aponta para a aba do piloto.
const APPROVED_CLIENT_CODE_V3 =
  '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>APP CALI RH · Seu código para entrar</title></head><body bgcolor="#F7F3EE" style="margin:0;padding:0;background:#F7F3EE;color:#2B2B2B;font-family:Arial,Helvetica,sans-serif;">\n<div style="display:none!important;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px">Seu código de acesso chegou. Use em até 10 minutos para entrar no Workspace.</div>\n<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#F7F3EE" style="width:100%;border-collapse:collapse;background:#F7F3EE"><tr><td align="center" style="padding:28px 12px 34px">\n<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#FFFFFF" style="max-width:640px;background:#FFFFFF;border:1px solid #E8DDD4;border-collapse:separate;border-spacing:0;border-radius:15px">\n<tr><td bgcolor="#5A1E2D" style="background:#5A1E2D;padding:25px 32px;border-radius:14px 14px 0 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td><img src="{{logo_workspace_url}}" alt="CALI Workspace" width="145" style="width:145px;max-width:100%;height:auto;display:block;border:0;color:#FFFFFF;font:700 17px Arial,Helvetica,sans-serif"></td><td align="right"><img src="{{carvalho_url}}" alt="Símbolo do carvalho da CALI" width="42" style="display:block;border:0;width:42px;height:auto;color:#FFFFFF;font:12px Arial,Helvetica,sans-serif"></td></tr></table></td></tr>\n<tr><td style="padding:34px 36px 15px"><p style="margin:0 0 12px;color:#B58C52;letter-spacing:1.45px;font:700 11px/17px Arial,Helvetica,sans-serif">ACESSO / CÓDIGO TEMPORÁRIO</p><h1 style="margin:0 0 22px;color:#5A1E2D;font:700 27px/35px Georgia,\'Times New Roman\',serif">Seu acesso está a um código de distância.</h1><p style="margin:0 0 12px;color:#2B2B2B;font:15px/25px Arial,Helvetica,sans-serif">Oi, <strong>{{nome_do_cliente}}</strong>!</p><p style="margin:0;color:#2B2B2B;font:15px/25px Arial,Helvetica,sans-serif">Para entrar no Workspace, digite o número abaixo na tela de acesso. <strong>Ele vale por 10 minutos</strong> e funciona uma única vez.</p></td></tr>\n<tr><td style="padding:9px 36px 22px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#FAF8F5" style="background:#FAF8F5;border:1px solid #E8DDD4;border-collapse:separate;border-spacing:0;border-radius:8px"><tr><td style="padding:17px 19px 15px"><p style="margin:0 0 9px;color:#B58C52;font:700 11px/18px Arial,Helvetica,sans-serif;letter-spacing:1.15px">SEU CÓDIGO</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td valign="top" style="padding:9px 12px 9px 0;width:35%;color:#8C807A;font:12px/19px Arial,Helvetica,sans-serif;">Código</td><td valign="top" style="padding:9px 0;color:#2B2B2B;font:600 14px/21px Arial,Helvetica,sans-serif;"><strong style="font:700 31px/41px Arial,Helvetica,sans-serif;letter-spacing:4px;color:#5A1E2D">{{codigo}}</strong></td></tr><tr><td valign="top" style="padding:9px 12px 9px 0;width:35%;color:#8C807A;font:12px/19px Arial,Helvetica,sans-serif;">Validade</td><td valign="top" style="padding:9px 0;color:#2B2B2B;font:600 14px/21px Arial,Helvetica,sans-serif;">10 minutos após a solicitação</td></tr></table></td></tr></table></td></tr>\n<tr><td style="padding:0 36px 25px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="4" bgcolor="#D9A514" style="width:4px;background:#D9A514;font-size:1px">&nbsp;</td><td bgcolor="#FFF8E6" style="padding:13px 16px;background:#FFF8E6;font:13px/21px Arial,Helvetica,sans-serif;color:#614C2D"><strong>Não foi você?</strong> Pode ignorar este e-mail. Nunca compartilhe seu código, nem com alguém que diga falar em nome da CALI.</td></tr></table></td></tr>\n<tr><td align="center" style="padding:0 32px 30px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#5A1E2D" style="background:#5A1E2D;border-radius:7px"><a href="{{link}}" style="padding:14px 24px;display:inline-block;color:#FFFFFF;text-decoration:none;font:700 14px/21px Arial,Helvetica,sans-serif">Ir para a tela de acesso</a></td></tr></table></td></tr>\n<tr><td style="padding:0 36px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #E8DDD4"><tr><td style="padding:18px 0 25px"><p style="margin:0 0 4px;color:#5A1E2D;font:700 12px/19px Arial,Helvetica,sans-serif">APP CALI Workspace</p><p style="margin:0 0 9px;color:#8C807A;font:12px/20px Arial,Helvetica,sans-serif">calirh.com · @calirh_</p><p style="margin:0;color:#8C807A;font:11px/18px Arial,Helvetica,sans-serif">E-mail automático. Não responda a esta mensagem. Para falar com a CALI, acesse o <a href="https://app.calirh.com" style="color:#5A1E2D;text-decoration:underline">Workspace</a>.</p></td></tr></table></td></tr></table></td></tr></table></body></html>';
const escapeEmailText = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
export function renderClientCodeV3(
  code: string,
  fullName: string | null | undefined,
  appUrl: string,
): string {
  if (!/^\d{6}$/.test(code)) throw new Error('Código inválido para o layout.');
  const firstName =
    String(fullName || '')
      .trim()
      .split(/\s+/)[0] || 'você';
  const safeApp = appUrl.replace(/\/$/, '');
  if (!/^http:\/\/127\.0\.0\.1:(5181|5182)\/cliente$/.test(safeApp))
    throw new Error('URL de acesso não autorizada.');
  const brand = 'https://app.calirh.com';
  const fields: Record<string, string> = {
    nome_do_cliente: firstName,
    codigo: code,
    link: safeApp,
    logo_workspace_url: brand + '/brand/cali-workspace-transparent.svg',
    carvalho_url: brand + '/brand/cali-oak-mark-light.svg',
  };
  return APPROVED_CLIENT_CODE_V3.replace(/\{\{([a-z0-9_]+)\}\}/g, (_match, marker: string) => {
    if (!Object.prototype.hasOwnProperty.call(fields, marker))
      throw new Error('Marcador ausente: ' + marker);
    return escapeEmailText(fields[marker]);
  });
}
