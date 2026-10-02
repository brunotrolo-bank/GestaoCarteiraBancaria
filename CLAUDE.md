# Gestão de Carteira Bancária — guia para o Claude Code

POC de **gestão de carteira por Posição** (a carteira pertence à cadeira/mesa, nunca à pessoa), com dados **sintéticos**. Roda 100% no **Google Apps Script** (front + backend) lendo/gravando uma **planilha Google**. O repositório é o código-fonte; o Apps Script recebe artefatos compilados.

## Regras de trabalho (do dono do projeto)
- **Nunca criar branch**: commit e push direto na `main`.
- **Salvar tudo dentro da pasta do projeto** (subpastas quando fizer sentido).
- Foco em **entregar o app funcionando no Apps Script**; não gastar tempo com excesso de testes/relatórios.
- Responder em **português (pt-BR)**.
- **CPF/CNPJ sempre mascarados** em tela/API/logs; só a ação auditada "revelar documento" mostra o completo. Nunca versionar chaves/tokens.

## Estrutura
```
packages/core    núcleo de domínio puro (posicoes, delegacao, clientes, acesso, insights; model/shared) — sem I/O nem relógio global
packages/data    dados sintéticos determinísticos (seed), conversão tabela⇄matriz, integridade, adaptador Sheets API (Node)
apps/api         API REST (rotas, validação) — manipulador SÍNCRONO usado em Node e no Apps Script; contrato em contracts/openapi.yaml
apps/gas         entradas do backend do Apps Script (GasStore: cache + escrita incremental; apiChamar)
apps/mcp         servidor MCP (stdio) com proteções de escrita
frontend/ui      design system (shadcn/Radix + tokens GERADOS de planos/system-design/DESIGN-stripe.md)
frontend/sdk     cliente da API + contrato de micro-frontend (+ transporte google.script.run)
frontend/mfe-*   micro-frontends por domínio (cockpit, posicoes, carteira, delegacao)
frontend/shell   shell que compõe os MFEs (Vite: build-time; Apps Script: runtime via window.CARTEIRA_MFES)
apps-script/     projeto Apps Script (gerado + Codigo.js, rules.js, schema.js, appsscript.json)
scripts/         build-gas, setup-conta, carga/homologação do Sheets, geradores, lint de arquitetura
planos/          planejamento SDD (consolidação, domínios, system design, decisões, status)
docs/            guias (transferência/instalação em nova conta) e capturas de tela
```

## Comandos
```bash
npm install
npm run api                 # API local (cenário demo em memória) em :3001 ; npm run web:dev  → front em :5173
npm run gas:build           # gera apps-script/*.js e *.html (backend por domínio + um HTML por MFE)
npm run apps-script:push    # envia ao Apps Script (clasp) ; depois: (cd apps-script && clasp deploy / clasp redeploy <id>)
npm run gas:smoke           # backend do Apps Script em sandbox sem Node/Intl/URL
npm run sheets:carga        # popula as 15 abas da planilha com o cenário demo (idempotente)
npm run sheets:homologar    # roda o código REAL do Apps Script sobre a planilha (54 checks) e grava homologacao_resultado
npm run setup:conta -- --planilha <ID> --script <ID> [--gcp <projeto>]   # configura OUTRA conta Google
npm run gates               # arquitetura + OpenAPI + tipos + testes com cobertura
npm run e2e                 # Playwright (jornadas J1/J2/J3, axe, front composto como no Apps Script)
```

## Instalar em outra conta Google (pedido típico: "instale o projeto na minha nova conta")
Siga **docs/instalacao-em-nova-conta.md** (Caminho A). Resumo: o usuário cria à mão uma planilha vazia e um projeto Apps Script na conta nova e faz `clasp login` e `gcloud auth login`; você roda `setup:conta` com os IDs, pede que ele compartilhe a planilha com a service account impressa, depois `--verificar`, `sheets:carga`, `gas:build`, `apps-script:push` e `clasp deploy`. Sem GCP: Caminho B (o Apps Script se instala sozinho).

## Pontos de atenção (aprendidos)
- O Apps Script **não tem** `structuredClone`, `URL`, `URLSearchParams`, `Request/Response`, `Intl` com fuso nem Promises síncronas: o núcleo e o manipulador da API foram escritos para isso (clone por JSON, `diaDe` com fallback UTC−3, manipulador síncrono). Valide mudanças no backend com `npm run gas:smoke`.
- Cada execução do Apps Script carrega **todos** os arquivos: mantenha-os pequenos (por isso a API não usa zod). Ordem de carga em `apps-script/.clasp.json` (`filePushOrder`, gerada pelo build).
- Leituras vêm do **CacheService** (15 min); gravações só das tabelas alteradas; logs só anexam. `GasStore` está em `apps/gas/src/gas-store.ts`.
- Colunas de texto na planilha usam formato "@" (datas, instantes e CPF/CNPJ não podem ser convertidos pelo Sheets).
- Tokens de design são **gerados** (`npm run tokens`); não usar cores/raios/pesos fora dos tokens (há teste em `frontend/ui/test/design.test.ts`). Evitar o namespace `--spacing-*` do Tailwind para tokens de espaço (colide com `max-w-xl`).
- **Armadilhas do HtmlService (aprendidas em produção)**: (1) o servidor carrega os `.js` em ordem **alfabética**, ignorando `filePushOrder` quando nada mudou → arquivos de backend têm prefixo numérico (`00-`, `1x-`, `2x-`); (2) `&nome;` dentro de script vira entidade HTML e quebra o JS → `comoScript` separa o `&`; (3) template literals (crases) quebram o `document.write` da página → esbuild com `supported: {'template-literal': false}`; (4) link `<a href="#/rota">` com `<base target="_top">` navega a janela externa → navegar por JS (`preventDefault`); (5) o teste `e2e/gas-front.spec.ts` NÃO reproduz esses problemas, então depois de publicar confira no app real.
- Erros de carga e de renderização aparecem numa caixa vermelha no rodapé (`CARTEIRA_MOSTRAR` em `index.html`, `Contencao` em `main.gas.tsx`): se o usuário relatar tela branca, peça o texto dela.
- **Data da demonstração**: o app SEMPRE abre em hoje (fuso de São Paulo); só o papel é lembrado. Para reproduzir um cenário use `?data=AAAA-MM-DD` na URL (os testes E2E fazem isso). No Apps Script o parâmetro não chega ao iframe: use o campo de data.
- **Abas opcionais**: tabelas criadas depois da 1ª versão (hoje `cfg_metas_posicao`) entram em `OPCIONAIS` no `GasStore`: planilha antiga sem a aba continua funcionando (vazia = padrão) e a aba nasce na 1ª gravação. Nova tabela exige: `TABELAS`, `types.ts`, `scripts/dicionario.ts`, FK em `gerar-dicionario.ts`, seed, `npm run dicionario` e `npm run schema:apps-script`.
- Metas/limites de alerta por posição ficam em `cfg_metas_posicao` (só o Gerente Geral grava; padrão 50%–100%). O comparativo entre períodos NÃO compara AUM histórico (a POC não guarda saldo no tempo): usa fluxos e o valor atual da base.
- `clasp run` não funciona neste projeto; a homologação roda o mesmo código em Node (`sheets:homologar`) ou pelo editor (`homologar()`).
- Heredocs grandes no Bash tool às vezes quebram: prefira criar arquivos com a ferramenta Write.
- O web app usa `executeAs: USER_DEPLOYING` e `access: MYSELF`; papel e data são **simulados** (não há login por usuário).

## Estado
Ver `planos/status-execucao.md` (tarefas por domínio) e `planos/00-consolidacao.md`. Limites conhecidos: sem adaptador Postgres (DDL em `data/ddl/postgres.sql` só validado sintaticamente), Pact substituído por testes de contrato, mutação medida em ~69% na 1ª passada (testes dirigidos adicionados depois, sem remedição).
