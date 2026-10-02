import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';

mkdirSync('docs/telas', { recursive: true });

/** Responsividade da Visão 360°: sem "buracos" em branco em nenhuma largura. */
for (const largura of [1600, 1280, 1024, 820, 420]) {
  test(`visão 360° responsiva em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await page.request.post('http://localhost:3101/api/v1/simulacao/reset');
    await page.addInitScript(() => window.localStorage.setItem('carteira.sessao', JSON.stringify({ papel: 'POS-AG01-002', dataSimulada: null })));
    await page.goto('/#/carteira');
    await page.getByRole('row').nth(1).click();
    const gaveta = page.getByRole('dialog', { name: 'Visão 360° do cliente' });
    await expect(gaveta.getByText('Penetração de produtos')).toBeVisible();
    await page.screenshot({ path: `docs/telas/360-${largura}.png` });

    // Os três blocos de uma mesma linha têm a mesma altura (nenhum buraco abaixo de uma coluna mais curta)
    const alturas = await gaveta.locator('[aria-labelledby^="t360-"]').evaluateAll((els) => els.map((e) => ({ top: Math.round(e.getBoundingClientRect().top), h: Math.round(e.getBoundingClientRect().height) })));
    const porLinha = new Map<number, number[]>();
    for (const a of alturas) porLinha.set(a.top, [...(porLinha.get(a.top) ?? []), a.h]);
    for (const hs of porLinha.values()) expect(Math.max(...hs) - Math.min(...hs)).toBeLessThanOrEqual(1);
    // sem rolagem horizontal
    const sobra = await gaveta.evaluate((e) => e.scrollWidth - e.clientWidth);
    expect(sobra).toBeLessThanOrEqual(1);
  });
}
