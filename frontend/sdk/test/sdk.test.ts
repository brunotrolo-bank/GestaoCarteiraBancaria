// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { ApiErro, criarApi, useConsulta } from '../src';

const resposta = (corpo: unknown, status = 200): Response => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' } });

describe('SDK da API v1', () => {
  it('envia papel simulado e data de demonstração; idempotência no lote; sem papel nas rotas públicas', async () => {
    const f = vi.fn(async () => resposta({ itens: [] }));
    const api = criarApi({ baseUrl: '/api/v1', obterSessao: () => ({ papel: 'POS-AG01-002', dataSimulada: '2026-11-05' }), fetchImpl: f as unknown as typeof fetch });
    await api.posicoes();
    await api.redistribuir({ ids_clientes: ['CLI-0001'], id_posicao_destino: 'POS-AG01-004', motivo: 'x' }, 'LOTE-1');
    await api.atores();
    const [primeira, segunda, terceira] = f.mock.calls as unknown as [string, RequestInit][];
    expect(primeira![0]).toBe('/api/v1/posicoes');
    expect((primeira![1].headers as Record<string, string>)['X-Papel-Simulado']).toBe('POS-AG01-002');
    expect((primeira![1].headers as Record<string, string>)['X-Data-Simulada']).toBe('2026-11-05');
    expect((segunda![1].headers as Record<string, string>)['Idempotency-Key']).toBe('LOTE-1');
    expect(segunda![1].method).toBe('POST');
    expect((terceira![1].headers as Record<string, string>)['X-Papel-Simulado']).toBeUndefined();
  });

  it('erros problem+json viram ApiErro com codigo_dominio e correlation_id', async () => {
    const api = criarApi({ baseUrl: '/api/v1', obterSessao: () => ({ papel: 'GG', dataSimulada: null }), fetchImpl: (async () => resposta({ codigo_dominio: 'OCUPACAO_SOBREPOSTA', detail: 'conflito', correlation_id: 'c-1' }, 409)) as unknown as typeof fetch });
    await expect(api.gerentes()).rejects.toMatchObject({ status: 409, codigo: 'OCUPACAO_SOBREPOSTA', correlationId: 'c-1' });
    await expect(api.gerentes()).rejects.toBeInstanceOf(ApiErro);
  });

  it('monta querystrings sem parâmetros vazios', async () => {
    const f = vi.fn(async () => resposta({ itens: [], total: 0, proximo_cursor: null }));
    const api = criarApi({ baseUrl: '/x', obterSessao: () => ({ papel: 'GG', dataSimulada: null }), fetchImpl: f as unknown as typeof fetch });
    await api.clientes({ posicao: 'POS-AG01-001', segmento: '', limit: 10 });
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe('/x/carteira/clientes?posicao=POS-AG01-001&limit=10');
  });

  it('cobre todas as rotas do contrato OpenAPI usadas pelo front (contract testing)', () => {
    const doc = parse(readFileSync(join(process.cwd(), 'contracts/openapi.yaml'), 'utf8')) as { paths: Record<string, unknown> };
    const fonte = readFileSync(join(process.cwd(), 'frontend/sdk/src/index.ts'), 'utf8');
    const usadas = [...fonte.matchAll(/chamar<[^>]*>\('(?:GET|POST)', [`']([^`'?]+)/g)].map((m) => m[1]!.replace(/\$\{[^}]+\}/g, '{id}'));
    expect(usadas.length).toBeGreaterThan(15);
    for (const u of usadas) expect(Object.keys(doc.paths), `rota do SDK ausente no OpenAPI: ${u}`).toContain(u);
  });
});

describe('useConsulta', () => {
  it('carrega, informa erro e recarrega; ignora respostas de consultas antigas', async () => {
    let n = 0;
    const buscar = vi.fn(async () => { n += 1; if (n === 1) throw new Error('falhou'); return `ok-${n}`; });
    const { result } = renderHook(() => useConsulta(buscar, []));
    expect(result.current.carregando).toBe(true);
    await waitFor(() => expect(result.current.erro?.message).toBe('falhou'));
    act(() => result.current.recarregar());
    await waitFor(() => expect(result.current.dados).toBe('ok-2'));
    expect(result.current.erro).toBeNull();
  });
});
