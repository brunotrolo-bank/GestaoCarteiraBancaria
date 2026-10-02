/* GERADO por scripts/build-gas.ts a partir do repositório — não editar à mão (npm run gas:build). Domínio: delegacao */
"use strict";
var DOM_delegacao = (() => {
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

  // global:../model/db.ts
  var require_db = __commonJS({
    "global:../model/db.ts"(exports, module) {
      module.exports = CARTEIRA_NUCLEO;
    }
  });

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

  // global:../model/registro.ts
  var require_registro = __commonJS({
    "global:../model/registro.ts"(exports, module) {
      module.exports = CARTEIRA_NUCLEO;
    }
  });

  // global:../posicoes/index.ts
  var require_posicoes = __commonJS({
    "global:../posicoes/index.ts"(exports, module) {
      module.exports = CARTEIRA_DOMINIOS.posicoes;
    }
  });

  // packages/core/src/delegacao/index.ts
  var index_exports = {};
  __export(index_exports, {
    aprovar: () => aprovar,
    delegacoesVigentes: () => delegacoesVigentes,
    obterDelegacao: () => obterDelegacao,
    rejeitar: () => rejeitar,
    revogar: () => revogar,
    situacao: () => situacao,
    submeter: () => submeter,
    varrerEventosDeVigencia: () => varrerEventosDeVigencia,
    vigente: () => vigente
  });
  var import_db = __toESM(require_db(), 1);
  var import_dates = __toESM(require_dates(), 1);
  var import_errors = __toESM(require_errors(), 1);
  var import_registro = __toESM(require_registro(), 1);
  var import_posicoes = __toESM(require_posicoes(), 1);
  var ESCOPOS = ["Total", "Apenas Consulta", "Apenas Emergencial"];
  function vigente(d, instante) {
    if (d.status_aprovacao !== "Aprovada") return false;
    if (d.revogada_em !== null && instante.getTime() >= new Date(d.revogada_em).getTime()) return false;
    return (0, import_dates.noIntervalo)((0, import_dates.diaDe)(instante), d.data_inicio, d.data_fim);
  }
  function situacao(d, instante) {
    if (d.status_aprovacao !== "Aprovada") return d.status_aprovacao;
    const dia = (0, import_dates.diaDe)(instante);
    if (dia < d.data_inicio) return "Agendada";
    if (dia > d.data_fim) return "Conclu\xEDda";
    return "Em Vigor";
  }
  function delegacoesVigentes(db, instante) {
    return db.fct_delegacoes.filter((d) => {
      var _a;
      if (!vigente(d, instante)) return false;
      return ((_a = db.dim_gerentes.find((g) => g.id_gerente === d.id_gerente_delegado)) == null ? void 0 : _a.status) === "Ativo";
    });
  }
  function obterDelegacao(db, id) {
    const d = db.fct_delegacoes.find((x) => x.id_delegacao === id);
    (0, import_errors.exigir)(d, "DELEGACAO_INEXISTENTE", `Delega\xE7\xE3o ${id} n\xE3o existe.`);
    return d;
  }
  function exigirSemSobreposicaoAprovada(db, candidata) {
    const conflito = db.fct_delegacoes.some(
      (o) => o.id_delegacao !== candidata.id_delegacao && o.id_posicao_origem === candidata.id_posicao_origem && o.status_aprovacao === "Aprovada" && (0, import_dates.intervalosSobrepostos)({ inicio: candidata.data_inicio, fim: candidata.data_fim }, { inicio: o.data_inicio, fim: o.data_fim })
    );
    (0, import_errors.exigir)(!conflito, "DELEGACAO_SOBREPOSTA", "J\xE1 existe delega\xE7\xE3o aprovada sobreposta para esta posi\xE7\xE3o.");
  }
  function submeter(db, clock, entrada, ator) {
    var _a, _b;
    (0, import_errors.exigir)((0, import_dates.isISODate)(entrada.data_inicio) && (0, import_dates.isISODate)(entrada.data_fim) && entrada.data_inicio <= entrada.data_fim, "DATAS_INVALIDAS", "Per\xEDodo inv\xE1lido (in\xEDcio deve ser \u2264 fim).");
    (0, import_errors.exigir)(ESCOPOS.includes(entrada.escopo), "DADOS_INVALIDOS", "Escopo inv\xE1lido.");
    (0, import_errors.exigir)((_a = entrada.motivo) == null ? void 0 : _a.trim(), "MOTIVO_OBRIGATORIO", "Motivo \xE9 obrigat\xF3rio.");
    const origem = (0, import_posicoes.obterPosicao)(db, entrada.id_posicao_origem);
    (0, import_errors.exigir)(origem.status !== "Extinta", "POSICAO_EXTINTA", "Posi\xE7\xE3o extinta.");
    const solicitante = (0, import_posicoes.obterGerente)(db, ator.idGerente);
    (0, import_errors.exigir)(solicitante.status === "Ativo", "GERENTE_INDISPONIVEL", "Solicitante n\xE3o est\xE1 Ativo.");
    const delegado = (0, import_posicoes.obterGerente)(db, entrada.id_gerente_delegado);
    (0, import_errors.exigir)(delegado.status === "Ativo", "GERENTE_INDISPONIVEL", "Delegado n\xE3o est\xE1 Ativo.");
    const agora = clock.agora();
    const hoje = (0, import_dates.diaDe)(agora);
    if (solicitante.perfil !== "Gerente Geral") {
      const titularHoje = (0, import_posicoes.titularVigente)(db, origem.id_posicao, hoje);
      const ehTitular = (titularHoje == null ? void 0 : titularHoje.id_gerente) === solicitante.id_gerente;
      if (!ehTitular) {
        const recebeuCobertura = delegacoesVigentes(db, agora).some(
          (d) => d.id_posicao_origem === origem.id_posicao && d.id_gerente_delegado === solicitante.id_gerente
        );
        (0, import_errors.exigir)(!recebeuCobertura, "DELEGACAO_TRANSITIVA", "Quem recebeu a cobertura n\xE3o pode repass\xE1-la.");
        (0, import_errors.exigir)(false, "NAO_AUTORIZADO", "Apenas o titular da posi\xE7\xE3o ou o Gerente Geral solicitam delega\xE7\xE3o.");
      }
    }
    const titularNoInicio = (_b = (0, import_posicoes.titularVigente)(db, origem.id_posicao, entrada.data_inicio)) != null ? _b : (0, import_posicoes.titularVigente)(db, origem.id_posicao, hoje);
    (0, import_errors.exigir)((titularNoInicio == null ? void 0 : titularNoInicio.id_gerente) !== delegado.id_gerente, "AUTO_DELEGACAO", "O titular n\xE3o pode ser o pr\xF3prio delegado.");
    const nova = {
      id_delegacao: (0, import_db.proximoId)("DEL", db.fct_delegacoes.map((d) => d.id_delegacao), 4),
      ...entrada,
      motivo: entrada.motivo.trim(),
      status_aprovacao: "Submetida",
      criada_por: ator.idGerente,
      criada_em: agora.toISOString(),
      decidida_por: null,
      decidida_em: null,
      revogada_em: null
    };
    return (0, import_db.emTransacao)(db, () => {
      exigirSemSobreposicaoAprovada(db, nova);
      db.fct_delegacoes.push(nova);
      (0, import_registro.auditar)(db, clock, ator.idGerente, "DELEGACAO_SUBMETIDA", "fct_delegacoes", nova.id_delegacao, { origem: nova.id_posicao_origem, delegado: nova.id_gerente_delegado });
      (0, import_registro.publicar)(db, clock, "DelegacaoSubmetida", { id_delegacao: nova.id_delegacao });
      return nova;
    });
  }
  function aprovar(db, clock, idDelegacao, ator) {
    (0, import_posicoes.exigirGerenteGeral)(db, ator);
    const d = obterDelegacao(db, idDelegacao);
    (0, import_errors.exigir)(d.status_aprovacao === "Submetida", "ESTADO_INVALIDO", `Delega\xE7\xE3o em estado ${d.status_aprovacao} n\xE3o pode ser aprovada.`);
    return (0, import_db.emTransacao)(db, () => {
      exigirSemSobreposicaoAprovada(db, d);
      d.status_aprovacao = "Aprovada";
      d.decidida_por = ator.idGerente;
      d.decidida_em = clock.agora().toISOString();
      (0, import_registro.auditar)(db, clock, ator.idGerente, "DELEGACAO_APROVADA", "fct_delegacoes", d.id_delegacao, {});
      (0, import_registro.publicar)(db, clock, "DelegacaoAprovada", { id_delegacao: d.id_delegacao });
      return d;
    });
  }
  function rejeitar(db, clock, idDelegacao, ator) {
    (0, import_posicoes.exigirGerenteGeral)(db, ator);
    const d = obterDelegacao(db, idDelegacao);
    (0, import_errors.exigir)(d.status_aprovacao === "Submetida", "ESTADO_INVALIDO", `Delega\xE7\xE3o em estado ${d.status_aprovacao} n\xE3o pode ser rejeitada.`);
    return (0, import_db.emTransacao)(db, () => {
      d.status_aprovacao = "Rejeitada";
      d.decidida_por = ator.idGerente;
      d.decidida_em = clock.agora().toISOString();
      (0, import_registro.auditar)(db, clock, ator.idGerente, "DELEGACAO_REJEITADA", "fct_delegacoes", d.id_delegacao, {});
      return d;
    });
  }
  function revogar(db, clock, idDelegacao, ator) {
    const d = obterDelegacao(db, idDelegacao);
    const quem = (0, import_posicoes.obterGerente)(db, ator.idGerente);
    (0, import_errors.exigir)(quem.status === "Ativo", "GERENTE_INDISPONIVEL", "Ator n\xE3o est\xE1 Ativo.");
    if (quem.perfil !== "Gerente Geral") {
      const titular = (0, import_posicoes.titularVigente)(db, d.id_posicao_origem, (0, import_dates.diaDe)(clock.agora()));
      (0, import_errors.exigir)((titular == null ? void 0 : titular.id_gerente) === quem.id_gerente, "NAO_AUTORIZADO", "Apenas o titular da origem ou o Gerente Geral revogam.");
    }
    (0, import_errors.exigir)(d.status_aprovacao === "Submetida" || d.status_aprovacao === "Aprovada", "ESTADO_INVALIDO", `Delega\xE7\xE3o em estado ${d.status_aprovacao} n\xE3o pode ser revogada.`);
    return (0, import_db.emTransacao)(db, () => {
      const eraAprovada = d.status_aprovacao === "Aprovada";
      d.status_aprovacao = "Revogada";
      d.revogada_em = clock.agora().toISOString();
      (0, import_registro.auditar)(db, clock, ator.idGerente, "DELEGACAO_REVOGADA", "fct_delegacoes", d.id_delegacao, { estava_aprovada: eraAprovada });
      (0, import_registro.publicar)(db, clock, "DelegacaoRevogada", { id_delegacao: d.id_delegacao });
      return d;
    });
  }
  function varrerEventosDeVigencia(db, clock) {
    const agora = clock.agora();
    const jaEmitidos = new Set(db.log_eventos.map((e) => `${e.tipo}|${e.payload}`));
    let emitidos = 0;
    for (const d of db.fct_delegacoes) {
      const s = situacao(d, agora);
      const tipo = s === "Em Vigor" ? "DelegacaoIniciada" : s === "Conclu\xEDda" ? "DelegacaoExpirada" : null;
      if (!tipo) continue;
      const payload = JSON.stringify({ id_delegacao: d.id_delegacao });
      if (jaEmitidos.has(`${tipo}|${payload}`)) continue;
      (0, import_registro.publicar)(db, clock, tipo, { id_delegacao: d.id_delegacao });
      emitidos += 1;
    }
    return emitidos;
  }
  return __toCommonJS(index_exports);
})();
CARTEIRA_DOMINIOS.delegacao = DOM_delegacao;
