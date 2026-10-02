/**
 * Dicionário de dados (domínio 06, FR-DAD-001): metadados campo a campo — tipo SQL-alvo, descrição, classificação LGPD, origem.
 * Fonte para: planos/dominios/anexos/dicionario-de-dados.md e data/ddl/postgres.sql (gerados) e teste esquema × dicionário (AC-DAD-08).
 */
import type { NomeTabela } from '@carteira/core';

export type Lgpd = 'Interno' | 'Pessoal' | 'Financeiro sensível' | 'Identificador';
type Coluna = [sql: string, descricao: string, lgpd: Lgpd, origem: string];

export interface TabelaDic { descricao: string; dono: string; colunas: Record<string, Coluna> }

const PG = 'Plano Geral';
const NOVO = 'novo';

export const DICIONARIO: Record<NomeTabela, TabelaDic> = {
  ref_segmentos: { descricao: 'Catálogo de segmentos de cliente.', dono: '06', colunas: {
    codigo: ['varchar(30)', 'Código do segmento (UHNW, Private, Alta Renda, Varejo).', 'Interno', PG],
    nome: ['varchar(60)', 'Nome de exibição.', 'Interno', NOVO],
    ordem: ['smallint', 'Ordem de apresentação.', 'Interno', NOVO],
  } },
  ref_produtos: { descricao: 'Catálogo de produtos para cálculo de penetração.', dono: '06', colunas: {
    codigo: ['varchar(30)', 'Código do produto (CARTAO_BLACK, CAMBIO, CREDITO, PREVIDENCIA, SEGURO).', 'Interno', PG],
    nome: ['varchar(80)', 'Nome de exibição.', 'Interno', NOVO],
  } },
  dim_agencias: { descricao: 'Agências/unidades de negócio (uma na POC).', dono: '01', colunas: {
    id_agencia: ['varchar(10)', 'Identificador da agência.', 'Identificador', 'Plano Geral (FK sem tabela)'],
    nome: ['varchar(100)', 'Nome da agência.', 'Interno', NOVO],
    cidade: ['varchar(60)', 'Cidade.', 'Interno', NOVO],
  } },
  dim_posicoes: { descricao: 'Posições (cadeiras/mesas) que detêm as carteiras. Chave perene, nunca derivada de pessoa.', dono: '01', colunas: {
    id_posicao: ['varchar(30)', 'Identificador perene da posição (ex.: POS-AG01-001).', 'Identificador', PG],
    nome_posicao: ['varchar(100)', 'Nome funcional da mesa.', 'Interno', PG],
    id_agencia: ['varchar(10)', 'Agência da posição (FK dim_agencias).', 'Identificador', PG],
    segmento_especialidade: ['varchar(30)', 'Especialidade: Private, Alta Renda, Middle Market ou Misto.', 'Interno', PG],
    capacidade_max_contas: ['integer', 'Capacidade operacional prudencial (clientes ativos).', 'Interno', PG],
    status: ['varchar(20)', 'Ativa, Congelada ou Extinta.', 'Interno', PG],
  } },
  dim_gerentes: { descricao: 'Pessoas (colaboradores). Perfis: Gerente de Contas ou Gerente Geral (sem posição).', dono: '01', colunas: {
    id_gerente: ['varchar(30)', 'Matrícula/identificador funcional.', 'Identificador', PG],
    nome_completo: ['varchar(150)', 'Nome do colaborador.', 'Pessoal', PG],
    email_corporativo: ['varchar(150)', 'E-mail corporativo (único, sem diferenciar caixa).', 'Pessoal', PG],
    perfil: ['varchar(30)', 'Gerente de Contas ou Gerente Geral.', 'Interno', PG],
    status: ['varchar(20)', 'Ativo, Afastado ou Desligado ("Férias" removido: deriva da delegação).', 'Interno', 'Plano Geral (valor removido)'],
  } },
  bridge_ocupacao_posicao: { descricao: 'Histórico de titularidade: quem ocupou qual posição e quando. Situação "atual" é derivada de data_fim nula.', dono: '01', colunas: {
    id_ocupacao: ['varchar(30)', 'Identificador da ocupação.', 'Identificador', PG],
    id_posicao: ['varchar(30)', 'Posição ocupada (FK).', 'Identificador', PG],
    id_gerente: ['varchar(30)', 'Titular (FK). Um gerente ocupa no máximo uma posição por vez.', 'Identificador', PG],
    data_inicio: ['date', 'Início da titularidade (inclusivo, America/Sao_Paulo).', 'Interno', PG],
    data_fim: ['date', 'Fim (inclusivo); nulo = titular vigente.', 'Interno', PG],
    tipo_vinculo: ['varchar(20)', 'Titular Efetivo, Trainee ou Interino.', 'Interno', PG],
  } },
  fct_delegacoes: { descricao: 'Cobertura temporária de uma posição por outro gerente. A situação (Agendada/Em Vigor/Concluída) é derivada do relógio.', dono: '02', colunas: {
    id_delegacao: ['varchar(30)', 'Identificador da delegação.', 'Identificador', PG],
    id_posicao_origem: ['varchar(30)', 'Posição coberta (FK).', 'Identificador', PG],
    id_gerente_delegado: ['varchar(30)', 'Gerente que recebe a cobertura (FK).', 'Identificador', PG],
    data_inicio: ['date', 'Início da cobertura (inclusivo).', 'Interno', PG],
    data_fim: ['date', 'Fim da cobertura (inclusivo).', 'Interno', PG],
    motivo: ['varchar(200)', 'Motivo (férias, licença etc.).', 'Interno', PG],
    escopo: ['varchar(30)', 'Total, Apenas Consulta ou Apenas Emergencial.', 'Interno', PG],
    status_aprovacao: ['varchar(20)', 'Submetida, Aprovada, Rejeitada ou Revogada (único estado persistido).', 'Interno', 'Plano Geral (status → status_aprovacao)'],
    criada_por: ['varchar(30)', 'Quem solicitou.', 'Identificador', NOVO],
    criada_em: ['timestamptz', 'Instante da solicitação.', 'Interno', NOVO],
    decidida_por: ['varchar(30)', 'Quem aprovou/rejeitou.', 'Identificador', NOVO],
    decidida_em: ['timestamptz', 'Instante da decisão.', 'Interno', NOVO],
    revogada_em: ['timestamptz', 'Instante da revogação; o efeito cessa a partir dele.', 'Interno', NOVO],
  } },
  dim_clientes: { descricao: 'Cadastro e visão financeira do cliente. Pertence à POSIÇÃO; id_posicao_carteira é projeção do vínculo vigente.', dono: '03', colunas: {
    id_cliente: ['varchar(30)', 'Identificador do cliente.', 'Identificador', PG],
    nome_razao_social: ['varchar(150)', 'Nome ou razão social (sintético na POC).', 'Pessoal', PG],
    cpf_cnpj: ['varchar(14)', 'CPF/CNPJ só dígitos, único. SEMPRE mascarado nas saídas; sintético com marcador 999/99999.', 'Pessoal', PG],
    segmento_cliente: ['varchar(30)', 'UHNW, Private, Alta Renda ou Varejo.', 'Interno', PG],
    faixa_renda_faturamento: ['numeric(15,2)', 'Renda/faturamento declarado.', 'Financeiro sensível', PG],
    volume_aum: ['numeric(15,2)', 'Ativos sob custódia (decimal exato).', 'Financeiro sensível', PG],
    score_risco: ['smallint', 'Score de risco interno 1–1000 (unifica score_credito/score_risco).', 'Financeiro sensível', 'Plano Geral (unificado)'],
    id_posicao_carteira: ['varchar(30)', 'Posição da carteira atual (projeção de bridge_vinculo_carteira).', 'Identificador', PG],
    data_carteirizacao: ['date', 'Entrada na posição atual.', 'Interno', PG],
    status: ['varchar(20)', 'Ativo, Em Prospecção ou Inativo (só Ativo conta para capacidade).', 'Interno', PG],
  } },
  bridge_vinculo_carteira: { descricao: 'Linha do tempo cliente → posição (histórico da carteirização). Intervalo semiaberto [inicio_em, fim_em).', dono: '03', colunas: {
    id_vinculo: ['varchar(30)', 'Identificador do vínculo.', 'Identificador', NOVO],
    id_cliente: ['varchar(30)', 'Cliente (FK).', 'Identificador', NOVO],
    id_posicao: ['varchar(30)', 'Posição (FK).', 'Identificador', NOVO],
    inicio_em: ['timestamptz', 'Início do vínculo.', 'Interno', NOVO],
    fim_em: ['timestamptz', 'Fim; nulo = vínculo vigente (exatamente um por cliente).', 'Interno', NOVO],
  } },
  fct_produtos_cliente: { descricao: 'Produtos contratados pelo cliente (base da penetração).', dono: '03', colunas: {
    id_cliente: ['varchar(30)', 'Cliente (FK).', 'Identificador', NOVO],
    codigo_produto: ['varchar(30)', 'Produto (FK ref_produtos).', 'Interno', NOVO],
    status: ['varchar(10)', 'Ativo ou Inativo.', 'Interno', NOVO],
    data_contratacao: ['date', 'Data de contratação.', 'Interno', NOVO],
  } },
  fct_interacoes_crm: { descricao: 'Interações de CRM. O texto é dado de terceiros: nunca instrução (FR-API-007).', dono: '03', colunas: {
    id_interacao: ['varchar(30)', 'Identificador da interação.', 'Identificador', NOVO],
    id_cliente: ['varchar(30)', 'Cliente (FK).', 'Identificador', NOVO],
    id_posicao: ['varchar(30)', 'Posição que atendeu (não a pessoa).', 'Identificador', NOVO],
    canal: ['varchar(30)', 'Telefone, Reunião, E-mail, WhatsApp corporativo.', 'Interno', NOVO],
    data: ['date', 'Data da interação.', 'Interno', NOVO],
    nota: ['text', 'Texto livre da interação.', 'Pessoal', NOVO],
  } },
  fct_movimentacao_carteira: { descricao: 'Movimentações de clientes entre posições (redistribuição, transferência, compensação). Append-only.', dono: '03', colunas: {
    id_movimentacao: ['varchar(30)', 'Identificador da movimentação.', 'Identificador', NOVO],
    id_lote: ['varchar(60)', 'Lote (também a chave de idempotência).', 'Identificador', NOVO],
    id_cliente: ['varchar(30)', 'Cliente movido (FK).', 'Identificador', NOVO],
    id_posicao_origem: ['varchar(30)', 'Posição de origem.', 'Identificador', NOVO],
    id_posicao_destino: ['varchar(30)', 'Posição de destino.', 'Identificador', NOVO],
    motivo: ['varchar(200)', 'Motivo informado.', 'Interno', NOVO],
    ator: ['varchar(30)', 'Quem executou.', 'Identificador', NOVO],
    instante: ['timestamptz', 'Quando ocorreu.', 'Interno', NOVO],
    tipo: ['varchar(20)', 'Redistribuicao, Transferencia ou Compensacao.', 'Interno', NOVO],
  } },
  log_auditoria: { descricao: 'Auditoria append-only (sem expurgo na POC). Nunca contém CPF/CNPJ em claro.', dono: '06', colunas: {
    id_log: ['varchar(30)', 'Identificador do registro.', 'Identificador', NOVO],
    instante: ['timestamptz', 'Quando.', 'Interno', NOVO],
    ator: ['varchar(30)', 'Quem (ou SISTEMA).', 'Identificador', NOVO],
    acao: ['varchar(60)', 'Ação auditada.', 'Interno', NOVO],
    entidade: ['varchar(60)', 'Tabela/entidade afetada.', 'Interno', NOVO],
    id_entidade: ['varchar(60)', 'Identificador da entidade.', 'Identificador', NOVO],
    detalhe: ['jsonb', 'Detalhes em JSON (sem PII).', 'Interno', NOVO],
  } },
  log_eventos: { descricao: 'Outbox de eventos de domínio (D-09).', dono: '06', colunas: {
    id_evento: ['varchar(30)', 'Identificador do evento.', 'Identificador', NOVO],
    instante: ['timestamptz', 'Quando foi publicado.', 'Interno', NOVO],
    tipo: ['varchar(60)', 'Tipo do evento (TitularAlterado, DelegacaoIniciada…).', 'Interno', NOVO],
    payload: ['jsonb', 'Conteúdo do evento.', 'Interno', NOVO],
  } },
};
