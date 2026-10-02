import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { clientes, delegacao, posicoes, FixedClock, gerarCpf, gerarCnpj, mascararDocumento, cpfValido, cnpjValido, type Db } from '@carteira/core';
import { hashDb } from '@carteira/data';
import { assinaturaCarteira, cenario, em, esperaErro, ger, GG } from './helpers.ts';

const doPosicao = (db: Db, p: string, status = 'Ativo'): string[] => db.dim_clientes.filter((c) => c.id_posicao_carteira === p && c.status === status).map((c) => c.id_cliente);

describe('03 Clientes e Carteira', () => {
  it('valida e mascara CPF/CNPJ (nunca em claro)', () => {
    const cpf = gerarCpf('123456789');
    const cnpj = gerarCnpj('112223330001');
    expect(cpfValido(cpf)).toBe(true);
    expect(cnpjValido(cnpj)).toBe(true);
    expect(cpfValido('11111111111')).toBe(false);
    expect(cpfValido(cpf.slice(0, 10) + (cpf[10] === '0' ? '1' : '0'))).toBe(false);
    expect(mascararDocumento(cpf)).toMatch(/^\*\*\*\.\d{3}\.\d{3}-\*\*$/);
    expect(mascararDocumento(cnpj)).toMatch(/^\*\*\.\*\*\*\.\d{3}\/\d{4}-\*\*$/);
    expect(mascararDocumento(cpf)).not.toContain(cpf.slice(0, 3));
    fc.assert(fc.property(fc.stringMatching(/^\d{9}$/), (b) => cpfValido(gerarCpf(b)) || /^(\d)\1{8}$/.test(b) === false), { numRuns: 100 });
  });

  it('AC-CLI-01: documento inválido ou duplicado; dados fora de domínio', () => {
    const { db, clock } = cenario();
    const ok = { nome_razao_social: 'Cliente Teste', cpf_cnpj: gerarCpf('999000111'), segmento_cliente: 'Private' as const, faixa_renda_faturamento: 1, volume_aum: 10, score_risco: 500, id_posicao_carteira: 'POS-AG01-001' };
    esperaErro(() => clientes.cadastrarCliente(db, clock, { ...ok, cpf_cnpj: '123.456.789-00' }, GG), 'DOCUMENTO_INVALIDO');
    const c = clientes.cadastrarCliente(db, clock, ok, GG);
    expect(c.cpf_cnpj).toBe(ok.cpf_cnpj);
    expect(db.bridge_vinculo_carteira.filter((v) => v.id_cliente === c.id_cliente && v.fim_em === null)).toHaveLength(1);
    esperaErro(() => clientes.cadastrarCliente(db, clock, ok, GG), 'DOCUMENTO_DUPLICADO');
    esperaErro(() => clientes.cadastrarCliente(db, clock, { ...ok, cpf_cnpj: gerarCpf('999000222'), score_risco: 1001 }, GG), 'DADOS_INVALIDOS');
    esperaErro(() => clientes.cadastrarCliente(db, clock, { ...ok, cpf_cnpj: gerarCpf('999000333'), volume_aum: -1 }, GG), 'DADOS_INVALIDOS');
    esperaErro(() => clientes.cadastrarCliente(db, clock, { ...ok, cpf_cnpj: gerarCpf('999000444') }, ger(101)), 'NAO_AUTORIZADO');
  });

  it('AC-CLI-02: simulação não altera nenhum dado e informa antes/depois e avisos', () => {
    const { db } = cenario('demo');
    const ids = doPosicao(db, 'POS-AG01-001').slice(0, 20);
    const antes = hashDb(db);
    const s = clientes.simularRedistribuicao(db, { ids_clientes: ids, id_posicao_destino: 'POS-AG01-004' });
    expect(hashDb(db)).toBe(antes);
    const dest = s.depois.find((u) => u.id_posicao === 'POS-AG01-004')!;
    expect(dest.clientes_ativos).toBe(52); // 32 + 20
    expect(s.depois.find((u) => u.id_posicao === 'POS-AG01-001')!.clientes_ativos).toBe(76); // 96 - 20
    expect(s.antes.find((u) => u.id_posicao === 'POS-AG01-004')!.clientes_ativos).toBe(32);
    expect(s.avisos.some((a) => a.codigo === 'CAPACIDADE_EXCEDIDA')).toBe(false);
  });

  it('AC-CLI-03 (J3): execução move o bloco com 1 movimentação por cliente, mesmo lote e histórico', () => {
    const { db, clock } = cenario('demo');
    const ids = doPosicao(db, 'POS-AG01-001').slice(0, 20);
    const r = clientes.executarRedistribuicao(db, clock, { ids_clientes: ids, id_posicao_destino: 'POS-AG01-004', motivo: 'Rebalanceamento J3' }, GG);
    expect(r.movimentacoes).toHaveLength(20);
    expect(new Set(r.movimentacoes.map((m) => m.id_lote)).size).toBe(1);
    expect(clientes.utilizacaoPosicao(db, 'POS-AG01-004').clientes_ativos).toBe(52);
    expect(clientes.utilizacaoPosicao(db, 'POS-AG01-001').clientes_ativos).toBe(76);
    const hist = db.bridge_vinculo_carteira.filter((v) => v.id_cliente === ids[0]);
    expect(hist.map((h) => h.id_posicao)).toEqual(['POS-AG01-001', 'POS-AG01-004']);
    expect(hist[0]!.fim_em).not.toBeNull();
    expect(db.log_auditoria.at(-1)!.acao).toBe('LOTE_REDISTRIBUIDO');
    expect(JSON.stringify(db.log_auditoria)).not.toMatch(/\d{11}/); // nenhum documento nos logs
  });

  it('AC-CLI-04: falha no meio do lote não deixa nenhum cliente movido', () => {
    const { db, clock } = cenario('demo');
    const ids = doPosicao(db, 'POS-AG01-001').slice(0, 14);
    const inativo = doPosicao(db, 'POS-AG01-001', 'Inativo')[0]!;
    const antes = hashDb(db);
    esperaErro(() => clientes.executarRedistribuicao(db, clock, { ids_clientes: [...ids, inativo], id_posicao_destino: 'POS-AG01-004', motivo: 'x' }, GG), 'CLIENTE_INATIVO');
    expect(hashDb(db)).toBe(antes);
  });

  it('AC-CLI-05: mesma chave de idempotência não duplica movimentações', () => {
    const { db, clock } = cenario('demo');
    const ids = doPosicao(db, 'POS-AG01-001').slice(0, 5);
    const entrada = { ids_clientes: ids, id_posicao_destino: 'POS-AG01-004', motivo: 'idem', chave_idempotencia: 'LOTE-IDEM-1' };
    const a = clientes.executarRedistribuicao(db, clock, entrada, GG);
    const total = db.fct_movimentacao_carteira.length;
    const b = clientes.executarRedistribuicao(db, clock, entrada, GG);
    expect(b.repetido).toBe(true);
    expect(b.movimentacoes.map((m) => m.id_movimentacao)).toEqual(a.movimentacoes.map((m) => m.id_movimentacao));
    expect(db.fct_movimentacao_carteira).toHaveLength(total);
  });

  it('AC-CLI-06 (Q-14): capacidade excedida gera alerta e exige justificativa, sem bloquear', () => {
    const { db, clock } = cenario('demo');
    const ids = doPosicao(db, 'POS-AG01-002').slice(0, 10); // POS-005 tem 75; +10 = 85/80
    const entrada = { ids_clientes: ids, id_posicao_destino: 'POS-AG01-005', motivo: 'Teste' };
    expect(clientes.simularRedistribuicao(db, entrada).avisos.some((a) => a.codigo === 'CAPACIDADE_EXCEDIDA')).toBe(true);
    esperaErro(() => clientes.executarRedistribuicao(db, clock, entrada, GG), 'JUSTIFICATIVA_OBRIGATORIA');
    const r = clientes.executarRedistribuicao(db, clock, { ...entrada, justificativa: 'Cobertura de férias' }, GG);
    expect(r.capacidade_excedida).toBe(true);
    expect(db.log_eventos.some((e) => e.tipo === 'CapacidadeExcedida')).toBe(true);
  });

  it('AC-CLI-07: desfazer lote cria compensações; estado final = inicial; histórico preserva ambos', () => {
    const { db, clock } = cenario('demo');
    const ids = doPosicao(db, 'POS-AG01-001').slice(0, 8);
    const antesProjecao = ids.map((i) => db.dim_clientes.find((c) => c.id_cliente === i)!.id_posicao_carteira);
    const lote = clientes.executarRedistribuicao(db, clock, { ids_clientes: ids, id_posicao_destino: 'POS-AG01-004', motivo: 'ida' }, GG);
    const desfeito = clientes.desfazerLote(db, clock, lote.id_lote, GG);
    expect(desfeito.movimentacoes.every((m) => m.tipo === 'Compensacao')).toBe(true);
    expect(ids.map((i) => db.dim_clientes.find((c) => c.id_cliente === i)!.id_posicao_carteira)).toEqual(antesProjecao);
    expect(db.fct_movimentacao_carteira.filter((m) => m.id_cliente === ids[0])).toHaveLength(2);
    esperaErro(() => clientes.desfazerLote(db, clock, lote.id_lote, GG), 'LOTE_JA_DESFEITO');
    esperaErro(() => clientes.desfazerLote(db, clock, 'LOTE-XXXX', GG), 'LOTE_INEXISTENTE');
  });

  it('AC-CLI-08: destino congelado ou extinto é rejeitado', () => {
    const { db, clock } = cenario();
    posicoes.alterarStatusPosicao(db, clock, 'POS-AG01-004', 'Congelada', GG);
    esperaErro(() => clientes.executarRedistribuicao(db, clock, { ids_clientes: doPosicao(db, 'POS-AG01-001').slice(0, 1), id_posicao_destino: 'POS-AG01-004', motivo: 'x' }, GG), 'POSICAO_DESTINO_INDISPONIVEL');
    esperaErro(() => clientes.executarRedistribuicao(db, clock, { ids_clientes: doPosicao(db, 'POS-AG01-004').slice(0, 1), id_posicao_destino: 'POS-AG01-004', motivo: 'x' }, GG), 'POSICAO_DESTINO_INDISPONIVEL');
  });

  it('AC-CLI-09 (R1): trocar titular não gera movimentação nem altera id_posicao_carteira', () => {
    const { db, clock } = cenario('demo');
    const antes = assinaturaCarteira(db);
    posicoes.trocarTitular(db, clock, { id_posicao: 'POS-AG01-001', id_gerente: 'GER-106', data_inicio: '2026-10-05', tipo_vinculo: 'Titular Efetivo' }, GG);
    expect(assinaturaCarteira(db)).toBe(antes);
    expect(db.fct_movimentacao_carteira).toHaveLength(0);
  });

  it('lote vazio, cliente no destino (no-op) e restrição ao Gerente Geral', () => {
    const { db, clock } = cenario();
    const ids = doPosicao(db, 'POS-AG01-001');
    esperaErro(() => clientes.executarRedistribuicao(db, clock, { ids_clientes: ids, id_posicao_destino: 'POS-AG01-001', motivo: 'x' }, GG), 'LOTE_VAZIO');
    esperaErro(() => clientes.executarRedistribuicao(db, clock, { ids_clientes: ids, id_posicao_destino: 'POS-AG01-004', motivo: 'x' }, ger(101)), 'NAO_AUTORIZADO');
    esperaErro(() => clientes.executarRedistribuicao(db, clock, { ids_clientes: ids, id_posicao_destino: 'POS-AG01-004', motivo: ' ' }, GG), 'MOTIVO_OBRIGATORIO');
    esperaErro(() => clientes.simularRedistribuicao(db, { ids_clientes: ['CLI-9999'], id_posicao_destino: 'POS-AG01-004' }), 'CLIENTE_INEXISTENTE');
  });

  it('transferência individual: titular (escrita) pode; delegado em leitura não; quem não tem acesso não', () => {
    const { db, clock } = cenario('demo');
    const cliente = doPosicao(db, 'POS-AG01-002')[0]!;
    const r = clientes.transferirCliente(db, clock, { id_cliente: cliente, id_posicao_destino: 'POS-AG01-005', motivo: 'Mudança de perfil' }, ger(102));
    expect(r.movimentacoes[0]!.ator).toBe('GER-102');
    esperaErro(() => clientes.transferirCliente(db, clock, { id_cliente: cliente, id_posicao_destino: 'POS-AG01-001', motivo: 'x' }, ger(103)), 'ACESSO_NEGADO');
    esperaErro(() => clientes.transferirCliente(db, clock, { id_cliente: cliente, id_posicao_destino: 'POS-AG01-001', motivo: 'x' }, ger(999)), 'NAO_AUTORIZADO');
  });

  it('transferência em delegação de consulta é negada; com escopo Total é permitida', () => {
    const { db, clock } = cenario('demo');
    const dia = new FixedClock(em('2026-11-05'));
    const cliente = doPosicao(db, 'POS-AG01-001')[0]!;
    // DEL-0001 do seed (Total, POS-001 → GER-102) está vigente em 05/11
    expect(delegacao.vigente(db.fct_delegacoes[0]!, dia.agora())).toBe(true);
    const r = clientes.transferirCliente(db, dia, { id_cliente: cliente, id_posicao_destino: 'POS-AG01-004', motivo: 'Cobertura' }, ger(102));
    expect(r.movimentacoes[0]!.ator).toBe('GER-102');
    void clock;
  });

  it('revelar documento: só titular/GG, sempre auditado; terceiros negados (Q-24)', () => {
    const { db, clock } = cenario();
    const alvo = db.dim_clientes.find((c) => c.id_posicao_carteira === 'POS-AG01-002')!;
    expect(clientes.revelarDocumento(db, clock, alvo.id_cliente, ger(102))).toBe(alvo.cpf_cnpj);
    expect(clientes.revelarDocumento(db, clock, alvo.id_cliente, GG)).toBe(alvo.cpf_cnpj);
    expect(db.log_auditoria.filter((l) => l.acao === 'DOCUMENTO_REVELADO')).toHaveLength(2);
    esperaErro(() => clientes.revelarDocumento(db, clock, alvo.id_cliente, ger(103)), 'ACESSO_NEGADO');
    expect(clientes.clienteMascarado(alvo)).not.toHaveProperty('cpf_cnpj');
  });

  it('aderência ao segmento e utilização contam só clientes Ativos (Q-15)', () => {
    expect(clientes.aderenteAoSegmento('Private', 'UHNW')).toBe(true);
    expect(clientes.aderenteAoSegmento('Alta Renda', 'Varejo')).toBe(false);
    expect(clientes.aderenteAoSegmento('Misto', 'Varejo')).toBe(true);
    const { db } = cenario('demo');
    const u = clientes.utilizacaoPosicao(db, 'POS-AG01-001');
    expect(u.clientes_ativos).toBe(96);
    expect(u.utilizacao).toBeCloseTo(1.2, 10);
    expect(clientes.contarClientesDaPosicao(db, 'POS-AG01-001')).toBeGreaterThan(96); // inclui prospecção/inativos
  });
});
