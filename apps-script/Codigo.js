/**
 * Apps Script da POC — HOMOLOGAÇÃO da planilha (dados sintéticos) e consultas "visualizar como".
 * Regras em rules.js (testadas em Node contra o núcleo TypeScript); esquema em schema.js (gerado).
 * Não há implantação de web app: execute `homologar` pelo editor (▶) ou publique manualmente quando precisar.
 */
/**
 * Planilha de dados. O projeto é AUTOCONTIDO e transferível entre contas Google:
 *  - usa a planilha guardada nas propriedades do script (PLANILHA_ID);
 *  - se não houver, tenta a planilha de homologação abaixo (somente se a conta tiver acesso);
 *  - se a conta não enxerga nenhuma, CRIA uma nova planilha no Drive de quem executa e a popula com o cenário demo.
 * Para trocar de conta: copie/transfira o projeto, abra o app (ou rode `instalar`) e publique novamente o web app.
 */
var PLANILHA_PADRAO = '1ftzp2MniTBOxbn8IX6dYPpeZEZKPSc5AX5Q5zVw4W8g';
var NOME_PLANILHA = 'Gestão de Carteira Bancária — POC (dados sintéticos)';
var ABA_RESULTADO = 'homologacao_resultado';


function acessivel_(id) {
  try { SpreadsheetApp.openById(id).getName(); return true; } catch (e) { return false; }
}

/** Resolve (e memoriza) o id da planilha desta conta; cria e popula uma nova se necessário. */
function planilhaId() {
  var cache = CacheService.getScriptCache();
  var emCache = cache.get('carteira:planilha');
  if (emCache) return emCache;
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('PLANILHA_ID');
  if (!id && acessivel_(PLANILHA_PADRAO)) id = PLANILHA_PADRAO;
  if (!id || !acessivel_(id)) id = instalar();
  props.setProperty('PLANILHA_ID', id);
  cache.put('carteira:planilha', id, 21600);
  return id;
}

/**
 * INSTALAÇÃO: cria uma planilha nova no Drive de quem executa, com as 14 abas e o cenário demo (dados sintéticos).
 * Rode no editor (▶) em uma conta nova, ou deixe o app rodar sozinho na primeira abertura.
 */
function instalar() {
  var ss = SpreadsheetApp.create(NOME_PLANILHA);
  var id = ss.getId();
  PropertiesService.getScriptProperties().setProperty('PLANILHA_ID', id);
  CacheService.getScriptCache().put('carteira:planilha', id, 21600);
  CARTEIRA.instalarEm(id);
  Logger.log('Planilha criada: ' + ss.getUrl());
  return id;
}

/** Aponta o app para outra planilha existente (com as 14 abas). */
function usarPlanilha(id) {
  PropertiesService.getScriptProperties().setProperty('PLANILHA_ID', id);
  CacheService.getScriptCache().removeAll(['carteira:planilha']);
  return acessivel_(id);
}

/** URL da planilha em uso (para conferir os dados). */
function urlDaPlanilha() {
  return SpreadsheetApp.openById(planilhaId()).getUrl();
}

function lerTabelas_() {
  var ss = SpreadsheetApp.openById(planilhaId());
  var t = {};
  Object.keys(ESQUEMA).forEach(function (nome) {
    var aba = ss.getSheetByName(nome);
    if (!aba) throw new Error('Aba ausente: ' + nome);
    var valores = aba.getDataRange().getValues();
    var cab = valores[0].map(String);
    var colunas = ESQUEMA[nome].colunas;
    var idx = {};
    colunas.forEach(function (c) {
      idx[c.nome] = cab.indexOf(c.nome);
      if (idx[c.nome] < 0) throw new Error('Aba ' + nome + ': coluna ausente ' + c.nome);
    });
    t[nome] = valores.slice(1).filter(function (l) { return l.some(function (c) { return c !== ''; }); }).map(function (l) {
      var o = {};
      colunas.forEach(function (c) {
        var v = l[idx[c.nome]];
        if (v instanceof Date) v = Utilities.formatDate(v, FUSO, 'yyyy-MM-dd');
        o[c.nome] = c.tipo === 'number' ? Number(v === '' ? 0 : v) : (v === '' ? '' : String(v));
      });
      return o;
    });
  });
  return t;
}

/** Verificação de esquema: cabeçalhos exatamente iguais ao dicionário de dados (domínio 06). */
function verificarEsquema_() {
  var ss = SpreadsheetApp.openById(planilhaId());
  return Object.keys(ESQUEMA).map(function (nome) {
    var aba = ss.getSheetByName(nome);
    if (!aba) return { check: 'Esquema ' + nome, status: 'FALHA', detalhe: 'Aba ausente' };
    var cab = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0].map(String);
    var esperado = ESQUEMA[nome].colunas.map(function (c) { return c.nome; });
    var ok = cab.length === esperado.length && esperado.every(function (n, i) { return cab[i] === n; });
    return { check: 'Esquema ' + nome, status: ok ? 'OK' : 'FALHA', detalhe: ok ? esperado.length + ' colunas' : 'Cabeçalho difere do dicionário' };
  });
}

var REGRAS_INTEGRIDADE = ['PK_DUPLICADA', 'FK', 'DOMINIO', 'INTERVALO', 'OCUPACAO_SOBREPOSTA', 'GERENTE_EM_DUAS_POSICOES', 'DELEGACAO_SOBREPOSTA',
  'DOCUMENTO_INVALIDO', 'DOCUMENTO_DUPLICADO', 'DOCUMENTO_NAO_SINTETICO', 'VINCULO_VIGENTE', 'PROJECAO_DIVERGENTE'];

/** Monta a lista de resultados a partir das tabelas (testável em Node com a mesma lógica). */
function avaliarHomologacao(t, resultadosEsquema) {
  var resultados = (resultadosEsquema || []).slice();
  Object.keys(ESQUEMA).forEach(function (nome) { resultados.push({ check: 'Linhas ' + nome, status: 'OK', detalhe: t[nome].length + ' linhas' }); });
  var violacoes = verificarIntegridade(t, ESQUEMA);
  REGRAS_INTEGRIDADE.forEach(function (r) {
    var n = violacoes.filter(function (v) { return v.regra === r; });
    resultados.push({ check: 'Integridade ' + r, status: n.length === 0 ? 'OK' : 'FALHA', detalhe: n.length === 0 ? '0 violações' : n.length + ' violações; ex.: ' + n[0].tabela + ' ' + n[0].chave });
  });
  verificarCenarios(t).forEach(function (c) { resultados.push(c); });
  return resultados;
}

/** Executa todas as verificações e grava o resultado na aba homologacao_resultado. */
function homologar() {
  var inicio = new Date();
  var resultados = avaliarHomologacao(lerTabelas_(), verificarEsquema_());
  var ss = SpreadsheetApp.openById(planilhaId());
  var aba = ss.getSheetByName(ABA_RESULTADO) || ss.insertSheet(ABA_RESULTADO);
  aba.clear();
  var carimbo = Utilities.formatDate(new Date(), FUSO, "yyyy-MM-dd'T'HH:mm:ssXXX");
  var linhas = [['instante', 'check', 'status', 'detalhe']].concat(resultados.map(function (r) { return [carimbo, r.check, r.status, r.detalhe]; }));
  aba.getRange(1, 1, linhas.length, 4).setValues(linhas);
  aba.getRange(1, 1, 1, 4).setFontWeight('bold');
  aba.setFrozenRows(1);
  var resumo = {
    total: resultados.length,
    ok: resultados.filter(function (r) { return r.status === 'OK'; }).length,
    falhas: resultados.filter(function (r) { return r.status === 'FALHA'; }).length,
    na: resultados.filter(function (r) { return r.status === 'N/A'; }).length,
    duracao_ms: new Date() - inicio,
  };
  Logger.log(JSON.stringify(resumo));
  return resumo;
}

/** Diagnóstico de acesso: quem executa o script e se enxerga a planilha (útil quando openById falha). */
function diagnostico() {
  var saida = { executando_como: Session.getEffectiveUser().getEmail(), spreadsheet_id: planilhaId() };
  try {
    var f = DriveApp.getFileById(planilhaId());
    saida.arquivo = f.getName();
    saida.dono = f.getOwner() ? f.getOwner().getEmail() : '(sem dono visível)';
  } catch (e) { saida.erro_drive = String(e); }
  try {
    saida.abas = SpreadsheetApp.openById(planilhaId()).getSheets().map(function (s) { return s.getName(); });
  } catch (e) { saida.erro_planilha = String(e); }
  Logger.log(JSON.stringify(saida));
  return saida;
}

/** Posições que o gerente (por e-mail) pode operar numa data — versão atualizada da função do Plano Geral. */
function getPosicoesPermitidas(userEmail, dataISO) {
  var t = lerTabelas_();
  var g = t.dim_gerentes.filter(function (x) { return x.email_corporativo.toLowerCase() === String(userEmail).toLowerCase(); })[0];
  if (!g) return [];
  return posicoesPermitidas(t, g.id_gerente, instanteDe_(dataISO)).map(function (p) { return p.id_posicao; });
}

function getClientesUsuarioLogado() {
  var t = lerTabelas_();
  var email = Session.getActiveUser().getEmail();
  var g = t.dim_gerentes.filter(function (x) { return x.email_corporativo.toLowerCase() === email.toLowerCase(); })[0];
  return g ? clientesVisiveis(t, g.id_gerente, new Date()) : [];
}

/** "Visualizar como": papel = 'GG' ou id da posição (ex.: 'POS-AG01-002'); data opcional (AAAA-MM-DD). */
function getClientesPorPapel(papel, dataISO) {
  var t = lerTabelas_();
  var instante = instanteDe_(dataISO);
  var ator = resolverPapel(t, papel, instante);
  return ator ? clientesVisiveis(t, ator, instante) : [];
}

function instanteDe_(dataISO) {
  return dataISO ? new Date(dataISO + 'T12:00:00-03:00') : new Date();
}

/**
 * Aplicativo web: `index.html` é um template que compõe o runtime (React + design system), cada micro-frontend
 * (mfe-*.html) e o shell. Gerado por `npm run gas:build`.
 * O front chama `apiChamar` por google.script.run; o backend (nucleo.js, dominio-*.js, api.js…) é o mesmo núcleo de domínio da API REST.
 */
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Gestão de Carteira Bancária — POC')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Inclui um arquivo HTML (estilos, runtime, micro-frontends, shell) dentro do template `index`. */
function incluir(nome) {
  return HtmlService.createHtmlOutputFromFile(nome).getContent();
}

/** Única porta de entrada do backend para o front (google.script.run só enxerga funções de nível superior). */
function apiChamar(req) {
  return CARTEIRA.apiChamar(req);
}

/** Consulta JSON auxiliar para depuração no editor (?papel=POS-AG01-002&data=2026-11-05) — use doGetJson_ no console. */
function consultaJson(papel, data) {
  return getClientesPorPapel(papel || 'GG', data).slice(0, 50);
}

/** Teste de vida do projeto (sem acesso a serviços). */
function ping() { return "pong " + new Date().toISOString(); }
