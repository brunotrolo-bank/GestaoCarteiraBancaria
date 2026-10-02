import { describe, expect, it } from 'vitest';
import {
  acesso, clientes, clonarDb, delegacao, DomainError, FixedClock, meioDia, posicoes, proximoId, SystemClock, mascararDocumento, documentoValido, cnpjValido,
  gerarCnpj, addDays, isISODate, noIntervalo, intervalosSobrepostos, diaDe,
} from '@carteira/core';
import { cenario, em, esperaErro, GG, ger } from './helpers.ts';

describe('bordas e validações (completa a pirâmide dos domínios)', () => {
  it('relógios: SystemClock devolve o agora; FixedClock pode ser redefinido', () => {
    const antes = Date.now();
    expect(new SystemClock().agora().getTime()).toBeGreaterThanOrEqual(antes);
    const c = new FixedClock(meioDia('2026-01-01'));
    c.definir(meioDia('2026-02-02'));
    expect(diaDe(c.agora())).toBe('2026-02-02');
  });

  it('datas: validação ISO estrita, soma de dias, intervalos abertos e sobrepostos', () => {
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('2026-02-28')).toBe(true);
    expect(isISODate(20260228)).toBe(false);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(noIntervalo('2030-01-01', '2026-01-01', null)).toBe(true);
    expect(noIntervalo('2025-12-31', '2026-01-01', null)).toBe(false);
    expect(intervalosSobrepostos({ inicio: '2026-01-01', fim: '2026-01-10' }, { inicio: '2026-01-10', fim: null })).toBe(true); // toca no último dia
    expect(intervalosSobrepostos({ inicio: '2026-01-01', fim: '2026-01-09' }, { inicio: '2026-01-10', fim: null })).toBe(false);
  });

  it('documentos: máscara de documento inválido, CNPJ gerado é válido, tamanho incorreto reprova', () => {
    expect(mascararDocumento('123')).toBe('***');
    expect(documentoValido('1234567890')).toBe(false);
    expect(cnpjValido(gerarCnpj('999990010001'))).toBe(true);
    expect(cnpjValido('00000000000000')).toBe(false);
    expect(cnpjValido('11222333000100')).toBe(false);
  });

  it('banco: clonagem independente e próximo identificador sequencial', () => {
    const { db } = cenario();
    const copia = clonarDb(db);
    copia.dim_clientes[0]!.volume_aum = -1;
    expect(db.dim_clientes[0]!.volume_aum).not.toBe(-1);
    expect(proximoId('X', ['X-0009', 'Y-0100', 'X-0002'])).toBe('X-0010');
    expect(proximoId('Z', [])).toBe('Z-0001');
  });

  it('posições: validações de cadastro e transições Ativa ↔ Congelada', () => {
    const { db, clock } = cenario();
    const ok = { nome_posicao: 'Mesa X', id_agencia: 'AG01', segmento_especialidade: 'Misto' as const, capacidade_max_contas: 5 };
    esperaErro(() => posicoes.criarPosicao(db, clock, { ...ok, nome_posicao: ' ' }, GG), 'DADOS_INVALIDOS');
    esperaErro(() => posicoes.criarPosicao(db, clock, { ...ok, segmento_especialidade: 'Outro' as never }, GG), 'DADOS_INVALIDOS');
    esperaErro(() => posicoes.criarPosicao(db, clock, { ...ok, capacidade_max_contas: 0 }, GG), 'DADOS_INVALIDOS');
    esperaErro(() => posicoes.criarPosicao(db, clock, { ...ok, id_agencia: 'AG99' }, GG), 'DADOS_INVALIDOS');
    esperaErro(() => posicoes.criarPosicao(db, clock, ok, ger(101)), 'NAO_AUTORIZADO');
    expect(posicoes.alterarStatusPosicao(db, clock, 'POS-AG01-004', 'Congelada', GG).status).toBe('Congelada');
    expect(posicoes.alterarStatusPosicao(db, clock, 'POS-AG01-004', 'Ativa', GG).status).toBe('Ativa');
    esperaErro(() => posicoes.obterGerente(db, 'GER-999'), 'GERENTE_INEXISTENTE');
    esperaErro(() => posicoes.cadastrarGerente(db, clock, { nome_completo: 'A', email_corporativo: 'a@b.co', perfil: 'Outro' as never }, GG), 'DADOS_INVALIDOS');
    esperaErro(() => posicoes.cadastrarGerente(db, clock, { nome_completo: ' ', email_corporativo: 'a@b.co', perfil: 'Gerente de Contas' }, GG), 'DADOS_INVALIDOS');
  });

  it('troca de titular: posição extinta e tipo de vínculo inválido', () => {
    const { db, clock } = cenario();
    const p = posicoes.criarPosicao(db, clock, { nome_posicao: 'Mesa Y', id_agencia: 'AG01', segmento_especialidade: 'Misto', capacidade_max_contas: 5 }, GG);
    posicoes.alterarStatusPosicao(db, clock, p.id_posicao, 'Extinta', GG);
    esperaErro(() => posicoes.trocarTitular(db, clock, { id_posicao: p.id_posicao, id_gerente: 'GER-106', data_inicio: '2026-10-05', tipo_vinculo: 'Interino' }, GG), 'POSICAO_EXTINTA');
    esperaErro(() => posicoes.trocarTitular(db, clock, { id_posicao: 'POS-AG01-003', id_gerente: 'GER-106', data_inicio: '2026-10-05', tipo_vinculo: 'Bolsista' as never }, GG), 'DADOS_INVALIDOS');
    esperaErro(() => posicoes.trocarTitular(db, clock, { id_posicao: 'POS-AG01-003', id_gerente: 'GER-999', data_inicio: '2026-10-05', tipo_vinculo: 'Interino' }, GG), 'GERENTE_INEXISTENTE');
    // posição sem titular vigente recebe titular direto (vacância)
    posicoes.desligarGerente(db, clock, 'GER-103', GG);
    const nova = posicoes.trocarTitular(db, clock, { id_posicao: 'POS-AG01-003', id_gerente: 'GER-106', data_inicio: '2026-10-02', tipo_vinculo: 'Interino' }, GG);
    expect(nova.tipo_vinculo).toBe('Interino');
  });

  it('desligar quem iniciou hoje mantém intervalo válido (fim ≥ início)', () => {
    const { db, clock } = cenario();
    posicoes.trocarTitular(db, clock, { id_posicao: 'POS-AG01-003', id_gerente: 'GER-106', data_inicio: '2026-10-01', tipo_vinculo: 'Titular Efetivo' }, GG);
    posicoes.desligarGerente(db, clock, 'GER-106', GG);
    const o = db.bridge_ocupacao_posicao.find((x) => x.id_gerente === 'GER-106')!;
    expect(o.data_fim! >= o.data_inicio).toBe(true);
  });

  it('delegação: escopo inválido, posição extinta, solicitante inativo e rejeitada não tem efeito', () => {
    const { db, clock } = cenario();
    const base = { id_posicao_origem: 'POS-AG01-001', id_gerente_delegado: 'GER-102', data_inicio: '2026-11-01', data_fim: '2026-11-15', motivo: 'm', escopo: 'Total' as const };
    esperaErro(() => delegacao.submeter(db, clock, { ...base, escopo: 'Qualquer' as never }, GG), 'DADOS_INVALIDOS');
    esperaErro(() => delegacao.submeter(db, clock, base, ger(107)), 'GERENTE_INDISPONIVEL');
    esperaErro(() => delegacao.submeter(db, clock, { ...base, id_posicao_origem: 'POS-XX' }, GG), 'POSICAO_INEXISTENTE');
    const p = posicoes.criarPosicao(db, clock, { nome_posicao: 'Mesa Z', id_agencia: 'AG01', segmento_especialidade: 'Misto', capacidade_max_contas: 5 }, GG);
    posicoes.alterarStatusPosicao(db, clock, p.id_posicao, 'Extinta', GG);
    esperaErro(() => delegacao.submeter(db, clock, { ...base, id_posicao_origem: p.id_posicao }, GG), 'POSICAO_EXTINTA');
    const d = delegacao.submeter(db, clock, base, GG);
    delegacao.rejeitar(db, clock, d.id_delegacao, GG);
    expect(delegacao.situacao(d, em('2026-11-05'))).toBe('Rejeitada');
    esperaErro(() => delegacao.rejeitar(db, clock, d.id_delegacao, ger(101)), 'NAO_AUTORIZADO');
    esperaErro(() => delegacao.revogar(db, clock, d.id_delegacao, ger(999)), 'GERENTE_INEXISTENTE');
  });

  it('acesso: cliente ainda não carteirizado no instante e cliente sem histórico usam a regra correta', () => {
    const { db } = cenario('demo');
    const c = db.dim_clientes[0]!;
    const futuro = db.bridge_vinculo_carteira.find((v) => v.id_cliente === c.id_cliente)!;
    futuro.inicio_em = '2030-01-01T00:00:00.000Z';
    expect(acesso.posicaoDoClienteEm(db, c.id_cliente, em('2026-10-01'))).toBeNull();
    expect(acesso.decidirCliente(db, 'GER-100', c.id_cliente, em('2026-10-01')).permitido).toBe(false);
    db.bridge_vinculo_carteira = db.bridge_vinculo_carteira.filter((v) => v.id_cliente !== c.id_cliente);
    expect(acesso.posicaoDoClienteEm(db, c.id_cliente, em('2026-10-01'))).toBe(c.id_posicao_carteira); // sem histórico: projeção
    expect(acesso.posicaoDoClienteEm(db, 'CLI-9999', em('2026-10-01'))).toBeNull();
  });

  it('clientes: cadastro exige posição ativa; transferência exige ator ativo; revelar exige ator ativo', () => {
    const { db, clock } = cenario();
    posicoes.alterarStatusPosicao(db, clock, 'POS-AG01-004', 'Congelada', GG);
    const novo = { nome_razao_social: 'N', cpf_cnpj: '99900011122'.slice(0, 9) + '00', segmento_cliente: 'Varejo' as const, faixa_renda_faturamento: 0, volume_aum: 0, score_risco: 10, id_posicao_carteira: 'POS-AG01-004' };
    const doc = clientes.gerarCpf('999111222');
    esperaErro(() => clientes.cadastrarCliente(db, clock, { ...novo, cpf_cnpj: doc }, GG), 'POSICAO_DESTINO_INDISPONIVEL');
    esperaErro(() => clientes.transferirCliente(db, clock, { id_cliente: 'CLI-0001', id_posicao_destino: 'POS-AG01-002', motivo: 'x' }, ger(107)), 'NAO_AUTORIZADO');
    esperaErro(() => clientes.revelarDocumento(db, clock, 'CLI-0001', ger(107)), 'NAO_AUTORIZADO');
    esperaErro(() => clientes.revelarDocumento(db, clock, 'CLI-9999', GG), 'CLIENTE_INEXISTENTE');
  });
});
