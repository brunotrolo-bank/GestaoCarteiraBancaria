# Dicionário de dados

> **GERADO** por `scripts/gerar-dicionario.ts` (npm run dicionario) a partir do esquema real (`TABELAS`) e dos metadados em `scripts/dicionario.ts`. Não editar à mão: um teste compara este arquivo com o esquema (AC-DAD-08).
> Convenções: dinheiro em decimal exato; datas de negócio ISO (America/Sao_Paulo, intervalos fechados); instantes em UTC; chaves opacas e perenes; estados derivados do relógio não são persistidos.

Total: 15 tabelas, 90 colunas.

## `ref_segmentos`

Catálogo de segmentos de cliente. *(domínio 06; PK: `codigo`)*

| Coluna | Tipo lógico | Tipo SQL alvo | Descrição | LGPD | Origem |
|---|---|---|---|---|---|
| `codigo` | string | varchar(30) | Código do segmento (UHNW, Private, Alta Renda, Varejo). | Interno | Plano Geral |
| `nome` | string | varchar(60) | Nome de exibição. | Interno | novo |
| `ordem` | number | smallint | Ordem de apresentação. | Interno | novo |

## `ref_produtos`

Catálogo de produtos para cálculo de penetração. *(domínio 06; PK: `codigo`)*

| Coluna | Tipo lógico | Tipo SQL alvo | Descrição | LGPD | Origem |
|---|---|---|---|---|---|
| `codigo` | string | varchar(30) | Código do produto (CARTAO_BLACK, CAMBIO, CREDITO, PREVIDENCIA, SEGURO). | Interno | Plano Geral |
| `nome` | string | varchar(80) | Nome de exibição. | Interno | novo |

## `dim_agencias`

Agências/unidades de negócio (uma na POC). *(domínio 01; PK: `id_agencia`)*

| Coluna | Tipo lógico | Tipo SQL alvo | Descrição | LGPD | Origem |
|---|---|---|---|---|---|
| `id_agencia` | string | varchar(10) | Identificador da agência. | Identificador | Plano Geral (FK sem tabela) |
| `nome` | string | varchar(100) | Nome da agência. | Interno | novo |
| `cidade` | string | varchar(60) | Cidade. | Interno | novo |

## `dim_posicoes`

Posições (cadeiras/mesas) que detêm as carteiras. Chave perene, nunca derivada de pessoa. *(domínio 01; PK: `id_posicao`)*

| Coluna | Tipo lógico | Tipo SQL alvo | Descrição | LGPD | Origem |
|---|---|---|---|---|---|
| `id_posicao` | string | varchar(30) | Identificador perene da posição (ex.: POS-AG01-001). | Identificador | Plano Geral |
| `nome_posicao` | string | varchar(100) | Nome funcional da mesa. | Interno | Plano Geral |
| `id_agencia` | string | varchar(10) | Agência da posição (FK dim_agencias). | Identificador | Plano Geral |
| `segmento_especialidade` | string | varchar(30) | Especialidade: Private, Alta Renda, Middle Market ou Misto. | Interno | Plano Geral |
| `capacidade_max_contas` | number | integer | Capacidade operacional prudencial (clientes ativos). | Interno | Plano Geral |
| `status` | string | varchar(20) | Ativa, Congelada ou Extinta. | Interno | Plano Geral |

## `dim_gerentes`

Pessoas (colaboradores). Perfis: Gerente de Contas ou Gerente Geral (sem posição). *(domínio 01; PK: `id_gerente`)*

| Coluna | Tipo lógico | Tipo SQL alvo | Descrição | LGPD | Origem |
|---|---|---|---|---|---|
| `id_gerente` | string | varchar(30) | Matrícula/identificador funcional. | Identificador | Plano Geral |
| `nome_completo` | string | varchar(150) | Nome do colaborador. | Pessoal | Plano Geral |
| `email_corporativo` | string | varchar(150) | E-mail corporativo (único, sem diferenciar caixa). | Pessoal | Plano Geral |
| `perfil` | string | varchar(30) | Gerente de Contas ou Gerente Geral. | Interno | Plano Geral |
| `status` | string | varchar(20) | Ativo, Afastado ou Desligado ("Férias" removido: deriva da delegação). | Interno | Plano Geral (valor removido) |

## `bridge_ocupacao_posicao`

Histórico de titularidade: quem ocupou qual posição e quando. Situação "atual" é derivada de data_fim nula. *(domínio 01; PK: `id_ocupacao`)*

| Coluna | Tipo lógico | Tipo SQL alvo | Descrição | LGPD | Origem |
|---|---|---|---|---|---|
| `id_ocupacao` | string | varchar(30) | Identificador da ocupação. | Identificador | Plano Geral |
| `id_posicao` | string | varchar(30) | Posição ocupada (FK). | Identificador | Plano Geral |
| `id_gerente` | string | varchar(30) | Titular (FK). Um gerente ocupa no máximo uma posição por vez. | Identificador | Plano Geral |
| `data_inicio` | string | date | Início da titularidade (inclusivo, America/Sao_Paulo). | Interno | Plano Geral |
| `data_fim` | string | date | Fim (inclusivo); nulo = titular vigente. | Interno | Plano Geral |
| `tipo_vinculo` | string | varchar(20) | Titular Efetivo, Trainee ou Interino. | Interno | Plano Geral |

## `fct_delegacoes`

Cobertura temporária de uma posição por outro gerente. A situação (Agendada/Em Vigor/Concluída) é derivada do relógio. *(domínio 02; PK: `id_delegacao`)*

| Coluna | Tipo lógico | Tipo SQL alvo | Descrição | LGPD | Origem |
|---|---|---|---|---|---|
| `id_delegacao` | string | varchar(30) | Identificador da delegação. | Identificador | Plano Geral |
| `id_posicao_origem` | string | varchar(30) | Posição coberta (FK). | Identificador | Plano Geral |
| `id_gerente_delegado` | string | varchar(30) | Gerente que recebe a cobertura (FK). | Identificador | Plano Geral |
| `data_inicio` | string | date | Início da cobertura (inclusivo). | Interno | Plano Geral |
| `data_fim` | string | date | Fim da cobertura (inclusivo). | Interno | Plano Geral |
| `motivo` | string | varchar(200) | Motivo (férias, licença etc.). | Interno | Plano Geral |
| `escopo` | string | varchar(30) | Total, Apenas Consulta ou Apenas Emergencial. | Interno | Plano Geral |
| `status_aprovacao` | string | varchar(20) | Submetida, Aprovada, Rejeitada ou Revogada (único estado persistido). | Interno | Plano Geral (status → status_aprovacao) |
| `criada_por` | string | varchar(30) | Quem solicitou. | Identificador | novo |
| `criada_em` | string | timestamptz | Instante da solicitação. | Interno | novo |
| `decidida_por` | string | varchar(30) | Quem aprovou/rejeitou. | Identificador | novo |
| `decidida_em` | string | timestamptz | Instante da decisão. | Interno | novo |
| `revogada_em` | string | timestamptz | Instante da revogação; o efeito cessa a partir dele. | Interno | novo |

## `dim_clientes`

Cadastro e visão financeira do cliente. Pertence à POSIÇÃO; id_posicao_carteira é projeção do vínculo vigente. *(domínio 03; PK: `id_cliente`)*

| Coluna | Tipo lógico | Tipo SQL alvo | Descrição | LGPD | Origem |
|---|---|---|---|---|---|
| `id_cliente` | string | varchar(30) | Identificador do cliente. | Identificador | Plano Geral |
| `nome_razao_social` | string | varchar(150) | Nome ou razão social (sintético na POC). | Pessoal | Plano Geral |
| `cpf_cnpj` | string | varchar(14) | CPF/CNPJ só dígitos, único. SEMPRE mascarado nas saídas; sintético com marcador 999/99999. | Pessoal | Plano Geral |
| `segmento_cliente` | string | varchar(30) | UHNW, Private, Alta Renda ou Varejo. | Interno | Plano Geral |
| `faixa_renda_faturamento` | number | numeric(15,2) | Renda/faturamento declarado. | Financeiro sensível | Plano Geral |
| `volume_aum` | number | numeric(15,2) | Ativos sob custódia (decimal exato). | Financeiro sensível | Plano Geral |
| `score_risco` | number | smallint | Score de risco interno 1–1000 (unifica score_credito/score_risco). | Financeiro sensível | Plano Geral (unificado) |
| `id_posicao_carteira` | string | varchar(30) | Posição da carteira atual (projeção de bridge_vinculo_carteira). | Identificador | Plano Geral |
| `data_carteirizacao` | string | date | Entrada na posição atual. | Interno | Plano Geral |
| `status` | string | varchar(20) | Ativo, Em Prospecção ou Inativo (só Ativo conta para capacidade). | Interno | Plano Geral |

## `bridge_vinculo_carteira`

Linha do tempo cliente → posição (histórico da carteirização). Intervalo semiaberto [inicio_em, fim_em). *(domínio 03; PK: `id_vinculo`)*

| Coluna | Tipo lógico | Tipo SQL alvo | Descrição | LGPD | Origem |
|---|---|---|---|---|---|
| `id_vinculo` | string | varchar(30) | Identificador do vínculo. | Identificador | novo |
| `id_cliente` | string | varchar(30) | Cliente (FK). | Identificador | novo |
| `id_posicao` | string | varchar(30) | Posição (FK). | Identificador | novo |
| `inicio_em` | string | timestamptz | Início do vínculo. | Interno | novo |
| `fim_em` | string | timestamptz | Fim; nulo = vínculo vigente (exatamente um por cliente). | Interno | novo |

## `fct_produtos_cliente`

Produtos contratados pelo cliente (base da penetração). *(domínio 03; PK: `id_cliente`, `codigo_produto`)*

| Coluna | Tipo lógico | Tipo SQL alvo | Descrição | LGPD | Origem |
|---|---|---|---|---|---|
| `id_cliente` | string | varchar(30) | Cliente (FK). | Identificador | novo |
| `codigo_produto` | string | varchar(30) | Produto (FK ref_produtos). | Interno | novo |
| `status` | string | varchar(10) | Ativo ou Inativo. | Interno | novo |
| `data_contratacao` | string | date | Data de contratação. | Interno | novo |

## `fct_interacoes_crm`

Interações de CRM. O texto é dado de terceiros: nunca instrução (FR-API-007). *(domínio 03; PK: `id_interacao`)*

| Coluna | Tipo lógico | Tipo SQL alvo | Descrição | LGPD | Origem |
|---|---|---|---|---|---|
| `id_interacao` | string | varchar(30) | Identificador da interação. | Identificador | novo |
| `id_cliente` | string | varchar(30) | Cliente (FK). | Identificador | novo |
| `id_posicao` | string | varchar(30) | Posição que atendeu (não a pessoa). | Identificador | novo |
| `canal` | string | varchar(30) | Telefone, Reunião, E-mail, WhatsApp corporativo. | Interno | novo |
| `data` | string | date | Data da interação. | Interno | novo |
| `nota` | string | text | Texto livre da interação. | Pessoal | novo |

## `fct_movimentacao_carteira`

Movimentações de clientes entre posições (redistribuição, transferência, compensação). Append-only. *(domínio 03; PK: `id_movimentacao`)*

| Coluna | Tipo lógico | Tipo SQL alvo | Descrição | LGPD | Origem |
|---|---|---|---|---|---|
| `id_movimentacao` | string | varchar(30) | Identificador da movimentação. | Identificador | novo |
| `id_lote` | string | varchar(60) | Lote (também a chave de idempotência). | Identificador | novo |
| `id_cliente` | string | varchar(30) | Cliente movido (FK). | Identificador | novo |
| `id_posicao_origem` | string | varchar(30) | Posição de origem. | Identificador | novo |
| `id_posicao_destino` | string | varchar(30) | Posição de destino. | Identificador | novo |
| `motivo` | string | varchar(200) | Motivo informado. | Interno | novo |
| `ator` | string | varchar(30) | Quem executou. | Identificador | novo |
| `instante` | string | timestamptz | Quando ocorreu. | Interno | novo |
| `tipo` | string | varchar(20) | Redistribuicao, Transferencia ou Compensacao. | Interno | novo |

## `cfg_metas_posicao`

Metas e limites de alerta por posição, configuráveis pelo Gerente Geral. Sem linha = sem meta e limites padrão (50% a 100%). *(domínio 01; PK: `id_posicao`)*

| Coluna | Tipo lógico | Tipo SQL alvo | Descrição | LGPD | Origem |
|---|---|---|---|---|---|
| `id_posicao` | string | varchar(30) | Posição configurada (FK dim_posicoes). | Identificador | Plano Geral |
| `meta_aum` | number | numeric(18,2) | Meta de AUM total da posição em reais (0 = sem meta). | Interno | Plano Geral |
| `meta_clientes` | number | integer | Meta de clientes ativos da posição (0 = sem meta). | Interno | Plano Geral |
| `utilizacao_minima` | number | numeric(5,4) | Utilização mínima da capacidade (razão); abaixo dela a posição entra em alerta "Abaixo do mínimo". | Interno | Plano Geral |
| `utilizacao_maxima` | number | numeric(5,4) | Utilização máxima da capacidade (razão); acima dela a posição entra em alerta "Acima do limite". | Interno | Plano Geral |
| `atualizado_por` | string | varchar(30) | Gerente Geral que definiu a configuração. | Identificador | Plano Geral |
| `atualizado_em` | string | timestamptz | Instante da última alteração (ISO 8601). | Interno | Plano Geral |

## `log_auditoria`

Auditoria append-only (sem expurgo na POC). Nunca contém CPF/CNPJ em claro. *(domínio 06; PK: `id_log`)*

| Coluna | Tipo lógico | Tipo SQL alvo | Descrição | LGPD | Origem |
|---|---|---|---|---|---|
| `id_log` | string | varchar(30) | Identificador do registro. | Identificador | novo |
| `instante` | string | timestamptz | Quando. | Interno | novo |
| `ator` | string | varchar(30) | Quem (ou SISTEMA). | Identificador | novo |
| `acao` | string | varchar(60) | Ação auditada. | Interno | novo |
| `entidade` | string | varchar(60) | Tabela/entidade afetada. | Interno | novo |
| `id_entidade` | string | varchar(60) | Identificador da entidade. | Identificador | novo |
| `detalhe` | string | jsonb | Detalhes em JSON (sem PII). | Interno | novo |

## `log_eventos`

Outbox de eventos de domínio (D-09). *(domínio 06; PK: `id_evento`)*

| Coluna | Tipo lógico | Tipo SQL alvo | Descrição | LGPD | Origem |
|---|---|---|---|---|---|
| `id_evento` | string | varchar(30) | Identificador do evento. | Identificador | novo |
| `instante` | string | timestamptz | Quando foi publicado. | Interno | novo |
| `tipo` | string | varchar(60) | Tipo do evento (TitularAlterado, DelegacaoIniciada…). | Interno | novo |
| `payload` | string | jsonb | Conteúdo do evento. | Interno | novo |
