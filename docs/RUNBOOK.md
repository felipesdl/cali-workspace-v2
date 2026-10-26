# Operação local e verificação

Atualização: 25/10/2026. Este arquivo descreve o que existe; procedimentos futuros não são comandos já disponíveis.

## Comandos existentes

```bash
npm install
npm run dev
npm run typecheck
npm run build
npm run preview
```

- `dev`: Vite; usar URL/porta efetivamente informadas pelo processo.
- `typecheck`: `tsc --noEmit`.
- `build`: `tsc -b && vite build`; saída em `dist/`.
- `preview`: servidor local do build, sem comprovar configuração Vercel.

Não há `lint`, `test`, `verify`, CI, lockfile ou pin de Node neste checkout. `npm ci` só será procedimento válido depois de existir lockfile compatível.

## Configuração atual

`.env.example` contém somente `VITE_DEMO_MODE=true`; variável não é consumida no código. Não adicionar credenciais reais para validar apresentação. Não há persistência em localStorage nem cliente Supabase implementado.

Fontes e imagens usam serviços externos (Google Fonts/Unsplash). A interface pode variar sem rede. Isso não é conexão ao backend do produto; inventariar assets próprios e carregamento da fonte na fundação.

## Evidência da análise

Foi criada cópia temporária contendo package/configuração, HTML e `src`. Dependências públicas foram instaladas com scripts de instalação desabilitados, fora do checkout. Node 24.22.1 e npm 11.19.1; Vite resolvido 6.4.5. Typecheck/build passaram. Não houve alteração de dependências, lockfile ou código no projeto.

Resultado não fixa runtime/versões suportadas. Antes de implementar, escolher uma baseline reproduzível, criar lockfile e documentar versão de Node.

## Verificação manual futura

Após mudanças visuais/rotas: conferir 1440/1280/1024/390 px, navegação com teclado, foco dos overlays, Escape, scroll, filtros, períodos, vazios e mensagens. Conferir console e diferença entre demonstração local e operação efetiva.

Após roteamento: conferir URL direta e refresh no host estático, sem reescrever assets como HTML. Após integração: testar somente no ambiente isolado identificado no contrato, com outbound bloqueado.

## Publicação e rollback

Ainda não há runbook de publicação reproduzível neste repositório. Vercel/proteção/domínios descritos no handoff não foram inspecionados. Antes de release, registrar projeto, ambiente, revisão, build command, output, envs sem valores secretos, rewrites, aprovação e rollback.

Build local, push, CI, deploy e estado de produção são evidências diferentes. Para reverter documentação desta análise, restaurar o README anterior e remover apenas os arquivos novos listados no changelog. Para futuras mudanças funcionais, rollback inclui compatibilidade dos contratos e dados, não apenas código.
