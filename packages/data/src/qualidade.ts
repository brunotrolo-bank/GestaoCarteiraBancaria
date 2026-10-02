import { TABELAS, NOMES_TABELAS, apenasDigitos, documentoValido, ehDocumentoSintetico, intervalosSobrepostos, isISODate, type Db, type NomeTabela } from '@carteira/core';

/**
 * Suíte de contrato de dados (FR-DAD-011/012): regras que o motor (Sheets) não impõe e que, por isso,
 * são verificadas pela aplicação e por teste periódico. A versão em Apps Script (apps-script/) implementa as mesmas regras.
 */
export interface Violacao {
  regra: string;
  tabela: string;
  chave: string;
  detalhe: string;
}

export function verificarIntegridade(db: Db): Violacao[] {
  const v: Violacao[] = [];
  const add = (regra: string, tabela: string, chave: string, detalhe: string): void => { v.push({ regra, tabela, chave, detalhe }); };

  // 1. Chaves primárias únicas
  for (const t of NOMES_TABELAS) {
    const pk = TABELAS[t].pk;
    const vistos = new Set<string>();
    for (const linha of db[t] as unknown as Record<string, unknown>[]) {
      const chave = pk.map((c) => String(linha[c])).join('|');
      if (vistos.has(chave)) add('PK_DUPLICADA', t, chave, 'Chave primária repetida');
      vistos.add(chave);
    }
  }

  const ids = (t: NomeTabela, campo: string): Set<string> => new Set((db[t] as unknown as Record<string, unknown>[]).map((l) => String(l[campo])));
  const posicoes = ids('dim_posicoes', 'id_posicao');
  const gerentes = ids('dim_gerentes', 'id_gerente');
  const clientes = ids('dim_clientes', 'id_cliente');
  const agencias = ids('dim_agencias', 'id_agencia');
  const produtos = ids('ref_produtos', 'codigo');
  const segmentos = ids('ref_segmentos', 'codigo');

  // 2. Integridade referencial
  for (const p of db.dim_posicoes) if (!agencias.has(p.id_agencia)) add('FK', 'dim_posicoes', p.id_posicao, `Agência ${p.id_agencia} inexistente`);
  for (const o of db.bridge_ocupacao_posicao) {
    if (!posicoes.has(o.id_posicao)) add('FK', 'bridge_ocupacao_posicao', o.id_ocupacao, `Posição ${o.id_posicao} inexistente`);
    if (!gerentes.has(o.id_gerente)) add('FK', 'bridge_ocupacao_posicao', o.id_ocupacao, `Gerente ${o.id_gerente} inexistente`);
  }
  for (const d of db.fct_delegacoes) {
    if (!posicoes.has(d.id_posicao_origem)) add('FK', 'fct_delegacoes', d.id_delegacao, `Posição ${d.id_posicao_origem} inexistente`);
    if (!gerentes.has(d.id_gerente_delegado)) add('FK', 'fct_delegacoes', d.id_delegacao, `Gerente ${d.id_gerente_delegado} inexistente`);
  }
  for (const c of db.dim_clientes) {
    if (!posicoes.has(c.id_posicao_carteira)) add('FK', 'dim_clientes', c.id_cliente, `Posição ${c.id_posicao_carteira} inexistente`);
    if (!segmentos.has(c.segmento_cliente)) add('DOMINIO', 'dim_clientes', c.id_cliente, `Segmento ${c.segmento_cliente} fora do catálogo`);
  }
  for (const x of db.bridge_vinculo_carteira) {
    if (!clientes.has(x.id_cliente)) add('FK', 'bridge_vinculo_carteira', x.id_vinculo, `Cliente ${x.id_cliente} inexistente`);
    if (!posicoes.has(x.id_posicao)) add('FK', 'bridge_vinculo_carteira', x.id_vinculo, `Posição ${x.id_posicao} inexistente`);
  }
  for (const x of db.fct_produtos_cliente) {
    if (!clientes.has(x.id_cliente)) add('FK', 'fct_produtos_cliente', x.id_cliente, 'Cliente inexistente');
    if (!produtos.has(x.codigo_produto)) add('FK', 'fct_produtos_cliente', x.id_cliente, `Produto ${x.codigo_produto} fora do catálogo`);
  }
  for (const m of db.fct_movimentacao_carteira) {
    if (!clientes.has(m.id_cliente)) add('FK', 'fct_movimentacao_carteira', m.id_movimentacao, 'Cliente inexistente');
  }

  // 3. Ocupações: sem sobreposição por posição e uma posição por gerente (FR-POS-006/012)
  const oc = db.bridge_ocupacao_posicao;
  for (let i = 0; i < oc.length; i += 1) {
    const a = oc[i]!;
    if (!isISODate(a.data_inicio) || (a.data_fim !== null && (!isISODate(a.data_fim) || a.data_fim < a.data_inicio))) add('INTERVALO', 'bridge_ocupacao_posicao', a.id_ocupacao, 'Intervalo inválido');
    for (let j = i + 1; j < oc.length; j += 1) {
      const b = oc[j]!;
      if (!intervalosSobrepostos({ inicio: a.data_inicio, fim: a.data_fim }, { inicio: b.data_inicio, fim: b.data_fim })) continue;
      if (a.id_posicao === b.id_posicao) add('OCUPACAO_SOBREPOSTA', 'bridge_ocupacao_posicao', `${a.id_ocupacao}|${b.id_ocupacao}`, `Posição ${a.id_posicao} com dois titulares simultâneos`);
      if (a.id_gerente === b.id_gerente) add('GERENTE_EM_DUAS_POSICOES', 'bridge_ocupacao_posicao', `${a.id_ocupacao}|${b.id_ocupacao}`, `Gerente ${a.id_gerente} em duas posições simultâneas`);
    }
  }

  // 4. Delegações: período válido e sem sobreposição entre aprovadas da mesma origem (FR-DEL-002/006)
  const dl = db.fct_delegacoes;
  for (let i = 0; i < dl.length; i += 1) {
    const a = dl[i]!;
    if (!isISODate(a.data_inicio) || !isISODate(a.data_fim) || a.data_fim < a.data_inicio) add('INTERVALO', 'fct_delegacoes', a.id_delegacao, 'Período inválido');
    if (a.status_aprovacao !== 'Aprovada') continue;
    for (let j = i + 1; j < dl.length; j += 1) {
      const b = dl[j]!;
      if (b.status_aprovacao === 'Aprovada' && a.id_posicao_origem === b.id_posicao_origem
        && intervalosSobrepostos({ inicio: a.data_inicio, fim: a.data_fim }, { inicio: b.data_inicio, fim: b.data_fim })) {
        add('DELEGACAO_SOBREPOSTA', 'fct_delegacoes', `${a.id_delegacao}|${b.id_delegacao}`, `Delegações aprovadas sobrepostas na posição ${a.id_posicao_origem}`);
      }
    }
  }

  // 5. Clientes: documento válido e único, e projeção = vínculo vigente (C1/FR-CLI-003)
  const docs = new Set<string>();
  for (const c of db.dim_clientes) {
    const d = apenasDigitos(c.cpf_cnpj);
    if (!documentoValido(d)) add('DOCUMENTO_INVALIDO', 'dim_clientes', c.id_cliente, 'Dígito verificador inválido');
    if (docs.has(d)) add('DOCUMENTO_DUPLICADO', 'dim_clientes', c.id_cliente, 'CPF/CNPJ repetido');
    docs.add(d);
    if (!ehDocumentoSintetico(d)) add('DOCUMENTO_NAO_SINTETICO', 'dim_clientes', c.id_cliente, 'Documento sem o marcador de dado sintético');
    if (c.volume_aum < 0) add('DOMINIO', 'dim_clientes', c.id_cliente, 'AUM negativo');
    if (!(c.score_risco >= 1 && c.score_risco <= 1000)) add('DOMINIO', 'dim_clientes', c.id_cliente, 'Score fora de 1..1000');
    const vigentes = db.bridge_vinculo_carteira.filter((x) => x.id_cliente === c.id_cliente && x.fim_em === null);
    if (vigentes.length !== 1) add('VINCULO_VIGENTE', 'bridge_vinculo_carteira', c.id_cliente, `Esperado 1 vínculo vigente, encontrado ${vigentes.length}`);
    else if (vigentes[0]!.id_posicao !== c.id_posicao_carteira) add('PROJECAO_DIVERGENTE', 'dim_clientes', c.id_cliente, 'id_posicao_carteira diverge do vínculo vigente');
  }
  return v;
}
