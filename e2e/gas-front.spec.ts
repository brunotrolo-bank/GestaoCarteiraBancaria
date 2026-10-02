import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/**
 * Valida o front COMO O APPS SCRIPT O SERVE: monta o template index.html com os arquivos do projeto (runtime, um HTML por
 * micro-frontend, shell) e substitui `google.script.run.apiChamar` por uma ponte para a API local (mesmo manipulador do backend).
 */
const pasta = 'apps-script';
const incluir = (nome: string): string => readFileSync(`${pasta}/${nome}.html`, 'utf8');
const montar = (): string => readFileSync(`${pasta}/index.html`, 'utf8').replace(/<\?!= incluir\('([^']+)'\) \?>/g, (_m, n: string) => incluir(n));

test('front composto como no Apps Script: runtime + 4 micro-frontends + shell funcionam via google.script.run', async ({ page }) => {
  await page.request.post('http://localhost:3101/api/v1/simulacao/reset');
  await page.route('http://gas.test/', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: montar() }));
  // Ponte Node → API local (sem CORS): faz o papel do servidor do Apps Script
  await page.exposeFunction('__ponteApi', async (req: { metodo: string; caminho: string; consulta: Record<string, string>; headers: Record<string, string>; corpo?: unknown }) => {
    const q = new URLSearchParams(req.consulta).toString();
    const r = await page.request.fetch(`http://localhost:3101${req.caminho}${q ? `?${q}` : ''}`, {
      method: req.metodo, headers: { ...req.headers, 'content-type': 'application/json' }, data: req.corpo === undefined ? undefined : JSON.stringify(req.corpo),
    });
    const texto = await r.text();
    return { status: r.status(), headers: {}, corpo: texto ? JSON.parse(texto) : null };
  });
  await page.addInitScript(() => {
    const ponte = (window as unknown as { __ponteApi: (r: unknown) => Promise<unknown> }).__ponteApi;
    const novo = (ok?: (r: unknown) => void, falha?: (e: unknown) => void) => ({
      withSuccessHandler: (f: (r: unknown) => void) => novo(f, falha),
      withFailureHandler: (f: (e: unknown) => void) => novo(ok, f),
      apiChamar: (req: unknown) => { ponte(req).then((r) => ok?.(r), (e) => falha?.(e)); },
    });
    (window as unknown as { google: unknown }).google = { script: { run: novo() } };
    window.localStorage.setItem('carteira.sessao', JSON.stringify({ papel: 'GG', dataSimulada: null }));
  });
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
  await page.goto('http://gas.test/#/cockpit');
  await expect(page.getByRole('heading', { name: 'Torre de Controle' })).toBeVisible();
  await expect(page.getByLabel('Clientes ativos')).toContainText('348');
  // cada micro-frontend foi carregado de seu próprio arquivo e compõe o shell
  for (const [rota, titulo] of [['posicoes', 'Posições'], ['carteira', 'Carteira'], ['delegacoes', 'Delegações']] as const) {
    await page.goto(`http://gas.test/#/${rota}`);
    await expect(page.getByRole('heading', { name: titulo, exact: true }).first()).toBeVisible();
  }
  await page.goto('http://gas.test/#/carteira');
  await expect(page.getByRole('row').nth(1)).toBeVisible();
  await page.getByRole('row').nth(1).click();
  await expect(page.getByRole('dialog', { name: 'Visão 360° do cliente' })).toBeVisible();
  await page.screenshot({ path: 'docs/telas/gas-composto.png' });
  expect(erros).toEqual([]);
});
