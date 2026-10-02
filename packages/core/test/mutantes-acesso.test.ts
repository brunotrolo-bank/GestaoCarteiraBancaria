import { describe, expect, it } from 'vitest';
import { acesso, type Db, type Delegacao } from '@carteira/core';
import { capturaErro, cenario, em } from './helpers.ts';

const deleg = (id: string, origem: string, delegado: string, escopo: Delegacao['escopo'], inicio = '2026-11-01', fim = '2026-11-15'): Delegacao => ({
  id_delegacao: id, id_posicao_origem: origem, id_gerente_delegado: delegado, data_inicio: inicio, data_fim: fim, motivo: 't', escopo, status_aprovacao: 'Aprovada',
  criada_por: 'GER-100', criada_em: '2026-09-01T00:00:00.000Z', decidida_por: null, decidida_em: null, revogada_em: null,
});

/** Testes dirigidos pelos mutantes sobreviventes do núcleo de acesso. */
describe('acesso — estrutura da decisão, fusão de origens, histórico de vínculo e explicações (mutação)', () => {
  it('ator desconhecido ou inativo: estrutura exata e decisão com motivo próprio', () => {
    const { db } = cenario();
    expect(acesso.resolverAcessos(db, 'GER-999', em('2026-10-01'))).toEqual({ ativo: false, geral: false, posicoes: [] });
    expect(acesso.resolverAcessos(db, 'GER-107', em('2026-10-01'))).toEqual({ ativo: false, geral: false, posicoes: [] });
    const d = acesso.decidirPosicao(db, 'GER-107', 'POS-AG01-001', em('2026-10-01'));
    expect(d).toMatchObject({ permitido: false, modo: 'Negado', origens: [] });
    expect(d.motivo).toMatch(/desconhecido ou inativo/);
    const sem = acesso.decidirPosicao(db, 'GER-102', 'POS-AG01-001', em('2026-10-01'));
    expect(sem).toMatchObject({ permitido: false, modo: 'Negado', origens: [] });
    expect(sem.motivo).toMatch(/Sem titularidade nem delegação/);
    const cli = acesso.decidirCliente(db, 'GER-100', 'CLI-9999', em('2026-10-01'));
    expect(cli).toMatchObject({ permitido: false, modo: 'Negado', origens: [] });
    expect(cli.motivo).toMatch(/Cliente inexistente/);
  });

  it('Gerente Geral e titular: origens exatas e explicações por origem', () => {
    const { db } = cenario('demo');
    const gg = acesso.decidirPosicao(db, 'GER-100', 'POS-AG01-001', em('2026-10-01'));
    expect(gg.origens).toEqual([{ origem: 'GerenteGeral' }]);
    expect(gg.motivo).toBe('Gerente Geral: visão consolidada da agência.');
    const titular = acesso.decidirPosicao(db, 'GER-102', 'POS-AG01-002', em('2026-10-01'));
    expect(titular.origens).toEqual([{ origem: 'Titular' }]);
    expect(titular.motivo).toBe('Titular vigente da posição.');
    const ausente = acesso.decidirPosicao(db, 'GER-101', 'POS-AG01-001', em('2026-11-05'));
    expect(ausente.origens).toEqual([{ origem: 'Titular', titular_ausente: true }]);
    expect(ausente.motivo).toBe('Titular com posição sob cobertura vigente: somente leitura.');
    const delegado = acesso.decidirPosicao(db, 'GER-102', 'POS-AG01-001', em('2026-11-05'));
    expect(delegado.origens).toEqual([{ origem: 'Delegado', id_delegacao: 'DEL-0001', escopo: 'Total' }]);
    expect(delegado.motivo).toBe('Delegado (Total) pela delegação DEL-0001.');
  });

  it('várias origens na mesma posição: todas listadas e o modo MAIS permissivo prevalece, em qualquer ordem', () => {
    const { db } = cenario('demo');
    // GER-102 é titular da POS-002 (sob cobertura => Leitura) e também delegado Total dela (dado injetado): vence a escrita.
    db.fct_delegacoes.push(deleg('DEL-A', 'POS-AG01-002', 'GER-102', 'Total'));
    const r = acesso.resolverAcessos(db, 'GER-102', em('2026-11-05')).posicoes.find((p) => p.id_posicao === 'POS-AG01-002')!;
    expect(r.origens.map((o) => o.origem)).toEqual(['Titular', 'Delegado']);
    expect(r.modo).toBe('Escrita');
    expect(acesso.decidirPosicao(db, 'GER-102', 'POS-AG01-002', em('2026-11-05')).motivo).toBe('Titular com posição sob cobertura vigente: somente leitura. Delegado (Total) pela delegação DEL-A.');
    // dois delegados vigentes da mesma posição para o mesmo gerente: Total e depois Consulta mantém Escrita; Consulta e depois Total sobe para Escrita
    const ordem1 = cenario('demo').db;
    ordem1.fct_delegacoes.push(deleg('DEL-B', 'POS-AG01-005', 'GER-103', 'Total'), deleg('DEL-C', 'POS-AG01-005', 'GER-103', 'Apenas Consulta'));
    expect(acesso.resolverAcessos(ordem1, 'GER-103', em('2026-11-05')).posicoes.find((p) => p.id_posicao === 'POS-AG01-005')!.modo).toBe('Escrita');
    const ordem2 = cenario('demo').db;
    ordem2.fct_delegacoes.push(deleg('DEL-D', 'POS-AG01-005', 'GER-103', 'Apenas Consulta'), deleg('DEL-E', 'POS-AG01-005', 'GER-103', 'Total'));
    const r2 = acesso.resolverAcessos(ordem2, 'GER-103', em('2026-11-05')).posicoes.find((p) => p.id_posicao === 'POS-AG01-005')!;
    expect(r2.modo).toBe('Escrita');
    expect(r2.origens).toHaveLength(2);
    const so = cenario('demo').db;
    so.fct_delegacoes.push(deleg('DEL-F', 'POS-AG01-005', 'GER-103', 'Apenas Consulta'), deleg('DEL-G', 'POS-AG01-005', 'GER-103', 'Apenas Emergencial'));
    expect(acesso.resolverAcessos(so, 'GER-103', em('2026-11-05')).posicoes.find((p) => p.id_posicao === 'POS-AG01-005')!.modo).toBe('Leitura');
  });

  const vinculo = (db: Db, id: string, cliente: string, posicao: string, inicio: string, fim: string | null) => db.bridge_vinculo_carteira.push({ id_vinculo: id, id_cliente: cliente, id_posicao: posicao, inicio_em: inicio, fim_em: fim });

  it('posição do cliente no instante: início inclusivo, fim exclusivo e continuidade entre vínculos', () => {
    const { db } = cenario();
    const c = db.dim_clientes[0]!.id_cliente;
    db.bridge_vinculo_carteira = db.bridge_vinculo_carteira.filter((v) => v.id_cliente !== c);
    vinculo(db, 'V1', c, 'POS-AG01-001', '2026-01-01T00:00:00.000Z', '2026-06-01T12:00:00.000Z');
    vinculo(db, 'V2', c, 'POS-AG01-004', '2026-06-01T12:00:00.000Z', null);
    expect(acesso.posicaoDoClienteEm(db, c, new Date('2026-06-01T11:59:59.999Z'))).toBe('POS-AG01-001');
    expect(acesso.posicaoDoClienteEm(db, c, new Date('2026-06-01T12:00:00.000Z'))).toBe('POS-AG01-004'); // fronteira: fim exclusivo, início inclusivo
    expect(acesso.posicaoDoClienteEm(db, c, new Date('2026-01-01T00:00:00.000Z'))).toBe('POS-AG01-001'); // início inclusivo
  });

  it('cliente sem vínculo vigente: futuro ⇒ ainda sem carteira; só passado ⇒ projeção; inexistente ⇒ null', () => {
    const { db } = cenario();
    const [a, b] = [db.dim_clientes[0]!, db.dim_clientes[1]!];
    db.bridge_vinculo_carteira = db.bridge_vinculo_carteira.filter((v) => v.id_cliente !== a.id_cliente && v.id_cliente !== b.id_cliente);
    vinculo(db, 'V1', a.id_cliente, 'POS-AG01-001', '2025-01-01T00:00:00.000Z', '2025-06-01T00:00:00.000Z'); // passado, encerrado
    vinculo(db, 'V2', a.id_cliente, 'POS-AG01-002', '2030-01-01T00:00:00.000Z', null); // futuro
    expect(acesso.posicaoDoClienteEm(db, a.id_cliente, em('2026-10-01'))).toBeNull(); // existe vínculo futuro (some=true, every=false)
    vinculo(db, 'V3', b.id_cliente, 'POS-AG01-001', '2025-01-01T00:00:00.000Z', '2025-06-01T00:00:00.000Z'); // só passado
    expect(acesso.posicaoDoClienteEm(db, b.id_cliente, em('2026-10-01'))).toBe(b.id_posicao_carteira);
    expect(acesso.posicaoDoClienteEm(db, 'CLI-9999', em('2026-10-01'))).toBeNull();
  });

  it('exigirAcessoCliente: erro com detalhe do modo e respeito ao mínimo', () => {
    const { db } = cenario('demo');
    const alheio = db.dim_clientes.find((c) => c.id_posicao_carteira === 'POS-AG01-003')!.id_cliente;
    const e = capturaErro(() => acesso.exigirAcessoCliente(db, 'GER-102', alheio, em('2026-10-01')));
    expect(e).toMatchObject({ codigo: 'ACESSO_NEGADO', detalhe: { modo: 'Negado' } });
    const proprio = db.dim_clientes.find((c) => c.id_posicao_carteira === 'POS-AG01-002')!.id_cliente;
    expect(acesso.exigirAcessoCliente(db, 'GER-102', proprio, em('2026-10-01')).modo).toBe('Escrita');
    expect(acesso.exigirAcessoCliente(db, 'GER-100', proprio, em('2026-10-01'), 'Leitura').modo).toBe('Leitura');
    expect(capturaErro(() => acesso.exigirAcessoCliente(db, 'GER-100', proprio, em('2026-10-01'), 'Escrita')).detalhe).toEqual({ modo: 'Leitura' });
  });
});
