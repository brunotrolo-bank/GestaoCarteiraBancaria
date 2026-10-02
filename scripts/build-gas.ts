/**
 * Gera os arquivos do Apps Script (`apps-script/`) PRESERVANDO a separação por domínio e por micro-frontend:
 *
 *  Backend (um arquivo por camada/domínio; compartilham globais, na ordem de `.clasp.json`):
 *    nucleo.js · dominio-posicoes.js · dominio-delegacao.js · dominio-acesso.js · dominio-clientes.js · dominio-insights.js
 *    dominios-index.js · plataforma-dados.js · api.js · armazenamento-sheets.js · entrada.js
 *  Front (HTML por micro-frontend, composto em runtime pelo shell):
 *    index.html (template) · estilos.html · runtime.html (React + design system + SDK) · mfe-cockpit.html · mfe-posicoes.html ·
 *    mfe-carteira.html · mfe-delegacao.html · shell.html
 *
 * Uso: npm run gas:build   (depois: npm run apps-script:push)
 */
import { build as esbuild, type Plugin } from 'esbuild';
import { build as vite } from 'vite';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const saidaGas = join(raiz, 'apps-script');
const src = (p: string): string => join(raiz, p);

/** Plugin: imports que viram variáveis globais (o Apps Script compartilha o escopo global entre arquivos). */
function globais(mapa: (especificador: string, importador: string) => string | null): Plugin {
  return {
    name: 'globais',
    setup(b) {
      b.onResolve({ filter: /.*/ }, (args) => {
        if (args.kind === 'entry-point') return undefined;
        const g = mapa(args.path, args.importer);
        return g ? { path: args.path, namespace: 'global', pluginData: { g } } : undefined;
      });
      b.onLoad({ filter: /.*/, namespace: 'global' }, (args) => ({ contents: `module.exports = ${args.pluginData.g as string};`, loader: 'js' }));
    },
  };
}

// ======================= BACKEND =======================
const DOMINIOS = ['posicoes', 'delegacao', 'acesso', 'clientes', 'insights'] as const;
const NUCLEO_DIRS = ['shared', 'model'];

/** Resolve um import relativo dentro de packages/core/src para o módulo (pasta) de destino. */
function moduloDestino(especificador: string, importador: string): string | null {
  if (!especificador.startsWith('.')) return null;
  const abs = resolve(dirname(importador), especificador);
  const rel = relative(src('packages/core/src'), abs);
  if (rel.startsWith('..')) return null;
  return rel.split(sep)[0] ?? null;
}

async function backend(): Promise<void> {
  const comum = { bundle: true, format: 'iife' as const, platform: 'neutral' as const, mainFields: ['module', 'main'], conditions: ['import', 'module', 'default'], target: 'es2018', legalComments: 'none' as const, logLevel: 'error' as const };
  const cab = (nome: string): string => `/* GERADO por scripts/build-gas.ts a partir do repositório — não editar à mão (npm run gas:build). ${nome} */`;

  // núcleo: shared + model (tipos, datas, relógio, erros, auditoria, esquema)
  await esbuild({
    ...comum, entryPoints: [src('apps/gas/src/nucleo.ts')], outfile: join(saidaGas, 'nucleo.js'), globalName: 'CARTEIRA_NUCLEO',
    banner: { js: `${cab('Camada compartilhada (shared + model)')}\nvar CARTEIRA_DOMINIOS = {};` },
  });

  // um arquivo por domínio; dependências entre domínios e o núcleo viram globais
  for (const d of DOMINIOS) {
    await esbuild({
      ...comum, entryPoints: [src(`packages/core/src/${d}/index.ts`)], outfile: join(saidaGas, `dominio-${d}.js`), globalName: `DOM_${d}`,
      banner: { js: cab(`Domínio: ${d}`) }, footer: { js: `CARTEIRA_DOMINIOS.${d} = DOM_${d};` },
      plugins: [globais((esp, imp) => {
        const m = moduloDestino(esp, imp);
        if (!m || !imp.includes(`${sep}core${sep}src${sep}${d}${sep}`) && !imp.includes(`/core/src/${d}/`)) return null;
        if (NUCLEO_DIRS.includes(m)) return 'CARTEIRA_NUCLEO';
        if (m !== d && (DOMINIOS as readonly string[]).includes(m)) return `CARTEIRA_DOMINIOS.${m}`;
        return null;
      })],
    });
  }

  // índice do núcleo no mesmo formato de `@carteira/core` (para as camadas acima)
  writeFileSync(join(saidaGas, 'dominios-index.js'), `${cab('Índice do núcleo (equivale a @carteira/core)')}
var CARTEIRA_CORE = Object.assign({}, CARTEIRA_NUCLEO, CARTEIRA_DOMINIOS.clientes, {
  posicoes: CARTEIRA_DOMINIOS.posicoes,
  delegacao: CARTEIRA_DOMINIOS.delegacao,
  clientes: CARTEIRA_DOMINIOS.clientes,
  acesso: CARTEIRA_DOMINIOS.acesso,
  insights: CARTEIRA_DOMINIOS.insights,
});
`, 'utf8');

  const externosCamadas = (esp: string): string | null => {
    if (esp === '@carteira/core') return 'CARTEIRA_CORE';
    if (esp === '@carteira/data/seed' || esp === '@carteira/data/matriz') return 'CARTEIRA_DADOS';
    if (esp === '@carteira/api') return 'CARTEIRA_API';
    if (esp === './gas-store.ts') return 'CARTEIRA_ARMAZENAMENTO';
    return null;
  };
  const camada = (entrada: string, arquivo: string, global: string, nome: string, bloqueados: string[]): Promise<unknown> =>
    esbuild({
      ...comum, entryPoints: [src(entrada)], outfile: join(saidaGas, arquivo), globalName: global, banner: { js: cab(nome) },
      plugins: [globais((esp) => { const g = externosCamadas(esp); return g && !bloqueados.includes(g) ? g : null; })],
    });

  await camada('apps/gas/src/dados.ts', 'plataforma-dados.js', 'CARTEIRA_DADOS', 'Plataforma de dados (dados sintéticos, conversão tabela⇄matriz)', ['CARTEIRA_DADOS', 'CARTEIRA_API', 'CARTEIRA_ARMAZENAMENTO']);
  await camada('apps/gas/src/api.ts', 'api.js', 'CARTEIRA_API', 'API (rotas, validação, erros) sobre o núcleo', ['CARTEIRA_API', 'CARTEIRA_ARMAZENAMENTO']);
  await camada('apps/gas/src/gas-store.ts', 'armazenamento-sheets.js', 'CARTEIRA_ARMAZENAMENTO', 'Persistência na planilha (cache + escrita incremental)', ['CARTEIRA_ARMAZENAMENTO']);
  await camada('apps/gas/src/entrada.ts', 'entrada.js', 'CARTEIRA', 'Entrada do backend: apiChamar / instalarEm', []);
  rmSync(join(saidaGas, 'backend.js'), { force: true });
}

// ======================= FRONT =======================
const EXTERNOS_FRONT: Record<string, string> = {
  react: 'CARTEIRA_RUNTIME.React',
  'react-dom': 'CARTEIRA_RUNTIME.ReactDOM',
  'react-dom/client': 'CARTEIRA_RUNTIME.ReactDOM',
  'react/jsx-runtime': 'CARTEIRA_RUNTIME.JsxRuntime',
  'react/jsx-dev-runtime': 'CARTEIRA_RUNTIME.JsxRuntime',
  '@carteira/ui': 'CARTEIRA_RUNTIME.UI',
  '@carteira/sdk': 'CARTEIRA_RUNTIME.SDK',
};

// O HtmlService trata `&nome;` como entidade HTML (ex.: `a&&n;` do recharts quebra o JS): separa o `&` do identificador.
const comoScript = (js: string): string => `<script>\n${js.replace(/<\/script/gi, '<\\/script').replace(/&([A-Za-z_$][\w$]*);/g, '& $1;')}\n</script>\n`;

async function jsFront(entrada: string, externalizar: boolean): Promise<string> {
  const r = await esbuild({
    entryPoints: [src(entrada)], bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2019', supported: { 'template-literal': false }, minify: false /* legível e indentado no editor do Apps Script */, charset: 'ascii', legalComments: 'none',
    jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'error',
    plugins: externalizar ? [globais((esp) => EXTERNOS_FRONT[esp] ?? null)] : [],
  });
  return r.outputFiles[0]!.text;
}

async function front(): Promise<void> {
  // CSS (Tailwind + tokens + fontes embutidas) gerado pelo Vite a partir de TODOS os pacotes
  const dist = src('frontend/shell/dist-gas');
  await vite({ root: src('frontend/shell'), configFile: src('frontend/shell/vite.gas.config.ts'), build: { outDir: dist, emptyOutDir: true, cssMinify: false }, logLevel: 'error' });
  const css = readdirSync(join(dist, 'assets')).find((n) => n.endsWith('.css'));
  if (!css) throw new Error('CSS do front não encontrado');
  writeFileSync(join(saidaGas, 'estilos.html'), `<style>\n${readFileSync(join(dist, 'assets', css), 'utf8')}\n</style>\n`, 'utf8');

  writeFileSync(join(saidaGas, 'runtime.html'), comoScript(await jsFront('frontend/shell/src/runtime.ts', false)), 'utf8');
  for (const m of ['cockpit', 'posicoes', 'carteira', 'delegacao']) {
    writeFileSync(join(saidaGas, `mfe-${m}.html`), comoScript(await jsFront(`frontend/mfe-${m}/src/gas.ts`, true)), 'utf8');
  }
  writeFileSync(join(saidaGas, 'shell.html'), comoScript(await jsFront('frontend/shell/src/main.gas.tsx', true)), 'utf8');

  writeFileSync(join(saidaGas, 'index.html'), `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <base target="_top" />
    <title>Gestão de Carteira Bancária — POC</title>
    <?!= incluir('estilos') ?>
    <script>
      // diagnóstico de carga: registra erros de cada script (arquivo em carga = window.__etapa) e o shell os mostra se algo faltar
      window.CARTEIRA_ERROS = [];
      window.__etapa = 'inicio';
      window.addEventListener('error', function (e) { window.CARTEIRA_ERROS.push(window.__etapa + ': ' + e.message + ' (linha ' + e.lineno + ':' + e.colno + ')'); });
    </script>
  </head>
  <body>
    <div id="raiz"><p style="font-family:sans-serif;padding:24px;color:#273951">Carregando…</p></div>
    <!-- Runtime compartilhado, depois cada micro-frontend (um arquivo cada) e, por fim, o shell que os compõe -->
    <script>window.__etapa = 'runtime';</script>
    <?!= incluir('runtime') ?>
    <script>window.__etapa = 'mfe-posicoes';</script>
    <?!= incluir('mfe-posicoes') ?>
    <script>window.__etapa = 'mfe-delegacao';</script>
    <?!= incluir('mfe-delegacao') ?>
    <script>window.__etapa = 'mfe-carteira';</script>
    <?!= incluir('mfe-carteira') ?>
    <script>window.__etapa = 'mfe-cockpit';</script>
    <?!= incluir('mfe-cockpit') ?>
    <script>window.__etapa = 'shell';</script>
    <?!= incluir('shell') ?>
  </body>
</html>
`, 'utf8');
}

// ======================= ordem dos arquivos =======================
const ORDEM = [
  'nucleo.js', 'dominio-posicoes.js', 'dominio-delegacao.js', 'dominio-acesso.js', 'dominio-clientes.js', 'dominio-insights.js', 'dominios-index.js',
  'plataforma-dados.js', 'api.js', 'armazenamento-sheets.js', 'entrada.js', 'schema.js', 'rules.js', 'Codigo.js',
];

mkdirSync(saidaGas, { recursive: true });
await backend();
await front();
const claspPath = join(saidaGas, '.clasp.json');
const clasp = JSON.parse(readFileSync(claspPath, 'utf8')) as Record<string, unknown>;
clasp.filePushOrder = ORDEM;
writeFileSync(claspPath, `${JSON.stringify(clasp, null, 2)}\n`, 'utf8');

const tam = (n: string): string => `${(readFileSync(join(saidaGas, n)).length / 1024).toFixed(0)} KB`;
const lista = readdirSync(saidaGas).filter((n) => /\.(js|html|json)$/.test(n) && n !== '.clasp.json');
console.log(lista.map((n) => `${n.padEnd(26)} ${tam(n)}`).join('\n'));
