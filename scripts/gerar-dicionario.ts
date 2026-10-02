/** Gera o dicionário de dados (Markdown) e o DDL Postgres-alvo a partir de TABELAS + DICIONARIO (D-02, T-DAD-02/03). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { NOMES_TABELAS, TABELAS } from '@carteira/core';
import { DICIONARIO } from './dicionario.ts';

export function conteudoDicionario(): string {
  const l: string[] = [];
  l.push('# Dicionário de dados');
  l.push('');
  l.push('> **GERADO** por `scripts/gerar-dicionario.ts` (npm run dicionario) a partir do esquema real (`TABELAS`) e dos metadados em `scripts/dicionario.ts`. Não editar à mão: um teste compara este arquivo com o esquema (AC-DAD-08).');
  l.push('> Convenções: dinheiro em decimal exato; datas de negócio ISO (America/Sao_Paulo, intervalos fechados); instantes em UTC; chaves opacas e perenes; estados derivados do relógio não são persistidos.');
  l.push('');
  l.push(`Total: ${NOMES_TABELAS.length} tabelas, ${NOMES_TABELAS.reduce((n, t) => n + TABELAS[t].colunas.length, 0)} colunas.`);
  for (const t of NOMES_TABELAS) {
    const d = DICIONARIO[t];
    l.push('', `## \`${t}\``, '', `${d.descricao} *(domínio ${d.dono}; PK: ${TABELAS[t].pk.map((c) => `\`${c}\``).join(', ')})*`, '');
    l.push('| Coluna | Tipo lógico | Tipo SQL alvo | Descrição | LGPD | Origem |', '|---|---|---|---|---|---|');
    for (const [nome, tipo] of TABELAS[t].colunas) {
      const [sql, desc, lgpd, origem] = d.colunas[nome]!;
      l.push(`| \`${nome}\` | ${tipo} | ${sql} | ${desc} | ${lgpd} | ${origem} |`);
    }
  }
  return `${l.join('\n')}\n`;
}

const CHECKS: Record<string, string> = {
  'dim_posicoes.status': "('Ativa','Congelada','Extinta')",
  'dim_posicoes.segmento_especialidade': "('Private','Alta Renda','Middle Market','Misto')",
  'dim_gerentes.perfil': "('Gerente de Contas','Gerente Geral')",
  'dim_gerentes.status': "('Ativo','Afastado','Desligado')",
  'bridge_ocupacao_posicao.tipo_vinculo': "('Titular Efetivo','Trainee','Interino')",
  'fct_delegacoes.escopo': "('Total','Apenas Consulta','Apenas Emergencial')",
  'fct_delegacoes.status_aprovacao': "('Submetida','Aprovada','Rejeitada','Revogada')",
  'dim_clientes.status': "('Ativo','Em Prospecção','Inativo')",
  'fct_produtos_cliente.status': "('Ativo','Inativo')",
  'fct_movimentacao_carteira.tipo': "('Redistribuicao','Transferencia','Compensacao')",
};

const FKS: Record<string, [string, string][]> = {
  dim_posicoes: [['id_agencia', 'dim_agencias(id_agencia)']],
  bridge_ocupacao_posicao: [['id_posicao', 'dim_posicoes(id_posicao)'], ['id_gerente', 'dim_gerentes(id_gerente)']],
  fct_delegacoes: [['id_posicao_origem', 'dim_posicoes(id_posicao)'], ['id_gerente_delegado', 'dim_gerentes(id_gerente)']],
  dim_clientes: [['id_posicao_carteira', 'dim_posicoes(id_posicao)'], ['segmento_cliente', 'ref_segmentos(codigo)']],
  bridge_vinculo_carteira: [['id_cliente', 'dim_clientes(id_cliente)'], ['id_posicao', 'dim_posicoes(id_posicao)']],
  fct_produtos_cliente: [['id_cliente', 'dim_clientes(id_cliente)'], ['codigo_produto', 'ref_produtos(codigo)']],
  fct_interacoes_crm: [['id_cliente', 'dim_clientes(id_cliente)'], ['id_posicao', 'dim_posicoes(id_posicao)']],
  fct_movimentacao_carteira: [['id_cliente', 'dim_clientes(id_cliente)']],
};

export function conteudoDdl(): string {
  const l: string[] = [];
  l.push('-- GERADO por scripts/gerar-dicionario.ts — DDL alvo para Postgres/Cloud SQL (D-02). NÃO é executado na POC (a persistência da POC é o Google Sheets).');
  l.push('-- Regras que o Sheets não impõe (não sobreposição, uma posição por gerente, um vínculo vigente) viram constraints reais aqui.');
  l.push('CREATE EXTENSION IF NOT EXISTS btree_gist;', '');
  for (const t of NOMES_TABELAS) {
    const cols = TABELAS[t].colunas.map(([nome]) => {
      const [sql] = DICIONARIO[t].colunas[nome]!;
      const nulavel = ['data_fim', 'fim_em', 'decidida_por', 'decidida_em', 'revogada_em'].includes(nome);
      const check = CHECKS[`${t}.${nome}`] ? ` CHECK (${nome} IN ${CHECKS[`${t}.${nome}`]})` : '';
      const extra = t === 'dim_clientes' && nome === 'score_risco' ? ' CHECK (score_risco BETWEEN 1 AND 1000)' : t === 'dim_clientes' && nome === 'volume_aum' ? ' CHECK (volume_aum >= 0)' : '';
      return `  ${nome} ${sql}${nulavel ? '' : ' NOT NULL'}${check}${extra}`;
    });
    cols.push(`  PRIMARY KEY (${TABELAS[t].pk.join(', ')})`);
    for (const [col, ref] of FKS[t] ?? []) cols.push(`  FOREIGN KEY (${col}) REFERENCES ${ref}`);
    if (t === 'dim_gerentes') cols.push('  UNIQUE (email_corporativo)');
    if (t === 'dim_clientes') cols.push('  UNIQUE (cpf_cnpj)');
    if (t === 'bridge_ocupacao_posicao') {
      cols.push('  CHECK (data_fim IS NULL OR data_fim >= data_inicio)');
      cols.push("  EXCLUDE USING gist (id_posicao WITH =, daterange(data_inicio, COALESCE(data_fim, 'infinity'::date), '[]') WITH &&)");
      cols.push("  EXCLUDE USING gist (id_gerente WITH =, daterange(data_inicio, COALESCE(data_fim, 'infinity'::date), '[]') WITH &&)");
    }
    if (t === 'fct_delegacoes') cols.push('  CHECK (data_fim >= data_inicio)');
    l.push(`COMMENT ON TABLE ${t} IS '${DICIONARIO[t].descricao.replace(/'/g, "''")}';`);
    l.push(`CREATE TABLE ${t} (\n${cols.join(',\n')}\n);`, '');
  }
  l.push('-- Exatamente um vínculo vigente por cliente (histórico de carteirização).');
  l.push('CREATE UNIQUE INDEX ux_vinculo_vigente ON bridge_vinculo_carteira (id_cliente) WHERE fim_em IS NULL;');
  l.push('CREATE INDEX ix_clientes_posicao ON dim_clientes (id_posicao_carteira) WHERE status = \'Ativo\';');
  l.push('CREATE INDEX ix_movimentacao_lote ON fct_movimentacao_carteira (id_lote);');
  return `${l.join('\n')}\n`;
}

if (process.argv[1]?.endsWith('gerar-dicionario.ts')) {
  mkdirSync(new URL('../planos/dominios/anexos/', import.meta.url), { recursive: true });
  mkdirSync(new URL('../data/ddl/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../planos/dominios/anexos/dicionario-de-dados.md', import.meta.url), conteudoDicionario(), 'utf8');
  writeFileSync(new URL('../data/ddl/postgres.sql', import.meta.url), conteudoDdl(), 'utf8');
  console.log('dicionário e DDL atualizados');
}
