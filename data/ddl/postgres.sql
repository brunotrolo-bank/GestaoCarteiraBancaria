-- GERADO por scripts/gerar-dicionario.ts — DDL alvo para Postgres/Cloud SQL (D-02). NÃO é executado na POC (a persistência da POC é o Google Sheets).
-- Regras que o Sheets não impõe (não sobreposição, uma posição por gerente, um vínculo vigente) viram constraints reais aqui.
CREATE EXTENSION IF NOT EXISTS btree_gist;

COMMENT ON TABLE ref_segmentos IS 'Catálogo de segmentos de cliente.';
CREATE TABLE ref_segmentos (
  codigo varchar(30) NOT NULL,
  nome varchar(60) NOT NULL,
  ordem smallint NOT NULL,
  PRIMARY KEY (codigo)
);

COMMENT ON TABLE ref_produtos IS 'Catálogo de produtos para cálculo de penetração.';
CREATE TABLE ref_produtos (
  codigo varchar(30) NOT NULL,
  nome varchar(80) NOT NULL,
  PRIMARY KEY (codigo)
);

COMMENT ON TABLE dim_agencias IS 'Agências/unidades de negócio (uma na POC).';
CREATE TABLE dim_agencias (
  id_agencia varchar(10) NOT NULL,
  nome varchar(100) NOT NULL,
  cidade varchar(60) NOT NULL,
  PRIMARY KEY (id_agencia)
);

COMMENT ON TABLE dim_posicoes IS 'Posições (cadeiras/mesas) que detêm as carteiras. Chave perene, nunca derivada de pessoa.';
CREATE TABLE dim_posicoes (
  id_posicao varchar(30) NOT NULL,
  nome_posicao varchar(100) NOT NULL,
  id_agencia varchar(10) NOT NULL,
  segmento_especialidade varchar(30) NOT NULL CHECK (segmento_especialidade IN ('Private','Alta Renda','Middle Market','Misto')),
  capacidade_max_contas integer NOT NULL,
  status varchar(20) NOT NULL CHECK (status IN ('Ativa','Congelada','Extinta')),
  PRIMARY KEY (id_posicao),
  FOREIGN KEY (id_agencia) REFERENCES dim_agencias(id_agencia)
);

COMMENT ON TABLE dim_gerentes IS 'Pessoas (colaboradores). Perfis: Gerente de Contas ou Gerente Geral (sem posição).';
CREATE TABLE dim_gerentes (
  id_gerente varchar(30) NOT NULL,
  nome_completo varchar(150) NOT NULL,
  email_corporativo varchar(150) NOT NULL,
  perfil varchar(30) NOT NULL CHECK (perfil IN ('Gerente de Contas','Gerente Geral')),
  status varchar(20) NOT NULL CHECK (status IN ('Ativo','Afastado','Desligado')),
  PRIMARY KEY (id_gerente),
  UNIQUE (email_corporativo)
);

COMMENT ON TABLE bridge_ocupacao_posicao IS 'Histórico de titularidade: quem ocupou qual posição e quando. Situação "atual" é derivada de data_fim nula.';
CREATE TABLE bridge_ocupacao_posicao (
  id_ocupacao varchar(30) NOT NULL,
  id_posicao varchar(30) NOT NULL,
  id_gerente varchar(30) NOT NULL,
  data_inicio date NOT NULL,
  data_fim date,
  tipo_vinculo varchar(20) NOT NULL CHECK (tipo_vinculo IN ('Titular Efetivo','Trainee','Interino')),
  PRIMARY KEY (id_ocupacao),
  FOREIGN KEY (id_posicao) REFERENCES dim_posicoes(id_posicao),
  FOREIGN KEY (id_gerente) REFERENCES dim_gerentes(id_gerente),
  CHECK (data_fim IS NULL OR data_fim >= data_inicio),
  EXCLUDE USING gist (id_posicao WITH =, daterange(data_inicio, COALESCE(data_fim, 'infinity'::date), '[]') WITH &&),
  EXCLUDE USING gist (id_gerente WITH =, daterange(data_inicio, COALESCE(data_fim, 'infinity'::date), '[]') WITH &&)
);

COMMENT ON TABLE fct_delegacoes IS 'Cobertura temporária de uma posição por outro gerente. A situação (Agendada/Em Vigor/Concluída) é derivada do relógio.';
CREATE TABLE fct_delegacoes (
  id_delegacao varchar(30) NOT NULL,
  id_posicao_origem varchar(30) NOT NULL,
  id_gerente_delegado varchar(30) NOT NULL,
  data_inicio date NOT NULL,
  data_fim date,
  motivo varchar(200) NOT NULL,
  escopo varchar(30) NOT NULL CHECK (escopo IN ('Total','Apenas Consulta','Apenas Emergencial')),
  status_aprovacao varchar(20) NOT NULL CHECK (status_aprovacao IN ('Submetida','Aprovada','Rejeitada','Revogada')),
  criada_por varchar(30) NOT NULL,
  criada_em timestamptz NOT NULL,
  decidida_por varchar(30),
  decidida_em timestamptz,
  revogada_em timestamptz,
  PRIMARY KEY (id_delegacao),
  FOREIGN KEY (id_posicao_origem) REFERENCES dim_posicoes(id_posicao),
  FOREIGN KEY (id_gerente_delegado) REFERENCES dim_gerentes(id_gerente),
  CHECK (data_fim >= data_inicio)
);

COMMENT ON TABLE dim_clientes IS 'Cadastro e visão financeira do cliente. Pertence à POSIÇÃO; id_posicao_carteira é projeção do vínculo vigente.';
CREATE TABLE dim_clientes (
  id_cliente varchar(30) NOT NULL,
  nome_razao_social varchar(150) NOT NULL,
  cpf_cnpj varchar(14) NOT NULL,
  segmento_cliente varchar(30) NOT NULL,
  faixa_renda_faturamento numeric(15,2) NOT NULL,
  volume_aum numeric(15,2) NOT NULL CHECK (volume_aum >= 0),
  score_risco smallint NOT NULL CHECK (score_risco BETWEEN 1 AND 1000),
  id_posicao_carteira varchar(30) NOT NULL,
  data_carteirizacao date NOT NULL,
  status varchar(20) NOT NULL CHECK (status IN ('Ativo','Em Prospecção','Inativo')),
  PRIMARY KEY (id_cliente),
  FOREIGN KEY (id_posicao_carteira) REFERENCES dim_posicoes(id_posicao),
  FOREIGN KEY (segmento_cliente) REFERENCES ref_segmentos(codigo),
  UNIQUE (cpf_cnpj)
);

COMMENT ON TABLE bridge_vinculo_carteira IS 'Linha do tempo cliente → posição (histórico da carteirização). Intervalo semiaberto [inicio_em, fim_em).';
CREATE TABLE bridge_vinculo_carteira (
  id_vinculo varchar(30) NOT NULL,
  id_cliente varchar(30) NOT NULL,
  id_posicao varchar(30) NOT NULL,
  inicio_em timestamptz NOT NULL,
  fim_em timestamptz,
  PRIMARY KEY (id_vinculo),
  FOREIGN KEY (id_cliente) REFERENCES dim_clientes(id_cliente),
  FOREIGN KEY (id_posicao) REFERENCES dim_posicoes(id_posicao)
);

COMMENT ON TABLE fct_produtos_cliente IS 'Produtos contratados pelo cliente (base da penetração).';
CREATE TABLE fct_produtos_cliente (
  id_cliente varchar(30) NOT NULL,
  codigo_produto varchar(30) NOT NULL,
  status varchar(10) NOT NULL CHECK (status IN ('Ativo','Inativo')),
  data_contratacao date NOT NULL,
  PRIMARY KEY (id_cliente, codigo_produto),
  FOREIGN KEY (id_cliente) REFERENCES dim_clientes(id_cliente),
  FOREIGN KEY (codigo_produto) REFERENCES ref_produtos(codigo)
);

COMMENT ON TABLE fct_interacoes_crm IS 'Interações de CRM. O texto é dado de terceiros: nunca instrução (FR-API-007).';
CREATE TABLE fct_interacoes_crm (
  id_interacao varchar(30) NOT NULL,
  id_cliente varchar(30) NOT NULL,
  id_posicao varchar(30) NOT NULL,
  canal varchar(30) NOT NULL,
  data date NOT NULL,
  nota text NOT NULL,
  PRIMARY KEY (id_interacao),
  FOREIGN KEY (id_cliente) REFERENCES dim_clientes(id_cliente),
  FOREIGN KEY (id_posicao) REFERENCES dim_posicoes(id_posicao)
);

COMMENT ON TABLE fct_movimentacao_carteira IS 'Movimentações de clientes entre posições (redistribuição, transferência, compensação). Append-only.';
CREATE TABLE fct_movimentacao_carteira (
  id_movimentacao varchar(30) NOT NULL,
  id_lote varchar(60) NOT NULL,
  id_cliente varchar(30) NOT NULL,
  id_posicao_origem varchar(30) NOT NULL,
  id_posicao_destino varchar(30) NOT NULL,
  motivo varchar(200) NOT NULL,
  ator varchar(30) NOT NULL,
  instante timestamptz NOT NULL,
  tipo varchar(20) NOT NULL CHECK (tipo IN ('Redistribuicao','Transferencia','Compensacao')),
  PRIMARY KEY (id_movimentacao),
  FOREIGN KEY (id_cliente) REFERENCES dim_clientes(id_cliente)
);

COMMENT ON TABLE cfg_metas_posicao IS 'Metas e limites de alerta por posição, configuráveis pelo Gerente Geral. Sem linha = sem meta e limites padrão (50% a 100%).';
CREATE TABLE cfg_metas_posicao (
  id_posicao varchar(30) NOT NULL,
  meta_aum numeric(18,2) NOT NULL,
  meta_clientes integer NOT NULL,
  utilizacao_minima numeric(5,4) NOT NULL,
  utilizacao_maxima numeric(5,4) NOT NULL,
  atualizado_por varchar(30) NOT NULL,
  atualizado_em timestamptz NOT NULL,
  PRIMARY KEY (id_posicao),
  FOREIGN KEY (id_posicao) REFERENCES dim_posicoes(id_posicao)
);

COMMENT ON TABLE log_auditoria IS 'Auditoria append-only (sem expurgo na POC). Nunca contém CPF/CNPJ em claro.';
CREATE TABLE log_auditoria (
  id_log varchar(30) NOT NULL,
  instante timestamptz NOT NULL,
  ator varchar(30) NOT NULL,
  acao varchar(60) NOT NULL,
  entidade varchar(60) NOT NULL,
  id_entidade varchar(60) NOT NULL,
  detalhe jsonb NOT NULL,
  PRIMARY KEY (id_log)
);

COMMENT ON TABLE log_eventos IS 'Outbox de eventos de domínio (D-09).';
CREATE TABLE log_eventos (
  id_evento varchar(30) NOT NULL,
  instante timestamptz NOT NULL,
  tipo varchar(60) NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY (id_evento)
);

-- Exatamente um vínculo vigente por cliente (histórico de carteirização).
CREATE UNIQUE INDEX ux_vinculo_vigente ON bridge_vinculo_carteira (id_cliente) WHERE fim_em IS NULL;
CREATE INDEX ix_clientes_posicao ON dim_clientes (id_posicao_carteira) WHERE status = 'Ativo';
CREATE INDEX ix_movimentacao_lote ON fct_movimentacao_carteira (id_lote);
