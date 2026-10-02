import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ALIASES, conteudoTokens, lerTokens } from '../../../scripts/gerar-tokens.ts';

/**
 * Barreiras automáticas contra desvio visual (01-design-system §8, constituição C13):
 * tokens gerados do DESIGN, nenhuma cor fora dos tokens, escala de raios, pesos, contraste (T-DS-04).
 */
const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const decode = (p: string): string => p;

function arquivos(dir: string, exts: string[]): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    if (['node_modules', 'dist', 'test'].includes(nome)) continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) saida.push(...arquivos(caminho, exts));
    else if (exts.some((e) => nome.endsWith(e))) saida.push(caminho);
  }
  return saida;
}

const fonte = arquivos(decode(RAIZ), ['.ts', '.tsx', '.css']).filter((f) => !f.endsWith('tokens.css'));
const conteudo = (f: string): string => readFileSync(f, 'utf8');

function luminancia(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
export function contraste(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1! + 0.05) / (l2! + 0.05);
}

describe('Design system — tokens do DESIGN-stripe.md', () => {
  const t = lerTokens();

  it('tokens.css está em dia com o DESIGN (regenerar e comparar)', () => {
    expect(readFileSync(new URL('../src/tokens.css', import.meta.url), 'utf8')).toBe(conteudoTokens());
  });

  it('cada cor do DESIGN aparece no CSS com o mesmo valor; aliases apontam para tokens existentes', () => {
    const css = conteudoTokens();
    for (const [nome, valor] of Object.entries(t.colors)) expect(css).toContain(`--color-${nome}: ${valor};`);
    for (const alvo of Object.values(ALIASES)) expect(Object.keys(t.colors)).toContain(alvo);
    for (const [nome, v] of Object.entries(t.rounded)) expect(css).toContain(`--radius-${nome}: ${v};`);
  });

  it('tipografia: pesos exatos do DESIGN, tracking negativo no display, tnum no tabular', () => {
    const css = conteudoTokens();
    for (const [nome, e] of Object.entries(t.typography)) {
      expect(css).toContain(`--text-${nome}--font-weight: ${e.fontWeight};`);
      expect(css).toContain(`--text-${nome}--letter-spacing: ${e.letterSpacing};`);
    }
    for (const nome of ['display-xxl', 'display-xl', 'display-lg', 'display-md']) {
      expect(t.typography[nome]!.fontWeight).toBe(300); // "Thin weight is the brand": nunca acima de 300
      expect(Number.parseFloat(t.typography[nome]!.letterSpacing)).toBeLessThan(0);
    }
    expect(css).toMatch(/\.tnum \{[^}]*"tnum"/);
    expect(css).toMatch(/body \{[^}]*"ss01"/);
  });

  it('espaçamento do DESIGN é múltiplo da escala de 4px do Tailwind e não polui o namespace --spacing-*', () => {
    const css = conteudoTokens();
    expect(css).not.toMatch(/--spacing-(xxs|xs|sm|md|lg|xl|xxl|huge):/);
    for (const [nome, v] of Object.entries(t.spacing)) {
      expect(css).toContain(`--space-${nome}: ${v};`);
      const px = Number.parseFloat(v);
      expect(px % 2).toBe(0);
    }
  });

  it('nenhuma cor literal fora dos tokens (hex/rgb/hsl) no código-fonte', () => {
    const proibidos: string[] = [];
    for (const f of fonte) {
      const texto = conteudo(f);
      for (const m of texto.matchAll(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g)) {
        const trecho = texto.slice(Math.max(0, m.index! - 40), m.index! + 20);
        if (/\/\/ ?cor-permitida/.test(trecho)) continue;
        if (relative(decode(RAIZ), f).startsWith('frontend')) proibidos.push(`${relative(decode(RAIZ), f)}: ${m[0]}`);
      }
    }
    expect(proibidos).toEqual([]);
  });

  it('sem paleta padrão do Tailwind (bg-blue-500, text-gray-600…) nem raios fora da escala', () => {
    const ruins: string[] = [];
    const paleta = /\b(?:bg|text|border|ring|fill|stroke|from|to|via|divide|outline|decoration|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(?:-\d{2,3})?\b/g;
    const raioForaEscala = /\brounded(?:-[a-z]{1,2})?-(?:2xl|3xl|full|none)\b|\brounded-(?:\[[^\]]+\])/g;
    for (const f of fonte.filter((x) => /\.(tsx|ts)$/.test(x) && relative(decode(RAIZ), x).startsWith('frontend'))) {
      const texto = conteudo(f);
      for (const m of texto.matchAll(paleta)) ruins.push(`${relative(decode(RAIZ), f)}: ${m[0]}`);
      for (const m of texto.matchAll(raioForaEscala)) ruins.push(`${relative(decode(RAIZ), f)}: ${m[0]}`);
    }
    expect(ruins).toEqual([]);
  });

  it('botões e tags são pill; botão preenchido usa primary; padding mínimo 8px 16px', () => {
    const decodificado = conteudo(fileURLToPath(new URL('../src/components/basicos.tsx', import.meta.url)));
    expect(decodificado).toContain('rounded-pill px-4 py-2'); // 8px 16px
    expect(decodificado).toContain("primario: 'bg-primary text-on-primary");
    expect(decodificado).toMatch(/selo = cva\('inline-flex items-center gap-1 rounded-pill/);
    expect(decodificado).toContain('min-h-10'); // alvo ≥ 40px
  });

  it('contraste WCAG (T-DS-04): pares de texto usados no cockpit ≥ 4,5:1; ruby só como ícone/marcador (≥ 3:1)', () => {
    const c = t.colors;
    const pares: [string, string, string, number][] = [
      ['ink sobre canvas', c.ink!, c.canvas!, 7],
      ['ink-secondary sobre canvas-soft', c['ink-secondary']!, c['canvas-soft']!, 4.5],
      ['primary sobre canvas (links/botão secundário)', c.primary!, c.canvas!, 4.5],
      ['on-primary sobre primary (botão)', c['on-primary']!, c.primary!, 4.5],
      ['ink-mute sobre canvas (rótulos)', c['ink-mute']!, c.canvas!, 4.5],
      ['primary-press sobre subdued (tag — correção NC-DS-6)', c['primary-press']!, c['primary-bg-subdued-hover']!, 4.5],
      ['on-primary sobre brand-dark-900 (sidebar)', c['on-primary']!, c['brand-dark-900']!, 7],
      ['primary-bg-subdued-hover sobre brand-dark-900 (texto auxiliar da sidebar)', c['primary-bg-subdued-hover']!, c['brand-dark-900']!, 4.5],
      ['lemon sobre canvas (ícone de atenção)', c.lemon!, c.canvas!, 3],
      ['ruby sobre canvas (ícone/marcador crítico — nunca texto pequeno)', c.ruby!, c.canvas!, 3],
    ];
    const falhas = pares.filter(([, fg, bg, min]) => contraste(fg, bg) < min).map(([n, fg, bg]) => `${n}: ${contraste(fg, bg).toFixed(2)}:1`);
    expect(falhas).toEqual([]);
  });

  it('registro das medições que motivaram as correções do NC-DS-6 (tag original reprova; legenda sobre canvas-soft)', () => {
    const c = t.colors;
    expect(contraste(c['primary-deep']!, c['primary-bg-subdued-hover']!)).toBeLessThan(4.5); // par original do DESIGN falha em 10px
    expect(contraste(c['primary-press']!, c['primary-bg-subdued-hover']!)).toBeGreaterThanOrEqual(4.5); // correção adotada
    expect(contraste(c['ink-mute']!, c['canvas-soft']!)).toBeLessThan(4.5); // medido ≈ 4,49:1: texto auxiliar FORA de cartão (sobre canvas-soft) usa ink-secondary
    expect(contraste(c['ink-secondary']!, c['canvas-soft']!)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(c.ruby!, c.canvas!)).toBeLessThan(4.5); // ruby não serve para texto pequeno
  });
});
