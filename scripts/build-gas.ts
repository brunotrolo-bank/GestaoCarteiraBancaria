/**
 * Gera os artefatos que sobem para o Apps Script (`apps-script/`):
 *  - backend.js : núcleo de domínio + API (esbuild, IIFE `CARTEIRA`), sem dependências de Node;
 *  - index.html : front (shell + MFEs) em arquivo único, com JS, CSS e fontes embutidos.
 * Uso: npm run gas:build   (depois: npm run apps-script:push)
 */
import { build as esbuild } from 'esbuild';
import { build as vite } from 'vite';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));

// ---------- backend ----------
await esbuild({
  entryPoints: [join(raiz, 'apps/gas/src/entrada.ts')],
  outfile: join(raiz, 'apps-script/backend.js'),
  bundle: true,
  format: 'iife',
  globalName: 'CARTEIRA',
  platform: 'neutral',
  mainFields: ['module', 'main'],
  conditions: ['import', 'module', 'default'],
  target: 'es2018',
  minify: false,
  legalComments: 'none',
  banner: { js: '/* GERADO por scripts/build-gas.ts — não editar à mão (npm run gas:build). */' },
  logLevel: 'info',
});

// ---------- front (arquivo único) ----------
const saida = join(raiz, 'frontend/shell/dist-gas');
await vite({
  root: join(raiz, 'frontend/shell'),
  configFile: join(raiz, 'frontend/shell/vite.gas.config.ts'),
  build: { outDir: saida, emptyOutDir: true },
  logLevel: 'warn',
});

function listar(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? listar(join(dir, n)) : [join(dir, n)]));
}
let html = readFileSync(join(saida, 'index.html'), 'utf8');
const lerAsset = (src: string): string => readFileSync(join(saida, src.replace(/^\.?\//, '')), 'utf8');
html = html.replace(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g, (_m, src: string) => `<script type="module">${lerAsset(src).replace(/<\/script/gi, '<\\/script')}</script>`);
html = html.replace(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_m, href: string) => `<style>${lerAsset(href)}</style>`);
html = html.replace(/<link[^>]*rel="modulepreload"[^>]*>/g, '');
const externos = html.match(/(?:src|href)="(?!data:|#|https:\/\/fonts)[^"]+\.(?:js|css|woff2?|png|svg)"/g);
if (externos) throw new Error(`Referências externas restantes no HTML: ${externos.join(', ')}`);
writeFileSync(join(raiz, 'apps-script/index.html'), html, 'utf8');
mkdirSync(join(raiz, 'docs'), { recursive: true });
console.log(`index.html: ${(html.length / 1024).toFixed(0)} KB · arquivos de build: ${listar(saida).length}`);
