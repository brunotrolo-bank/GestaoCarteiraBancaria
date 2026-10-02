/**
 * Lint de arquitetura (D-01, constituição C4/C6/C12): fronteiras entre módulos do monolito modular e dependências proibidas.
 * Uso: npm run lint:arq  (também roda como teste e no CI).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Violacao { arquivo: string; regra: string; detalhe: string }

/** Grafo permitido entre módulos do núcleo (sem ciclos): cada módulo só importa dos listados. */
const PERMITIDO: Record<string, string[]> = {
  shared: [],
  model: ['shared'],
  posicoes: ['shared', 'model'],
  delegacao: ['shared', 'model', 'posicoes'],
  acesso: ['shared', 'model', 'posicoes', 'delegacao'],
  clientes: ['shared', 'model', 'posicoes', 'acesso'],
  insights: ['shared', 'model', 'posicoes', 'delegacao', 'acesso', 'clientes'],
};

function listar(dir: string, exts: string[]): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    if (['node_modules', 'dist', '.git', 'test-results'].includes(nome)) continue;
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) saida.push(...listar(p, exts));
    else if (exts.some((e) => nome.endsWith(e))) saida.push(p);
  }
  return saida;
}

export interface Fonte { arquivo: string; texto: string }

export function analisar(fontes: Fonte[]): Violacao[] {
  const v: Violacao[] = [];
  for (const { arquivo, texto } of fontes) {
    const a = arquivo.split(sep).join('/');
    const imports = [...texto.matchAll(/(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);

    const nucleo = /^packages\/core\/src\/([^/]+)\//.exec(a);
    if (nucleo) {
      const modulo = nucleo[1]!;
      if (modulo in PERMITIDO) {
        for (const imp of imports) {
          if (/^@carteira\/(data|api|mcp|sdk|ui)|^node:|^react|^zod|^yaml/.test(imp)) v.push({ arquivo: a, regra: 'NUCLEO_PURO', detalhe: `o núcleo não pode importar ${imp}` });
          const alvo = /^\.\.\/([^/]+)\//.exec(imp)?.[1];
          if (alvo && alvo in PERMITIDO && alvo !== modulo && !PERMITIDO[modulo]!.includes(alvo)) v.push({ arquivo: a, regra: 'FRONTEIRA_MODULO', detalhe: `${modulo} não pode depender de ${alvo}` });
          if (/^\.\.\/[^/]+\/.+/.test(imp) && !/^\.\.\/[^/]+\/(index|documento|dates|clock|errors|registro|db|types)\.ts$/.test(imp)) v.push({ arquivo: a, regra: 'API_PUBLICA', detalhe: `importe pela API pública do módulo, não por ${imp}` });
        }
      }
      // Tempo é dependência (C4): nada de relógio global no domínio.
      if (!/shared\/clock\.ts$/.test(a)) {
        if (/new Date\(\s*\)|Date\.now\s*\(/.test(texto)) v.push({ arquivo: a, regra: 'RELOGIO_INJETAVEL', detalhe: 'use Clock injetável, não new Date()/Date.now()' });
      }
      if (/Math\.random\s*\(/.test(texto)) v.push({ arquivo: a, regra: 'DETERMINISMO', detalhe: 'sem Math.random no núcleo' });
    }

    if (a.startsWith('frontend/') && !a.includes('/test/')) {
      for (const imp of imports) {
        if (/^@carteira\/(core|data|api|mcp)\b/.test(imp)) v.push({ arquivo: a, regra: 'FRONT_SO_VIA_SDK', detalhe: `o front não importa ${imp}; use o SDK/contrato` });
        const mfe = /^frontend\/(mfe-[^/]+)\//.exec(a)?.[1];
        const outro = /^@carteira\/(mfe-[^/]+)/.exec(imp)?.[1];
        if (mfe && outro && outro !== mfe) v.push({ arquivo: a, regra: 'MFE_ISOLADO', detalhe: `${mfe} não importa ${outro}; comunique por eventos` });
      }
    }

    if ((a.startsWith('apps/') || a.startsWith('packages/')) && !a.includes('/test/')) {
      for (const imp of imports) if (/^@carteira\/(ui|sdk|mfe-|shell)/.test(imp)) v.push({ arquivo: a, regra: 'BACKEND_SEM_FRONT', detalhe: `backend não importa ${imp}` });
    }
  }
  return v;
}

export function verificarArquitetura(raiz: string): Violacao[] {
  const arquivos = [...listar(join(raiz, 'packages'), ['.ts']), ...listar(join(raiz, 'apps'), ['.ts']), ...listar(join(raiz, 'frontend'), ['.ts', '.tsx'])];
  return analisar(arquivos.map((f) => ({ arquivo: relative(raiz, f), texto: readFileSync(f, 'utf8') })));
}

if (process.argv[1]?.endsWith('lint-arquitetura.ts')) {
  const violacoes = verificarArquitetura(fileURLToPath(new URL('..', import.meta.url)));
  for (const x of violacoes) console.error(`${x.regra} ${x.arquivo}: ${x.detalhe}`);
  console.log(violacoes.length === 0 ? 'Arquitetura OK: fronteiras respeitadas.' : `${violacoes.length} violação(ões).`);
  process.exit(violacoes.length === 0 ? 0 : 1);
}
