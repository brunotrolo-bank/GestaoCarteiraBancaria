/* GERADO por scripts/build-gas.ts a partir do repositório — não editar à mão (npm run gas:build). Domínio: acesso */
"use strict";
var DOM_acesso = (() => {
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

  // packages/core/src/acesso/index.ts
  var index_exports = {};
  __export(index_exports, {
    decidirCliente: () => decidirCliente,
    decidirPosicao: () => decidirPosicao,
    exigirAcessoCliente: () => exigirAcessoCliente,
    posicaoDoClienteEm: () => posicaoDoClienteEm,
    posicoesPermitidas: () => posicoesPermitidas,
    resolverAcessos: () => resolverAcessos
  });
  var import_dates = __toESM(require_dates(), 1);
  var import_errors = __toESM(require_errors(), 1);
  var import_delegacao = __toESM(require_delegacao(), 1);
  var import_posicoes = __toESM(require_posicoes(), 1);
  var PESO = { Negado: 0, Leitura: 1, Escrita: 2 };
  function modoDoEscopo(escopo) {
    return escopo === "Total" ? "Escrita" : "Leitura";
  }
  function resolverAcessos(db, idGerente, instante) {
    const g = db.dim_gerentes.find((x) => x.id_gerente === idGerente);
    if (!g || g.status !== "Ativo") return { ativo: false, geral: false, posicoes: [] };
    const mapa = /* @__PURE__ */ new Map();
    const somar = (id_posicao, modo, origem) => {
      const atual = mapa.get(id_posicao);
      if (!atual) mapa.set(id_posicao, { id_posicao, modo, origens: [origem] });
      else {
        atual.origens.push(origem);
        if (PESO[modo] > PESO[atual.modo]) atual.modo = modo;
      }
    };
    if (g.perfil === "Gerente Geral") {
      for (const p of db.dim_posicoes) somar(p.id_posicao, "Leitura", { origem: "GerenteGeral" });
      return { ativo: true, geral: true, posicoes: [...mapa.values()] };
    }
    const dia = (0, import_dates.diaDe)(instante);
    const vigentes = (0, import_delegacao.delegacoesVigentes)(db, instante);
    const ocupacao = (0, import_posicoes.ocupacaoDoGerente)(db, g.id_gerente, dia);
    if (ocupacao) {
      const sobCobertura = vigentes.some((d) => d.id_posicao_origem === ocupacao.id_posicao);
      somar(ocupacao.id_posicao, sobCobertura ? "Leitura" : "Escrita", sobCobertura ? { origem: "Titular", titular_ausente: true } : { origem: "Titular" });
    }
    for (const d of vigentes.filter((x) => x.id_gerente_delegado === g.id_gerente)) {
      somar(d.id_posicao_origem, modoDoEscopo(d.escopo), { origem: "Delegado", id_delegacao: d.id_delegacao, escopo: d.escopo });
    }
    return { ativo: true, geral: false, posicoes: [...mapa.values()] };
  }
  function decidirPosicao(db, idGerente, idPosicao, instante) {
    const acessos = resolverAcessos(db, idGerente, instante);
    if (!acessos.ativo) return { permitido: false, modo: "Negado", origens: [], motivo: "Ator desconhecido ou inativo." };
    const a = acessos.posicoes.find((p) => p.id_posicao === idPosicao);
    if (!a) return { permitido: false, modo: "Negado", origens: [], motivo: "Sem titularidade nem delega\xE7\xE3o vigente para a posi\xE7\xE3o." };
    return { permitido: true, modo: a.modo, origens: a.origens, motivo: explicar(a) };
  }
  function posicaoDoClienteEm(db, idCliente, instante) {
    var _a, _b;
    const t = instante.getTime();
    const v = db.bridge_vinculo_carteira.find(
      (x) => x.id_cliente === idCliente && new Date(x.inicio_em).getTime() <= t && (x.fim_em === null || t < new Date(x.fim_em).getTime())
    );
    if (v) return v.id_posicao;
    const aindaNaoCarteirizado = db.bridge_vinculo_carteira.some((x) => x.id_cliente === idCliente && new Date(x.inicio_em).getTime() > t);
    if (aindaNaoCarteirizado) return null;
    return (_b = (_a = db.dim_clientes.find((c) => c.id_cliente === idCliente)) == null ? void 0 : _a.id_posicao_carteira) != null ? _b : null;
  }
  function decidirCliente(db, idGerente, idCliente, instante) {
    const posicao = posicaoDoClienteEm(db, idCliente, instante);
    if (!posicao) return { permitido: false, modo: "Negado", origens: [], motivo: "Cliente inexistente ou sem carteira no instante." };
    return decidirPosicao(db, idGerente, posicao, instante);
  }
  function exigirAcessoCliente(db, idGerente, idCliente, instante, minimo = "Leitura") {
    const d = decidirCliente(db, idGerente, idCliente, instante);
    if (!d.permitido || PESO[d.modo] < PESO[minimo]) {
      throw new import_errors.DomainError("ACESSO_NEGADO", "Acesso negado ao cliente.", { modo: d.modo });
    }
    return d;
  }
  function posicoesPermitidas(db, idGerente, instante) {
    return resolverAcessos(db, idGerente, instante).posicoes.map((p) => p.id_posicao);
  }
  function explicar(a) {
    return a.origens.map((o) => {
      if (o.origem === "GerenteGeral") return "Gerente Geral: vis\xE3o consolidada da ag\xEAncia.";
      if (o.origem === "Titular") return o.titular_ausente ? "Titular com posi\xE7\xE3o sob cobertura vigente: somente leitura." : "Titular vigente da posi\xE7\xE3o.";
      return `Delegado (${o.escopo}) pela delega\xE7\xE3o ${o.id_delegacao}.`;
    }).join(" ");
  }
  return __toCommonJS(index_exports);
})();
CARTEIRA_DOMINIOS.acesso = DOM_acesso;
