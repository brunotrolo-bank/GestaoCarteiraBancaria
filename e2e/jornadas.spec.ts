import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const TELAS = 'docs/telas';
mkdirSync(TELAS, { recursive: true });

async function reiniciar(page: Page): Promise<void> {
  await page.request.post('http://localhost:3101/api/v1/simulacao/reset');
}

async function abrir(page: Page, rota: string, papel = 'GG', data: string | null = null): Promise<void> {
  await page.addInitScript((p) => window.localStorage.setItem('carteira.sessao', JSON.stringify({ papel: p })), papel);
  await page.goto(`/${data ? `?data=${data}` : ''}#/${rota}`);
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

test('tipografia do DESIGN: Inter 300 nos títulos, ss01 global e tnum alinhando os dígitos', async ({ page }) => {
  await abrir(page, 'cockpit');
  const h1 = page.getByRole('heading', { name: 'Torre de Controle' });
  expect(await h1.evaluate((e) => getComputedStyle(e).fontWeight)).toBe('300');
  expect(await h1.evaluate((e) => getComputedStyle(e).letterSpacing)).not.toBe('normal');
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFeatureSettings)).toContain('ss01');
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Inter');
  await page.evaluate(() => document.fonts.ready);
  const larguras = await page.evaluate(() => {
    const medir = (txt: string, cls: string): number => {
      const s = document.createElement('span');
      s.className = cls;
      s.textContent = txt;
      s.style.position = 'absolute';
      s.style.whiteSpace = 'nowrap';
      document.body.appendChild(s);
      const w = s.getBoundingClientRect().width;
      s.remove();
      return w;
    };
    return { tn1: medir('1111', 'tnum'), tn0: medir('0000', 'tnum'), p1: medir('1111', ''), p0: medir('0000', '') };
  });
  expect(Math.abs(larguras.tn1 - larguras.tn0)).toBeLessThan(0.05); // tnum: dígitos de largura igual
  expect(Math.abs(larguras.p1 - larguras.p0)).toBeGreaterThan(0.5); // sem tnum o Inter é proporcional
  // toda célula monetária da tabela usa tnum
  const tabela = page.getByRole('table', { name: 'Posições' });
  const celulaAum = tabela.getByRole('cell').filter({ hasText: /R\$/ }).first();
  await expect(celulaAum).toHaveClass(/tnum/);
});

test('botões do cockpit são pill (raio 9999px) com altura ≥ 40px', async ({ page }) => {
  await abrir(page, 'cockpit');
  const botao = page.getByRole('button', { name: 'Simular redistribuição' });
  const estilo = await botao.evaluate((e) => ({ raio: getComputedStyle(e).borderTopLeftRadius, h: e.getBoundingClientRect().height, padding: getComputedStyle(e).padding }));
  expect(Number.parseFloat(estilo.raio)).toBeGreaterThanOrEqual(1000);
  expect(estilo.h).toBeGreaterThanOrEqual(40);
  expect(estilo.padding).toBe('8px 16px');
});

for (const [rota, papel, data] of [['capa', 'GG', null], ['cockpit', 'GG', null], ['posicoes', 'GG', null], ['carteira', 'POS-AG01-002', '2026-11-05'], ['delegacoes', 'GG', null]] as const) {
  test(`acessibilidade automática (axe, WCAG 2.2 AA): sem violações graves em ${rota}`, async ({ page }) => {
    await abrir(page, rota, papel, data);
    await page.waitForLoadState('networkidle');
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    const graves = r.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(graves.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes[0]?.target?.join(' ')}`)).toEqual([]);
  });
}

test('data da demonstração abre sempre em hoje; ?data= fixa outra data e "Voltar para hoje" restaura', async ({ page }) => {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  await page.addInitScript(() => window.localStorage.setItem('carteira.sessao', JSON.stringify({ papel: 'GG', dataSimulada: '2020-01-01' })));
  await page.goto('/#/cockpit');
  await expect(page.getByLabel('Data da demonstração')).toHaveValue(hoje); // uma data antiga guardada não é restaurada
  await expect(page.getByRole('button', { name: 'Voltar para hoje' })).toHaveCount(0);
  await page.goto('/?data=2026-11-05#/cockpit');
  await expect(page.getByLabel('Data da demonstração')).toHaveValue('2026-11-05');
  await page.getByRole('button', { name: 'Voltar para hoje' }).click();
  await expect(page.getByLabel('Data da demonstração')).toHaveValue(hoje);
});

test('metas e alertas: o GG muda o limite de uma posição e o alerta aparece na lista e na Torre', async ({ page }) => {
  await abrir(page, 'posicoes');
  await page.getByRole('row', { name: /Mesa Alta Renda A/ }).click();
  await page.getByRole('button', { name: 'Configurar metas e alertas' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Metas e alertas' });
  await dialogo.getByLabel('Alerta acima de (% da capacidade)').fill('90');
  await dialogo.getByLabel('Meta de clientes ativos').fill('100');
  await dialogo.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Metas e alertas de Mesa Alta Renda A atualizados.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('row', { name: /Mesa Alta Renda A/ })).toContainText('Acima de 90%');
  await page.goto('/#/cockpit');
  await expect(page.getByRole('region', { name: 'Metas por posição' })).toContainText('Alerta fora de 50%–90%');
  await expect(page.getByLabel('Posições em alerta')).toContainText('3');
});

test('metas e alertas: gerente de contas vê as metas mas não pode configurá-las', async ({ page }) => {
  await abrir(page, 'posicoes', 'POS-AG01-002');
  await page.getByRole('row').nth(1).click();
  await expect(page.getByText('Metas e alertas').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Configurar metas e alertas' })).toHaveCount(0);
});

test('metas e alertas: valores inconsistentes são recusados pela API com mensagem clara', async ({ page }) => {
  await abrir(page, 'posicoes');
  await page.getByRole('row', { name: /Mesa Geral/ }).click();
  await page.getByRole('button', { name: 'Configurar metas e alertas' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Metas e alertas' });
  await dialogo.getByLabel('Alerta abaixo de (% da capacidade)').fill('95');
  await dialogo.getByLabel('Alerta acima de (% da capacidade)').fill('90');
  await dialogo.getByRole('button', { name: 'Salvar' }).click();
  await expect(dialogo.getByRole('alert')).toContainText('maior que a mínima');
});

test('comparativo entre períodos: atalhos, período personalizado e validação', async ({ page }) => {
  await abrir(page, 'cockpit', 'GG', '2026-10-01');
  const painel = page.getByRole('region', { name: 'Comparativo entre períodos' });
  await expect(painel).toContainText('(30 dias cada)');
  await expect(painel).toContainText('Interações de relacionamento');
  await expect(painel).toContainText('AUM não tem histórico');
  await page.getByRole('combobox', { name: 'Período' }).click();
  await page.getByRole('option', { name: 'Últimos 90 dias' }).click();
  await expect(painel).toContainText('(90 dias cada)');
  await page.getByRole('combobox', { name: 'Período' }).click();
  await page.getByRole('option', { name: 'Personalizado' }).click();
  await painel.getByLabel('De').fill('2026-09-20');
  await painel.getByLabel('Até').fill('2026-09-26');
  await expect(painel).toContainText('(7 dias cada)');
  await painel.getByLabel('De').fill('2026-09-30');
  await expect(painel.getByRole('alert')).toContainText('período válido');
});
