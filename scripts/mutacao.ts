/**
 * Teste de mutação dos núcleos 01–04 (meta ≥ 80%; 00-consolidacao §7).
 * Usa o *command runner* do Stryker: cada mutante roda os testes do domínio (`vitest --bail=1`) com o mutante ativado
 * por variável de ambiente. (O runner nativo do vitest não ativa mutantes com vitest 5 — o escore saía ~1,5% — e o
 * command runner é independente da versão.) Os testes importam o código-fonte da sandbox pelo alias de vitest.stryker.config.ts.
 * Uso: npm run mutacao [-- <alvo>]   alvos: posicoes delegacao acesso clientes
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const T = 'packages/core/test';
const ALVOS: Record<string, { mutar: string[]; testes: string[] }> = {
  posicoes: { mutar: ['packages/core/src/posicoes/index.ts'], testes: ['posicoes', 'bordas', 'acesso'] },
  delegacao: { mutar: ['packages/core/src/delegacao/index.ts'], testes: ['delegacao', 'acesso', 'bordas'] },
  acesso: { mutar: ['packages/core/src/acesso/index.ts'], testes: ['acesso', 'delegacao', 'clientes', 'insights'] },
  clientes: { mutar: ['packages/core/src/clientes/index.ts', 'packages/core/src/clientes/documento.ts'], testes: ['clientes', 'bordas', 'insights'] },
};

interface Mutante { status: string }
interface Relatorio { files: Record<string, { mutants: Mutante[] }> }

const escolhidos = process.argv.slice(2).filter((a) => a in ALVOS);
const alvos = escolhidos.length ? escolhidos : Object.keys(ALVOS);
const resumo: { alvo: string; total: number; mortos: number; sobreviventes: number; semCobertura: number; escore: number }[] = [];

for (const alvo of alvos) {
  const { mutar, testes } = ALVOS[alvo]!;
  const arquivos = testes.map((t) => `${T}/${t}.test.ts`).join(' ');
  const saida = `reports/mutation/${alvo}.json`;
  mkdirSync('reports/mutation', { recursive: true });
  console.log(`\n=== Mutação: ${alvo} (${mutar.join(', ')}) ===`);
  const base = JSON.parse(readFileSync('stryker.config.json', 'utf8')) as Record<string, unknown>;
  const cfg = { ...base, mutate: mutar, commandRunner: { command: `npx vitest run -c vitest.stryker.config.ts --bail=1 ${arquivos}` }, jsonReporter: { fileName: saida }, thresholds: { high: 90, low: 80, break: null } };
  const arquivoCfg = `.stryker-${alvo}.json`;
  writeFileSync(arquivoCfg, JSON.stringify(cfg, null, 2), 'utf8');
  spawnSync('npx', ['stryker', 'run', arquivoCfg], { stdio: 'inherit', shell: true });
  rmSync(arquivoCfg, { force: true });
  const rel = JSON.parse(readFileSync(saida, 'utf8')) as Relatorio;
  const ms = Object.values(rel.files).flatMap((f) => f.mutants);
  const c = (s: string): number => ms.filter((m) => m.status === s).length;
  const mortos = c('Killed') + c('Timeout');
  const validos = ms.length - c('Ignored') - c('CompileError') - c('RuntimeError');
  resumo.push({ alvo, total: validos, mortos, sobreviventes: c('Survived'), semCobertura: c('NoCoverage'), escore: validos ? (mortos / validos) * 100 : 100 });
}

const total = resumo.reduce((a, r) => a + r.total, 0);
const mortos = resumo.reduce((a, r) => a + r.mortos, 0);
const linhas = ['| Alvo | Mutantes | Mortos | Sobreviventes | Sem cobertura | Escore |', '|---|---|---|---|---|---|', ...resumo.map((r) => `| ${r.alvo} | ${r.total} | ${r.mortos} | ${r.sobreviventes} | ${r.semCobertura} | ${r.escore.toFixed(1)}% |`), `| **Total** | ${total} | ${mortos} | | | **${((mortos / Math.max(total, 1)) * 100).toFixed(1)}%** |`];
writeFileSync('reports/mutation/resumo.md', `${linhas.join('\n')}\n`, 'utf8');
console.log(`\n${linhas.join('\n')}`);
process.exit((mortos / Math.max(total, 1)) * 100 >= 80 ? 0 : 1);
