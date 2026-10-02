# Status da execução dos planos

> Atualizado em 2026-10-01 (execução autorizada pelo usuário). Legenda: ✅ feito e verificado · 🟡 parcial (o que falta está dito) · ⛔ não feito (motivo). Evidência = arquivo de teste/artefato no repositório.
> Gates atuais: `npm run gates` (arquitetura + OpenAPI + tipos + testes com cobertura) e `npm run e2e` (Playwright). Números e relatórios em §6.

## 1. Resumo por onda
| Onda | Conteúdo | Estado |
|---|---|---|
| 0 Fundação | Constituição aplicada; esquema, dicionário, DDL, dados sintéticos, CI | ✅ (repositório git, monorepo, CI no GitHub Actions) |
| 1 Núcleo de dados e titularidade | Domínios 01 e 03 | ✅ |
| 2 Regras temporais e acesso | Domínios 02 e 04 | ✅ |
| 3 Leitura e integração | Domínios 05 e 07 | ✅ (Pact substituído por testes de contrato — ver §4) |
| 4 Experiência | Domínio 08 + design system | ✅ |
| 5 Endurecimento | Mutação, a11y automatizada, revisão independente, segurança | 🟡 ver §6 |

## 2. Tarefas por domínio
### 01 Posições e Ocupação — `packages/core/test/posicoes.test.ts`, `bordas.test.ts`
| Tarefa | Estado | Observação |
|---|---|---|
| T-POS-01 value objects | 🟡 | Validações inline nos agregados; sem classes de valor dedicadas (decisão C12: sem abstração especulativa) |
| T-POS-02 agregado Posição + transições | ✅ | AC-POS-03; transições testadas por tabela (sem property-based) |
| T-POS-03 histórico de titularidade | ✅ | Propriedade: nenhuma sequência de trocas gera sobreposição nem gerente em 2 posições (150 execuções) |
| T-POS-04 `trocarTitular` + relógio injetável | ✅ | AC-POS-01/02/04/06/07, retroativo, atomicidade |
| T-POS-05 consulta as-of | ✅ | AC-POS-05 |
| T-POS-06 porta de repositório + suíte de contrato | 🟡 | Porta = `Db` + `Store`; adaptadores memória e Sheets; prova de persistência por `sheets:smoke`; **sem suíte de contrato de repositório rodando nos dois adaptadores** |
| T-POS-07 eventos + outbox | ✅ | `log_eventos`; `PosicaoVagou`/`TitularAlterado` testados |
| T-POS-08 invariante cross-domínio | ✅ | AC-POS-01 e AC-CLI-09 (hash da carteira inalterado) |
| T-POS-09 Pact + OpenAPI | 🟡 | OpenAPI ✅ (Spectral); Pact ⛔ → testes de contrato (§4) |

### 02 Delegação — `delegacao.test.ts`
| T-DEL-01 `vigente()/situacao()` | ✅ | Limites, fuso, propriedade por 300 períodos |
| T-DEL-02 agregado e máquina de estados | ✅ | |
| T-DEL-03 elegibilidade | ✅ | AC-DEL-06/07 |
| T-DEL-04 sobreposição | ✅ | AC-DEL-05 (+ regra repetida na qualidade de dados e no Apps Script) |
| T-DEL-05 casos de uso | ✅ | submeter/aprovar/rejeitar/revogar |
| T-DEL-06 `DelegacoesVigentes` | ✅ | AC-DEL-01/02/03 |
| T-DEL-07 varredura idempotente | ✅ | Executar 2× não duplica |
| T-DEL-08 cross-domínio | ✅ | AC-DEL-10; AC-DEL-09 em `acesso.test.ts` |
| T-DEL-09 Pact | 🟡 | ver §4 |

### 03 Clientes e Carteira — `clientes.test.ts`
| T-CLI-01..09 | ✅ | CPF/CNPJ, cadastro, vínculo histórico, capacidade/aderência, simulação sem efeitos, execução atômica e idempotente, desfazer, produtos/CRM, AC-CLI-09 |
| T-CLI-10 Pact | 🟡 | ver §4 |

### 04 Acesso e Visibilidade — `acesso.test.ts`, `apps-script/test/equivalencia.test.ts`
| T-ACE-01..06, 08 | ✅ | Núcleo único, delegação/escopo, GG, negação por padrão, papel simulado (API/MCP), as-of + explicação (`/acesso/explicacao`) |
| T-ACE-05 propriedade | ✅ | Decisão ≡ oráculo ingênuo independente (400 execuções) |
| T-ACE-07 `PredicadoDeLinha` SQL + equivalência | ⛔ | Sem adaptador SQL (D-02: Postgres não implementado). Em vez disso: **equivalência TypeScript ≡ Apps Script** (JavaScript) provada por propriedade |
| T-ACE-09 log de decisões | 🟡 | Negações (`ACESSO_NEGADO`) e "revelar documento" auditados (FR-ACE-012); **leituras permitidas via delegação/GG não são registradas** (custo de escrita no Sheets) |
| T-ACE-10 spike OpenFGA/Permify | ⛔ | Opcional; não realizado |

### 05 Insights — `insights.test.ts`
| T-INS-01 dataset controlado | 🟡 | Fixtures com oráculo independente nos testes; **a "verdade-terrestre revisada por humano" não foi feita** |
| T-INS-02..08 métricas, desbalanceamento, penetração, predicado, soma das partes, 360°, delegado | ✅ | AC-INS-01..08 |
| T-INS-09 as-of | 🟡 | Posição e titularidade as-of ✅; **AUM não tem histórico** (usa o valor atual) |
| T-INS-10 spike Cube | ⛔ | Decisão D-06: métricas em código; spike não realizado |
| T-INS-11 Pact | 🟡 | ver §4 |

### 06 Plataforma de Dados — `packages/data/test`, `scripts/test/dicionario.test.ts`
| T-DAD-01 convenções | ✅ | Teste de nomes/prefixos; decisões em `03-decisoes` |
| T-DAD-02 dicionário completo | ✅ | `planos/dominios/anexos/dicionario-de-dados.md` (gerado; AC-DAD-08) |
| T-DAD-03 esquema + DDL | ✅ | `data/ddl/postgres.sql` validado pelo **parser do Postgres**; ⛔ não executado em um servidor |
| T-DAD-04/05 sintéticos e cenários | ✅ | Seed determinístico (demo/base/minimo), J1/J2/J3, documentos com marcador sintético |
| T-DAD-06 carga idempotente | ✅ | `npm run sheets:carga` (releitura + hash idêntico, executada 2×) |
| T-DAD-07 testes de qualidade | ✅ | `verificarIntegridade` (TS) e versão Apps Script, equivalentes |
| T-DAD-08 linhagem + LGPD | 🟡 | Classificação LGPD por coluna ✅; **linhagem fonte→métrica não documentada** |
| T-DAD-09 plano e ensaio de migração | 🟡 | Ensaio de carga/reconciliação por hash no Sheets ✅; **plano Sheets→Postgres não escrito** |

### 07 API/MCP — `apps/api/test`, `apps/mcp/test`
| T-API-01 OpenAPI + lint | ✅ | `contracts/openapi.yaml`, Spectral sem erros; rotas ≡ contrato (teste) |
| T-API-02..05 erros, ator/papel, adaptadores, idempotência | ✅ | problem+json, 401/403, paginação, `Idempotency-Key` |
| T-API-06 MCP (5 ferramentas) | ✅ | Cliente e servidor MCP reais (transporte em memória); escrita só com confirmação humana |
| T-API-07 suíte adversarial | 🟡 | Um cenário de *prompt injection* via nota de CRM; não é uma suíte ampla |
| T-API-08 auditoria de chamadas | ✅ | Escritas, MCP e negações |
| T-API-09 Pact no CI | ⛔ | Substituído por: OpenAPI×rotas, SDK×OpenAPI, Spectral (ver §4) |

### 08 Experiência — `frontend/*/test`, `e2e/jornadas.spec.ts`
| T-UX-01 tokens + componentes base | ✅ | Gerados do DESIGN; ver T-DS |
| T-UX-02 cliente de API + mocks | 🟡 | SDK tipado **escrito à mão** (coberto pelo contrato); **sem servidor de mocks** (o front foi desenvolvido contra a API real) |
| T-UX-03 shell | ✅ | Seletor de papel/data, banner permanente, troca de papel ≤ 1 s sem vazar dados (E2E) |
| T-UX-04..07 MFEs posições, delegação, carteira/360°, cockpit | ✅ | E2E J1, J2, J3, 360° |
| T-UX-08 estados | ✅ | carregando/vazio/erro/sem permissão |
| T-UX-09 acessibilidade | 🟡 | Teclado ✅; contraste medido ✅; **auditoria automática com axe: ver §6** |
| T-UX-10 roteiro J1→J2→J3 + reset | ✅ | Capa com roteiro; botão "Reiniciar cenário" |
| T-UX-11 identidade visual | ✅ | DESIGN-stripe.md aplicado |

### Design system (T-DS) — `frontend/ui/test/design.test.ts`
| T-DS-01 versão do CLI shadcn | 🟡 | **O CLI do shadcn não foi usado**: os componentes foram escritos à mão no padrão shadcn (Radix + cva + tailwind-merge + Tailwind), não copiados via `shadcn add` |
| T-DS-02 gerador tokens | ✅ | `npm run tokens`; teste "tokens em dia" |
| T-DS-03 raios/espaços/sombras | ✅ | Espaçamento fora do namespace `--spacing-*` (colidia com `max-w-xl`; bug real encontrado no E2E e corrigido) |
| T-DS-04 contraste | ✅ | Medições registradas em teste; correções NC-DS-6 aplicadas |
| T-DS-05..06 componentes e pacote `ui` | ✅ | |
| T-DS-07 varreduras no CI | 🟡 | Varreduras ✅; **o lint do pacote `@google/design.md` não foi executado** (existência do pacote não verificada) |
| T-DS-08 regressão visual | 🟡 | Capturas geradas em `docs/telas/` pelos E2E; **sem comparação automática de imagens** |

## 3. Desvios de decisão (registrados)
| Decisão | O que foi feito | Por quê |
|---|---|---|
| D-10 Module Federation | Composição em build-time via workspaces + carregamento sob demanda (`React.lazy`) | Menor risco para a POC; os contratos (props + eventos) já isolam os MFEs; federação em runtime é evolução sem retrabalho nos MFEs |
| D-02 adaptador Postgres | Não implementado; DDL gerado e validado sintaticamente | Sem Docker/Postgres no ambiente de execução |
| Pact | Substituído por testes de contrato | Overhead de Pact broker em POC de monorepo único; contrato único (OpenAPI) e testes garantem rotas↔contrato↔SDK |

## 4. Contrato sem Pact — o que garante a compatibilidade
1. Teste "rotas implementadas ≡ OpenAPI" (`apps/api/test/api.test.ts`).
2. Lint Spectral do OpenAPI (sem erros).
3. Teste "todas as rotas do SDK existem no OpenAPI" (`frontend/sdk/test/sdk.test.ts`).
4. E2E que exercita API e front reais.
Limite: não detecta mudança de **formato do corpo** de resposta entre API e SDK (tipos do SDK são manuais). Evolução: gerar os tipos do SDK a partir do OpenAPI.

## 5. Ambiente Google
Ver [system-design/02-ambiente-google-sheets-apps-script.md](system-design/02-ambiente-google-sheets-apps-script.md): planilha com 14 abas e 370 clientes sintéticos; homologação 52/52 checks OK; Apps Script publicado via clasp (sem web app); API validada contra o Sheets vivo.

## 6. Métricas e relatórios
*(preenchido ao final da execução — ver 00-consolidacao §Status e o README)*
