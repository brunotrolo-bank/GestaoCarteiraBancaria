import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { FixedClock, meioDia } from '@carteira/core';
import { criarApp, ROTAS_PUBLICADAS } from '../src/app.ts';
import { MemoriaStore } from '../src/store.ts';

const BASE = 'http://api.local/api/v1';

function novoApp(opcoes: { simulacao?: boolean; cenario?: 'demo' | 'minimo'; dia?: string } = {}) {
  const store = new MemoriaStore(opcoes.cenario ?? 'demo', new FixedClock(meioDia(opcoes.dia ?? '2026-10-01')));
  const logs: Record<string, unknown>[] = [];
  const app = criarApp({ store, simulacaoPapel: opcoes.simulacao ?? true, log: (l) => logs.push(l) });
  const chamar = async (metodo: string, caminho: string, init: { papel?: string; data?: string; corpo?: unknown; chave?: string } = {}) => {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (init.papel) headers['x-papel-simulado'] = init.papel;
    if (init.data) headers['x-data-simulada'] = init.data;
    if (init.chave) headers['idempotency-key'] = init.chave;
    const resp = await app.fetch(new Request(`${BASE}${caminho}`, { method: metodo, headers, body: init.corpo === undefined ? undefined : JSON.stringify(init.corpo) }));
    const texto = await resp.text();
    return { status: resp.status, headers: resp.headers, corpo: texto ? JSON.parse(texto) : null, texto };
  };
  return { store, logs, chamar };
}

const GG = 'GG';
const POS = (n: number): string => `POS-AG01-00${n}`;

describe('07 API REST', () => {
  it('contrato: todas as rotas implementadas existem no OpenAPI e vice-versa (contract-first)', () => {
    const doc = parse(readFileSync(new URL('../../../contracts/openapi.yaml', import.meta.url), 'utf8')) as { paths: Record<string, Record<string, unknown>> };
    const docRotas = Object.entries(doc.paths).flatMap(([p, ops]) => Object.keys(ops).filter((m) => ['get', 'post'].includes(m)).map((m) => `${m.toUpperCase()} ${p}`));
    expect([...docRotas].sort()).toEqual([...ROTAS_PUBLICADAS].sort());
  });

  it('contrato: o OpenAPI passa no lint do Spectral sem erros', () => {
    const saida = execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['spectral', 'lint', 'contracts/openapi.yaml', '--fail-severity=error'], { encoding: 'utf8', shell: process.platform === 'win32', cwd: new URL('../../../', import.meta.url) });
    expect(saida).not.toMatch(/\berror\b\s+\S+\s+\S/);
  });

  it('AC-API-01: sem papel → 401; com papel desconhecido → 403; e-mail na URL é ignorado', async () => {
    const { chamar } = novoApp();
    expect((await chamar('GET', '/posicoes')).status).toBe(401);
    const r = await chamar('GET', '/posicoes', { papel: 'POS-INEXISTENTE' });
    expect(r.status).toBe(403);
    expect(r.corpo.codigo_dominio).toBe('ATOR_DESCONHECIDO');
    // `user_email` não influencia o ator: o papel simulado continua mandando
    const x = await chamar('GET', '/posicoes?user_email=helena.duarte@banco-poc.example&role_override=all', { papel: POS(2) });
    expect(x.corpo.itens.map((p: { id_posicao: string }) => p.id_posicao)).toEqual([POS(2)]);
  });

  it('com a flag de simulação desligada nenhum papel é aceito (não há autenticação real ainda)', async () => {
    const { chamar } = novoApp({ simulacao: false });
    const r = await chamar('GET', '/posicoes', { papel: GG });
    expect(r.status).toBe(401);
    expect(r.headers.get('x-modo-simulacao')).toBeNull();
    expect((await chamar('GET', '/saude')).status).toBe(200);
  });

  it('modo simulação marca todas as respostas e devolve a lista de papéis na data simulada', async () => {
    const { chamar } = novoApp();
    const r = await chamar('GET', '/simulacao/atores', { data: '2026-11-05' });
    expect(r.headers.get('x-modo-simulacao')).toBe('true');
    expect(r.corpo.atores).toHaveLength(6);
    expect(r.corpo.atores[0]).toMatchObject({ papel: 'GG' });
    expect(r.corpo.data_simulada).toBe('2026-11-05');
  });

  it('AC-API-03: erro de domínio vem como problem+json com codigo_dominio estável e correlation_id', async () => {
    const { chamar } = novoApp();
    const r = await chamar('POST', `/posicoes/${POS(2)}/titular`, { papel: GG, corpo: { id_gerente: 'GER-101', data_inicio: '2026-10-05', tipo_vinculo: 'Titular Efetivo' } });
    expect(r.status).toBe(409);
    expect(r.headers.get('content-type')).toContain('application/problem+json');
    expect(r.corpo).toMatchObject({ codigo_dominio: 'GERENTE_JA_ALOCADO', status: 409 });
    expect(r.corpo.correlation_id).toBeTruthy();
    const invalido = await chamar('POST', `/posicoes/${POS(2)}/titular`, { papel: GG, corpo: { data_inicio: 'ontem' } });
    expect(invalido.status).toBe(422);
    expect(invalido.corpo.codigo_dominio).toBe('DADOS_INVALIDOS');
    expect((await chamar('GET', '/nao-existe', { papel: GG })).status).toBe(404);
    expect((await chamar('POST', '/posicoes', { papel: GG })).status).toBe(405);
  });

  it('J1: troca de titular pela API não altera a carteira; novo titular passa a ser o ator da posição', async () => {
    const { chamar, store } = novoApp();
    const antes = JSON.stringify(store.db.dim_clientes);
    const r = await chamar('POST', `/posicoes/${POS(3)}/titular`, { papel: GG, corpo: { id_gerente: 'GER-106', data_inicio: '2026-10-05', tipo_vinculo: 'Titular Efetivo' } });
    expect(r.status).toBe(201);
    expect(JSON.stringify(store.db.dim_clientes)).toBe(antes);
    const t = await chamar('GET', `/posicoes/${POS(3)}/titular`, { papel: GG, data: '2026-10-06' });
    expect(t.corpo.gerente.id_gerente).toBe('GER-106');
    const hist = await chamar('GET', `/posicoes/${POS(3)}/historico`, { papel: GG });
    expect(hist.corpo.itens).toHaveLength(2);
    const novo = await chamar('GET', '/carteira/clientes?limit=5', { papel: POS(3), data: '2026-10-06' });
    expect(novo.corpo.total).toBeGreaterThan(60);
    // titular só pode trocar se for GG
    expect((await chamar('POST', `/posicoes/${POS(3)}/titular`, { papel: POS(3), data: '2026-10-06', corpo: { id_gerente: 'GER-103', data_inicio: '2026-10-07', tipo_vinculo: 'Interino' } })).status).toBe(403);
  });

  it('J2: cobertura de férias — delegado vê duas seções em 05/11 e uma em 16/11, sem intervenção', async () => {
    const { chamar } = novoApp();
    const dentro = await chamar('GET', '/carteira/minha', { papel: POS(2), data: '2026-11-05' });
    expect(dentro.corpo.secoes.map((s: { tipo: string }) => s.tipo)).toEqual(['Propria', 'Delegada']);
    expect(dentro.corpo.secoes[1].cobertura).toMatchObject({ id_delegacao: 'DEL-0001', situacao: 'Em Vigor' });
    const fora = await chamar('GET', '/carteira/minha', { papel: POS(2), data: '2026-11-16' });
    expect(fora.corpo.secoes.map((s: { tipo: string }) => s.tipo)).toEqual(['Propria']);
    // titular ausente fica em leitura e a escrita é negada
    const ausente = await chamar('POST', '/clientes/CLI-0001/transferencia', { papel: POS(1), data: '2026-11-05', corpo: { id_posicao_destino: POS(4), motivo: 'x' } });
    expect(ausente.status).toBe(403);
  });

  it('J2 pela API: submeter, aprovar, revogar e derivar a situação', async () => {
    const { chamar } = novoApp({ dia: '2026-10-01' });
    const novo = await chamar('POST', '/delegacoes', { papel: POS(4), corpo: { id_posicao_origem: POS(4), id_gerente_delegado: 'GER-105', data_inicio: '2026-12-01', data_fim: '2026-12-05', motivo: 'Treinamento', escopo: 'Apenas Consulta' } });
    expect(novo.status).toBe(201);
    expect(novo.corpo.situacao).toBe('Submetida');
    const id = novo.corpo.id_delegacao as string;
    expect((await chamar('POST', `/delegacoes/${id}/aprovacao`, { papel: POS(4) })).status).toBe(403); // só GG aprova
    const ok = await chamar('POST', `/delegacoes/${id}/aprovacao`, { papel: GG });
    expect(ok.corpo.situacao).toBe('Agendada');
    const durante = await chamar('GET', '/delegacoes', { papel: POS(5), data: '2026-12-03' });
    expect(durante.corpo.itens.find((d: { id_delegacao: string }) => d.id_delegacao === id).situacao).toBe('Em Vigor');
    const rev = await chamar('POST', `/delegacoes/${id}/revogacao`, { papel: POS(4) });
    expect(rev.corpo.situacao).toBe('Revogada');
    expect((await chamar('POST', `/delegacoes/${id}/revogacao`, { papel: GG })).status).toBe(409);
    const sobreposta = await chamar('POST', '/delegacoes', { papel: GG, corpo: { id_posicao_origem: POS(1), id_gerente_delegado: 'GER-103', data_inicio: '2026-11-10', data_fim: '2026-11-20', motivo: 'x', escopo: 'Total' } });
    expect(sobreposta.corpo.codigo_dominio).toBe('DELEGACAO_SOBREPOSTA');
  });

  it('AC-API-04/INS-03: isolamento — gerente não vê clientes nem 360° de outra posição', async () => {
    const { chamar, store } = novoApp();
    const alheio = store.db.dim_clientes.find((c) => c.id_posicao_carteira === POS(3))!.id_cliente;
    expect((await chamar('GET', `/clientes/${alheio}/visao-360`, { papel: POS(2) })).status).toBe(403);
    const lista = await chamar('GET', '/carteira/clientes?limit=200', { papel: POS(2) });
    expect(lista.corpo.itens.every((c: { id_posicao: string }) => c.id_posicao === POS(2))).toBe(true);
    const gg = await chamar('GET', '/carteira/clientes?limit=1', { papel: GG });
    expect(gg.corpo.total).toBe(store.db.dim_clientes.length);
    const ex = await chamar('GET', `/acesso/explicacao?cliente=${alheio}`, { papel: POS(2) });
    expect(ex.corpo).toMatchObject({ permitido: false, modo: 'Negado' });
  });

  it('PII: documentos nunca saem em claro; só "revelar" (titular/GG) e fica auditado', async () => {
    const { chamar, store, logs } = novoApp();
    const proprio = store.db.dim_clientes.find((c) => c.id_posicao_carteira === POS(2))!;
    const lista = await chamar('GET', '/carteira/clientes?limit=200', { papel: GG });
    expect(lista.texto).not.toContain(proprio.cpf_cnpj);
    expect(lista.corpo.itens[0]).not.toHaveProperty('cpf_cnpj');
    expect((await chamar('GET', `/clientes/${proprio.id_cliente}/visao-360`, { papel: POS(2) })).texto).not.toContain(proprio.cpf_cnpj);
    expect((await chamar('POST', `/clientes/${proprio.id_cliente}/documento:revelar`, { papel: POS(3) })).status).toBe(403);
    const r = await chamar('POST', `/clientes/${proprio.id_cliente}/documento:revelar`, { papel: POS(2) });
    expect(r.corpo.cpf_cnpj).toBe(proprio.cpf_cnpj);
    expect(store.db.log_auditoria.at(-1)!.acao).toBe('DOCUMENTO_REVELADO');
    expect(JSON.stringify(logs)).not.toContain(proprio.cpf_cnpj);
    expect(JSON.stringify(store.db.log_auditoria)).not.toContain(proprio.cpf_cnpj);
  });

  it('J3: simular → executar → desfazer, com idempotência e justificativa de capacidade', async () => {
    const { chamar, store } = novoApp();
    const ids = store.db.dim_clientes.filter((c) => c.id_posicao_carteira === POS(1) && c.status === 'Ativo').slice(0, 20).map((c) => c.id_cliente);
    const hashAntes = JSON.stringify(store.db.dim_clientes);
    const sim = await chamar('POST', '/carteira/redistribuicoes:simular', { papel: GG, corpo: { ids_clientes: ids, id_posicao_destino: POS(4) } });
    expect(sim.corpo.depois.find((u: { id_posicao: string }) => u.id_posicao === POS(4)).clientes_ativos).toBe(52);
    expect(JSON.stringify(store.db.dim_clientes)).toBe(hashAntes);
    expect((await chamar('POST', '/carteira/redistribuicoes:simular', { papel: POS(1), corpo: { ids_clientes: ids, id_posicao_destino: POS(4) } })).status).toBe(403);

    const corpo = { ids_clientes: ids, id_posicao_destino: POS(4), motivo: 'Rebalanceamento J3' };
    const a = await chamar('POST', '/carteira/redistribuicoes', { papel: GG, corpo, chave: 'LOTE-API-1' });
    expect(a.status).toBe(201);
    expect(a.corpo.movimentacoes).toHaveLength(20);
    const b = await chamar('POST', '/carteira/redistribuicoes', { papel: GG, corpo, chave: 'LOTE-API-1' });
    expect(b.corpo.repetido).toBe(true);
    expect(store.db.fct_movimentacao_carteira).toHaveLength(20);
    const alerta = await chamar('GET', '/insights/desbalanceamento', { papel: GG });
    expect(alerta.corpo.itens.map((i: { id_posicao: string }) => i.id_posicao)).toEqual([]); // 76/80 e 52/80 já dentro dos limites

    const desfeito = await chamar('POST', '/carteira/redistribuicoes/LOTE-API-1:desfazer', { papel: GG });
    expect(desfeito.status).toBe(200);
    const volta = await chamar('GET', '/insights/desbalanceamento', { papel: GG });
    expect(volta.corpo.itens).toHaveLength(2);
    expect((await chamar('POST', '/carteira/redistribuicoes/LOTE-API-1:desfazer', { papel: GG })).corpo.codigo_dominio).toBe('LOTE_JA_DESFEITO');
    const excedida = await chamar('POST', '/carteira/redistribuicoes', { papel: GG, corpo: { ids_clientes: store.db.dim_clientes.filter((c) => c.id_posicao_carteira === POS(2) && c.status === 'Ativo').slice(0, 10).map((c) => c.id_cliente), id_posicao_destino: POS(5), motivo: 'x' } });
    expect(excedida.corpo.codigo_dominio).toBe('JUSTIFICATIVA_OBRIGATORIA');
  });

  it('Torre de Controle: GG vê a agência inteira; gerente comum só a própria carteira; paginação por cursor', async () => {
    const { chamar } = novoApp();
    const gg = await chamar('GET', '/insights/agencia', { papel: GG });
    expect(gg.corpo).toMatchObject({ escopo: 'Agencia', total_clientes: 348, posicoes_em_alerta: 2 });
    const g = await chamar('GET', '/insights/agencia', { papel: POS(2) });
    expect(g.corpo).toMatchObject({ escopo: 'Carteira', total_clientes: 75 });
    expect((await chamar('GET', `/insights/posicoes/${POS(3)}`, { papel: POS(2) })).status).toBe(403);
    const p1 = await chamar('GET', '/carteira/clientes?limit=100', { papel: GG });
    expect(p1.corpo.itens).toHaveLength(100);
    const p2 = await chamar('GET', `/carteira/clientes?limit=100&cursor=${p1.corpo.proximo_cursor}`, { papel: GG });
    expect(p2.corpo.itens[0].id_cliente).not.toBe(p1.corpo.itens[0].id_cliente);
    const filtro = await chamar('GET', '/carteira/clientes?segmento=UHNW&status=Ativo&limit=200', { papel: GG });
    expect(filtro.corpo.itens.every((c: { segmento_cliente: string }) => c.segmento_cliente === 'UHNW')).toBe(true);
  });

  it('logs estruturados não carregam PII nem corpo; X-Correlation-Id é propagado', async () => {
    const { chamar, logs } = novoApp();
    await chamar('GET', '/carteira/clientes?q=silva', { papel: GG });
    const ultimo = logs.at(-1)!;
    expect(Object.keys(ultimo).sort()).toEqual(['ator', 'correlation_id', 'metodo', 'ms', 'nivel', 'rota', 'status']);
    expect(JSON.stringify(ultimo)).not.toContain('silva');
    const resp = await novoApp().chamar('GET', '/saude');
    expect(resp.headers.get('x-correlation-id')).toBeTruthy();
  });

  it('simulação: data inválida é rejeitada; reset restaura o cenário', async () => {
    const { chamar, store } = novoApp();
    expect((await chamar('GET', '/posicoes', { papel: GG, data: '2026-13-45' })).status).toBe(422);
    await chamar('POST', `/posicoes/${POS(3)}/titular`, { papel: GG, corpo: { id_gerente: 'GER-106', data_inicio: '2026-10-05', tipo_vinculo: 'Titular Efetivo' } });
    expect(store.db.bridge_ocupacao_posicao).toHaveLength(7);
    expect((await chamar('POST', '/simulacao/reset')).status).toBe(200);
    expect(store.db.bridge_ocupacao_posicao).toHaveLength(6);
  });
});
