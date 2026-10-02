# 99 — System Design (decidido para a POC)

> **Status:** decisões D-01…D-14 **fechadas em 2026-10-01** a pedido do usuário ("adotar as recomendações", POC). Detalhe em [03-decisoes-system-design-poc.md](03-decisoes-system-design-poc.md). Continuam **revisáveis** se o usuário fornecer um `.md` de System Design com outra orientação.
> O nome histórico do arquivo ("pendente") foi mantido para não quebrar os links dos planos.

## 1. Como reabrir uma decisão
1. Salvar o novo `.md` em `planos\system-design\` (sem alterá-lo).
2. Comparar com D-01…D-15: marcar *Confirmado* / *Conflito* / *Omitido*.
3. Abrir ADR por mudança (formato em §4) e atualizar só as seções "Dependências do System Design" e as tarefas afetadas dos domínios; registrar no changelog do [00](../00-consolidacao.md).
4. Rodar o checklist de consistência (§5).

## 2. Registro de decisões
| ID | Decisão (resumo) | Status |
|---|---|---|
| D-01 | Monolito modular com fronteiras por bounded context | **Decidido** |
| D-02 | Porta de repositório: adaptador Sheets (POC) + Postgres (testes/produção) | **Decidido** |
| D-03 | Read models calculados na aplicação (POC); views em Postgres/BigQuery em produção | **Decidido** |
| D-04 | Núcleo próprio de autorização + adaptador SQL; spike OpenFGA depois | **Decidido** |
| D-05 | Papel simulado na POC; Google Identity/IdM em produção | **Decidido** |
| D-06 | Métricas em código (POC); spike do Cube depois | **Decidido** |
| D-07 | Node.js + TypeScript | **Decidido** |
| D-08 | Local na POC; Cloud Run ao publicar (exige billing) | **Decidido** (billing pendente de ação do usuário) |
| D-09 | Eventos internos + outbox | **Decidido** |
| D-10 | React + Module Federation; pacote `ui` | **Decidido** |
| D-11 | MCP stdio local na POC | **Decidido** |
| D-12 | Monorepo com workspaces | **Decidido** |
| D-13 | Logs JSON com `correlation_id`, sem PII | **Decidido** |
| D-14 | git + GitHub Actions + clasp; Cloud Run depois | **Decidido**; repositório: https://github.com/brunotrolo/GestaoCarteiraBancaria (público, só `README.md`); falta autorizar `init`/*push* |
| D-15 | Design system: shadcn/ui + DESIGN-stripe.md | **Decidido** |

## 2.1 Insumos de System Design
| Arquivo | Conteúdo |
|---|---|
| [DESIGN-stripe.md](DESIGN-stripe.md) | Tokens e regras visuais (fonte de verdade visual) |
| [01-design-system-shadcn-stripe.md](01-design-system-shadcn-stripe.md) | Mapeamento shadcn/ui ↔ tokens; decisões NC-DS-1..8 |
| [02-ambiente-google-sheets-apps-script.md](02-ambiente-google-sheets-apps-script.md) | Acesso verificado a Sheets/Apps Script; projeto GCP; service account |
| [03-decisoes-system-design-poc.md](03-decisoes-system-design-poc.md) | **D-01…D-14 decididas** |

## 3. Restrições conhecidas
- Front-end: shadcn/ui + DESIGN-stripe.md; app independente (D-15).
- Dados da POC em Google Sheets via Sheets API/Apps Script; web app do Apps Script **sem implantação** (publicação manual do usuário).
- Regra inegociável: carteira pertence à **posição**.
- Dados sintéticos apenas; LGPD aplicável a dado real futuro; CPF/CNPJ sempre mascarados.
- Sem git inicializado e sem billing no projeto GCP até o usuário decidir.

## 4. Modelo de ADR
```
# ADR-NNN — Título
Status: Proposto | Aceito | Substituído por ADR-xxx
Contexto: (forças, restrições, requisitos R*/FR-* afetados)
Opções consideradas: (≥ 2, com prós/contras)
Decisão: (uma, justificada contra os atributos de qualidade)
Consequências: (positivas, negativas, riscos, o que muda nos domínios)
Verificação: (teste/fitness function)
```

## 5. Checklist de consistência
- [ ] Nenhum plano de domínio contradiz D-01…D-15.
- [ ] Fronteiras de domínio do 00 §3 respeitadas pela estrutura do monorepo (D-12).
- [ ] Atributos de qualidade globais definidos antes da onda 3 (disponibilidade, latência, segurança) — hoje: POC sem SLA (Q-39).
- [ ] Matriz de rastreabilidade do 00 atualizada.
