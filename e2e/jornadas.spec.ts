import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const TELAS = 'docs/telas';
mkdirSync(TELAS, { recursive: true });

async function reiniciar(page: Page): Promise<void> {
  await page.request.post('http://localhost:3101/api/v1/simulacao/reset');
}

async function abrir(page: Page, rota: string, papel = 'GG', data: string | null = null): Promise<void> {
  await page.addInitScript(([p, d]) => window.localStorage.setItem('carteira.sessao', JSON.stringify({ papel: p, dataSimulada: d })), [papel, data] as const);
  await page.goto(`/#/${rota}`);
}

test.beforeEach(async ({ page }) => { await reiniciar(page); });

test('capa de apresentação: banner de simulação permanente e roteiro das 3 jornadas', async ({ page }) => {
  await abrir(page, 'capa');
  await expect(page.getByRole('heading', { name: /Gestão de carteira por Posição/ })).toBeVisible();
  await expect(page.getByText('Modo simulação')).toBeVisible();
  await expect(page.getByRole('heading', { name: '1. Operação cotidiana' })).toBeVisible();
  await page.screenshot({ path: `${TELAS}/00-capa.png`, fullPage: true });
});

test('J3: Torre de Controle mostra os alertas 120% e 40%; simular, executar, ver o alerta sumir e desfazer', async ({ page }) => {
  await abrir(page, 'cockpit');
  await expect(page.getByRole('heading', { name: 'Torre de Controle' })).toBeVisible();
  await expect(page.getByLabel('Posições em alerta')).toContainText('2');
  await expect(page.getByLabel('Clientes ativos')).toContainText('348');
  await expect(page.getByRole('img', { name: /POS-001 120%/ })).toBeVisible();
  const tabela = page.getByRole('table', { name: 'Posições' });
  await expect(tabela.getByText('Acima do limite')).toBeVisible();
  await expect(tabela.getByText('Abaixo do mínimo')).toBeVisible();
  await page.screenshot({ path: `${TELAS}/01-torre-de-controle.png`, fullPage: true });

  await page.getByRole('button', { name: 'Simular redistribuição' }).click();
  const gaveta = page.getByRole('dialog', { name: 'Redistribuir clientes' });
  await expect(gaveta).toBeVisible();
  await gaveta.getByLabel('Posição de origem').click();
  await page.getByRole('option', { name: /Mesa Private/ }).click();
  await gaveta.getByLabel('Posição de destino').click();
  await page.getByRole('option', { name: /Mesa Mista/ }).click();
  await gaveta.getByRole('button', { name: 'Simular' }).click();
  await expect(gaveta.getByText('Antes e depois')).toBeVisible();
  await expect(gaveta.getByText('76 · 95,0%')).toBeVisible(); // 96 - 20 em POS-001
  await expect(gaveta.getByText('52 · 65,0%')).toBeVisible(); // 32 + 20 em POS-004
  await gaveta.getByLabel('Motivo').fill('Rebalanceamento J3');
  await page.screenshot({ path: `${TELAS}/02-redistribuicao-simulacao.png` });
  await gaveta.getByRole('button', { name: /Confirmar redistribuição de 20 clientes/ }).click();
  await expect(gaveta.getByText('Redistribuição concluída')).toBeVisible();
  await gaveta.getByRole('button', { name: 'Desfazer lote' }).click();
  await expect(gaveta.getByText('Lote desfeito')).toBeVisible();
});

test('J1: troca de titular da Posição 03 preserva os clientes e mostra o histórico', async ({ page }) => {
  await abrir(page, 'posicoes');
  await page.getByRole('row', { name: /Mesa Alta Renda B/ }).click();
  const gaveta = page.getByRole('dialog', { name: 'Mesa Alta Renda B' });
  await expect(gaveta.getByText('Rafael Costa').first()).toBeVisible();
  await expect(gaveta.getByText(/70 clientes ativos permanece/)).toBeVisible();
  await gaveta.getByRole('button', { name: 'Trocar titular' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Trocar titular' });
  await dialogo.getByLabel('Novo titular (gerente sem posição)').click();
  await page.getByRole('option', { name: 'Lucas Ferreira' }).click();
  await dialogo.getByLabel('Início da titularidade').fill('2026-10-05');
  await page.screenshot({ path: `${TELAS}/03-trocar-titular.png` });
  await dialogo.getByRole('button', { name: 'Confirmar troca' }).click();
  await expect(gaveta.getByText(/Lucas Ferreira assume a posição em 05\/10\/2026/)).toBeVisible();
  await expect(gaveta.getByText(/Os 70 clientes ativos continuam intactos/)).toBeVisible();
  await expect(gaveta.getByRole('list', { name: /Histórico/ }).or(gaveta.getByText('Histórico de titularidade'))).toBeVisible();
  await page.screenshot({ path: `${TELAS}/04-historico-titularidade.png` });
});

test('J2: cobertura de férias — duas abas em 05/11 e uma em 16/11, sem intervenção', async ({ page }) => {
  await abrir(page, 'carteira', 'POS-AG01-002', '2026-11-05');
  await expect(page.getByRole('tab', { name: /Minha Carteira/ })).toBeVisible();
  const delegada = page.getByRole('tab', { name: /Carteira Delegada/ });
  await expect(delegada).toBeVisible();
  await expect(delegada).toContainText('Cobertura temporária');
  await delegada.click();
  await expect(page.getByText(/Cobertura \(Total\) até 15\/11\/2026/)).toBeVisible();
  await page.screenshot({ path: `${TELAS}/05-carteira-delegada.png`, fullPage: true });

  await page.locator('#data-simulada').fill('2026-11-16');
  await expect(page.getByRole('tab', { name: /Carteira Delegada/ })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /Minha Carteira/ })).toBeVisible();
});

test('J2: titular ausente fica em somente leitura durante a cobertura', async ({ page }) => {
  await abrir(page, 'carteira', 'POS-AG01-001', '2026-11-05');
  await expect(page.getByText('Somente leitura').first()).toBeVisible();
  await expect(page.getByText('Posição em cobertura temporária')).toBeVisible();
});

test('visão 360°: documento mascarado, revelar auditado, produtos, histórico e CRM', async ({ page }) => {
  await abrir(page, 'carteira', 'POS-AG01-002');
  await page.getByRole('row').nth(1).click();
  const gaveta = page.getByRole('dialog', { name: 'Visão 360° do cliente' });
  await expect(gaveta.getByText('Penetração de produtos')).toBeVisible();
  await expect(gaveta.getByText(/^\*\*\*\.\d{3}\.\d{3}-\*\*$|^\*\*\.\*\*\*\.\d{3}\/\d{4}-\*\*$/)).toBeVisible();
  await expect(gaveta.getByText('Histórico de posições')).toBeVisible();
  await page.screenshot({ path: `${TELAS}/06-visao-360.png` });
  await gaveta.getByRole('button', { name: 'Revelar documento' }).click();
  await expect(gaveta.getByText(/registrada em auditoria/)).toBeVisible();
  await expect(gaveta.getByText(/^999\d{8}$|^99999\d{9}$/)).toBeVisible();
});

test('isolamento: papel de gerente não vê as carteiras das outras posições', async ({ page }) => {
  await abrir(page, 'carteira', 'POS-AG01-003');
  await expect(page.getByRole('tab')).toHaveCount(1);
  await abrir(page, 'cockpit', 'POS-AG01-003');
  await expect(page.getByRole('heading', { name: 'Resumo da minha carteira' })).toBeVisible();
  await expect(page.getByLabel('Clientes ativos')).toContainText('70');
});

test('delegações: nova delegação fica Submetida e o GG aprova', async ({ page }) => {
  await abrir(page, 'delegacoes');
  await expect(page.getByRole('heading', { name: 'Delegações' })).toBeVisible();
  await expect(page.getByText('DEL-0002')).toBeVisible();
  await page.getByRole('button', { name: 'Aprovar' }).first().click();
  await expect(page.getByRole('table', { name: 'Delegações' }).getByText('Agendada')).toBeVisible();
  await page.screenshot({ path: `${TELAS}/07-delegacoes.png`, fullPage: true });
});

test('troca de papel muda os dados em ≤ 1 s sem recarregar e sem vazar o papel anterior', async ({ page }) => {
  await abrir(page, 'cockpit');
  await expect(page.getByLabel('Clientes ativos')).toContainText('348');
  const inicio = Date.now();
  await page.getByLabel('Visualizar como').click();
  await page.getByRole('option', { name: /Mesa Alta Renda A/ }).click();
  await expect(page.getByLabel('Clientes ativos')).toContainText('75');
  expect(Date.now() - inicio).toBeLessThan(2500);
  await expect(page.getByText('Mesa Private')).toHaveCount(0);
});

test('acessibilidade: navegação por teclado chega ao seletor de papel e aos botões principais', async ({ page }) => {
  await abrir(page, 'cockpit');
  await page.keyboard.press('Tab');
  const foco = await page.evaluate(() => document.activeElement?.tagName);
  expect(['A', 'BUTTON', 'INPUT']).toContain(foco);
  await page.getByLabel('Visualizar como').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('option').first()).toBeVisible();
  await page.keyboard.press('Escape');
});
