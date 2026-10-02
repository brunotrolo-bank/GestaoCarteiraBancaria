import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { clientes, delegacao, FixedClock, gerarCnpj, gerarCpf, meioDia, type Db } from '@carteira/core';
import { capturaErro, cenario, em, esperaErro, execucoes, ger, GG, ultimaAuditoria, ultimoEvento } from './helpers.ts';

/** Algoritmo de referência INDEPENDENTE (módulo 11 clássico) para provar a validação de CPF/CNPJ. */
function dvRef(digitos: number[], pesos: number[]): number {
  const r = digitos.reduce((a, d, i) => a + d * pesos[i]!, 0) % 11;
  return r < 2 ? 0 : 11 - r;
}
function cpfRef(s: string): boolean {
  if (!/^\d{11}$/.test(s) || /^(\d)\1{10}$/.test(s)) return false;
  const n = [...s].map(Number);
  return dvRef(n.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]) === n[9] && dvRef(n.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) === n[10];
}
function cnpjRef(s: string): boolean {
  if (!/^\d{14}$/.test(s) || /^(\d)\1{13}$/.test(s)) return false;
  const n = [...s].map(Number);
  return dvRef(n.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === n[12] && dvRef(n.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === n[13];
}

const ativos = (db: Db, p: string): string[] => db.dim_clientes.filter((c) => c.id_posicao_carteira === p && c.status === 'Ativo').map((c) => c.id_cliente);
const novo = (doc: string, extra: Record<string, unknown> = {}) => ({ nome_razao_social: 'Cliente Novo', cpf_cnpj: doc, segmento_cliente: 'Private' as const, faixa_renda_faturamento: 10, volume_aum: 100, score_risco: 500, id_posicao_carteira: 'POS-AG01-001', ...extra });

describe('clientes — documentos, cadastro, simulação, lote, desfazer e revelação (mutação)', () => {
  it('CPF/CNPJ: validação ≡ algoritmo de referência independente (aleatórios, gerados e com 1 dígito errado)', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^\d{11}$/), fc.stringMatching(/^\d{14}$/), fc.stringMatching(/^\d{9}$/), fc.stringMatching(/^\d{12}$/), fc.integer({ min: 0, max: 10 }), (c11, c14, b9, b12, pos) => {
        expect(clientes.cpfValido(c11)).toBe(cpfRef(c11));
        expect(clientes.cnpjValido(c14)).toBe(cnpjRef(c14));
        const cpf = gerarCpf(b9);
        const cnpj = gerarCnpj(b12);
        expect(clientes.cpfValido(cpf)).toBe(cpfRef(cpf));
        expect(clientes.cnpjValido(cnpj)).toBe(cnpjRef(cnpj));
        const trocado = cpf.slice(0, pos) + String((Number(cpf[pos]) + 1) % 10) + cpf.slice(pos + 1);
        expect(clientes.cpfValido(trocado)).toBe(cpfRef(trocado));
        expect(clientes.documentoValido(cpf)).toBe(cpfRef(cpf));
        expect(clientes.documentoValido(cnpj)).toBe(cnpjRef(cnpj));
      }),
      { numRuns: execucoes(300) },
    );
    expect(clientes.cpfValido('529.982.247-25')).toBe(true); // vetor conhecido, com máscara
    expect(clientes.cpfValido('52998224724')).toBe(false);
    expect(clientes.cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(clientes.cnpjValido('11222333000182')).toBe(false);
    expect(clientes.cnpjValido('11222333000171')).toBe(false); // 1º dígito errado
    expect(clientes.documentoValido('')).toBe(false);
    expect(clientes.documentoValido('123')).toBe(false);
  });

  it('apenasDigitos tolera vazio/indefinido; marcador sintético só para 999… (CPF) e 99999… (CNPJ)', () => {
    expect(clientes.apenasDigitos(undefined as never)).toBe('');
    expect(clientes.apenasDigitos('a1b2-3.4')).toBe('1234');
    expect(clientes.ehDocumentoSintetico(gerarCpf('999111222'))).toBe(true);
    expect(clientes.ehDocumentoSintetico(gerarCpf('529982247'))).toBe(false);
    expect(clientes.ehDocumentoSintetico(gerarCnpj('999990010001'))).toBe(true);
    expect(clientes.ehDocumentoSintetico(gerarCnpj('112223330001'))).toBe(false);
    expect(clientes.ehDocumentoSintetico('99999999999999'.slice(0, 12))).toBe(false); // 12 dígitos: nem CPF nem CNPJ
    expect(clientes.ehDocumentoSintetico('99999123456')).toBe(true); // CPF começando com 999
    expect(clientes.ehDocumentoSintetico(`999${'1'.repeat(11)}`)).toBe(false); // 14 dígitos mas sem o marcador de CNPJ (99999)
    expect(clientes.mascararDocumento(gerarCpf('123456789'))).toBe('***.456.789-**');
    expect(clientes.mascararDocumento(gerarCnpj('112223330001'))).toBe('**.***.333/0001-**');
  });

  it('aderência ao segmento: matriz completa especialidade × segmento', () => {
    const esperado: Record<string, string[]> = { Private: ['UHNW', 'Private'], 'Alta Renda': ['Alta Renda'], 'Middle Market': ['Varejo'], Misto: ['UHNW', 'Private', 'Alta Renda', 'Varejo'] };
    for (const [esp, ok] of Object.entries(esperado)) {
      for (const seg of ['UHNW', 'Private', 'Alta Renda', 'Varejo'] as const) expect(clientes.aderenteAoSegmento(esp as 'Misto', seg), `${esp} × ${seg}`).toBe(ok.includes(seg));
    }
  });

  it('contagem de carteira: inclui todos os status, só da posição pedida', () => {
    const { db } = cenario();
    expect(clientes.contarClientesDaPosicao(db, 'POS-AG01-001')).toBe(db.dim_clientes.filter((c) => c.id_posicao_carteira === 'POS-AG01-001').length);
    expect(clientes.contarClientesDaPosicao(db, 'POS-AG01-001')).toBeGreaterThan(ativos(db, 'POS-AG01-001').length);
    expect(clientes.contarClientesDaPosicao(db, 'POS-XX')).toBe(0);
  });

  it('cadastro: limites de score e valores, nome/segmento obrigatórios, identificadores, status e registros', () => {
    const { db, clock } = cenario();
    const d = (n: number): string => gerarCpf(`999${String(n).padStart(6, '0')}`);
    esperaErro(() => clientes.cadastrarCliente(db, clock, novo(d(1), { nome_razao_social: undefined }), GG), 'DADOS_INVALIDOS');
    esperaErro(() => clientes.cadastrarCliente(db, clock, novo(d(2), { nome_razao_social: '  ' }), GG), 'DADOS_INVALIDOS');
    esperaErro(() => clientes.cadastrarCliente(db, clock, novo(d(3), { segmento_cliente: 'Outro' }), GG), 'DADOS_INVALIDOS');
    for (const score of [0, 1001, 1.5, Number.NaN]) esperaErro(() => clientes.cadastrarCliente(db, clock, novo(d(4), { score_risco: score }), GG), 'DADOS_INVALIDOS');
    esperaErro(() => clientes.cadastrarCliente(db, clock, novo(d(5), { volume_aum: -0.01 }), GG), 'DADOS_INVALIDOS');
    esperaErro(() => clientes.cadastrarCliente(db, clock, novo(d(6), { faixa_renda_faturamento: -1 }), GG), 'DADOS_INVALIDOS');
    const minimo = clientes.cadastrarCliente(db, clock, novo(d(7), { score_risco: 1, volume_aum: 0, faixa_renda_faturamento: 0 }), GG);
    expect(minimo).toMatchObject({ score_risco: 1, volume_aum: 0, status: 'Ativo' });
    expect(minimo.id_cliente).toMatch(/^CLI-\d{4}$/);
    const maximo = clientes.cadastrarCliente(db, clock, novo(d(8), { score_risco: 1000, nome_razao_social: '  Maria  ', status: 'Em Prospecção' }), GG);
    expect(maximo).toMatchObject({ score_risco: 1000, nome_razao_social: 'Maria', status: 'Em Prospecção', data_carteirizacao: '2026-10-01' });
    const vin = db.bridge_vinculo_carteira.find((v) => v.id_cliente === maximo.id_cliente)!;
    expect(vin).toMatchObject({ id_posicao: 'POS-AG01-001', fim_em: null });
    expect(vin.id_vinculo).toMatch(/^VIN-\d{5}$/);
    expect(new Set(db.bridge_vinculo_carteira.map((v) => v.id_vinculo)).size).toBe(db.bridge_vinculo_carteira.length);
    expect(ultimaAuditoria(db, 'CLIENTE_CARTEIRIZADO')).toMatchObject({ entidade: 'dim_clientes', id_entidade: maximo.id_cliente });
    expect(JSON.parse(ultimaAuditoria(db, 'CLIENTE_CARTEIRIZADO')!.detalhe)).toEqual({ id_posicao: 'POS-AG01-001' });
    expect(JSON.parse(ultimoEvento(db, 'ClienteCarteirizado')!.payload)).toEqual({ id_cliente: maximo.id_cliente, id_posicao: 'POS-AG01-001' });
  });

  it('simulação: ignora quem já está no destino, não conta inativos, avisa aderência/inativo e só excede ACIMA de 100%', () => {
    const { db } = cenario('minimo'); // capacidade 4 por posição; POS-001 tem 4 ativos
    const ids001 = ativos(db, 'POS-AG01-001');
    const s0 = clientes.simularRedistribuicao(db, { ids_clientes: [...ids001, ids001[0]!], id_posicao_destino: 'POS-AG01-001' }); // duplicado + no destino
    expect(s0.clientes_a_mover).toEqual([]);
    expect(s0.ignorados_ja_no_destino).toEqual(ids001);
    expect(s0.antes).toEqual(s0.depois);
    // POS-003 tem 3 ativos: mover 1 => 4/4 = 100% (sem aviso); mover 2 => 5/4 (aviso)
    const dest = 'POS-AG01-003';
    const s1 = clientes.simularRedistribuicao(db, { ids_clientes: ids001.slice(0, 1), id_posicao_destino: dest });
    expect(s1.depois.find((u) => u.id_posicao === dest)).toMatchObject({ clientes_ativos: 4, utilizacao: 1 });
    expect(s1.depois.find((u) => u.id_posicao === 'POS-AG01-001')).toMatchObject({ clientes_ativos: 3 });
    expect(s1.avisos.some((a) => a.codigo === 'CAPACIDADE_EXCEDIDA')).toBe(false);
    const s2 = clientes.simularRedistribuicao(db, { ids_clientes: ids001.slice(0, 2), id_posicao_destino: dest });
    const exc = s2.avisos.find((a) => a.codigo === 'CAPACIDADE_EXCEDIDA')!;
    expect(exc.mensagem).toContain('125%');
    // inativo: aviso próprio e não conta na capacidade
    const inativo = db.dim_clientes.find((c) => c.status === 'Inativo')!;
    const s3 = clientes.simularRedistribuicao(db, { ids_clientes: [inativo.id_cliente], id_posicao_destino: dest });
    expect(s3.avisos.find((a) => a.codigo === 'CLIENTE_INATIVO')).toMatchObject({ id_cliente: inativo.id_cliente });
    expect(s3.depois.find((u) => u.id_posicao === dest)!.clientes_ativos).toBe(3);
    const origemInativo = inativo.id_posicao_carteira;
    expect(s3.antes.find((u) => u.id_posicao === origemInativo)!.clientes_ativos).toBe(s3.depois.find((u) => u.id_posicao === origemInativo)!.clientes_ativos); // inativo não conta ao sair
    // aderência: Private (POS-001) → posição "Alta Renda" (POS-002) para um UHNW/Private gera aviso com o cliente
    const adv = clientes.simularRedistribuicao(db, { ids_clientes: ids001.slice(0, 1), id_posicao_destino: 'POS-AG01-002' }).avisos.find((a) => a.codigo === 'ADERENCIA_SEGMENTO')!;
    expect(adv).toMatchObject({ id_cliente: ids001[0] });
    expect(adv.mensagem).toMatch(/não é aderente/);
    expect(clientes.simularRedistribuicao(db, { ids_clientes: ids001.slice(0, 1), id_posicao_destino: 'POS-AG01-004' }).avisos.some((a) => a.codigo === 'ADERENCIA_SEGMENTO')).toBe(false); // Misto aceita tudo
  });

  it('lote: identificadores gerados, chave aparada, idempotência, justificativa só acima de 100%, auditoria e eventos', () => {
    const { db, clock } = cenario('minimo');
    const ids = ativos(db, 'POS-AG01-001');
    const a = clientes.executarRedistribuicao(db, clock, { ids_clientes: ids.slice(0, 1), id_posicao_destino: 'POS-AG01-003', motivo: '  Rebalanço  ', chave_idempotencia: '   ' }, GG);
    expect(a.id_lote).toBe('LOTE-0001'); // chave só de espaços => gerado
    expect(a).toMatchObject({ repetido: false, capacidade_excedida: false }); // exatamente 100%: sem justificativa
    expect(db.fct_movimentacao_carteira[0]).toMatchObject({ motivo: 'Rebalanço', tipo: 'Transferencia', ator: 'GER-100' });
    expect(db.fct_movimentacao_carteira[0]!.id_movimentacao).toMatch(/^MOV-\d{6}$/);
    expect(db.bridge_vinculo_carteira.find((v) => v.id_cliente === ids[0] && v.fim_em === null)!.id_vinculo).toMatch(/^VIN-\d{5}$/);
    expect(db.log_eventos.some((e) => e.tipo === 'CapacidadeExcedida')).toBe(false);
    const b = clientes.executarRedistribuicao(db, clock, { ids_clientes: ids.slice(1, 3), id_posicao_destino: 'POS-AG01-004', motivo: 'Segundo', chave_idempotencia: ' CHAVE-X ' }, GG);
    expect(b.id_lote).toBe('CHAVE-X'); // chave aparada
    expect(b.movimentacoes.every((m) => m.tipo === 'Redistribuicao')).toBe(true);
    const c = clientes.executarRedistribuicao(db, clock, { ids_clientes: ids.slice(3, 4), id_posicao_destino: 'POS-AG01-002', motivo: 'Terceiro' }, GG);
    expect(c.id_lote).toBe('LOTE-0002'); // a sequência conta só ids no padrão LOTE-nnnn (chaves próprias não entram)
    const rep = clientes.executarRedistribuicao(db, clock, { ids_clientes: ids.slice(1, 3), id_posicao_destino: 'POS-AG01-004', motivo: 'Segundo', chave_idempotencia: 'CHAVE-X' }, GG);
    expect(rep).toMatchObject({ repetido: true, capacidade_excedida: false });
    expect(rep.movimentacoes.map((m) => m.id_movimentacao)).toEqual(b.movimentacoes.map((m) => m.id_movimentacao));
    expect(JSON.parse(ultimaAuditoria(db, 'LOTE_REDISTRIBUIDO')!.detalhe)).toEqual({ destino: 'POS-AG01-002', clientes: 1, motivo: 'Terceiro', justificativa: null });
    expect(JSON.parse(ultimoEvento(db, 'LoteRedistribuido')!.payload)).toEqual({ id_lote: 'LOTE-0002', destino: 'POS-AG01-002', clientes: 1 });
    expect(ultimoEvento(db, 'ClienteRealocado')!.payload).toContain('"de":"POS-AG01-001"');
    // acima de 100% exige justificativa (inclusive só espaços) e fica registrada
    const ids2 = ativos(db, 'POS-AG01-005');
    esperaErro(() => clientes.executarRedistribuicao(db, clock, { ids_clientes: ids2.slice(0, 2), id_posicao_destino: 'POS-AG01-003', motivo: 'x', justificativa: '   ' }, GG), 'JUSTIFICATIVA_OBRIGATORIA');
    const exc = clientes.executarRedistribuicao(db, clock, { ids_clientes: ids2.slice(0, 2), id_posicao_destino: 'POS-AG01-003', motivo: 'x', justificativa: 'Cobertura' }, GG);
    expect(exc.capacidade_excedida).toBe(true);
    expect(JSON.parse(ultimaAuditoria(db, 'LOTE_REDISTRIBUIDO')!.detalhe).justificativa).toBe('Cobertura');
    expect(JSON.parse(ultimoEvento(db, 'CapacidadeExcedida')!.payload)).toMatchObject({ id_posicao: 'POS-AG01-003' });
    esperaErro(() => clientes.executarRedistribuicao(db, clock, { ids_clientes: ids2, id_posicao_destino: 'POS-AG01-004', motivo: undefined as never }, GG), 'MOTIVO_OBRIGATORIO');
    const ei = capturaErro(() => clientes.executarRedistribuicao(db, clock, { ids_clientes: [db.dim_clientes.find((x) => x.status === 'Inativo')!.id_cliente], id_posicao_destino: 'POS-AG01-004', motivo: 'x' }, GG));
    expect(ei.codigo).toBe('CLIENTE_INATIVO');
    expect(ei.detalhe).toHaveProperty('ids');
  });

  it('mover cliente encerra SÓ o vínculo vigente dele e abre o novo; outros vínculos e clientes ficam intactos', () => {
    const { db, clock } = cenario('minimo');
    const [x, y] = ativos(db, 'POS-AG01-001');
    const vinculoY = JSON.stringify(db.bridge_vinculo_carteira.filter((v) => v.id_cliente === y));
    clientes.executarRedistribuicao(db, clock, { ids_clientes: [x!], id_posicao_destino: 'POS-AG01-004', motivo: 'm' }, GG);
    expect(db.bridge_vinculo_carteira.filter((v) => v.id_cliente === x)).toHaveLength(2);
    expect(db.bridge_vinculo_carteira.filter((v) => v.id_cliente === x && v.fim_em === null)).toHaveLength(1);
    expect(JSON.stringify(db.bridge_vinculo_carteira.filter((v) => v.id_cliente === y))).toBe(vinculoY);
    expect(db.dim_clientes.find((c) => c.id_cliente === x)).toMatchObject({ id_posicao_carteira: 'POS-AG01-004', data_carteirizacao: '2026-10-01' });
  });

  it('transferência individual: GG pode (mesmo só com leitura); titular com escrita pode; sem acesso/leitura não', () => {
    const { db, clock } = cenario('demo');
    const cli = ativos(db, 'POS-AG01-002')[0]!;
    const comoGG = clientes.transferirCliente(db, clock, { id_cliente: cli, id_posicao_destino: 'POS-AG01-005', motivo: 'GG move' }, GG);
    expect(comoGG.movimentacoes[0]!.ator).toBe('GER-100');
    const dia = new FixedClock(em('2026-11-05'));
    const alvo = ativos(db, 'POS-AG01-001')[0]!;
    esperaErro(() => clientes.transferirCliente(db, dia, { id_cliente: alvo, id_posicao_destino: 'POS-AG01-004', motivo: 'x' }, ger(101)), 'ACESSO_NEGADO'); // titular ausente: leitura
    expect(clientes.transferirCliente(db, dia, { id_cliente: alvo, id_posicao_destino: 'POS-AG01-004', motivo: 'Cobertura' }, ger(102)).movimentacoes).toHaveLength(1); // delegado Total
  });

  it('desfazer lote: identificador, auditoria, evento, só movimentações do lote e bloqueio quando o cliente já mudou', () => {
    const { db, clock } = cenario('minimo');
    const ids = ativos(db, 'POS-AG01-001');
    const lote = clientes.executarRedistribuicao(db, clock, { ids_clientes: ids.slice(0, 2), id_posicao_destino: 'POS-AG01-004', motivo: 'ida', chave_idempotencia: 'L-1' }, GG);
    const outro = clientes.executarRedistribuicao(db, clock, { ids_clientes: ids.slice(2, 3), id_posicao_destino: 'POS-AG01-005', motivo: 'outro', chave_idempotencia: 'L-2' }, GG);
    const r = clientes.desfazerLote(db, clock, 'L-1', GG);
    expect(r).toMatchObject({ id_lote: 'L-1-DESFAZER', repetido: false, capacidade_excedida: false });
    expect(r.movimentacoes).toHaveLength(2);
    expect(r.movimentacoes.every((m) => m.motivo === 'Desfazer L-1' && m.tipo === 'Compensacao' && m.id_lote === 'L-1-DESFAZER')).toBe(true);
    expect(db.dim_clientes.find((c) => c.id_cliente === outro.movimentacoes[0]!.id_cliente)!.id_posicao_carteira).toBe('POS-AG01-005'); // o outro lote não foi tocado
    expect(ultimaAuditoria(db, 'LOTE_DESFEITO')).toMatchObject({ id_entidade: 'L-1' });
    expect(JSON.parse(ultimaAuditoria(db, 'LOTE_DESFEITO')!.detalhe)).toEqual({ clientes: 2 });
    expect(JSON.parse(ultimoEvento(db, 'LoteDesfeito')!.payload)).toEqual({ id_lote: 'L-1' });
    esperaErro(() => clientes.desfazerLote(db, clock, 'L-1', ger(101)), 'NAO_AUTORIZADO');
    // cliente movido de novo depois do lote: não dá para desfazer (e nada é alterado)
    const antes = JSON.stringify(db.dim_clientes);
    clientes.executarRedistribuicao(db, clock, { ids_clientes: [lote.movimentacoes[0]!.id_cliente], id_posicao_destino: 'POS-AG01-002', motivo: 'já moveu', chave_idempotencia: 'L-3' }, GG);
    clientes.executarRedistribuicao(db, clock, { ids_clientes: [outro.movimentacoes[0]!.id_cliente], id_posicao_destino: 'POS-AG01-003', motivo: 'já moveu', chave_idempotencia: 'L-4' }, GG);
    const depois = JSON.stringify(db.dim_clientes);
    expect(depois).not.toBe(antes);
    esperaErro(() => clientes.desfazerLote(db, clock, 'L-2', GG), 'LOTE_NAO_DESFAZIVEL');
    expect(JSON.stringify(db.dim_clientes)).toBe(depois);
  });

  it('revelar documento: só titular ou GG — delegado (mesmo com escrita) não; auditado com o ator', () => {
    const { db } = cenario('demo');
    const dia = new FixedClock(em('2026-11-05'));
    const cli = db.dim_clientes.find((c) => c.id_posicao_carteira === 'POS-AG01-001')!;
    expect(delegacao.delegacoesVigentes(db, dia.agora())).toHaveLength(1);
    esperaErro(() => clientes.revelarDocumento(db, dia, cli.id_cliente, ger(102)), 'ACESSO_NEGADO'); // delegado Total
    expect(clientes.revelarDocumento(db, dia, cli.id_cliente, ger(101))).toBe(cli.cpf_cnpj); // titular ausente ainda é titular
    expect(ultimaAuditoria(db, 'DOCUMENTO_REVELADO')).toMatchObject({ ator: 'GER-101', entidade: 'dim_clientes', id_entidade: cli.id_cliente });
  });

  it('produtos e interações: só do cliente pedido; interações do mais recente ao mais antigo', () => {
    const { db } = cenario('minimo');
    const cli = db.dim_clientes[0]!.id_cliente;
    db.fct_interacoes_crm.push({ id_interacao: 'CRM-T1', id_cliente: cli, id_posicao: 'POS-AG01-001', canal: 'E-mail', data: '2020-01-01', nota: 'antiga' }, { id_interacao: 'CRM-T2', id_cliente: cli, id_posicao: 'POS-AG01-001', canal: 'E-mail', data: '2030-01-01', nota: 'futura' });
    const lista = clientes.interacoesDoCliente(db, cli);
    expect(lista.every((i) => i.id_cliente === cli)).toBe(true);
    expect(lista.map((i) => i.data)).toEqual([...lista.map((i) => i.data)].sort().reverse());
    expect(lista[0]!.id_interacao).toBe('CRM-T2');
    expect(clientes.produtosDoCliente(db, cli).every((p) => p.id_cliente === cli)).toBe(true);
    expect(clientes.produtosDoCliente(db, 'CLI-9999')).toEqual([]);
    expect(meioDia('2026-01-01')).toBeInstanceOf(Date);
  });
});
