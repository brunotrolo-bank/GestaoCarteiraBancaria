/* GERADO por scripts/build-gas.ts a partir do repositório — não editar à mão (npm run gas:build). Domínio: insights */
"use strict";
var DOM_insights = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // global:../shared/dates.ts
  var require_dates = __commonJS({
    "global:../shared/dates.ts"(exports, module) {
      module.exports = CARTEIRA_NUCLEO;
    }
  });

  // global:../shared/errors.ts
  var require_errors = __commonJS({
    "global:../shared/errors.ts"(exports, module) {
      module.exports = CARTEIRA_NUCLEO;
    }
  });

  // global:../acesso/index.ts
  var require_acesso = __commonJS({
    "global:../acesso/index.ts"(exports, module) {
      module.exports = CARTEIRA_DOMINIOS.acesso;
    }
  });

  // global:../delegacao/index.ts
  var require_delegacao = __commonJS({
    "global:../delegacao/index.ts"(exports, module) {
      module.exports = CARTEIRA_DOMINIOS.delegacao;
    }
  });

  // global:../posicoes/index.ts
  var require_posicoes = __commonJS({
    "global:../posicoes/index.ts"(exports, module) {
      module.exports = CARTEIRA_DOMINIOS.posicoes;
    }
  });

  // global:../clientes/index.ts
  var require_clientes = __commonJS({
    "global:../clientes/index.ts"(exports, module) {
      module.exports = CARTEIRA_DOMINIOS.clientes;
    }
  });

  // packages/core/src/insights/index.ts
  var index_exports = {};
  __export(index_exports, {
    LIMITE_INFERIOR: () => LIMITE_INFERIOR,
    LIMITE_SUPERIOR: () => LIMITE_SUPERIOR,
    analiseCarteira: () => analiseCarteira,
    carteiraDoAtor: () => carteiraDoAtor,
    classificarUtilizacao: () => classificarUtilizacao,
    clientesVisiveis: () => clientesVisiveis,
    desbalanceamentos: () => desbalanceamentos,
    exigirAtorAtivo: () => exigirAtorAtivo,
    resumoAgencia: () => resumoAgencia,
    resumoPosicao: () => resumoPosicao,
    visao360: () => visao360
  });
  var import_dates2 = __toESM(require_dates(), 1);
  var import_errors = __toESM(require_errors(), 1);
  var import_acesso2 = __toESM(require_acesso(), 1);
  var import_delegacao2 = __toESM(require_delegacao(), 1);
  var import_posicoes = __toESM(require_posicoes(), 1);
  var import_clientes = __toESM(require_clientes(), 1);

  // packages/core/src/insights/analise.ts
  var import_dates = __toESM(require_dates(), 1);
  var import_acesso = __toESM(require_acesso(), 1);
  var import_delegacao = __toESM(require_delegacao(), 1);
  var SEGMENTOS = ["UHNW", "Private", "Alta Renda", "Varejo"];
  var FAIXAS_AUM = [
    { faixa: "At\xE9 R$ 250 mil", ate: 25e4 },
    { faixa: "R$ 250 mil \u2013 1 mi", ate: 1e6 },
    { faixa: "R$ 1 \u2013 5 mi", ate: 5e6 },
    { faixa: "R$ 5 \u2013 25 mi", ate: 25e6 },
    { faixa: "Acima de R$ 25 mi", ate: Infinity }
  ];
  var FAIXAS_SCORE = [
    { faixa: "At\xE9 499", ate: 499 },
    { faixa: "500 \u2013 699", ate: 699 },
    { faixa: "700 \u2013 849", ate: 849 },
    { faixa: "850 ou mais", ate: Infinity }
  ];
  var DIAS_SEM_CONTATO = 90;
  var MESES_SERIE = 12;
  var pct = (a, b) => b === 0 ? 0 : Math.round(a / b * 1e3) / 10;
  var centavos = (xs) => xs.reduce((a, b) => a + Math.round(b * 100), 0) / 100;
  var dias = (de, ate) => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 864e5);
  var mesesAte = (hoje, n) => {
    const [a, m] = hoje.split("-").map(Number);
    return Array.from({ length: n }, (_, i) => {
      const total = a * 12 + (m - 1) - (n - i);
      return `${Math.floor(total / 12)}-${String(total % 12 + 1).padStart(2, "0")}`;
    });
  };
  var brl = (v) => v >= 1e9 ? `R$ ${(v / 1e9).toFixed(2).replace(".", ",")} bi` : v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1).replace(".", ",")} mi` : `R$ ${Math.round(v / 1e3)} mil`;
  function analiseCarteira(db, ctx) {
    var _a, _b, _c;
    const hoje = (0, import_dates.diaDe)(ctx.instante);
    const resumo = resumoAgencia(db, ctx);
    const ativos = clientesVisiveis(db, ctx).filter((c) => c.status === "Ativo");
    const idsVisiveis = new Set(clientesVisiveis(db, ctx).map((c) => c.id_cliente));
    const totalAum = centavos(ativos.map((c) => c.volume_aum));
    const resumir = (c) => ({ id_cliente: c.id_cliente, nome: c.nome_razao_social, segmento: c.segmento_cliente, aum: c.volume_aum, id_posicao: c.posicao_no_instante });
    const porAum = [...ativos].sort((a, b) => b.volume_aum - a.volume_aum || a.id_cliente.localeCompare(b.id_cliente));
    const acumulado = (n) => pct(centavos(porAum.slice(0, n).map((c) => c.volume_aum)), totalAum);
    const curva = Array.from({ length: 11 }, (_, i) => ({ pct_clientes: i * 10, pct_aum: acumulado(Math.round(porAum.length * i / 10)) }));
    const concentracao = { maior_cliente_pct: acumulado(1), top10_pct: acumulado(10), top20pct_clientes_pct: acumulado(Math.ceil(porAum.length * 0.2)), curva };
    const faixa = (faixas, valor) => faixas.find((f) => valor <= f.ate);
    const faixas_aum = FAIXAS_AUM.map((f) => {
      const doGrupo = ativos.filter((c) => faixa(FAIXAS_AUM, c.volume_aum) === f);
      return { faixa: f.faixa, clientes: doGrupo.length, aum: centavos(doGrupo.map((c) => c.volume_aum)) };
    });
    const faixas_score = FAIXAS_SCORE.map((f) => ({ faixa: f.faixa, clientes: ativos.filter((c) => faixa(FAIXAS_SCORE, c.score_risco) === f).length }));
    const produtosAtivos = /* @__PURE__ */ new Map();
    for (const p of db.fct_produtos_cliente) {
      if (p.status !== "Ativo" || !idsVisiveis.has(p.id_cliente)) continue;
      produtosAtivos.set(p.id_cliente, ((_a = produtosAtivos.get(p.id_cliente)) != null ? _a : /* @__PURE__ */ new Set()).add(p.codigo_produto));
    }
    const qtd = (id) => {
      var _a2, _b2;
      return (_b2 = (_a2 = produtosAtivos.get(id)) == null ? void 0 : _a2.size) != null ? _b2 : 0;
    };
    const nomeProduto = new Map(db.ref_produtos.map((p) => [p.codigo, p.nome]));
    const produtos_por_cliente = [0, 1, 2, 3, 4].map((n) => ({
      produtos: n === 4 ? "4 ou mais" : n === 0 ? "Nenhum" : n === 1 ? "1 produto" : `${n} produtos`,
      clientes: ativos.filter((c) => n === 4 ? qtd(c.id_cliente) >= 4 : qtd(c.id_cliente) === n).length
    }));
    const meses = mesesAte(hoje, MESES_SERIE);
    const mesDe = (d) => d.slice(0, 7);
    const serie_mensal = meses.map((mes) => ({
      mes,
      contratacoes: db.fct_produtos_cliente.filter((p) => idsVisiveis.has(p.id_cliente) && mesDe(p.data_contratacao) === mes).length,
      interacoes: db.fct_interacoes_crm.filter((i) => idsVisiveis.has(i.id_cliente) && mesDe(i.data) === mes).length,
      novos_clientes: clientesVisiveis(db, ctx).filter((c) => mesDe(c.data_carteirizacao) === mes).length
    }));
    const inicio90 = (0, import_dates.addDays)(hoje, -DIAS_SEM_CONTATO);
    const ultimoContato = /* @__PURE__ */ new Map();
    const canais = /* @__PURE__ */ new Map();
    for (const i of db.fct_interacoes_crm) {
      if (!idsVisiveis.has(i.id_cliente) || i.data > hoje) continue;
      if (i.data > ((_b = ultimoContato.get(i.id_cliente)) != null ? _b : "")) ultimoContato.set(i.id_cliente, i.data);
      if (i.data > inicio90) canais.set(i.canal, ((_c = canais.get(i.canal)) != null ? _c : 0) + 1);
    }
    const semContato = ativos.filter((c) => {
      var _a2;
      return ((_a2 = ultimoContato.get(c.id_cliente)) != null ? _a2 : "") <= inicio90;
    });
    const prioritarios = [...semContato].sort((a, b) => b.volume_aum - a.volume_aum || a.id_cliente.localeCompare(b.id_cliente)).slice(0, 6).map((c) => ({ ...resumir(c), dias_sem_contato: ultimoContato.has(c.id_cliente) ? dias(ultimoContato.get(c.id_cliente), hoje) : null }));
    const oportunidades = ativos.filter((c) => qtd(c.id_cliente) <= 2).sort((a, b) => b.volume_aum - a.volume_aum || a.id_cliente.localeCompare(b.id_cliente)).slice(0, 6).map((c) => ({
      ...resumir(c),
      produtos_ativos: qtd(c.id_cliente),
      produtos_faltantes: db.ref_produtos.filter((p) => {
        var _a2;
        return !((_a2 = produtosAtivos.get(c.id_cliente)) == null ? void 0 : _a2.has(p.codigo));
      }).map((p) => p.nome)
    }));
    const mapa_posicao_segmento = resumo.posicoes.map((p) => ({
      id_posicao: p.id_posicao,
      nome_posicao: p.nome_posicao,
      celulas: SEGMENTOS.map((segmento) => ({ segmento, clientes: ativos.filter((c) => c.posicao_no_instante === p.id_posicao && c.segmento_cliente === segmento).length }))
    }));
    const visiveis = new Set((0, import_acesso.resolverAcessos)(db, ctx.idGerente, ctx.instante).posicoes.map((p) => p.id_posicao));
    const delegacoesVigentes = db.fct_delegacoes.filter((d) => visiveis.has(d.id_posicao_origem) && (0, import_delegacao.situacao)(d, ctx.instante) === "Em Vigor");
    const delegacoes = { vigentes: delegacoesVigentes.length, expirando_7d: delegacoesVigentes.filter((d) => dias(hoje, d.data_fim) <= 7).length };
    const top_clientes = porAum.slice(0, 5).map((c) => ({ ...resumir(c), pct_do_total: pct(c.volume_aum, totalAum) }));
    const insights = [];
    for (const p of resumo.posicoes.filter((x) => x.status === "Ativa" && x.desbalanceamento === "Acima")) {
      const folga = resumo.posicoes.filter((x) => x.status === "Ativa" && x.utilizacao < 0.9).sort((a, b) => a.utilizacao - b.utilizacao)[0];
      insights.push({
        severidade: "critico",
        titulo: `${p.nome_posicao} acima da capacidade`,
        detalhe: `${p.clientes_ativos} clientes para ${p.capacidade} vagas (${Math.round(p.utilizacao * 100)}%).${folga ? ` ${folga.nome_posicao} tem folga (${Math.round(folga.utilizacao * 100)}%): simule a redistribui\xE7\xE3o.` : ""}`,
        destino: "posicoes"
      });
    }
    for (const p of resumo.posicoes.filter((x) => x.status === "Ativa" && x.desbalanceamento === "Abaixo")) {
      insights.push({ severidade: "atencao", titulo: `${p.nome_posicao} subutilizada`, detalhe: `Apenas ${Math.round(p.utilizacao * 100)}% da capacidade em uso; pode receber clientes de posi\xE7\xF5es sobrecarregadas.`, destino: "posicoes" });
    }
    for (const p of resumo.posicoes.filter((x) => x.vaga && x.status === "Ativa")) {
      insights.push({ severidade: "critico", titulo: `${p.nome_posicao} sem titular`, detalhe: `A posi\xE7\xE3o tem ${p.clientes_ativos} clientes e nenhum gerente titular vigente.`, destino: "posicoes" });
    }
    if (delegacoes.expirando_7d > 0) {
      insights.push({ severidade: "atencao", titulo: `${delegacoes.expirando_7d} cobertura(s) terminam em at\xE9 7 dias`, detalhe: "Confirme o retorno do titular ou renove a delega\xE7\xE3o antes do fim da vig\xEAncia.", destino: "delegacoes" });
    }
    if (ativos.length > 0 && concentracao.top10_pct >= 40) {
      insights.push({ severidade: "atencao", titulo: "Carteira concentrada", detalhe: `Os 10 maiores clientes somam ${concentracao.top10_pct.toString().replace(".", ",")}% do AUM; o maior sozinho responde por ${concentracao.maior_cliente_pct.toString().replace(".", ",")}%.`, destino: "carteira" });
    }
    const valiosos = semContato.filter((c) => c.volume_aum >= 1e6);
    if (valiosos.length > 0) {
      insights.push({ severidade: "critico", titulo: `${valiosos.length} clientes acima de R$ 1 mi sem contato h\xE1 mais de ${DIAS_SEM_CONTATO} dias`, detalhe: `Somam ${brl(centavos(valiosos.map((c) => c.volume_aum)))} em AUM. Priorize o relacionamento.`, destino: "carteira" });
    } else if (semContato.length > 0) {
      insights.push({ severidade: "atencao", titulo: `${semContato.length} clientes sem contato h\xE1 mais de ${DIAS_SEM_CONTATO} dias`, detalhe: "Nenhum acima de R$ 1 mi, mas vale retomar o relacionamento.", destino: "carteira" });
    }
    const menor = [...resumo.penetracao_por_produto].sort((a, b) => a.penetracao - b.penetracao)[0];
    if (menor && ativos.length > 0) {
      insights.push({ severidade: "info", titulo: `${menor.nome} \xE9 o produto menos contratado`, detalhe: `Penetra\xE7\xE3o de ${Math.round(menor.penetracao * 100)}% (${menor.clientes} de ${ativos.length} clientes): maior espa\xE7o de venda cruzada.`, destino: "carteira" });
    }
    const recente = serie_mensal.slice(-3).reduce((a, m) => a + m.interacoes, 0);
    const anterior = serie_mensal.slice(-6, -3).reduce((a, m) => a + m.interacoes, 0);
    if (anterior > 0 && recente > anterior) {
      insights.push({ severidade: "positivo", titulo: "Relacionamento em alta", detalhe: `${recente} intera\xE7\xF5es nos \xFAltimos 3 meses contra ${anterior} nos 3 anteriores (+${Math.round((recente / anterior - 1) * 100)}%).` });
    }
    const ordem = { critico: 0, atencao: 1, info: 2, positivo: 3 };
    insights.sort((a, b) => ordem[a.severidade] - ordem[b.severidade]);
    return {
      calculado_em: ctx.instante.toISOString(),
      escopo: resumo.escopo,
      por_segmento: resumo.por_segmento,
      concentracao,
      faixas_aum,
      faixas_score,
      produtos_por_cliente,
      serie_mensal,
      canais_90d: [...canais.entries()].map(([canal, interacoes]) => ({ canal, interacoes })).sort((a, b) => b.interacoes - a.interacoes || a.canal.localeCompare(b.canal)),
      mapa_posicao_segmento,
      engajamento: { sem_contato_90d: semContato.length, pct_sem_contato: pct(semContato.length, ativos.length), prioritarios },
      oportunidades,
      top_clientes,
      delegacoes,
      insights
    };
  }

  // packages/core/src/insights/index.ts
  var LIMITE_SUPERIOR = 1;
  var LIMITE_INFERIOR = 0.5;
  var SEGMENTOS2 = ["UHNW", "Private", "Alta Renda", "Varejo"];
  function classificarUtilizacao(utilizacao) {
    if (utilizacao > LIMITE_SUPERIOR) return "Acima";
    if (utilizacao < LIMITE_INFERIOR) return "Abaixo";
    return null;
  }
  function posicaoVisivel(db, ctx) {
    return new Map((0, import_acesso2.resolverAcessos)(db, ctx.idGerente, ctx.instante).posicoes.map((p) => [p.id_posicao, p]));
  }
  function clientesVisiveis(db, ctx) {
    const permitidas = posicaoVisivel(db, ctx);
    const resultado = [];
    for (const c of db.dim_clientes) {
      const posicao = (0, import_acesso2.posicaoDoClienteEm)(db, c.id_cliente, ctx.instante);
      if (posicao && permitidas.has(posicao)) resultado.push({ ...c, posicao_no_instante: posicao });
    }
    return resultado;
  }
  var soma = (xs) => xs.reduce((a, b) => a + Math.round(b * 100), 0) / 100;
  var razao = (a, b) => b === 0 ? 0 : a / b;
  function resumoPosicao(db, ctx, acesso) {
    const p = db.dim_posicoes.find((x) => x.id_posicao === acesso.id_posicao);
    const ativos = db.dim_clientes.filter(
      (c) => c.status === "Ativo" && (0, import_acesso2.posicaoDoClienteEm)(db, c.id_cliente, ctx.instante) === p.id_posicao
    );
    const ocupacao = (0, import_posicoes.titularVigente)(db, p.id_posicao, (0, import_dates2.diaDe)(ctx.instante));
    const titular = ocupacao ? db.dim_gerentes.find((g) => g.id_gerente === ocupacao.id_gerente) : void 0;
    const utilizacao = razao(ativos.length, p.capacidade_max_contas);
    return {
      id_posicao: p.id_posicao,
      nome_posicao: p.nome_posicao,
      segmento_especialidade: p.segmento_especialidade,
      status: p.status,
      titular: titular ? { id_gerente: titular.id_gerente, nome: titular.nome_completo } : null,
      vaga: !titular,
      clientes_ativos: ativos.length,
      capacidade: p.capacidade_max_contas,
      utilizacao,
      aum_total: soma(ativos.map((c) => c.volume_aum)),
      desbalanceamento: classificarUtilizacao(utilizacao),
      modo: acesso.modo,
      origens: acesso.origens
    };
  }
  function resumoAgencia(db, ctx) {
    const acessos = (0, import_acesso2.resolverAcessos)(db, ctx.idGerente, ctx.instante);
    const posicoes = acessos.posicoes.map((a) => resumoPosicao(db, ctx, a)).sort((a, b) => a.id_posicao.localeCompare(b.id_posicao));
    const ativos = clientesVisiveis(db, ctx).filter((c) => c.status === "Ativo");
    const aumTotal = soma(ativos.map((c) => c.volume_aum));
    const penetracaoPorProduto = db.ref_produtos.map((prod) => {
      const clientes = ativos.filter((c) => db.fct_produtos_cliente.some((x) => x.id_cliente === c.id_cliente && x.codigo_produto === prod.codigo && x.status === "Ativo")).length;
      return { codigo: prod.codigo, nome: prod.nome, clientes, penetracao: razao(clientes, ativos.length) };
    });
    return {
      calculado_em: ctx.instante.toISOString(),
      escopo: acessos.geral ? "Agencia" : "Carteira",
      total_clientes: ativos.length,
      aum_total: aumTotal,
      aum_medio_por_cliente: razao(aumTotal, ativos.length),
      penetracao_media: razao(soma(penetracaoPorProduto.map((p) => p.penetracao)), penetracaoPorProduto.length),
      por_segmento: SEGMENTOS2.map((s) => {
        const doSegmento = ativos.filter((c) => c.segmento_cliente === s);
        return { segmento: s, clientes: doSegmento.length, aum: soma(doSegmento.map((c) => c.volume_aum)) };
      }),
      penetracao_por_produto: penetracaoPorProduto,
      posicoes,
      posicoes_em_alerta: posicoes.filter((p) => p.desbalanceamento !== null && p.status !== "Extinta").length
    };
  }
  function desbalanceamentos(db, ctx) {
    return resumoAgencia(db, ctx).posicoes.filter((p) => p.desbalanceamento !== null && p.status === "Ativa");
  }
  function carteiraDoAtor(db, ctx) {
    const acessos = (0, import_acesso2.resolverAcessos)(db, ctx.idGerente, ctx.instante);
    const visiveis = clientesVisiveis(db, ctx);
    const secoes = [];
    for (const a of acessos.posicoes) {
      const resumo = resumoPosicao(db, ctx, a);
      const clientes = visiveis.filter((c) => c.posicao_no_instante === a.id_posicao).map(import_clientes.clienteMascarado);
      const delegada = a.origens.find((o) => o.origem === "Delegado");
      const propria = a.origens.some((o) => o.origem === "Titular");
      if (propria || acessos.geral) secoes.push({ tipo: "Propria", posicao: resumo, clientes });
      if (delegada && !acessos.geral) {
        const d = db.fct_delegacoes.find((x) => x.id_delegacao === delegada.id_delegacao);
        secoes.push({
          tipo: "Delegada",
          posicao: resumo,
          cobertura: { id_delegacao: d.id_delegacao, escopo: d.escopo, data_fim: d.data_fim, situacao: (0, import_delegacao2.situacao)(d, ctx.instante) },
          clientes
        });
      }
    }
    return secoes.sort((a, b) => a.tipo === b.tipo ? a.posicao.id_posicao.localeCompare(b.posicao.id_posicao) : a.tipo === "Propria" ? -1 : 1);
  }
  function visao360(db, ctx, idCliente) {
    const cliente = db.dim_clientes.find((c) => c.id_cliente === idCliente);
    if (!cliente) throw new import_errors.DomainError("ACESSO_NEGADO", "Acesso negado ao cliente.");
    const decisao = (0, import_acesso2.exigirAcessoCliente)(db, ctx.idGerente, idCliente, ctx.instante, "Leitura");
    const posId = (0, import_acesso2.posicaoDoClienteEm)(db, idCliente, ctx.instante);
    const nomePosicao = (id) => {
      var _a, _b;
      return (_b = (_a = db.dim_posicoes.find((p) => p.id_posicao === id)) == null ? void 0 : _a.nome_posicao) != null ? _b : id;
    };
    const contratados = new Map((0, import_clientes.produtosDoCliente)(db, idCliente).filter((p) => p.status === "Ativo").map((p) => [p.codigo_produto, p.data_contratacao]));
    return {
      cliente: (0, import_clientes.clienteMascarado)(cliente),
      posicao_atual: { id_posicao: posId, nome_posicao: nomePosicao(posId) },
      decisao: { modo: decisao.modo, origens: decisao.origens, motivo: decisao.motivo },
      linha_do_tempo: db.bridge_vinculo_carteira.filter((v) => v.id_cliente === idCliente).sort((a, b) => a.inicio_em.localeCompare(b.inicio_em)).map((v) => ({ id_posicao: v.id_posicao, nome_posicao: nomePosicao(v.id_posicao), inicio_em: v.inicio_em, fim_em: v.fim_em })),
      produtos: db.ref_produtos.map((p) => {
        var _a;
        return { codigo: p.codigo, nome: p.nome, contratado: contratados.has(p.codigo), data_contratacao: (_a = contratados.get(p.codigo)) != null ? _a : null };
      }),
      interacoes: (0, import_clientes.interacoesDoCliente)(db, idCliente).map((i) => ({ id_interacao: i.id_interacao, canal: i.canal, data: i.data, nota: i.nota }))
    };
  }
  function exigirAtorAtivo(db, idGerente) {
    const g = db.dim_gerentes.find((x) => x.id_gerente === idGerente);
    (0, import_errors.exigir)(g && g.status === "Ativo", "ATOR_DESCONHECIDO", "Ator desconhecido ou inativo.");
    return g;
  }
  return __toCommonJS(index_exports);
})();
CARTEIRA_DOMINIOS.insights = DOM_insights;
