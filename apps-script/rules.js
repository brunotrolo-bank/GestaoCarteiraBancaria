/**
 * Regras de negócio da POC em JavaScript puro (sem serviços do Apps Script), para poderem ser testadas em Node e
 * executadas no Apps Script. Espelham o núcleo TypeScript (packages/core): posição ≠ pessoa, delegação por datas
 * inclusivas, acesso por titularidade/delegação, integridade dos dados. Teste de equivalência: apps-script/test.
 *
 * Convenção: `t` é um objeto { nome_da_tabela: [linhas como objetos] }; datas de negócio são 'AAAA-MM-DD'.
 */

var FUSO = 'America/Sao_Paulo';

function diaDe(instante) {
  var d = instante instanceof Date ? instante : new Date(instante);
  try {
    var partes = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    if (/^\d{4}-\d{2}-\d{2}$/.test(partes)) return partes;
  } catch (e) { /* fallback abaixo */ }
  return new Date(d.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10); // Brasil sem horário de verão desde 2019
}

function noIntervalo(dia, inicio, fim) {
  return dia >= inicio && (fim === null || fim === '' || fim === undefined || dia <= fim);
}

function sobrepostos(a, b) {
  var aTerminaAntes = a.fim !== null && a.fim !== '' && a.fim < b.inicio;
  var bTerminaAntes = b.fim !== null && b.fim !== '' && b.fim < a.inicio;
  return !aTerminaAntes && !bTerminaAntes;
}

function nulo(v) { return v === '' || v === undefined || v === null ? null : v; }

/** Delegação vigente: Aprovada, dentro das datas (inclusivas), não revogada, com delegado Ativo. */
function delegacoesVigentes(t, instante) {
  var dia = diaDe(instante);
  var ms = (instante instanceof Date ? instante : new Date(instante)).getTime();
  return t.fct_delegacoes.filter(function (d) {
    if (d.status_aprovacao !== 'Aprovada') return false;
    var rev = nulo(d.revogada_em);
    if (rev !== null && ms >= new Date(rev).getTime()) return false;
    if (!noIntervalo(dia, d.data_inicio, d.data_fim)) return false;
    var g = t.dim_gerentes.filter(function (x) { return x.id_gerente === d.id_gerente_delegado; })[0];
    return !!g && g.status === 'Ativo';
  });
}

/**
 * Posições que o gerente pode ver no instante, com o modo (Escrita/Leitura) — equivalente a `resolverAcessos` do TypeScript.
 * Negação por padrão; modo mais permissivo prevalece; titular com posição sob cobertura vigente fica em Leitura.
 */
function posicoesPermitidas(t, idGerente, instante) {
  var g = t.dim_gerentes.filter(function (x) { return x.id_gerente === idGerente; })[0];
  if (!g || g.status !== 'Ativo') return [];
  var mapa = {};
  var ordem = [];
  function somar(id, modo, origem) {
    if (!mapa[id]) { mapa[id] = { id_posicao: id, modo: modo, origens: [origem] }; ordem.push(id); return; }
    mapa[id].origens.push(origem);
    if (modo === 'Escrita') mapa[id].modo = 'Escrita';
  }
  if (g.perfil === 'Gerente Geral') {
    t.dim_posicoes.forEach(function (p) { somar(p.id_posicao, 'Leitura', 'GerenteGeral'); });
    return ordem.map(function (id) { return mapa[id]; });
  }
  var dia = diaDe(instante);
  var vigentes = delegacoesVigentes(t, instante);
  var oc = t.bridge_ocupacao_posicao.filter(function (o) { return o.id_gerente === idGerente && noIntervalo(dia, o.data_inicio, nulo(o.data_fim)); })[0];
  if (oc) {
    var sob = vigentes.some(function (d) { return d.id_posicao_origem === oc.id_posicao; });
    somar(oc.id_posicao, sob ? 'Leitura' : 'Escrita', 'Titular');
  }
  vigentes.filter(function (d) { return d.id_gerente_delegado === idGerente; }).forEach(function (d) {
    somar(d.id_posicao_origem, d.escopo === 'Total' ? 'Escrita' : 'Leitura', 'Delegado');
  });
  return ordem.map(function (id) { return mapa[id]; });
}

function posicaoDoCliente(t, idCliente, instante) {
  var ms = (instante instanceof Date ? instante : new Date(instante)).getTime();
  var v = t.bridge_vinculo_carteira.filter(function (x) {
    return x.id_cliente === idCliente && new Date(x.inicio_em).getTime() <= ms && (nulo(x.fim_em) === null || ms < new Date(x.fim_em).getTime());
  })[0];
  if (v) return v.id_posicao;
  var futuro = t.bridge_vinculo_carteira.some(function (x) { return x.id_cliente === idCliente && new Date(x.inicio_em).getTime() > ms; });
  if (futuro) return null;
  var c = t.dim_clientes.filter(function (x) { return x.id_cliente === idCliente; })[0];
  return c ? c.id_posicao_carteira : null;
}

/** Clientes visíveis ao gerente no instante, com CPF/CNPJ SEMPRE mascarado. */
function clientesVisiveis(t, idGerente, instante) {
  var permitidas = {};
  posicoesPermitidas(t, idGerente, instante).forEach(function (p) { permitidas[p.id_posicao] = p.modo; });
  var saida = [];
  t.dim_clientes.forEach(function (c) {
    var pos = posicaoDoCliente(t, c.id_cliente, instante);
    if (pos && permitidas[pos]) {
      saida.push({
        id_cliente: c.id_cliente, nome_razao_social: c.nome_razao_social, cpf_cnpj_mascarado: mascararDocumento(c.cpf_cnpj),
        segmento_cliente: c.segmento_cliente, volume_aum: c.volume_aum, status: c.status, id_posicao: pos, modo: permitidas[pos],
      });
    }
  });
  return saida;
}

/** Ator do "visualizar como": 'GG' ou id de posição → titular vigente no instante (null se vaga). */
function resolverPapel(t, papel, instante) {
  if (papel === 'GG') {
    var gg = t.dim_gerentes.filter(function (g) { return g.perfil === 'Gerente Geral' && g.status === 'Ativo'; })[0];
    return gg ? gg.id_gerente : null;
  }
  var dia = diaDe(instante);
  var oc = t.bridge_ocupacao_posicao.filter(function (o) { return o.id_posicao === papel && noIntervalo(dia, o.data_inicio, nulo(o.data_fim)); })[0];
  return oc ? oc.id_gerente : null;
}

// ---------- documentos ----------
function digitos(s) { return String(s === null || s === undefined ? '' : s).replace(/\D/g, ''); }

function dvCpf(base) {
  var soma = 0;
  for (var i = 0; i < base.length; i++) soma += base[i] * (base.length + 1 - i);
  var r = (soma * 10) % 11;
  return r === 10 ? 0 : r;
}
function dvCnpj(base) {
  var pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  var soma = 0;
  for (var i = 0; i < base.length; i++) soma += base[i] * pesos[i];
  var r = soma % 11;
  return r < 2 ? 0 : 11 - r;
}
function documentoValido(doc) {
  var d = digitos(doc);
  if (/^(\d)\1+$/.test(d)) return false;
  var n = d.split('').map(Number);
  if (d.length === 11) return dvCpf(n.slice(0, 9)) === n[9] && dvCpf(n.slice(0, 10)) === n[10];
  if (d.length === 14) return dvCnpj(n.slice(0, 12)) === n[12] && dvCnpj(n.slice(0, 13)) === n[13];
  return false;
}
function documentoSintetico(doc) {
  var d = digitos(doc);
  return (d.length === 11 && d.indexOf('999') === 0) || (d.length === 14 && d.indexOf('99999') === 0);
}
function mascararDocumento(doc) {
  var d = digitos(doc);
  if (d.length === 11) return '***.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-**';
  if (d.length === 14) return '**.***.' + d.slice(5, 8) + '/' + d.slice(8, 12) + '-**';
  return '***';
}

// ---------- integridade (equivalente a verificarIntegridade do TypeScript) ----------
function verificarIntegridade(t, esquema) {
  var v = [];
  function add(regra, tabela, chave, detalhe) { v.push({ regra: regra, tabela: tabela, chave: chave, detalhe: detalhe }); }
  function conjunto(tab, campo) { var s = {}; (t[tab] || []).forEach(function (l) { s[String(l[campo])] = true; }); return s; }

  Object.keys(esquema).forEach(function (tab) {
    var vistos = {};
    (t[tab] || []).forEach(function (l) {
      var chave = esquema[tab].pk.map(function (c) { return String(l[c]); }).join('|');
      if (vistos[chave]) add('PK_DUPLICADA', tab, chave, 'Chave primária repetida');
      vistos[chave] = true;
    });
  });

  var posicoes = conjunto('dim_posicoes', 'id_posicao'), gerentes = conjunto('dim_gerentes', 'id_gerente'), clientes = conjunto('dim_clientes', 'id_cliente');
  var agencias = conjunto('dim_agencias', 'id_agencia'), produtos = conjunto('ref_produtos', 'codigo'), segmentos = conjunto('ref_segmentos', 'codigo');

  t.dim_posicoes.forEach(function (p) { if (!agencias[p.id_agencia]) add('FK', 'dim_posicoes', p.id_posicao, 'Agência ' + p.id_agencia + ' inexistente'); });
  t.bridge_ocupacao_posicao.forEach(function (o) {
    if (!posicoes[o.id_posicao]) add('FK', 'bridge_ocupacao_posicao', o.id_ocupacao, 'Posição ' + o.id_posicao + ' inexistente');
    if (!gerentes[o.id_gerente]) add('FK', 'bridge_ocupacao_posicao', o.id_ocupacao, 'Gerente ' + o.id_gerente + ' inexistente');
  });
  t.fct_delegacoes.forEach(function (d) {
    if (!posicoes[d.id_posicao_origem]) add('FK', 'fct_delegacoes', d.id_delegacao, 'Posição ' + d.id_posicao_origem + ' inexistente');
    if (!gerentes[d.id_gerente_delegado]) add('FK', 'fct_delegacoes', d.id_delegacao, 'Gerente ' + d.id_gerente_delegado + ' inexistente');
  });
  t.dim_clientes.forEach(function (c) {
    if (!posicoes[c.id_posicao_carteira]) add('FK', 'dim_clientes', c.id_cliente, 'Posição ' + c.id_posicao_carteira + ' inexistente');
    if (!segmentos[c.segmento_cliente]) add('DOMINIO', 'dim_clientes', c.id_cliente, 'Segmento ' + c.segmento_cliente + ' fora do catálogo');
  });
  t.bridge_vinculo_carteira.forEach(function (x) {
    if (!clientes[x.id_cliente]) add('FK', 'bridge_vinculo_carteira', x.id_vinculo, 'Cliente ' + x.id_cliente + ' inexistente');
    if (!posicoes[x.id_posicao]) add('FK', 'bridge_vinculo_carteira', x.id_vinculo, 'Posição ' + x.id_posicao + ' inexistente');
  });
  t.fct_produtos_cliente.forEach(function (x) {
    if (!clientes[x.id_cliente]) add('FK', 'fct_produtos_cliente', x.id_cliente, 'Cliente inexistente');
    if (!produtos[x.codigo_produto]) add('FK', 'fct_produtos_cliente', x.id_cliente, 'Produto ' + x.codigo_produto + ' fora do catálogo');
  });
  t.fct_movimentacao_carteira.forEach(function (m) { if (!clientes[m.id_cliente]) add('FK', 'fct_movimentacao_carteira', m.id_movimentacao, 'Cliente inexistente'); });

  var isoData = function (s) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s; };
  var oc = t.bridge_ocupacao_posicao;
  for (var i = 0; i < oc.length; i++) {
    var a = oc[i], af = nulo(a.data_fim);
    if (!isoData(a.data_inicio) || (af !== null && (!isoData(af) || af < a.data_inicio))) add('INTERVALO', 'bridge_ocupacao_posicao', a.id_ocupacao, 'Intervalo inválido');
    for (var j = i + 1; j < oc.length; j++) {
      var b = oc[j];
      if (!sobrepostos({ inicio: a.data_inicio, fim: af }, { inicio: b.data_inicio, fim: nulo(b.data_fim) })) continue;
      if (a.id_posicao === b.id_posicao) add('OCUPACAO_SOBREPOSTA', 'bridge_ocupacao_posicao', a.id_ocupacao + '|' + b.id_ocupacao, 'Posição ' + a.id_posicao + ' com dois titulares simultâneos');
      if (a.id_gerente === b.id_gerente) add('GERENTE_EM_DUAS_POSICOES', 'bridge_ocupacao_posicao', a.id_ocupacao + '|' + b.id_ocupacao, 'Gerente ' + a.id_gerente + ' em duas posições simultâneas');
    }
  }
  var dl = t.fct_delegacoes;
  for (var k = 0; k < dl.length; k++) {
    var x = dl[k];
    if (!isoData(x.data_inicio) || !isoData(x.data_fim) || x.data_fim < x.data_inicio) add('INTERVALO', 'fct_delegacoes', x.id_delegacao, 'Período inválido');
    if (x.status_aprovacao !== 'Aprovada') continue;
    for (var m = k + 1; m < dl.length; m++) {
      var y = dl[m];
      if (y.status_aprovacao === 'Aprovada' && x.id_posicao_origem === y.id_posicao_origem && sobrepostos({ inicio: x.data_inicio, fim: x.data_fim }, { inicio: y.data_inicio, fim: y.data_fim })) {
        add('DELEGACAO_SOBREPOSTA', 'fct_delegacoes', x.id_delegacao + '|' + y.id_delegacao, 'Delegações aprovadas sobrepostas na posição ' + x.id_posicao_origem);
      }
    }
  }
  var docs = {};
  t.dim_clientes.forEach(function (c) {
    var d = digitos(c.cpf_cnpj);
    if (!documentoValido(d)) add('DOCUMENTO_INVALIDO', 'dim_clientes', c.id_cliente, 'Dígito verificador inválido');
    if (docs[d]) add('DOCUMENTO_DUPLICADO', 'dim_clientes', c.id_cliente, 'CPF/CNPJ repetido');
    docs[d] = true;
    if (!documentoSintetico(d)) add('DOCUMENTO_NAO_SINTETICO', 'dim_clientes', c.id_cliente, 'Documento sem o marcador de dado sintético');
    if (c.volume_aum < 0) add('DOMINIO', 'dim_clientes', c.id_cliente, 'AUM negativo');
    if (!(c.score_risco >= 1 && c.score_risco <= 1000)) add('DOMINIO', 'dim_clientes', c.id_cliente, 'Score fora de 1..1000');
    var vig = t.bridge_vinculo_carteira.filter(function (z) { return z.id_cliente === c.id_cliente && nulo(z.fim_em) === null; });
    if (vig.length !== 1) add('VINCULO_VIGENTE', 'bridge_vinculo_carteira', c.id_cliente, 'Esperado 1 vínculo vigente, encontrado ' + vig.length);
    else if (vig[0].id_posicao !== c.id_posicao_carteira) add('PROJECAO_DIVERGENTE', 'dim_clientes', c.id_cliente, 'id_posicao_carteira diverge do vínculo vigente');
  });
  return v;
}

// ---------- cenários de homologação (J1, J2, J3) ----------
function utilizacao(t, idPosicao) {
  var p = t.dim_posicoes.filter(function (x) { return x.id_posicao === idPosicao; })[0];
  var ativos = t.dim_clientes.filter(function (c) { return c.id_posicao_carteira === idPosicao && c.status === 'Ativo'; }).length;
  return { clientes_ativos: ativos, capacidade: p.capacidade_max_contas, utilizacao: ativos / p.capacidade_max_contas };
}

/** Cenário informado pela carga (linha SEED_CARREGADO da auditoria); null se desconhecido. */
function cenarioDeCarga(t) {
  var l = t.log_auditoria.filter(function (x) { return x.acao === 'SEED_CARREGADO'; })[0];
  if (!l) return null;
  try { return JSON.parse(l.detalhe).cenario || null; } catch (e) { return null; }
}

function idsOrdenados(lista) { return lista.map(function (p) { return p.id_posicao; }).sort(); }

/**
 * Verifica os cenários de negócio sobre os dados vivos. Cada item: { check, status: 'OK'|'FALHA'|'N/A', detalhe }.
 * Os cenários J2/J3 dependem do dataset "demo"; se ele não estiver carregado, resultam 'N/A' (não falham).
 */
function verificarCenarios(t) {
  var r = [];
  function chk(nome, ok, detalhe) { r.push({ check: nome, status: ok ? 'OK' : 'FALHA', detalhe: detalhe || '' }); }
  function na(nome, detalhe) { r.push({ check: nome, status: 'N/A', detalhe: detalhe }); }
  function em(dia, hora) { return new Date(dia + 'T' + (hora || '12:00:00') + '-03:00'); }

  var gg = resolverPapel(t, 'GG', em('2026-10-01'));
  chk('GG existe e vê todas as posições', !!gg && posicoesPermitidas(t, gg, em('2026-10-01')).length === t.dim_posicoes.length, 'GG=' + gg);

  var titulares = {};
  t.dim_posicoes.forEach(function (p) { titulares[p.id_posicao] = resolverPapel(t, p.id_posicao, em('2026-10-01')); });
  var todosComTitular = Object.keys(titulares).every(function (k) { return titulares[k]; });
  chk('Toda posição ativa tem titular vigente', t.dim_posicoes.filter(function (p) { return p.status === 'Ativa'; }).every(function (p) { return titulares[p.id_posicao]; }), JSON.stringify(titulares));

  // Isolamento: cada titular só vê clientes da própria posição fora de vigência de delegação
  var vazamento = 0;
  Object.keys(titulares).forEach(function (pos) {
    if (!titulares[pos]) return;
    clientesVisiveis(t, titulares[pos], em('2026-10-01')).forEach(function (c) { if (c.id_posicao !== pos) vazamento++; });
  });
  chk('Isolamento: titular não vê clientes de outra posição (01/10/2026)', vazamento === 0, 'vazamentos=' + vazamento);

  var visGG = clientesVisiveis(t, gg, em('2026-10-01')).length;
  chk('GG vê todos os clientes (soma das carteiras = total)', visGG === t.dim_clientes.length, visGG + ' de ' + t.dim_clientes.length);

  var semPII = clientesVisiveis(t, gg, em('2026-10-01')).every(function (c) { return /\*/.test(c.cpf_cnpj_mascarado) && digitos(c.cpf_cnpj_mascarado).length < 11; });
  chk('CPF/CNPJ sempre mascarado nas saídas', semPII, '');

  var del1 = t.fct_delegacoes.filter(function (d) { return d.id_delegacao === 'DEL-0001'; })[0];
  if (!del1 || !t.dim_posicoes.some(function (p) { return p.id_posicao === 'POS-AG01-001'; })) {
    na('J2 cobertura de férias', 'Dataset demo não carregado');
  } else {
    var delegado = del1.id_gerente_delegado, titularOrigem = titulares[del1.id_posicao_origem];
    var dentro = idsOrdenados(posicoesPermitidas(t, delegado, em('2026-11-05')));
    var fora = idsOrdenados(posicoesPermitidas(t, delegado, em('2026-11-16', '00:00:00')));
    var modoTitular = (posicoesPermitidas(t, titularOrigem, em('2026-11-05')).filter(function (p) { return p.id_posicao === del1.id_posicao_origem; })[0] || {}).modo;
    chk('J2: delegado vê própria + delegada em 05/11', dentro.length === 2 && dentro.indexOf(del1.id_posicao_origem) >= 0, dentro.join(','));
    chk('J2: acesso expira sozinho em 16/11 (00:00)', fora.length === 1 && fora.indexOf(del1.id_posicao_origem) < 0, fora.join(','));
    chk('J2: limites inclusivos (01/11 e 15/11 dentro; 31/10 fora)',
      posicoesPermitidas(t, delegado, em('2026-11-01', '00:00:00')).length === 2 && posicoesPermitidas(t, delegado, em('2026-11-15', '23:59:59')).length === 2 && posicoesPermitidas(t, delegado, em('2026-10-31', '23:59:59')).length === 1, '');
    chk('J2: titular ausente fica somente leitura durante a cobertura', modoTitular === 'Leitura', 'modo=' + modoTitular);
    var sub = t.fct_delegacoes.filter(function (d) { return d.status_aprovacao === 'Submetida'; })[0];
    if (sub) chk('Delegação Submetida não concede acesso', !posicoesPermitidas(t, sub.id_gerente_delegado, em(sub.data_inicio)).some(function (p) { return p.id_posicao === sub.id_posicao_origem && p.origens.indexOf('Delegado') >= 0; }), sub.id_delegacao);
  }
  var u1 = t.dim_posicoes.some(function (p) { return p.id_posicao === 'POS-AG01-001'; }) ? utilizacao(t, 'POS-AG01-001') : null;
  var u4 = t.dim_posicoes.some(function (p) { return p.id_posicao === 'POS-AG01-004'; }) ? utilizacao(t, 'POS-AG01-004') : null;
  if (!u1 || !u4 || cenarioDeCarga(t) !== 'demo') na('J3 desbalanceamento', 'Dataset demo não carregado');
  else chk('J3: POS-001 a 120% e POS-004 a 40% da capacidade', Math.abs(u1.utilizacao - 1.2) < 1e-9 && Math.abs(u4.utilizacao - 0.4) < 1e-9, Math.round(u1.utilizacao * 100) + '% / ' + Math.round(u4.utilizacao * 100) + '%');
  var vag = t.bridge_ocupacao_posicao.filter(function (o) { return o.id_posicao === 'POS-AG01-005'; });
  if (vag.length >= 2) chk('Histórico de titularidade preservado (POS-005 com 2 ocupações, sem sobreposição)', vag.length === 2 && verificarIntegridade(t, ESQUEMA_VAZIO).filter(function (x) { return x.regra === 'OCUPACAO_SOBREPOSTA'; }).length === 0, vag.length + ' ocupações');
  return r;
}
var ESQUEMA_VAZIO = {};
