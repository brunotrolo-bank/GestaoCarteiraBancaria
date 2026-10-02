/**
 * Gera frontend/ui/src/tokens.css a partir do front matter do DESIGN-stripe.md (T-DS-02, FR-UX-015, constituição C13).
 * Os tokens NUNCA são copiados à mão: CI regenera e compara (teste "tokens em dia").
 * Decisões aplicadas: fonte Inter no lugar da Sohne (NC-DS-5); cromo escuro em brand-dark-900 (NC-DS-1);
 * estados semânticos só com tokens documentados (NC-DS-4); aliases shadcn conforme 01-design-system-shadcn-stripe.md §3.1.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'yaml';

export interface Tokens {
  colors: Record<string, string>;
  typography: Record<string, { fontFamily: string; fontSize: string; fontWeight: number; lineHeight: number; letterSpacing: string; fontFeature: string }>;
  rounded: Record<string, string>;
  spacing: Record<string, string>;
}

export const CAMINHO_DESIGN = new URL('../planos/system-design/DESIGN-stripe.md', import.meta.url);

export function lerTokens(): Tokens {
  const texto = readFileSync(CAMINHO_DESIGN, 'utf8').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---/.exec(texto);
  if (!m) throw new Error('DESIGN-stripe.md sem front matter');
  return parse(m[1]!) as Tokens;
}

/** Alias semântico (shadcn / cockpit) → token do DESIGN. Documentado em 01-design-system §3.1 e §6. */
export const ALIASES: Record<string, string> = {
  background: 'canvas',
  foreground: 'ink',
  card: 'canvas',
  'card-foreground': 'ink',
  popover: 'canvas',
  'popover-foreground': 'ink',
  'primary-foreground': 'on-primary',
  secondary: 'canvas-soft',
  'secondary-foreground': 'ink-secondary',
  muted: 'canvas-soft',
  'muted-foreground': 'ink-mute',
  accent: 'canvas-soft',
  'accent-foreground': 'ink',
  border: 'hairline',
  input: 'hairline-input',
  ring: 'primary',
  destructive: 'ruby',
  'chart-1': 'primary',
  'chart-2': 'primary-soft',
  'chart-3': 'brand-dark-900',
  'chart-4': 'ruby',
  'chart-5': 'ink-mute',
  sidebar: 'brand-dark-900',
  'sidebar-foreground': 'on-primary',
  'sidebar-muted': 'primary-bg-subdued-hover',
  'sidebar-active': 'primary-press',
  critico: 'ruby',
  atencao: 'lemon',
  informativo: 'primary-deep',
};

const px = (v: string): number => Number.parseFloat(v);

export function conteudoTokens(): string {
  const t = lerTokens();
  const l: string[] = [];
  l.push('/* GERADO por scripts/gerar-tokens.ts a partir de planos/system-design/DESIGN-stripe.md — não editar à mão (npm run tokens). */');
  l.push('@theme {');
  for (const [nome, valor] of Object.entries(t.colors)) l.push(`  --color-${nome}: ${valor};`);
  for (const [alias, alvo] of Object.entries(ALIASES)) {
    if (!(alvo in t.colors)) throw new Error(`Alias ${alias} aponta para token inexistente: ${alvo}`);
    l.push(`  --color-${alias}: var(--color-${alvo});`);
  }
  l.push("  --font-sans: 'Inter', 'SF Pro Display', system-ui, -apple-system, sans-serif;");
  for (const [nome, v] of Object.entries(t.rounded)) l.push(`  --radius-${nome}: ${v};`);
  for (const [nome, e] of Object.entries(t.typography)) {
    l.push(`  --text-${nome}: ${e.fontSize};`);
    l.push(`  --text-${nome}--line-height: ${e.lineHeight};`);
    l.push(`  --text-${nome}--letter-spacing: ${e.letterSpacing};`);
    l.push(`  --text-${nome}--font-weight: ${e.fontWeight};`);
  }
  l.push('  --shadow-nivel-1: rgba(0, 55, 112, 0.08) 0 1px 3px;');
  l.push('  --shadow-nivel-2: rgba(0, 55, 112, 0.08) 0 8px 24px, rgba(0, 55, 112, 0.04) 0 2px 6px;');
  l.push('  --breakpoint-md: 768px;');
  l.push('  --breakpoint-lg: 1024px;');
  l.push('  --breakpoint-wide: 1440px;');
  l.push('}');
  l.push('');
  // Espaçamento: NÃO usar o namespace --spacing-* do Tailwind (colidiria com max-w-xl, max-w-lg…: xl vira 24px!).
  // Os valores do DESIGN são todos múltiplos da escala de 4px do Tailwind (p-1=4px … p-16=64px) — ver teste de tokens.
  l.push(':root {');
  for (const [nome, v] of Object.entries(t.spacing)) l.push(`  --space-${nome}: ${v};`);
  l.push('}');
  l.push('');
  l.push('@layer base {');
  l.push('  html { font-family: var(--font-sans); }');
  l.push('  body { font-feature-settings: "ss01"; font-weight: 300; font-size: 15px; line-height: 1.4; color: var(--color-ink); background: var(--color-canvas-soft); }');
  l.push('  button, input, select, textarea { font-family: inherit; font-feature-settings: "ss01"; }');
  l.push('  :focus-visible { outline: 2px solid var(--color-ring); outline-offset: 2px; }');
  l.push('}');
  l.push('');
  l.push('@layer utilities {');
  l.push('  /* Toda célula de dinheiro/contagem usa tnum (DESIGN: "Tabular-Figure Money Type"). */');
  l.push('  .tnum { font-feature-settings: "ss01", "tnum"; font-variant-numeric: tabular-nums; }');
  l.push(`  .text-body-tabular { font-feature-settings: "tnum"; letter-spacing: ${t.typography['body-tabular']!.letterSpacing}; }`);
  l.push(`  .text-caption { font-feature-settings: "tnum"; }`);
  l.push('}');
  // metadados para teste de peso máximo e escala
  l.push(`/* escala de raios (px): ${Object.values(t.rounded).map(px).join(', ')} */`);
  return `${l.join('\n')}\n`;
}

if (process.argv[1]?.endsWith('gerar-tokens.ts')) {
  writeFileSync(new URL('../frontend/ui/src/tokens.css', import.meta.url), conteudoTokens(), 'utf8');
  console.log('frontend/ui/src/tokens.css atualizado');
}
