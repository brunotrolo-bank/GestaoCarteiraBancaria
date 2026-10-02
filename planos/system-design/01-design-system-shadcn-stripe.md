# Design System do Cockpit — shadcn/ui + tokens do DESIGN-stripe.md

> **Status: planejamento, com todas as decisões de design fechadas (§9). Nada foi desenvolvido.** Este documento é entrada do System Design (decisões D-10, D-15 em [99](99-system-design-pendente.md)) e fonte normativa para o domínio [08](../dominios/08-dominio-experiencia-frontend.md).
> Pedido do usuário: considerar o ecossistema **shadcn/ui** como referência para o cockpit e seguir **estritamente** layout, cores, tipografia, bordas e densidade do arquivo de design.

## 1. Fontes de verdade e precedência
| Ordem | Fonte | Papel |
|---|---|---|
| 1 | [DESIGN-stripe.md](DESIGN-stripe.md) | **Tokens e regras visuais** (cores, tipografia, raios, espaçamento, elevação, componentes, Do/Don't). Em caso de dúvida visual, ele vence. |
| 2 | **shadcn/ui** (premissa do usuário: referência de mercado para apps analíticos e cockpits financeiros — *a classificação não foi verificada por mim; adotada como decisão do usuário*) | **Mecanismo de implementação**: componentes copiados para o repositório (código aberto e editável), tema por variáveis CSS, CLI/registro de distribuição com suporte a monorepo, gráficos sobre Recharts, tabelas sobre TanStack Table. |
| 3 | WCAG 2.2 AA (FR-UX-010 do 08) | Piso de acessibilidade; conflitos com (1) viram decisão explícita (§7), não desvio silencioso. |

**Observação sobre o nome do arquivo:** o pedido cita "DESIGN.md da raiz", mas o único arquivo existente é `planos\system-design\DESIGN-stripe.md`. Este plano trata **esse arquivo** como o DESIGN.md oficial. Ele cita o comando `npx @google/design.md lint DESIGN.md`; **não verifiquei que esse pacote existe** — confirmar antes de entrar no CI (T-DS-07).
**Observação sobre o conteúdo:** o arquivo descreve a linguagem visual de marketing de uma marca de infraestrutura financeira (a descrição o chama de "Stripi"). O cockpit corresponde ao que o arquivo chama de **"dashboard track"**. Onde o arquivo é omisso para um cockpit, o plano **não inventa**: registra a lacuna (§6) e propõe valor a ser aprovado.

## 2. O que o shadcn/ui significa para a arquitetura (confirmado na documentação oficial)
- Não é uma biblioteca instalada: o código dos componentes **vive no nosso repositório** ("Open Code"); distribuição via CLI e esquema de arquivos planos; suporta monorepo e tema por variáveis CSS.
- Gráficos: **Recharts** (não encapsulado), cores por variáveis `--chart-1…n`. Tabelas: **TanStack Table** (headless; ordenação, filtro, paginação, seleção, visibilidade de colunas).
- *Decisão (NC-DS-8):* base de front **React + TypeScript + Tailwind**, o que fixa a parte de front-end de **D-07/D-10**. (Que o ecossistema assenta em React/Tailwind não veio da documentação que li; o plano adota a pilha por decisão, e T-DS-01 confirma a compatibilidade da versão do CLI.)

**Consequências para os planos:**
1. **MFE:** o conjunto de componentes vira um **pacote compartilhado** (`ui`, no monorepo) consumido pelo shell e por todos os MFEs; as variáveis CSS ficam no `:root` do shell. Evita que cada MFE copie e divirja os componentes (violaria "uma só fonte de tokens", §5).
2. **POC (NC-UX-2, decidido):** shadcn exige *build* (React/Tailwind), então o front é um **app independente**; o Apps Script fica apenas como fonte de dados (Sheets), não como host da interface.
3. **Open Code ⇒ governança:** o código copiado passa a ser nosso; mudanças nele são revisadas como qualquer código (gates do 00 §9) e **não podem** afrouxar as regras do DESIGN-stripe.md.

## 3. Tokens — mapeamento DESIGN-stripe.md → variáveis do tema
Princípio: **os tokens nascem do front matter do DESIGN-stripe.md e são gerados por script** (nunca copiados à mão). Os nomes de variáveis shadcn abaixo são os convencionais do ecossistema (`--background`, `--primary`…); **conferir contra a versão do CLI adotada** no T-DS-01.

### 3.1 Cores
| Variável do tema | Token do DESIGN | Valor | Observação |
|---|---|---|---|
| `--background` | `canvas` | #ffffff | Fundo padrão |
| `--foreground` | `ink` | #0d253d | Texto padrão — "azul-marinho, nunca preto puro" |
| `--card` / `--popover` | `canvas` | #ffffff | Cartões sobre o fundo |
| `--card-foreground` / `--popover-foreground` | `ink` | #0d253d | |
| `--primary` | `primary` | #533afd | **Só** CTA preenchido e ênfase de link |
| `--primary-foreground` | `on-primary` | #ffffff | |
| `--secondary` / `--muted` | `canvas-soft` | #f6f9fc | Faixas e áreas sutis |
| `--secondary-foreground` | `ink-secondary` | #273951 | |
| `--muted-foreground` | `ink-mute` | #64748d | Rótulos, legendas |
| `--accent` | `canvas-soft` *(decidido, §6)* | #f6f9fc | Hover/seleção; o DESIGN não define estado de hover de linha |
| `--accent-foreground` | `ink` | #0d253d | |
| `--border` | `hairline` | #e3e8ee | Borda de 1px em cartões e tabelas |
| `--input` | `hairline-input` | #a8c3de | Borda de campos |
| `--ring` | `primary` | #533afd | Foco (a borda do campo vira `primary`) |
| `--destructive` | `ruby` *(NC-DS-4, decidido)* | #ea2261 | O DESIGN diz que ruby "nunca é botão": usar só como texto/ícone/marcador; confirmação destrutiva usa botão `primary` + texto de aviso em ruby |
| `--sidebar*` | `brand-dark-900` *(NC-DS-1, decidido)* | #1c1e54 | "Cromo" escuro do app |
| `--chart-1…5` | ver §3.4 | — | |
Tokens extras mantidos como utilitários: `primary-deep` (#4434d4), `primary-press` (#2e2b8c, estado pressionado), `primary-soft` (#665efd, destaques de gráfico), `primary-bg-subdued-hover` (#b9b9f9, fundo de tag), `canvas-cream` (#f5e9d4, faixa de respiro), `shadow-blue` (#003770, base da sombra).

### 3.2 Tipografia
| Item | Regra do DESIGN | Aplicação no cockpit |
|---|---|---|
| Família | `sohne-var` (proprietária) → fallback `SF Pro Display`, `system-ui`; substituto aberto indicado: **Inter** peso 300 | Usar Inter (Google Fonts) salvo licença Sohne; **validar visualmente**: o conjunto `ss01` do Inter pode produzir variantes diferentes das da Sohne (o arquivo afirma equivalência; não verifiquei) |
| Peso | Display e corpo = **300**; botões e legendas = **400**; **nunca acima de 300 em display** | Teste automático de peso (§8) |
| Tamanhos | display-xxl 56 / xl 48 / lg 32 / md 26; heading-lg 22 / md 20 / sm 18; body-lg 16 / md 15 (**padrão de UI**); body-tabular 14; caption 13; micro 11; micro-cap 10 | Escala exposta como utilitários do Tailwind a partir dos tokens |
| Tracking | Negativo no display (−1.4px a −0.2px); 0 no corpo; −0.42px em `body-tabular`; −0.39px em `caption` | Idem |
| Recursos OpenType | `ss01` **global** no `body`; **`tnum` em toda célula de dinheiro ou contagem** | KPIs, tabelas, eixos de gráfico, totais |
| Formatação | — (não definida) | pt-BR: `R$ 1.234.567,89`, datas `dd/mm/aaaa` (FR-UX-011) |

### 3.3 Forma, espaço, elevação
| Token | Valor | Uso no cockpit |
|---|---|---|
| Raios | xs 4 · sm 6 · md 8 · lg 12 · xl 16 · pill 9999 | xs: tags/cromo de tabela · sm: **campos** · md: alertas/cartões compactos · lg: **cartões** · xl: moldura de painel · **pill: todos os botões e tags**. Os raios do shadcn (derivados de `--radius`) devem ser **sobrescritos explicitamente** para essa escala |
| Espaçamento | base 8; 2/4/8/12/16/24/32/64 | Padding de cartão de cockpit = **24px** (cartão de dashboard); 32px apenas em cartões "feature"; secções de produto **32–48px** |
| Elevação | Nível 0 plano · Nível 1 `rgba(0,55,112,0.08) 0 1px 3px` · Nível 2 `rgba(0,55,112,0.08) 0 8px 24px, rgba(0,55,112,0.04) 0 2px 6px` | Cartões: nível 1; painéis flutuantes/modais/gavetas: nível 2. Sem outras sombras |
| Breakpoints | ≥1440 / 1024–1440 / 768–1023 / <768 | Grade reorganiza 4→2→1 colunas de KPI |
| Alvos de toque | botões ≥ 40×40 (44 em telas pequenas); campos ≥ 40px de altura | Aplica-se também a linhas clicáveis de tabela |

### 3.4 Gráficos (o DESIGN define só destaques; paleta abaixo **adotada**, só com tokens documentados)
O DESIGN documenta `primary-soft` como **destaque de gráfico** e `ruby` como **destaque de gráfico**; não define paleta categórica. **Decisão:** série principal `primary`; secundária `primary-soft`; referência/linha-limite `ink-mute`; alerta `ruby`; neutro `brand-dark-900`. Máximo de **5 séries** por gráfico; nunca usar cor como única codificação (rótulo, padrão ou ícone junto). Eixos e totais com `tnum`.

## 4. Componentes shadcn → regras do DESIGN-stripe.md
| Componente (shadcn) | Regra obrigatória (DESIGN) | Uso no cockpit |
|---|---|---|
| Button | `button-primary-pill`: fundo `primary`, texto branco, **pill**, padding **8px 16px**, 16px/400; pressionado `primary-press`. `secondary`: fundo branco, texto e borda `primary` 1px. `on-dark`: fundo `brand-dark-900`. **Um único botão preenchido por faixa/região.** Nunca retângulo arredondado. | Confirmar troca de titular, aprovar delegação, simular/confirmar redistribuição (a ação secundária é outline) |
| Input / Select / Textarea | Fundo branco, texto `ink`, 15px, padding 8px 12px, raio **6px**, borda `hairline-input` 1px, foco = borda `primary`, altura ≥ 40px | Filtros, formulário de delegação (datas) |
| Card | Fundo branco, borda `hairline` 1px, raio **12px**, padding **24px** (dashboard), nível 1 opcional | KPIs, painéis de carteira |
| Card "featured" | Fundo `brand-dark-900`, texto branco, raio 12 | **Um** destaque por tela (ex.: KPI principal AUM) — uso opcional |
| Badge / Tag | `pill-tag-soft`: fundo `primary-bg-subdued-hover`, texto `primary-deep`, micro-cap 10px/400, padding 4px 8px, pill | "Cobertura temporária", segmento, status (ver restrição de contraste §7) |
| Table (+TanStack) | Borda `hairline` 1px; cromo `xs` 4px; **células numéricas com `tnum`** e `body-tabular` (14px/300, −0.42px); cabeçalho em `caption` `ink-mute` | Clientes, posições, histórico de titularidade, movimentações |
| Tabs | Sem definição própria no DESIGN → derivar: texto `ink-mute`, ativo `ink` com sublinhado `primary` | "Minha Carteira / Carteira Delegada" |
| Dialog / Sheet | Superfície branca, raio **xl 16px**, **nível 2** | Visão 360° (gaveta lateral), wizard de redistribuição |
| Alert | Raio **md 8px**; fundo `canvas-soft` + ícone | **Banner permanente "Modo simulação"** |
| Tooltip / Popover | Branco, raio md, nível 2 | Definição de métrica (FR-INS-010) |
| Skeleton / Empty / Error | Superfícies `canvas-soft`; textos reais pt-BR | Estados obrigatórios (FR-UX-009) |
| Chart | Recharts + variáveis `--chart-*`, `tnum` nos eixos | Capacidade por posição, volumetria por segmento, tendência de AUM |
| Sidebar / Nav | `nav-bar`: fundo `canvas`, texto `ink`, padding 16px 24px; sidebar e topbar em `brand-dark-900` (NC-DS-1, decidido) | Shell com seletor de papel no topo |
| Toast (Sonner) | Mesma linguagem de Alert | Confirmação de operações |

## 5. Layout do cockpit (especificação de baixa fidelidade)
```
┌ topbar ─ [logo] ────────────── [Visualizar como ▾ Posição 1..5 | Gerente Geral] [banner simulação] ┐
│ sidebar │  Torre de Controle (GG)                                                               │
│ (nav)   │  ┌KPI AUM┐┌KPI Clientes┐┌KPI Penetração┐┌KPI Posições em alerta┐   ← grade 4→2→1         │
│         │  ┌ Capacidade por posição (barras + linhas 40% e 100%) ┐┌ Volumetria por segmento ┐      │
│         │  ┌ Tabela de posições: posição · titular · segmento · clientes · utilização · AUM · status ┐
└─────────┴──────────────────────────────────────────────────────────────────────────────────────────┘
```
- **Seletor de papel** no topo (Select/Command): Posição 1–5 e Gerente Geral; troca dados em ≤ 1 s (AC-UX-04).
- **Carteira:** tabela de clientes com filtros (segmento, status), visibilidade de colunas, ordenação; clique abre **gaveta 360°** (cadastro, risco, produtos, CRM, linha do tempo de posições, ação "Transferir").
- **Delegado:** abas "Minha Carteira" / "Carteira Delegada" com tag de cobertura e data final.
- **Redistribuição:** assistente em duas etapas (simular → confirmar), com antes/depois da utilização.
- **Posição (J1):** detalhe com linha do tempo de titularidade e ação "Trocar titular" (confirmação).
- **Densidade:** corpo 15px; tabelas 14px `tnum`; seções de produto com **32–48px** de respiro; cartões com **24px**; altura mínima de linha/campo **40px**. Sem componentes decorativos.
- **Gradiente em malha (mesh):** o DESIGN o define como marca **de heróis de marketing** e proíbe heróis sem ele *no marketing*. No cockpit ele **não aparece atrás de dados**; uso restrito a uma **capa de apresentação** para o gestor de negócio (NC-DS-2, decidido).

## 6. Lacunas do DESIGN-stripe.md para um cockpit (propostas **adotadas** — ver §9; só tokens já documentados)
O arquivo proíbe novos acentos fora dos documentados e declara que **não há paleta semântica** (erro/sucesso vivem "no produto").
| Necessidade do cockpit | Situação no DESIGN | Decisão adotada |
|---|---|---|
| Estado **crítico** (utilização > limite superior; erro) | Sem token semântico; `ruby` só como destaque de gráfico/acento, "nunca botão" | Usar `ruby` **apenas** como texto/ícone/marcador (nunca como botão preenchido) + ícone + rótulo |
| Estado **atenção** | Sem token | `lemon` (#9b6829) como texto/ícone — é cor de "sherbet" do gradiente; avaliar contraste |
| Estado **sucesso/saudável** | Sem token | Representar por **ausência de alerta** + `ink-secondary`; **não** introduzir verde |
| Estado **informativo** | — | `primary-soft`/`primary-deep` |
| Hover/seleção de linha | Não definido | `canvas-soft` |
| Desabilitado | Não definido | `ink-mute` + opacidade; manter contraste de texto legível |
| Largura máxima do app | Só ~1200px de marketing | Fluida, contêiner máx. **1440px** (NC-DS-3) |
| Modo escuro completo | Só `brand-dark-900` como superfície | Fora da POC (NC-DS-1) |
| Altura de linha de tabela | Só "campos ≥ 40px" | 40px (derivado) |
| Foco visível | Borda do campo vira `primary`; sem anel global | Anel `ring` = `primary` 2px em todo elemento interativo |

## 7. Conflitos entre o DESIGN e a acessibilidade (regra de resolução decidida em NC-DS-6)
Cálculos aproximados de contraste WCAG (fórmula padrão; **confirmar com ferramenta** em T-DS-04):
| Par (texto sobre fundo) | Razão aproximada | Parecer |
|---|---|---|
| `ink` sobre `canvas` | ≫ 7:1 | OK |
| `primary` #533afd sobre `canvas` | ≈ 6,2:1 | OK |
| `ink-mute` #64748d sobre `canvas` | ≈ 4,7:1 | OK (limite próximo) |
| `ink-mute` sobre `canvas-soft` | ≈ 4,5:1 | **Limítrofe** para texto pequeno |
| `primary-deep` #4434d4 sobre `primary-bg-subdued-hover` #b9b9f9 (tag de 10px) | ≈ 4,2:1 | **Abaixo de 4,5:1** (texto pequeno) |
Além disso, **peso 300 em 10–14px** reduz legibilidade percebida; o DESIGN exige 300.
**Decisão:** respeitar o DESIGN e **medir** (T-DS-04); onde o par falhar, aplicar a menor correção com token documentado — `primary-press` #2e2b8c como texto da tag e `ink-secondary` nas legendas sobre `canvas-soft` — registrando um ADR curto com a medição.

## 8. Barreiras automáticas contra desvio visual (anti-slop de UI)
| Regra | Verificação |
|---|---|
| Nenhuma cor fora dos tokens | Varredura do código: todo `#hex`/`rgb()` deve existir nos tokens gerados |
| Pill em todo botão/tag | Teste de componente: `border-radius` = 9999px |
| Padding de botão ≥ 8px 16px | Teste de componente |
| Display ≤ peso 300; corpo 300; botões/legendas 400 | Teste de estilo computado |
| `ss01` no `body`; `tnum` em células numéricas | Teste de estilo computado + varredura de células monetárias |
| Raios da escala (4/6/8/12/16/pill) | Varredura do CSS gerado |
| Um botão preenchido por região | Teste de página (contagem) |
| `primary` nunca como cor de texto corrido | Revisão + teste de seletor |
| Contraste ≥ 4,5:1 em texto pequeno | Cálculo automático sobre pares do tema + axe |
| Dinheiro formatado pt-BR | Teste de formatação |
| Gráficos ≤ 5 séries, com legenda/rótulo | Teste de componente |
| Sem texto de preenchimento / sem decoração sem função | Revisão (`impeccable`) e checklist do 08 |
| Tokens gerados do DESIGN-stripe.md (não copiados) | CI regenera e compara; diferença = falha |

## 9. Decisões de design (todas fechadas — sem pendências)
| ID | Tema | Decisão | Status |
|---|---|---|---|
| NC-DS-1 | Cromo do app | **Sidebar e topbar em `brand-dark-900`**, área de conteúdo clara (`canvas-soft` de fundo, cartões `canvas`). Modo escuro completo fora da POC | **Decidido** |
| NC-DS-2 | Gradiente em malha | Somente na **capa de apresentação** ao gestor; nunca atrás de dados ou tabelas | **Decidido** |
| NC-DS-3 | Largura e densidade | Layout fluido com contêiner máximo de **1440px** (limite do breakpoint "Wide" do DESIGN); densidade do DESIGN: corpo 15px, tabelas 14px `tnum`, cartões 24px, linha/campo ≥ 40px | **Decidido** (ajuste fino só por ADR após protótipo) |
| NC-DS-4 | Estados semânticos | Aprovados como em §6: crítico = `ruby` (texto/ícone/marcador, nunca botão), atenção = `lemon`, informativo = `primary-soft`/`primary-deep`, saudável = ausência de alerta; **sempre ícone + texto**; sem verde | **Decidido** |
| NC-DS-5 | Fonte | **Inter** (Google Fonts), pesos 300/400, com os recursos do DESIGN. Sohne fora de escopo (licença). Teste visual de `ss01` e `tnum` no T-DS-03 | **Decidido** |
| NC-DS-6 | Contraste | Regra: **medir** (T-DS-04) e, se um par falhar 4,5:1, aplicar a correção abaixo (só tokens documentados). Tag `pill-tag-soft`: texto `primary-press`; legendas sobre `canvas-soft`: `ink-secondary`. A correção só é adotada se o par original falhar na medição | **Decidido** |
| NC-DS-7 | Arquivo de design | Mantido em `planos\system-design\DESIGN-stripe.md` como o DESIGN.md oficial; referenciado por caminho e usado pelo gerador de tokens. Ao iniciar o código, o gerador lê esse caminho (sem cópia na raiz) | **Decidido** |
| NC-DS-8 | Base de front | **React + TypeScript + Tailwind**, componentes shadcn/ui, gráficos Recharts, tabelas TanStack Table | **Decidido** |
| NC-UX-2 | Entrega da POC | **App independente** (build normal); Apps Script permanece apenas como fonte de dados da POC (Sheets), não como host do front | **Decidido** |
> Qualquer mudança nestas decisões passa por ADR e atualiza este arquivo, o 08 e o 99.

## 10. Tarefas de planejamento/execução (TDD; nenhuma foi iniciada)
| # | Tarefa | Teste-primeiro |
|---|---|---|
| T-DS-01 | Fixar versão do CLI/tema shadcn e confirmar nomes de variáveis | Teste de contrato do tema (todas as variáveis esperadas existem) |
| T-DS-02 | Gerador **front matter → variáveis CSS/tema** | Teste: cada token do DESIGN aparece com o mesmo valor |
| T-DS-03 | Sobrescrever raios/espaços/sombras do tema para a escala do DESIGN | Teste de estilo computado |
| T-DS-04 | Calculadora de contraste dos pares do tema + ADRs de conflito (§7) | Teste falha enquanto houver par < 4,5:1 sem ADR |
| T-DS-05 | Variantes de componentes (Button, Input, Card, Badge, Table, Alert, Tabs, Sheet) | Testes de §8 por componente |
| T-DS-06 | Pacote `ui` compartilhado entre shell e MFEs | Teste de que nenhum MFE importa componente local duplicado |
| T-DS-07 | Linters/varreduras de §8 no CI (incl. lint do DESIGN se o pacote existir) | CI falha ao introduzir cor/peso/raio fora dos tokens |
| T-DS-08 | Telas de referência (Torre, Carteira, 360°, Delegação, Redistribuição) em regressão visual | Capturas aprovadas pelo usuário |
