/**
 * Instala o projeto em OUTRA conta Google (a planilha e o projeto Apps Script são criados à mão na conta nova).
 *
 *   npm run setup:conta -- --planilha <ID> --script <ID> [--gcp <id-do-projeto-gcp>]   configura (e, com --gcp, cria projeto/service account)
 *   npm run setup:conta -- --verificar                                                  confere os acessos
 *
 * O que faz:
 *  - grava config/ambiente.json (planilha, script, projeto GCP, service account);
 *  - aponta apps-script/.clasp.json para o novo script e `PLANILHA_PADRAO` do Codigo.js para a nova planilha;
 *  - com --gcp: cria o projeto, habilita Sheets/Drive/Apps Script/IAM Credentials, cria a service account (SEM chave) e dá
 *    ao usuário do gcloud permissão de agir como ela (impersonation). Depois é preciso COMPARTILHAR a planilha com a service account.
 * Nada disto exige billing. Pré-requisitos: `clasp login` e `gcloud auth login` na conta nova.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const arg = (n: string): string | undefined => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const flag = (n: string): boolean => process.argv.includes(`--${n}`);
const win = process.platform === 'win32';

function gcloud(...args: string[]): string {
  return execFileSync(win ? 'gcloud.cmd' : 'gcloud', args, { encoding: 'utf8', shell: win, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
const caminhoConfig = `${raiz}config/ambiente.json`;
const lerConfig = (): Record<string, string> => (existsSync(caminhoConfig) ? (JSON.parse(readFileSync(caminhoConfig, 'utf8')) as Record<string, string>) : {});

if (flag('verificar')) {
  const { lerAmbiente, lerDb, obterToken } = await import('@carteira/data');
  const amb = lerAmbiente();
  console.log(`Planilha: ${amb.planilhaId || '(não configurada)'} · Script: ${amb.scriptId || '(não configurado)'} · Service account: ${amb.contaServico || '(não configurada)'}`);
  try { obterToken(); console.log('OK   impersonation da service account'); } catch { console.log('FALHA impersonation: rode `gcloud auth login` na conta nova e o setup com --gcp (aguarde ~1 min de propagação do IAM)'); process.exit(1); }
  try { const db = await lerDb(amb.planilhaId); console.log(`OK   planilha lida (${db.dim_clientes.length} clientes)`); } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(/Aba|coluna ausente|400|Unable to parse range/.test(msg) ? 'OK   acesso à planilha (ainda sem as 14 abas: rode `npm run sheets:carga`)' : `FALHA planilha: ${msg.slice(0, 200)}\n     → compartilhe a planilha como EDITOR com ${amb.contaServico}`);
  }
  setTimeout(() => process.exit(0), 300); // aguarda os handles de rede fecharem (evita ruído do libuv no Windows)
  await new Promise<void>(() => undefined);
}

const planilha = arg('planilha');
const script = arg('script');
if (!planilha || !script) {
  console.error('Uso: npm run setup:conta -- --planilha <ID_DA_PLANILHA> --script <ID_DO_SCRIPT> [--gcp <id-do-projeto-gcp-novo>]');
  process.exit(1);
}

const projeto = arg('gcp') ?? lerConfig().projetoGcp ?? '';
const contaServico = projeto ? `carteira-pipeline@${projeto}.iam.gserviceaccount.com` : '';

if (arg('gcp')) {
  const usuario = gcloud('config', 'get-value', 'account');
  console.log(`Conta do gcloud: ${usuario}`);
  const passo = (rotulo: string, ...a: string[]): void => {
    try { gcloud(...a); console.log(`OK   ${rotulo}`); } catch (e) {
      const m = e instanceof Error ? (e as Error & { stderr?: string }).stderr ?? e.message : String(e);
      if (/already exists|ALREADY_EXISTS/.test(m)) console.log(`OK   ${rotulo} (já existia)`); else { console.error(`FALHA ${rotulo}:\n${m.slice(0, 400)}`); process.exit(1); }
    }
  };
  passo(`projeto ${projeto}`, 'projects', 'create', projeto, '--name=Gestao Carteira POC');
  passo('APIs Sheets/Drive/Apps Script/IAM Credentials', 'services', 'enable', 'sheets.googleapis.com', 'drive.googleapis.com', 'script.googleapis.com', 'iamcredentials.googleapis.com', `--project=${projeto}`);
  passo('service account carteira-pipeline (sem chave)', 'iam', 'service-accounts', 'create', 'carteira-pipeline', '--display-name=Pipeline Gestao Carteira', `--project=${projeto}`);
  passo('permissão de impersonation para o usuário', 'iam', 'service-accounts', 'add-iam-policy-binding', contaServico, `--member=user:${usuario}`, '--role=roles/iam.serviceAccountTokenCreator', `--project=${projeto}`);
}

writeFileSync(caminhoConfig, `${JSON.stringify({ planilhaId: planilha, scriptId: script, projetoGcp: projeto, contaServico }, null, 2)}\n`, 'utf8');

const clasp = `${raiz}apps-script/.clasp.json`;
const c = JSON.parse(readFileSync(clasp, 'utf8')) as Record<string, unknown>;
c.scriptId = script;
writeFileSync(clasp, `${JSON.stringify(c, null, 2)}\n`, 'utf8');

const codigo = `${raiz}apps-script/Codigo.js`;
const fonte = readFileSync(codigo, 'utf8');
if (!/var PLANILHA_PADRAO = '[^']*';/.test(fonte)) throw new Error('PLANILHA_PADRAO não encontrada em apps-script/Codigo.js');
writeFileSync(codigo, fonte.replace(/var PLANILHA_PADRAO = '[^']*';/, `var PLANILHA_PADRAO = '${planilha}';`), 'utf8');

console.log(`\nConfigurado.\n  planilha: ${planilha}\n  script:   ${script}\n  projeto GCP: ${projeto || '(nenhum — use --gcp para criar)'}\n  service account: ${contaServico || '(nenhuma)'}\n`);
console.log('Próximos passos:');
if (contaServico) console.log(`  1) Compartilhe a planilha como EDITOR com: ${contaServico}`);
console.log('  2) npm run setup:conta -- --verificar');
console.log('  3) npm run sheets:carga        (popula as 14 abas com os dados sintéticos)');
console.log('  4) npm run gas:build && npm run apps-script:push');
console.log('  5) (dentro de apps-script/) clasp deploy --description "POC"   → abra a URL /exec');
