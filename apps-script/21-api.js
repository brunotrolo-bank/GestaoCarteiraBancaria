/* GERADO por scripts/build-gas.ts a partir do repositório — não editar à mão (npm run gas:build). API (rotas, validação, erros) sobre o núcleo */
"use strict";
var CARTEIRA_API = (() => {
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

  // global:@carteira/core
  var require_core = __commonJS({
    "global:@carteira/core"(exports, module) {
      module.exports = CARTEIRA_CORE;
    }
  });

  // apps/gas/src/api.ts
  var api_exports = {};
  __export(api_exports, {
    criarManipulador: () => criarManipulador
  });

  // apps/api/src/app.ts
  var import_core = __toESM(require_core(), 1);
  var STATUS = {
    ACESSO_NEGADO: 403,
    NAO_AUTORIZADO: 403,
    ATOR_DESCONHECIDO: 403,
    POSICAO_INEXISTENTE: 404,
    GERENTE_INEXISTENTE: 404,
    DELEGACAO_INEXISTENTE: 404,
    CLIENTE_INEXISTENTE: 404,
    LOTE_INEXISTENTE: 404,
    OCUPACAO_SOBREPOSTA: 409,
    GERENTE_JA_ALOCADO: 409,
    DELEGACAO_SOBREPOSTA: 409,
    DOCUMENTO_DUPLICADO: 409,
    EMAIL_DUPLICADO: 409,
    ESTADO_INVALIDO: 409,
    LOTE_JA_DESFEITO: 409,
    LOTE_NAO_DESFAZIVEL: 409,
    POSICAO_COM_CARTEIRA: 409,
    TRANSICAO_INVALIDA: 409
  };
  var txt = (opcional = false) => ({ tipo: "txt", opcional });
  var dt = () => ({ tipo: "data" });
  var opc = (opcoes) => ({ tipo: "enum", opcoes });
  var lista = () => ({ tipo: "lista" });
  var num = () => ({ tipo: "num" });
  function esquema(campos) {
    return (corpo) => {
      const erros = [];
      const o = corpo !== null && typeof corpo === "object" && !Array.isArray(corpo) ? corpo : null;
      if (!o) throw new import_core.DomainError("DADOS_INVALIDOS", "corpo: esperado um objeto JSON");
      for (const [nome, campo] of Object.entries(campos)) {
        const v = o[nome];
        const ausente = v === void 0 || v === null;
        if (campo.tipo === "txt") {
          if (ausente) {
            if (!campo.opcional) erros.push(`${nome}: obrigat\xF3rio`);
          } else if (typeof v !== "string") erros.push(`${nome}: esperado texto`);
          else if (!campo.opcional && v.length < 1) erros.push(`${nome}: n\xE3o pode ser vazio`);
        } else if (campo.tipo === "data") {
          if (typeof v !== "string" || !(0, import_core.isISODate)(v)) erros.push(`${nome}: Data deve estar no formato AAAA-MM-DD`);
        } else if (campo.tipo === "num") {
          if (typeof v !== "number" || !Number.isFinite(v)) erros.push(`${nome}: esperado n\xFAmero`);
        } else if (campo.tipo === "enum") {
          if (typeof v !== "string" || !campo.opcoes.includes(v)) erros.push(`${nome}: valor inv\xE1lido (use ${campo.opcoes.join(", ")})`);
        } else if (!Array.isArray(v) || v.length < 1 || v.some((x) => typeof x !== "string")) erros.push(`${nome}: esperada lista n\xE3o vazia de textos`);
      }
      if (erros.length > 0) throw new import_core.DomainError("DADOS_INVALIDOS", erros.join("; "));
      return o;
    };
  }
  var VINCULOS = ["Titular Efetivo", "Trainee", "Interino"];
  var ESCOPOS = ["Total", "Apenas Consulta", "Apenas Emergencial"];
  var corpos = {
    titular: esquema({ id_gerente: txt(), data_inicio: dt(), tipo_vinculo: opc(VINCULOS), motivo: txt(true) }),
    delegacao: esquema({
      id_posicao_origem: txt(),
      id_gerente_delegado: txt(),
      data_inicio: dt(),
      data_fim: dt(),
      motivo: txt(),
      escopo: opc(ESCOPOS)
    }),
    metas: esquema({ meta_aum: num(), meta_clientes: num(), utilizacao_minima: num(), utilizacao_maxima: num() }),
    transferencia: esquema({ id_posicao_destino: txt(), motivo: txt(), justificativa: txt(true) }),
    simulacao: esquema({ ids_clientes: lista(), id_posicao_destino: txt() }),
    redistribuicao: esquema({ ids_clientes: lista(), id_posicao_destino: txt(), motivo: txt(), justificativa: txt(true) })
  };
  function analisar(validador, corpo) {
    return validador(corpo);
  }
  function instanteDe(c, asof) {
    if (!asof) return c.instante;
    if (!(0, import_core.isISODate)(asof)) throw new import_core.DomainError("DADOS_INVALIDOS", "asof deve estar no formato AAAA-MM-DD");
    return (0, import_core.meioDia)(asof);
  }
  var ctxInsights = (c, asof) => ({ idGerente: c.ator.idGerente, instante: instanteDe(c, asof != null ? asof : null) });
  function exigirGG(c) {
    const g = c.db.dim_gerentes.find((x) => x.id_gerente === c.ator.idGerente);
    if ((g == null ? void 0 : g.perfil) !== "Gerente Geral") throw new import_core.DomainError("NAO_AUTORIZADO", "Opera\xE7\xE3o restrita ao Gerente Geral.");
  }
  function exigirPosicaoVisivel(c, idPosicao, instante = c.instante) {
    import_core.posicoes.obterPosicao(c.db, idPosicao);
    if (!import_core.acesso.decidirPosicao(c.db, c.ator.idGerente, idPosicao, instante).permitido) throw new import_core.DomainError("ACESSO_NEGADO", "Acesso negado \xE0 posi\xE7\xE3o.");
  }
  function visaoDelegacao(c, d) {
    return { ...d, situacao: import_core.delegacao.situacao(d, c.instante) };
  }
  var ROTAS = [
    { metodo: "GET", caminho: "/saude", publica: true, tratador: () => ({ status: "ok" }) },
    {
      metodo: "GET",
      caminho: "/simulacao/atores",
      publica: true,
      tratador: (c) => {
        const dia = (0, import_core.diaDe)(c.instante);
        const gg = c.db.dim_gerentes.find((g) => g.perfil === "Gerente Geral" && g.status === "Ativo");
        return {
          data_simulada: dia,
          atores: [
            ...gg ? [{ papel: "GG", rotulo: `Gerente Geral \u2014 ${gg.nome_completo}`, id_gerente: gg.id_gerente }] : [],
            ...c.db.dim_posicoes.map((p) => {
              var _a, _b;
              const t = import_core.posicoes.titularVigente(c.db, p.id_posicao, dia);
              const nome = t ? (_a = c.db.dim_gerentes.find((g) => g.id_gerente === t.id_gerente)) == null ? void 0 : _a.nome_completo : null;
              return { papel: p.id_posicao, rotulo: `${p.nome_posicao} \u2014 ${nome != null ? nome : "vaga"}`, id_gerente: (_b = t == null ? void 0 : t.id_gerente) != null ? _b : null };
            })
          ]
        };
      }
    },
    { metodo: "POST", caminho: "/simulacao/recarregar", publica: true, tratador: (c) => {
      var _a, _b;
      (_b = (_a = c.store).recarregar) == null ? void 0 : _b.call(_a);
      return { recarregado: Boolean(c.store.recarregar) };
    } },
    { metodo: "POST", caminho: "/simulacao/reset", publica: true, escrita: false, tratador: (c) => {
      c.store.reiniciar();
      return { reiniciado: true };
    } },
    { metodo: "GET", caminho: "/posicoes", tratador: (c) => ({ itens: import_core.insights.resumoAgencia(c.db, ctxInsights(c)).posicoes }) },
    {
      metodo: "GET",
      caminho: "/posicoes/{id}/titular",
      tratador: (c) => {
        const dia = (0, import_core.diaDe)(instanteDe(c, c.consulta.get("asof")));
        exigirPosicaoVisivel(c, c.params.id, instanteDe(c, c.consulta.get("asof")));
        const o = import_core.posicoes.titularVigente(c.db, c.params.id, dia);
        const g = o ? c.db.dim_gerentes.find((x) => x.id_gerente === o.id_gerente) : void 0;
        return { id_posicao: c.params.id, data: dia, vaga: !o, ocupacao: o, gerente: g ? { id_gerente: g.id_gerente, nome_completo: g.nome_completo } : null };
      }
    },
    {
      metodo: "GET",
      caminho: "/posicoes/{id}/historico",
      tratador: (c) => {
        exigirPosicaoVisivel(c, c.params.id);
        return { itens: import_core.posicoes.historicoDaPosicao(c.db, c.params.id).map((o) => {
          var _a, _b;
          return { ...o, nome_gerente: (_b = (_a = c.db.dim_gerentes.find((g) => g.id_gerente === o.id_gerente)) == null ? void 0 : _a.nome_completo) != null ? _b : o.id_gerente };
        }) };
      }
    },
    {
      metodo: "POST",
      caminho: "/posicoes/{id}/titular",
      escrita: true,
      status: 201,
      tratador: (c) => import_core.posicoes.trocarTitular(c.db, c.clock, { id_posicao: c.params.id, ...analisar(corpos.titular, c.corpo) }, c.ator)
    },
    {
      metodo: "GET",
      caminho: "/posicoes/{id}/metas",
      tratador: (c) => {
        exigirPosicaoVisivel(c, c.params.id);
        return { id_posicao: c.params.id, ...import_core.posicoes.metasDaPosicao(c.db, c.params.id) };
      }
    },
    {
      metodo: "POST",
      caminho: "/posicoes/{id}/metas",
      escrita: true,
      tratador: (c) => import_core.posicoes.definirMetas(c.db, c.clock, c.params.id, analisar(corpos.metas, c.corpo), c.ator)
    },
    {
      metodo: "GET",
      caminho: "/gerentes",
      tratador: (c) => {
        exigirGG(c);
        return { itens: c.db.dim_gerentes.map((g) => {
          var _a, _b;
          return { ...g, posicao: (_b = (_a = import_core.posicoes.ocupacaoDoGerente(c.db, g.id_gerente, (0, import_core.diaDe)(c.instante))) == null ? void 0 : _a.id_posicao) != null ? _b : null };
        }) };
      }
    },
    {
      metodo: "GET",
      caminho: "/delegacoes",
      tratador: (c) => {
        var _a;
        const gg = ((_a = c.db.dim_gerentes.find((g) => g.id_gerente === c.ator.idGerente)) == null ? void 0 : _a.perfil) === "Gerente Geral";
        const dia = (0, import_core.diaDe)(c.instante);
        const pos = c.consulta.get("posicao");
        const itens = c.db.fct_delegacoes.filter((d) => !pos || d.id_posicao_origem === pos).filter((d) => {
          var _a2;
          return gg || d.id_gerente_delegado === c.ator.idGerente || d.criada_por === c.ator.idGerente || ((_a2 = import_core.posicoes.titularVigente(c.db, d.id_posicao_origem, dia)) == null ? void 0 : _a2.id_gerente) === c.ator.idGerente;
        }).map((d) => visaoDelegacao(c, d));
        return { itens };
      }
    },
    { metodo: "POST", caminho: "/delegacoes", escrita: true, status: 201, tratador: (c) => visaoDelegacao(c, import_core.delegacao.submeter(c.db, c.clock, analisar(corpos.delegacao, c.corpo), c.ator)) },
    { metodo: "POST", caminho: "/delegacoes/{id}/aprovacao", escrita: true, tratador: (c) => visaoDelegacao(c, import_core.delegacao.aprovar(c.db, c.clock, c.params.id, c.ator)) },
    { metodo: "POST", caminho: "/delegacoes/{id}/rejeicao", escrita: true, tratador: (c) => visaoDelegacao(c, import_core.delegacao.rejeitar(c.db, c.clock, c.params.id, c.ator)) },
    { metodo: "POST", caminho: "/delegacoes/{id}/revogacao", escrita: true, tratador: (c) => visaoDelegacao(c, import_core.delegacao.revogar(c.db, c.clock, c.params.id, c.ator)) },
    {
      metodo: "GET",
      caminho: "/carteira/clientes",
      tratador: (c) => {
        var _a, _b, _c;
        const limite = Math.min(Number((_a = c.consulta.get("limit")) != null ? _a : 50) || 50, 200);
        const inicio = Number((_b = c.consulta.get("cursor")) != null ? _b : 0) || 0;
        const q = ((_c = c.consulta.get("q")) != null ? _c : "").toLowerCase();
        const filtrados = import_core.insights.clientesVisiveis(c.db, ctxInsights(c, c.consulta.get("asof"))).filter((x) => (!c.consulta.get("posicao") || x.posicao_no_instante === c.consulta.get("posicao")) && (!c.consulta.get("segmento") || x.segmento_cliente === c.consulta.get("segmento")) && (!c.consulta.get("status") || x.status === c.consulta.get("status")) && (!q || x.nome_razao_social.toLowerCase().includes(q) || x.id_cliente.toLowerCase().includes(q))).sort((a, b) => a.id_cliente.localeCompare(b.id_cliente));
        const pagina = filtrados.slice(inicio, inicio + limite).map(({ posicao_no_instante, ...resto }) => ({ ...import_core.clientes.clienteMascarado(resto), id_posicao: posicao_no_instante }));
        return { itens: pagina, total: filtrados.length, proximo_cursor: inicio + limite < filtrados.length ? inicio + limite : null };
      }
    },
    { metodo: "GET", caminho: "/carteira/minha", tratador: (c) => ({ secoes: import_core.insights.carteiraDoAtor(c.db, ctxInsights(c, c.consulta.get("asof"))) }) },
    { metodo: "GET", caminho: "/clientes/{id}/visao-360", tratador: (c) => import_core.insights.visao360(c.db, ctxInsights(c, c.consulta.get("asof")), c.params.id) },
    {
      metodo: "POST",
      caminho: "/clientes/{id}/transferencia",
      escrita: true,
      tratador: (c) => import_core.clientes.transferirCliente(c.db, c.clock, { id_cliente: c.params.id, ...analisar(corpos.transferencia, c.corpo), chave_idempotencia: c.idempotencia }, c.ator)
    },
    { metodo: "POST", caminho: "/clientes/{id}/documento:revelar", escrita: true, tratador: (c) => ({ cpf_cnpj: import_core.clientes.revelarDocumento(c.db, c.clock, c.params.id, c.ator) }) },
    { metodo: "POST", caminho: "/carteira/redistribuicoes:simular", tratador: (c) => {
      exigirGG(c);
      return import_core.clientes.simularRedistribuicao(c.db, analisar(corpos.simulacao, c.corpo));
    } },
    {
      metodo: "POST",
      caminho: "/carteira/redistribuicoes",
      escrita: true,
      status: 201,
      tratador: (c) => import_core.clientes.executarRedistribuicao(c.db, c.clock, { ...analisar(corpos.redistribuicao, c.corpo), chave_idempotencia: c.idempotencia }, c.ator)
    },
    { metodo: "POST", caminho: "/carteira/redistribuicoes/{id}:desfazer", escrita: true, tratador: (c) => import_core.clientes.desfazerLote(c.db, c.clock, c.params.id, c.ator) },
    { metodo: "GET", caminho: "/insights/analise", tratador: (c) => import_core.insights.analiseCarteira(c.db, ctxInsights(c, c.consulta.get("asof"))) },
    {
      metodo: "GET",
      caminho: "/insights/comparativo",
      tratador: (c) => {
        var _a, _b;
        const ctx = ctxInsights(c, c.consulta.get("asof"));
        const fim = (_a = c.consulta.get("fim")) != null ? _a : (0, import_core.diaDe)(ctx.instante);
        const inicio = (_b = c.consulta.get("inicio")) != null ? _b : (0, import_core.addDays)(fim, -29);
        return import_core.insights.comparativo(c.db, ctx, { inicio, fim });
      }
    },
    { metodo: "GET", caminho: "/insights/agencia", tratador: (c) => import_core.insights.resumoAgencia(c.db, ctxInsights(c, c.consulta.get("asof"))) },
    {
      metodo: "GET",
      caminho: "/insights/posicoes/{id}",
      tratador: (c) => {
        const r = import_core.insights.resumoAgencia(c.db, ctxInsights(c, c.consulta.get("asof"))).posicoes.find((p) => p.id_posicao === c.params.id);
        if (!r) throw new import_core.DomainError("ACESSO_NEGADO", "Acesso negado \xE0 posi\xE7\xE3o.");
        return r;
      }
    },
    { metodo: "GET", caminho: "/insights/desbalanceamento", tratador: (c) => ({ itens: import_core.insights.desbalanceamentos(c.db, ctxInsights(c, c.consulta.get("asof"))) }) },
    {
      metodo: "GET",
      caminho: "/acesso/explicacao",
      tratador: (c) => {
        const cliente = c.consulta.get("cliente");
        if (!cliente) throw new import_core.DomainError("DADOS_INVALIDOS", "Informe ?cliente=");
        return import_core.acesso.decidirCliente(c.db, c.ator.idGerente, cliente, instanteDe(c, c.consulta.get("asof")));
      }
    }
  ];
  var ROTAS_PUBLICADAS = ROTAS.map((r) => `${r.metodo} ${r.caminho}`);
  function compilar(caminho) {
    const nomes = [];
    const re = caminho.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{(\w+)\}/g, (_m, n) => {
      nomes.push(n);
      return "([^/:]+)";
    });
    return { re: new RegExp(`^${re}$`), nomes };
  }
  var COMPILADAS = ROTAS.map((r) => ({ rota: r, ...compilar(r.caminho) }));
  function problema(status, codigo, detalhe, correlacao, extra = {}) {
    return {
      status,
      headers: { "Content-Type": "application/problem+json" },
      corpo: { type: `https://carteira.example/erros/${codigo}`, title: codigo, status, detail: detalhe, codigo_dominio: codigo, correlation_id: correlacao, ...extra }
    };
  }
  function criarManipulador(opcoes) {
    var _a;
    const log = (_a = opcoes.log) != null ? _a : (() => void 0);
    let contador = 0;
    return function tratar(req) {
      var _a2, _b, _c, _d, _e, _f, _g, _h;
      const correlacao = (_a2 = req.headers["x-correlation-id"]) != null ? _a2 : `c-${Date.now().toString(36)}-${contador += 1}`;
      const cabecalhos = { "X-Correlation-Id": correlacao };
      if (opcoes.simulacaoPapel) cabecalhos["X-Modo-Simulacao"] = "true";
      const cors = opcoes.simulacaoPapel ? { "Access-Control-Allow-Origin": (_b = req.headers.origin) != null ? _b : "*", "Access-Control-Allow-Headers": "content-type,x-papel-simulado,x-data-simulada,idempotency-key,x-correlation-id", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Expose-Headers": "x-modo-simulacao,x-correlation-id" } : {};
      const finalizar = (resp) => ({ ...resp, headers: { ...resp.headers, ...cabecalhos, ...cors } });
      if (req.metodo === "OPTIONS") return finalizar({ status: 204, headers: {}, corpo: null });
      const caminho = req.caminho.replace(/^\/api\/v1/, "") || "/";
      const alvo = COMPILADAS.find((r) => r.rota.metodo === req.metodo && r.re.test(caminho));
      if (!alvo) {
        const existe = COMPILADAS.some((r) => r.re.test(caminho));
        return finalizar(problema(existe ? 405 : 404, existe ? "METODO_NAO_PERMITIDO" : "ROTA_INEXISTENTE", `${req.metodo} ${req.caminho}`, correlacao));
      }
      const m = alvo.re.exec(caminho);
      const params = Object.fromEntries(alvo.nomes.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
      const consulta = { get: (nome) => Object.prototype.hasOwnProperty.call(req.consulta, nome) ? req.consulta[nome] : null };
      const inicio = Date.now();
      let status = 200;
      let ator = "-";
      try {
        const store = opcoes.store;
        const dataSimulada = opcoes.simulacaoPapel ? (_c = req.headers["x-data-simulada"]) != null ? _c : null : null;
        if (dataSimulada && !(0, import_core.isISODate)(dataSimulada)) throw new import_core.DomainError("DADOS_INVALIDOS", "X-Data-Simulada deve estar no formato AAAA-MM-DD");
        const clock = dataSimulada ? new import_core.FixedClock((0, import_core.meioDia)(dataSimulada)) : store.clock;
        const instante = clock.agora();
        let idGerente = "";
        if (!alvo.rota.publica) {
          const papel = opcoes.simulacaoPapel ? (_d = req.headers["x-papel-simulado"]) != null ? _d : null : null;
          if (!opcoes.simulacaoPapel) return finalizar(problema(401, "NAO_AUTENTICADO", "Autentica\xE7\xE3o real ainda n\xE3o implementada; habilite SIMULACAO_PAPEL somente na POC.", correlacao));
          if (!papel) return finalizar(problema(401, "NAO_AUTENTICADO", "Informe o cabe\xE7alho X-Papel-Simulado (GG ou id da posi\xE7\xE3o).", correlacao));
          const g = papel === "GG" ? (_e = store.db.dim_gerentes.find((x) => x.perfil === "Gerente Geral" && x.status === "Ativo")) == null ? void 0 : _e.id_gerente : (_f = import_core.posicoes.titularVigente(store.db, papel, (0, import_core.diaDe)(instante))) == null ? void 0 : _f.id_gerente;
          if (!g) throw new import_core.DomainError("ATOR_DESCONHECIDO", "Papel sem titular vigente ou desconhecido.");
          idGerente = g;
          ator = g;
        }
        if (req.corpoInvalido) throw new import_core.DomainError("DADOS_INVALIDOS", "Corpo n\xE3o \xE9 JSON v\xE1lido.");
        const resultado = alvo.rota.tratador({
          store,
          db: store.db,
          ator: { idGerente },
          clock,
          instante,
          corpo: req.corpo,
          params,
          consulta,
          idempotencia: req.headers["idempotency-key"]
        });
        if (alvo.rota.escrita) store.persistir();
        status = (_g = alvo.rota.status) != null ? _g : 200;
        return finalizar({ status, headers: { "Content-Type": "application/json" }, corpo: resultado });
      } catch (erro) {
        if (erro instanceof import_core.DomainError) {
          status = (_h = STATUS[erro.codigo]) != null ? _h : 422;
          if ((erro.codigo === "ACESSO_NEGADO" || erro.codigo === "NAO_AUTORIZADO") && ator !== "-") {
            (0, import_core.auditar)(opcoes.store.db, opcoes.store.clock, ator, "ACESSO_NEGADO", "api", alvo.rota.caminho, { codigo: erro.codigo, metodo: req.metodo });
            opcoes.store.persistir();
          }
          return finalizar(problema(status, erro.codigo, erro.message, correlacao, erro.detalhe ? { detalhe: erro.detalhe } : {}));
        }
        status = 500;
        log({ nivel: "erro", correlation_id: correlacao, mensagem: erro instanceof Error ? erro.message : String(erro) });
        return finalizar(problema(500, "ERRO_INTERNO", "Erro inesperado.", correlacao));
      } finally {
        log({ nivel: "info", correlation_id: correlacao, metodo: req.metodo, rota: alvo.rota.caminho, status, ator, ms: Date.now() - inicio });
      }
    };
  }
  return __toCommonJS(api_exports);
})();
