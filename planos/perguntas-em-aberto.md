# Perguntas e decisões — registro consolidado

> Estado em 2026-10-01. Cada item mostra a decisão e a **origem**:
> **[U]** respondida pelo usuário · **[P]** adotada por padrão de POC (o usuário pediu "siga o recomendado, é uma POC"; **não foi respondida item a item** — reabrir se discordar) · **[S]** depende do arquivo de System Design (continua em aberto).
> Nada foi desenvolvido. Mudanças aqui exigem atualizar o domínio afetado e, se estrutural, um ADR.

## 0. Decididos antes
| Item | Decisão |
|---|---|
| NC-DS-1 | Sidebar/topbar em `brand-dark-900`, conteúdo claro |
| NC-DS-2 | Gradiente em malha só na capa de apresentação |
| NC-DS-3 | Fluido, contêiner máx. 1440px, densidade do DESIGN |
| NC-DS-4 | Rubi/limão/índigo com ícone + texto; sem verde |
| NC-DS-5 | Inter 300/400 |
| NC-DS-6 | Medir contraste; corrigir só com tokens existentes |
| NC-DS-7 | DESIGN fica em `system-design\DESIGN-stripe.md` |
| NC-DS-8 | React + TypeScript + Tailwind + shadcn/ui |
| NC-UX-2 | App independente; Apps Script só como fonte de dados |
| ENV-1..3 | Planilha compartilhada, acesso comprovado, web app sem implantação |

## A. Posições e Delegação
| ID | Decisão | Origem |
|---|---|---|
| Q-01 | **Um gerente ocupa no máximo UMA posição** (regra do domínio, não política configurável) | **[U]** |
| Q-02 | **Datas (dia)**, intervalo **fechado** (início e fim inclusivos), fuso America/Sao_Paulo, dias corridos | **[U→P]** ("faça o recomendado") |
| Q-03 | Troca retroativa só pelo GG, com motivo obrigatório e auditoria | [P] |
| Q-04 | Estados **derivados** do relógio (titular atual, situação da delegação); grava-se só aprovação/revogação | [P] |
| Q-05 | Remover "Férias" do status do gerente | [P] |
| Q-06 | Criar `dim_agencias`; uma agência na POC | [P] |
| Q-07 | Delegado = qualquer gerente **Ativo** (diferente do titular). *Com Q-01, todo gerente ativo tem posição, exceto o GG* | [P] |
| Q-08 | Titular ausente durante a delegação fica **somente leitura** | **[U]** |
| Q-09 | Solicita: titular ou GG · Aprova: GG · GG pode aprovar as próprias | **[U→P]** |
| Q-10 | Delegação parcial: fora da POC | [P] |
| Q-11 | Notificações: fora da POC | [P] |
| Q-12 | Gerente Geral = perfil em `dim_gerentes`, sem posição; visão total regida pelo 04 | [P] |
| Q-13 | Sem Gerente Adjunto na POC | [P] |
| Q-26 | Aprovação da delegação (Submetida/Aprovada/Rejeitada/Revogada) permanece no modelo | [P] |

## B. Clientes e Carteira
| ID | Decisão | Origem |
|---|---|---|
| Q-14 | Capacidade excedida gera **alerta + justificativa obrigatória**, sem bloqueio | **[U→P]** |
| Q-15 | Só clientes **Ativos** contam para a capacidade | [P] |
| Q-16 | Só o GG redistribui; sem dupla aprovação | [P] |
| Q-17 | Sem co-gestão: um cliente, uma posição | [P] |
| Q-18 | Unificar em `score_risco` (1–1000) | [P] |
| Q-19 | Reclassificação de segmento manual | [P] |
| Q-20 | Catálogo inicial de produtos: cartão Black, câmbio, crédito, previdência, seguro | [P] |
| Q-21 | Histórico de posição por cliente + log de auditoria append-only | [P] |

## C. Acesso, Segurança e Privacidade
| ID | Decisão | Origem |
|---|---|---|
| Q-22 | GG escreve apenas: trocar titular, aprovar/revogar delegação, redistribuir | [P] |
| Q-23 | "Apenas Emergencial" = leitura + registrar nota de atendimento | [P] |
| Q-24 | **CPF/CNPJ sempre mascarados** (dado sensível), em tela, API, MCP e logs, para **todos** os papéis. Exibição completa só por ação explícita de "revelar", restrita a titular da posição e GG, **registrada em auditoria**. Nomes são sintéticos na POC | **[U]** (a ação "revelar" é meu detalhamento) |
| Q-25 | **Registrar logs e auditoria, sem política de expurgo** na POC (nenhuma retenção/descarte automático) | **[U]** |

## D. Insights
| ID | Decisão | Origem |
|---|---|---|
| Q-27 | Desbalanceamento: acima de **100%** ou abaixo de **50%** da capacidade (por posição). 120%/40% do Plano Geral são massa de teste | [P] |
| Q-28 | Tempo real sobre dados sintéticos | [P] |
| Q-29 | "Saúde comercial" = apenas os KPIs listados no 05 | [P] |
| Q-30 | Sem metas/orçado na POC | [P] |

## E. Dados e Qualidade
| ID | Decisão | Origem |
|---|---|---|
| Q-31 | Modelar `id_agencia`, operar uma agência | [P] |
| Q-32 | Dataset sintético: 5 posições, ≈ 350 clientes (ex.: 50/75/70/80/75), seed fixa | [P] |
| Q-33 | Manter prefixos `dim_/fct_/bridge_` + `ref_/log_` | [P] |
| Q-34 | Cobertura de ramos ≥ 90% e mutação ≥ 80% nos núcleos 01–04 (ajuste por ADR) | **[U→P]** |
| Q-35 | Remuneração variável e integrações legadas **fora de escopo** | **[U→P]** |

## F. API / MCP
| ID | Decisão | Origem |
|---|---|---|
| Q-36 | Consumidores: front + agentes MCP internos | [P] |
| Q-37 | MCP de escrita cria delegação **Submetida**; aprovação humana pelo GG no front | [P] |
| Q-38 | MCP em stdio/local na POC; remoto com autenticação só em produção | [P] |
| Q-39 | Sem SLA formal; limites de taxa conservadores | [P] |
| Q-40 | `/v1`; *breaking* só em `/v2` | [P] |
| Q-41 | Substituir `user_email`/`role_override` na URL pelo contexto de ator (07) | [P] |
| Q-42 | Incluir `simular_redistribuicao` como ferramenta MCP | [P] |

## G. Front e Demonstração
| ID | Decisão | Origem |
|---|---|---|
| Q-43 | Module Federation com React (confirmar após System Design) | [P] / [S] |
| Q-44 | pt-BR; desktop primeiro, responsivo até tablet | [P] |
| Q-45 | "Viajar no tempo" na demo, só em modo simulação | [P] |
| Q-46 | Público: gestor de negócio; demo ≤ 10 min (J1→J2→J3) | **[U→P]** |

## H. System Design geral — **decidido pelo usuário em 2026-10-01 ("adotar as recomendações")**
Detalhe e justificativas em [system-design/03-decisoes-system-design-poc.md](system-design/03-decisoes-system-design-poc.md). Revisáveis se chegar outro `.md` de System Design.
| ID | Recomendação |
|---|---|
| D-01 | Monolito modular com fronteiras reais por domínio |
| D-02 | Cloud SQL (Postgres) em produção; Sheets na POC |
| D-03 | Read models no Postgres na POC; BigQuery em produção |
| D-04 | Núcleo próprio puro + adaptador SQL; spike OpenFGA depois |
| D-05 | Papel simulado na POC; Google Identity/IdM em produção |
| D-06 | Spike do Cube; fallback: views SQL versionadas |
| D-07 | Node.js (TypeScript), alinhado ao front |
| D-08 | Google Cloud Run (projeto `gestao-carteira-poc`) |
| D-09 | Outbox no banco; broker só em produção |
| D-10/D-11 | Ver Q-43/Q-38 |
| D-12 | Monorepo com pacote `ui` compartilhado |
| D-13/D-14 | Observabilidade e CI/CD a definir com o repositório |

## I. Efeito das respostas nas specs (aplicar na execução)
| Resposta | Mudança nos planos |
|---|---|
| Q-01 (1 posição por gerente) | 01: nova invariante **FR-POS-012** "gerente tem no máximo uma ocupação vigente em todo o sistema"; cenário **AC-POS-07**. 04: remove caso de borda "titular de 2 posições" |
| Q-02 (datas inclusivas) | 01/02/04: intervalos em dia, fim inclusivo; testes de limite (véspera, início, fim, dia seguinte) |
| Q-08 (só leitura) | 02: FR-DEL-008 fixo em "Somente Leitura" (sem política configurável); 04: FR-ACE-006 idem |
| Q-14 (alerta) | 03: FR-CLI-004 confirmado (alerta + **justificativa obrigatória** acima de 100%, registrada) |
| Q-24 (mascarar) | 03/04/07: FR-CLI-012 passa a **mascaramento sempre ativo**; nova ação auditada "revelar documento"; teste: CPF/CNPJ nunca em claro em logs/API/MCP |
| Q-25 (logs sem expurgo) | 04/06: FR-ACE-012 e `log_auditoria` sem rotina de expurgo; retenção indefinida registrada como decisão de POC |
