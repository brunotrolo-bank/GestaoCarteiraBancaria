# 03 — Domínio: Clientes e Carteira

> Princípios herdados de [../00-consolidacao.md](../00-consolidacao.md) §2. Requisitos: R1, R4, R7. Onda de entrega: **1** (paralelo com 01).

## 1. Propósito e fronteiras
**Propósito:** guardar o cadastro e a segmentação de clientes, o vínculo **cliente→posição** (carteirização), a capacidade da carteira e as **movimentações/redistribuições** com trilha de auditoria. É a fonte do dado financeiro (AUM, renda, risco) e de produtos/CRM usados na visão 360.

**Dentro:** cliente, segmento, vínculo à posição (com histórico), capacidade/utilização, simulação e execução de redistribuição em bloco, transferência individual, produtos contratados e notas CRM (dados-fonte).
**Fora:** quem pode ver (→ 04); cálculo de métricas agregadas (→ 05); titularidade (→ 01).
**Linguagem ubíqua:** Carteira (= conjunto de clientes de uma posição), Carteirização, Movimentação, Lote, Capacidade, Aderência de segmento.
**Referência de mercado:** Salesforce FSC (*Account Team / Territory*), BIAN *Customer Relationship Management*; Twenty CRM como espelho de modelo extensível.

## 2. Specify

### 2.1 User stories
| ID | Pri. | História |
|---|---|---|
| US-CLI-1 | P1 | Como GG, quero cadastrar clientes segmentados e alocá-los a posições. |
| US-CLI-2 | P1 | Como gerente, quero ver apenas clientes da minha carteira (acesso → 04). |
| US-CLI-3 | P1 | Como GG, quero **simular** e depois **executar** a redistribuição de um bloco de clientes entre posições, com auditoria (**J3**). |
| US-CLI-4 | P1 | Como gerente/GG, quero transferir **um** cliente de posição a partir da visão 360. |
| US-CLI-5 | P2 | Como GG, quero desfazer um lote de redistribuição. |
| US-CLI-6 | P2 | Como GG, quero ver a utilização de capacidade por posição. |

### 2.2 Requisitos funcionais
| ID | Requisito |
|---|---|
| FR-CLI-001 | Cliente: `id_cliente`, `nome_razao_social`, `cpf_cnpj` (**único**, validado por dígito verificador), `segmento_cliente` ∈ {UHNW, Private, Alta Renda, Varejo}, `faixa_renda_faturamento`, `volume_aum` (≥ 0, decimal exato), `score_risco` (1–1000), `status` ∈ {Ativo, Em Prospecção, Inativo}. |
| FR-CLI-002 | **O cliente referencia `id_posicao_carteira`, nunca gerente.** Nenhum atributo de pessoa é gravado no cliente. |
| FR-CLI-003 | `data_carteirizacao` registra a entrada na posição atual; o **histórico** de posições é preservado (SCD2/linha do tempo). |
| FR-CLI-004 | Capacidade: `utilizacao = clientes_ativos / capacidade_max_contas`. Ultrapassar 100% **gera alerta**, não bloqueio (ver NC-CLI-2). |
| FR-CLI-005 | Aderência: cliente de segmento ≠ `segmento_especialidade` da posição (exceto posição Misto/Geral) gera **aviso** de aderência, não erro. |
| FR-CLI-006 | **Simulação de redistribuição** (dry-run): dado conjunto de clientes e posição destino, devolve utilização antes/depois e avisos; **não persiste nada**. |
| FR-CLI-007 | **Execução** de redistribuição é atômica por lote (`id_lote`): todos os clientes movem ou nenhum. Cada cliente gera um registro de movimentação (`origem`, `destino`, `motivo`, `ator`, `instante`, `id_lote`). |
| FR-CLI-008 | Reexecutar o mesmo lote com a mesma chave de idempotência não duplica movimentações. |
| FR-CLI-009 | Desfazer lote cria **movimentações compensatórias** (nunca apaga/edita o histórico). |
| FR-CLI-010 | Posição destino deve estar Ativa (não Congelada/Extinta). |
| FR-CLI-011 | Dados-fonte da visão 360: `fct_produtos_cliente` (cartão Black, câmbio, crédito etc. com status/ data) e `fct_interacoes_crm` (nota, canal, data, autor-posição). |
| FR-CLI-012 | **CPF/CNPJ são sempre mascarados** (tela, API, MCP) para todos os papéis; em logs, nunca em claro. Exibição completa só pela ação explícita "revelar documento", permitida ao titular da posição e ao GG, **registrada em auditoria** (decisão Q-24). Nomes são sintéticos na POC. |
| FR-CLI-013 | Eventos: `ClienteCarteirizado`, `ClienteRealocado`, `LoteRedistribuido`, `LoteDesfeito`, `CapacidadeExcedida`. |

### 2.3 Cenários de aceite
- **AC-CLI-01** — cadastrar cliente com CPF inválido → `DOCUMENTO_INVALIDO`; duplicado → `DOCUMENTO_DUPLICADO`.
- **AC-CLI-02** — *Dado* POS-01 (50/80) e POS-04 (30/80); *quando* simula mover 20 de POS-01→POS-04; *então* retorna 30/80 e 50/80, sem alterar dados (verificado por snapshot antes/depois).
- **AC-CLI-03 (J3)** — executar o lote → 20 movimentações auditadas com o mesmo `id_lote`; carteiras refletem a mudança; histórico de cada cliente mostra POS-01 → POS-04.
- **AC-CLI-04** — falha ao mover o 15º cliente (ex.: cliente inativo se a política proibir) → **rollback total**; 0 clientes movidos.
- **AC-CLI-05** — mesma `Idempotency-Key` repetida → resposta idêntica, 0 movimentações novas.
- **AC-CLI-06** — destino com 85/80 após a movimentação → alerta `CapacidadeExcedida` mas operação concluída (se política = alerta).
- **AC-CLI-07** — desfazer lote → 20 compensações; estado final = inicial; histórico preserva ambos os movimentos.
- **AC-CLI-08** — destino Congelada → `POSICAO_DESTINO_INDISPONIVEL`.
- **AC-CLI-09 (R1)** — trocar o titular da posição (01) não gera nenhuma movimentação nem altera `id_posicao_carteira`.

### 2.4 Casos de borda
Cliente já na posição destino (no-op, não conta como movimento); lote vazio; lote com clientes de várias origens; concorrência de duas redistribuições sobre o mesmo cliente; cliente Em Prospecção contando ou não na capacidade (NC-CLI-3).

## 3. Clarify
> **Resolvidas** (ver [../perguntas-em-aberto.md](../perguntas-em-aberto.md)): NC-CLI-1 → só o GG redistribui, sem dupla aprovação · NC-CLI-2 → **alerta + justificativa obrigatória** acima de 100% · NC-CLI-3 → só Ativos contam · NC-CLI-4 → sem co-gestão · NC-CLI-5 → `score_risco` · NC-CLI-6 → reclassificação manual · NC-CLI-7 → catálogo: cartão Black, câmbio, crédito, previdência, seguro. **Q-24:** CPF/CNPJ sempre mascarados; ação auditada "revelar documento" para titular e GG (FR-CLI-012 vale sempre). Histórico abaixo.
1. `[NC-CLI-1]` Quem pode redistribuir (só GG?) e precisa de aprovação dupla para lotes grandes?
2. `[NC-CLI-2]` Capacidade: **alerta** ou **bloqueio rígido**? *Rec.:* alerta + exigir justificativa acima de 100%.
3. `[NC-CLI-3]` Quais status contam para capacidade? *Rec.:* só Ativo.
4. `[NC-CLI-4]` Um cliente pode ter **co-gestão** (duas posições)? *Rec.:* **não** na POC (um dono).
5. `[NC-CLI-5]` `score_credito` (1–1000) × `score_risco` — são o mesmo conceito? O Plano Geral usa ambos os nomes.
6. `[NC-CLI-6]` Regras de reclassificação de segmento (quando AUM muda) — manual ou automática?
7. `[NC-CLI-7]` Catálogo oficial de produtos para a penetração (lista fechada?).

## 4. Plan

### 4.1 Modelo
- **Agregado `Cliente`** (+ `VinculoCarteira` com linha do tempo).
- **Agregado `LoteRedistribuicao`** (consistência transacional do lote; contém `Movimentacao[]`).
- **Política `Capacidade`**, **Política `AderenciaSegmento`** (puras).
- **Serviço de domínio** `SimularRedistribuicao`, `ExecutarRedistribuicao`, `DesfazerLote`.
- Consome 01 apenas via porta `PosicaoCatalogo` (status, capacidade, segmento) — **ACL** para não acoplar modelos.

### 4.2 Contratos
- **Publica:** `GET clientes`, `GET clientes/{id}`, `POST carteira/redistribuicoes:simular`, `POST carteira/redistribuicoes`, `POST carteira/redistribuicoes/{id}:desfazer`, `POST clientes/{id}/transferencia`, `ContarClientesDaPosicao(id)` (→ 01), eventos.
- **Consome:** 01 (catálogo de posições), 04 (filtro de visibilidade em leitura).

### 4.3 Quality attribute scenarios
| Atributo | Cenário | Medida |
|---|---|---|
| Atomicidade | Falha no meio do lote | 0 movimentações parciais |
| Auditabilidade | Qualquer mudança de posição | 100% com ator/instante/motivo/lote |
| Precisão | AUM em decimal exato | Sem erros de ponto flutuante (teste de soma) |
| Escalabilidade (POC) | Lote de 500 clientes | < 5 s |

### 4.4 Dependências do System Design
Suporte a transação multi-linha (Sheets não oferece ACID — avaliar estratégia no 06), idempotência, política de mascaramento.

## 5. Tasks
| # | Tarefa | Teste-primeiro | Par. |
|---|---|---|---|
| T-CLI-01 | Validador CPF/CNPJ + value objects (`Dinheiro`, `Score`) | Casos válidos/ inválidos, property-based | [P] |
| T-CLI-02 | Agregado `Cliente` (FR-CLI-001/002) | Invariantes | [P] |
| T-CLI-03 | Linha do tempo de vínculo | Property-based: sem lacunas/sobreposição por cliente | |
| T-CLI-04 | Políticas de capacidade e aderência | AC-CLI-06, tabela de segmentos | [P] |
| T-CLI-05 | `SimularRedistribuicao` | AC-CLI-02 (sem efeitos colaterais) | |
| T-CLI-06 | `ExecutarRedistribuicao` atômico + idempotência | AC-CLI-03/04/05/08 | |
| T-CLI-07 | `DesfazerLote` | AC-CLI-07 | |
| T-CLI-08 | Produtos e interações CRM (dados-fonte) | Contrato de leitura p/ 05 | [P] |
| T-CLI-09 | Teste cross-domínio R1 | AC-CLI-09 | |
| T-CLI-10 | Pact provider + OpenAPI | Verificação | |

## 6. Checklist
- [ ] Nenhuma coluna de pessoa em Cliente (grep no esquema).
- [ ] Todo movimento tem auditoria; nenhuma edição/exclusão de histórico.
- [ ] NC-CLI-1..7 resolvidos/registrados no 00.
- [ ] Rastreável: R1→FR-CLI-002/003; R4→001..005; R7→006..010.
