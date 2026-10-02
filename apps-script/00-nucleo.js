/* GERADO por scripts/build-gas.ts a partir do repositório — não editar à mão (npm run gas:build). Camada compartilhada (shared + model) */
var CARTEIRA_DOMINIOS = {};
"use strict";
var CARTEIRA_NUCLEO = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
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
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // apps/gas/src/nucleo.ts
  var nucleo_exports = {};
  __export(nucleo_exports, {
    DomainError: () => DomainError,
    FUSO: () => FUSO,
    FixedClock: () => FixedClock,
    NOMES_TABELAS: () => NOMES_TABELAS,
    SystemClock: () => SystemClock,
    TABELAS: () => TABELAS,
    addDays: () => addDays,
    auditar: () => auditar,
    clonarDb: () => clonarDb,
    criarDbVazio: () => criarDbVazio,
    diaDe: () => diaDe,
    emTransacao: () => emTransacao,
    exigir: () => exigir,
    intervalosSobrepostos: () => intervalosSobrepostos,
    isISODate: () => isISODate,
    meioDia: () => meioDia,
    noIntervalo: () => noIntervalo,
    proximoId: () => proximoId,
    publicar: () => publicar
  });

  // packages/core/src/shared/dates.ts
  var FUSO = "America/Sao_Paulo";
  var RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
  function isISODate(valor) {
    if (typeof valor !== "string" || !RE_DATA.test(valor)) return false;
    const d = /* @__PURE__ */ new Date(`${valor}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
  }
  function addDays(data, dias) {
    const d = /* @__PURE__ */ new Date(`${data}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().slice(0, 10);
  }
  function diaDe(instante) {
    try {
      const dia = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(instante);
      if (RE_DATA.test(dia)) return dia;
    } catch (e) {
    }
    return new Date(instante.getTime() - 3 * 3600 * 1e3).toISOString().slice(0, 10);
  }
  function noIntervalo(dia, inicio, fim) {
    return dia >= inicio && (fim === null || dia <= fim);
  }
  function intervalosSobrepostos(a, b) {
    const aTerminaAntes = a.fim !== null && a.fim < b.inicio;
    const bTerminaAntes = b.fim !== null && b.fim < a.inicio;
    return !aTerminaAntes && !bTerminaAntes;
  }

  // packages/core/src/shared/clock.ts
  var SystemClock = class {
    agora() {
      return /* @__PURE__ */ new Date();
    }
  };
  var FixedClock = class {
    constructor(instante) {
      __publicField(this, "instante", instante);
    }
    agora() {
      return this.instante;
    }
    definir(instante) {
      this.instante = instante;
    }
  };
  function meioDia(dia) {
    return /* @__PURE__ */ new Date(`${dia}T12:00:00-03:00`);
  }

  // packages/core/src/shared/errors.ts
  var DomainError = class extends Error {
    constructor(codigo, mensagem, detalhe) {
      super(mensagem);
      __publicField(this, "codigo", codigo);
      __publicField(this, "detalhe", detalhe);
      this.name = "DomainError";
    }
  };
  function exigir(condicao, codigo, mensagem, detalhe) {
    if (!condicao) throw new DomainError(codigo, mensagem, detalhe);
  }

  // packages/core/src/model/db.ts
  var TABELAS = {
    ref_segmentos: { pk: ["codigo"], colunas: [["codigo", "string"], ["nome", "string"], ["ordem", "number"]] },
    ref_produtos: { pk: ["codigo"], colunas: [["codigo", "string"], ["nome", "string"]] },
    dim_agencias: { pk: ["id_agencia"], colunas: [["id_agencia", "string"], ["nome", "string"], ["cidade", "string"]] },
    dim_posicoes: {
      pk: ["id_posicao"],
      colunas: [["id_posicao", "string"], ["nome_posicao", "string"], ["id_agencia", "string"], ["segmento_especialidade", "string"], ["capacidade_max_contas", "number"], ["status", "string"]]
    },
    dim_gerentes: {
      pk: ["id_gerente"],
      colunas: [["id_gerente", "string"], ["nome_completo", "string"], ["email_corporativo", "string"], ["perfil", "string"], ["status", "string"]]
    },
    bridge_ocupacao_posicao: {
      pk: ["id_ocupacao"],
      colunas: [["id_ocupacao", "string"], ["id_posicao", "string"], ["id_gerente", "string"], ["data_inicio", "string"], ["data_fim", "string"], ["tipo_vinculo", "string"]]
    },
    fct_delegacoes: {
      pk: ["id_delegacao"],
      colunas: [
        ["id_delegacao", "string"],
        ["id_posicao_origem", "string"],
        ["id_gerente_delegado", "string"],
        ["data_inicio", "string"],
        ["data_fim", "string"],
        ["motivo", "string"],
        ["escopo", "string"],
        ["status_aprovacao", "string"],
        ["criada_por", "string"],
        ["criada_em", "string"],
        ["decidida_por", "string"],
        ["decidida_em", "string"],
        ["revogada_em", "string"]
      ]
    },
    dim_clientes: {
      pk: ["id_cliente"],
      colunas: [
        ["id_cliente", "string"],
        ["nome_razao_social", "string"],
        ["cpf_cnpj", "string"],
        ["segmento_cliente", "string"],
        ["faixa_renda_faturamento", "number"],
        ["volume_aum", "number"],
        ["score_risco", "number"],
        ["id_posicao_carteira", "string"],
        ["data_carteirizacao", "string"],
        ["status", "string"]
      ]
    },
    bridge_vinculo_carteira: {
      pk: ["id_vinculo"],
      colunas: [["id_vinculo", "string"], ["id_cliente", "string"], ["id_posicao", "string"], ["inicio_em", "string"], ["fim_em", "string"]]
    },
    fct_produtos_cliente: {
      pk: ["id_cliente", "codigo_produto"],
      colunas: [["id_cliente", "string"], ["codigo_produto", "string"], ["status", "string"], ["data_contratacao", "string"]]
    },
    fct_interacoes_crm: {
      pk: ["id_interacao"],
      colunas: [["id_interacao", "string"], ["id_cliente", "string"], ["id_posicao", "string"], ["canal", "string"], ["data", "string"], ["nota", "string"]]
    },
    fct_movimentacao_carteira: {
      pk: ["id_movimentacao"],
      colunas: [
        ["id_movimentacao", "string"],
        ["id_lote", "string"],
        ["id_cliente", "string"],
        ["id_posicao_origem", "string"],
        ["id_posicao_destino", "string"],
        ["motivo", "string"],
        ["ator", "string"],
        ["instante", "string"],
        ["tipo", "string"]
      ]
    },
    cfg_metas_posicao: {
      pk: ["id_posicao"],
      colunas: [["id_posicao", "string"], ["meta_aum", "number"], ["meta_clientes", "number"], ["utilizacao_minima", "number"], ["utilizacao_maxima", "number"], ["atualizado_por", "string"], ["atualizado_em", "string"]]
    },
    log_auditoria: {
      pk: ["id_log"],
      colunas: [["id_log", "string"], ["instante", "string"], ["ator", "string"], ["acao", "string"], ["entidade", "string"], ["id_entidade", "string"], ["detalhe", "string"]]
    },
    log_eventos: { pk: ["id_evento"], colunas: [["id_evento", "string"], ["instante", "string"], ["tipo", "string"], ["payload", "string"]] }
  };
  var NOMES_TABELAS = Object.keys(TABELAS);
  function criarDbVazio() {
    return Object.fromEntries(NOMES_TABELAS.map((t) => [t, []]));
  }
  function clonarJson(valor) {
    return JSON.parse(JSON.stringify(valor));
  }
  function clonarDb(db) {
    return clonarJson(db);
  }
  function emTransacao(db, fn) {
    const snapshot = clonarJson(db);
    try {
      return fn();
    } catch (erro) {
      for (const t of NOMES_TABELAS) db[t] = snapshot[t];
      throw erro;
    }
  }
  function proximoId(prefixo, existentes, largura = 4) {
    let max = 0;
    const re = new RegExp(`^${prefixo}-(\\d+)$`);
    for (const id of existentes) {
      const m = re.exec(id);
      if (m) max = Math.max(max, Number(m[1]));
    }
    return `${prefixo}-${String(max + 1).padStart(largura, "0")}`;
  }

  // packages/core/src/model/registro.ts
  function auditar(db, clock, ator, acao, entidade, idEntidade, detalhe = {}) {
    db.log_auditoria.push({
      id_log: proximoId("LOG", db.log_auditoria.map((l) => l.id_log), 6),
      instante: clock.agora().toISOString(),
      ator,
      acao,
      entidade,
      id_entidade: idEntidade,
      detalhe: JSON.stringify(detalhe)
    });
  }
  function publicar(db, clock, tipo, payload) {
    db.log_eventos.push({
      id_evento: proximoId("EVT", db.log_eventos.map((e) => e.id_evento), 6),
      instante: clock.agora().toISOString(),
      tipo,
      payload: JSON.stringify(payload)
    });
  }
  return __toCommonJS(nucleo_exports);
})();
