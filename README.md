# Gestão de Carteira Bancária — POC

Prova de conceito de **gestão de carteira por Posição (cadeira/mesa), não por pessoa**: cinco mesas de atendimento, uma carteira por mesa; trocar o gerente, cobrir férias (delegação) ou rebalancear a agência **não exige migrar nenhum cliente**. Todos os dados são **sintéticos**.

Foco do projeto: **modelo de dados, camada semântica e engenharia de dados** (para dimensionar o esforço), com um front para validar as jornadas com o gestor comercial.

> Planejamento (SDD): [`planos/00-consolidacao.md`](planos/00-consolidacao.md) · decisões: [`planos/perguntas-em-aberto.md`](planos/perguntas-em-aberto.md) · System Design: [`planos/system-design/`](planos/system-design/).

## Jornadas demonstráveis
| | Jornada | Onde ver |
|---|---|---|
| J1 | **Turnover sem atrito**: trocar o titular da Posição 03; os 70 clientes seguem intactos | Posições → *Trocar titular* |
| J2 | **Cobertura de férias**: Posição 01 delegada à 02 de 01/11 a 15/11; expira sozinha em 16/11 | Carteira, papel "Mesa Alta Renda A", data 05/11 e 16/11 |
| J3 | **Torre de Controle**: 120% / 40% de capacidade; simular → redistribuir → desfazer | Torre de Controle → *Simular redistribuição* |

**Análises e insights** (Torre de Controle e Carteira, `GET /insights/analise`): insights automáticos em linguagem de negócio, concentração do AUM (Pareto), tendência de 12 meses, mapa de calor posição × segmento, faixas de AUM e de score, penetração e produtos por cliente, canais, e listas acionáveis (maiores clientes, prioridade de contato, venda cruzada) que abrem a visão 360°. Calculado em `packages/core/src/insights/analise.ts`, só sobre o que o papel pode ver.

Capturas de tela das jornadas: [`docs/telas/`](docs/telas/).

## Arquitetura (monolito modular — D-01)
```
packages/core      núcleo de domínio puro: posicoes · delegacao · clientes · acesso · insights (+ model, shared)
packages/data      dataset sintético determinístico, verificação de integridade, adaptador Google Sheets
apps/api           API REST v1 (contract-first: contracts/openapi.yaml)
apps/mcp           servidor MCP (stdio) com guardrails: escrita só com confirmação humana
apps-script/       Apps Script de homologação da planilha (publicado via clasp)
frontend/ui        design system (shadcn/ui + tokens gerados do DESIGN-stripe.md)
frontend/sdk       cliente tipado da API + contrato de micro-frontend
frontend/mfe-*     micro-frontends por domínio (cockpit, posições, carteira, delegação)
frontend/shell     shell: papel simulado, data de demonstração, banner de simulação, capa
scripts/           geradores (tokens, schema do Apps Script, dicionário/DDL), lint de arquitetura, carga/homologação do Sheets
e2e/               Playwright: jornadas J1/J2/J3 contra API e front reais
```
Regras estruturais verificadas por teste: o núcleo não tem I/O nem relógio global; módulos só dependem na direção permitida; o front só fala com a API pelo SDK; MFEs não se importam (`npm run lint:arq`).

## Como rodar
Requisitos: Node 24+.
```bash
npm install
npm run api            # API em http://localhost:3001/api/v1 (cenário demo em memória)
npm run web:dev        # front em http://localhost:5173 (proxy /api → 3001)
npm run mcp            # servidor MCP (stdio); defina MCP_PAPEL_PADRAO=GG para consultas
```
Persistir no **Google Sheets**: `STORE=sheets npm run api` (usa a service account por *impersonation*; nenhuma chave em disco — veja [`planos/system-design/02-ambiente-google-sheets-apps-script.md`](planos/system-design/02-ambiente-google-sheets-apps-script.md)).

O papel é **simulado** (`X-Papel-Simulado: GG | POS-AG01-00n`) sob a flag `SIMULACAO_PAPEL`; **nunca ligue em produção**. Sem a flag, a API recusa as chamadas (autenticação real é um item futuro).

## Qualidade (gates)
```bash
npm run gates          # arquitetura + OpenAPI (Spectral) + tipos + testes com cobertura (ramos ≥ 90%)
npm run e2e            # Playwright: jornadas na API e no front reais, gera docs/telas
npm run mutacao        # Stryker nos núcleos 01–04 (lento; meta ≥ 80%)
```
Geradores (os artefatos versionados são conferidos por teste): `npm run tokens`, `npm run schema:apps-script`, `npm run dicionario`.

## Planilha e Apps Script
```bash
npm run sheets:carga       # carrega o cenário demo (idempotente; valida por releitura)
npm run sheets:homologar   # executa o código REAL do Apps Script sobre a planilha e grava `homologacao_resultado`
npm run sheets:smoke       # escreve pelo adaptador, relê e restaura o cenário
npm run apps-script:push   # publica o código do Apps Script (clasp)
```
No editor do Apps Script, `homologar()` produz o mesmo resultado. O web app **não é implantado** (publicação manual do usuário).

## Aplicativo no Google Apps Script (testar sem rodar nada local)
O app completo (front React + backend com o mesmo núcleo de domínio) roda **dentro do Apps Script**, lendo e gravando a planilha:
- `apps-script/` — arquivos gerados do backend (um por domínio) e do front (um HTML por micro-frontend); `Codigo.js` — `doGet`, `incluir`, `apiChamar`, autoinstalação.
- O projeto no Apps Script mantém a separação por **domínio** (`1x-dominio-*.js`) e por **micro-frontend** (`mfe-*.html`), mais `00-nucleo.js`, `21-api.js`, `22-armazenamento-sheets.js`, `runtime.html`, `shell.html`. Os prefixos numéricos garantem a ordem de carga, pois o servidor do Apps Script carrega os arquivos em ordem alfabética.
- Gerar e publicar: `npm run gas:build && npm run apps-script:push` e, para uma versão estável, `clasp deploy` (dentro de `apps-script/`).
- Teste do backend em sandbox sem Node/Intl/URL: `npx tsx scripts/gas-smoke.ts`.
- Acesso: somente o dono da conta (`access: MYSELF`); a primeira abertura pede autorização dos escopos da planilha.
- **Transferível**: o projeto é autocontido (a planilha é criada e populada por `instalar()` em qualquer conta). Veja [`docs/transferencia-para-outra-conta.md`](docs/transferencia-para-outra-conta.md).
- Desempenho: leituras vêm de cache (CacheService, 15 min) e escritas gravam só o que mudou.

## Instalar em outra conta Google / outro computador
Guia passo a passo: [`docs/instalacao-em-nova-conta.md`](docs/instalacao-em-nova-conta.md) — você cria a planilha e o projeto Apps Script à mão, e o Claude Code popula a planilha (`npm run sheets:carga`) e atualiza o Apps Script (`npm run gas:build && npm run apps-script:push`) depois de `npm run setup:conta`. O arquivo [`CLAUDE.md`](CLAUDE.md) orienta o Claude Code nesse fluxo.

## Limitações conhecidas (honestas)
- **Persistência em Sheets não é transacional**: a atomicidade de lotes é garantida na aplicação (validação antes de gravar + rollback em memória). O DDL Postgres alvo ([`data/ddl/postgres.sql`](data/ddl/postgres.sql)) é validado sintaticamente, mas **não foi executado** em um Postgres (sem Docker/servidor no ambiente) e o adaptador Postgres **ainda não foi implementado**.
- **Execução remota do Apps Script** (`clasp run`) falhou neste projeto; a homologação roda o mesmo código em sandbox Node sobre os dados vivos e também pode ser executada no editor.
- **Micro-frontends** compostos em *build-time* (workspaces) — Module Federation em runtime fica como evolução (ver ADR em `planos/system-design/03-decisoes-system-design-poc.md`).
- **Sem autenticação real** (papel simulado) e **sem expurgo de logs** — decisões de POC.
