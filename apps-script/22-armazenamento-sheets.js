/* GERADO por scripts/build-gas.ts a partir do repositório — não editar à mão (npm run gas:build). Persistência na planilha (cache + escrita incremental) */
"use strict";
var CARTEIRA_ARMAZENAMENTO = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
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
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // global:@carteira/core
  var require_core = __commonJS({
    "global:@carteira/core"(exports, module) {
      module.exports = CARTEIRA_CORE;
    }
  });

  // global:@carteira/data/matriz
  var require_matriz = __commonJS({
    "global:@carteira/data/matriz"(exports, module) {
      module.exports = CARTEIRA_DADOS;
    }
  });

  // global:@carteira/data/seed
  var require_seed = __commonJS({
    "global:@carteira/data/seed"(exports, module) {
      module.exports = CARTEIRA_DADOS;
    }
  });

  // apps/gas/src/gas-store.ts
  var gas_store_exports = {};
  __export(gas_store_exports, {
    GasStore: () => GasStore
  });
  var import_core = __toESM(require_core(), 1);
  var import_matriz = __toESM(require_matriz(), 1);
  var import_seed = __toESM(require_seed(), 1);
  var CHAVE_CACHE = "carteira:db:v3";
  var TAMANHO_BLOCO = 9e4;
  var TTL_SEGUNDOS = 900;
  var SO_ANEXA = ["log_auditoria", "log_eventos", "fct_movimentacao_carteira"];
  var OPCIONAIS = ["cfg_metas_posicao"];
  var GasStore = class {
    /** `semear`: cria/popula todas as abas com o cenário demo (instalação em uma conta nova). */
    constructor(planilhaId, opcoes = {}) {
      __publicField(this, "planilhaId", planilhaId);
      __publicField(this, "nome", "gas-sheets");
      __publicField(this, "db");
      __publicField(this, "clock", new import_core.SystemClock());
      __publicField(this, "assinaturas", /* @__PURE__ */ new Map());
      __publicField(this, "linhasAnexaveis", /* @__PURE__ */ new Map());
      if (opcoes.semear) {
        this.db = (0, import_seed.criarSeed)({ cenario: "demo" });
        this.gravar(import_core.NOMES_TABELAS, true);
        this.salvarCache();
      } else {
        const doCache = opcoes.ignorarCache ? null : this.lerCache();
        if (doCache) {
          this.db = doCache;
        } else {
          try {
            this.db = this.lerPlanilha();
          } catch (e) {
            if (!String(e.message).startsWith("ABAS_AUSENTES")) throw e;
            this.db = (0, import_seed.criarSeed)({ cenario: "demo" });
            this.gravar(import_core.NOMES_TABELAS, true);
          }
          this.salvarCache();
        }
      }
      this.marcar();
    }
    assinatura(t) {
      return JSON.stringify(this.db[t].map((l) => import_core.TABELAS[t].colunas.map(([c]) => {
        var _a;
        return (_a = l[c]) != null ? _a : null;
      })));
    }
    assinaturasDeLinhas(t) {
      return this.db[t].map((l) => JSON.stringify(import_core.TABELAS[t].colunas.map(([c]) => {
        var _a;
        return (_a = l[c]) != null ? _a : null;
      })));
    }
    marcar() {
      for (const t of import_core.NOMES_TABELAS) this.assinaturas.set(t, this.assinatura(t));
      for (const t of SO_ANEXA) this.linhasAnexaveis.set(t, this.assinaturasDeLinhas(t));
    }
    // ---------- cache ----------
    lerCache() {
      try {
        const cache = CacheService.getScriptCache();
        const n = Number(cache.get(`${CHAVE_CACHE}:n`));
        if (!n) return null;
        const chaves = Array.from({ length: n }, (_, i) => `${CHAVE_CACHE}:${i}`);
        const blocos = cache.getAll(chaves);
        let b64 = "";
        for (const k of chaves) {
          if (blocos[k] === void 0) return null;
          b64 += blocos[k];
        }
        const bytes = Utilities.base64Decode(b64);
        const json = Utilities.ungzip(Utilities.newBlob(bytes, "application/x-gzip")).getDataAsString();
        return JSON.parse(json);
      } catch (e) {
        return null;
      }
    }
    salvarCache() {
      try {
        const cache = CacheService.getScriptCache();
        const gz = Utilities.gzip(Utilities.newBlob(JSON.stringify(this.db), "application/octet-stream", "db.json"));
        const b64 = Utilities.base64Encode(gz.getBytes());
        const itens = {};
        const n = Math.ceil(b64.length / TAMANHO_BLOCO);
        for (let i = 0; i < n; i += 1) itens[`${CHAVE_CACHE}:${i}`] = b64.slice(i * TAMANHO_BLOCO, (i + 1) * TAMANHO_BLOCO);
        itens[`${CHAVE_CACHE}:n`] = String(n);
        cache.putAll(itens, TTL_SEGUNDOS);
      } catch (e) {
      }
    }
    /** Descarta o cache e relê a planilha (após edição manual das abas). */
    recarregar() {
      try {
        const cache = CacheService.getScriptCache();
        const n = Number(cache.get(`${CHAVE_CACHE}:n`)) || 0;
        cache.removeAll([`${CHAVE_CACHE}:n`, ...Array.from({ length: n }, (_, i) => `${CHAVE_CACHE}:${i}`)]);
      } catch (e) {
      }
      this.db = this.lerPlanilha();
      this.salvarCache();
      this.marcar();
    }
    // ---------- planilha ----------
    lerPlanilha() {
      const ss = SpreadsheetApp.openById(this.planilhaId);
      const db = (0, import_core.criarDbVazio)();
      for (const t of import_core.NOMES_TABELAS) {
        const aba = ss.getSheetByName(t);
        if (!aba) {
          if (OPCIONAIS.includes(t)) continue;
          throw new Error(`ABAS_AUSENTES: ${t}`);
        }
        const valores = aba.getDataRange().getValues().map(
          (linha) => linha.map((v) => v instanceof Date ? Utilities.formatDate(v, "America/Sao_Paulo", "yyyy-MM-dd") : v)
        );
        db[t] = (0, import_matriz.matrizParaTabela)(t, valores);
      }
      return db;
    }
    formatarTexto(aba, t, primeiraLinha, linhas) {
      if (linhas <= 0) return;
      import_core.TABELAS[t].colunas.forEach(([, tipo], j) => {
        if (tipo === "string") aba.getRange(primeiraLinha, j + 1, linhas, 1).setNumberFormat("@");
      });
    }
    gravar(tabelas, criarAbas = false) {
      const ss = SpreadsheetApp.openById(this.planilhaId);
      for (const t of tabelas) {
        let aba = ss.getSheetByName(t);
        if (!aba) {
          if (!criarAbas && !SO_ANEXA.includes(t) && !OPCIONAIS.includes(t)) throw new Error(`Aba ausente: ${t}`);
          aba = ss.insertSheet(t);
        }
        const matriz = (0, import_matriz.tabelaParaMatriz)(this.db, t);
        const linhas = matriz.length;
        const colunas = matriz[0].length;
        const antes = this.linhasAnexaveis.get(t);
        if (antes && !criarAbas) {
          const agora = this.assinaturasDeLinhas(t);
          const prefixoIgual = agora.length >= antes.length && antes.every((s, i) => s === agora[i]);
          if (prefixoIgual) {
            const novas = matriz.slice(antes.length + 1);
            if (novas.length === 0) continue;
            const inicio = antes.length + 2;
            if (aba.getMaxRows() < inicio + novas.length - 1) aba.insertRowsAfter(aba.getMaxRows(), inicio + novas.length - 1 - aba.getMaxRows());
            this.formatarTexto(aba, t, inicio, novas.length);
            aba.getRange(inicio, 1, novas.length, colunas).setValues(novas);
            continue;
          }
        }
        if (aba.getMaxRows() < linhas) aba.insertRowsAfter(aba.getMaxRows(), linhas - aba.getMaxRows());
        if (aba.getMaxColumns() < colunas) aba.insertColumnsAfter(aba.getMaxColumns(), colunas - aba.getMaxColumns());
        aba.clearContents();
        this.formatarTexto(aba, t, 2, linhas - 1);
        aba.getRange(1, 1, linhas, colunas).setValues(matriz);
        aba.getRange(1, 1, 1, colunas).setFontWeight("bold");
        aba.setFrozenRows(1);
      }
    }
    persistir() {
      const alteradas = import_core.NOMES_TABELAS.filter((t) => this.assinatura(t) !== this.assinaturas.get(t));
      if (alteradas.length === 0) return;
      this.gravar(alteradas);
      this.salvarCache();
      this.marcar();
    }
    /** Reset da demonstração: regrava o cenário demo na planilha. */
    reiniciar() {
      this.db = (0, import_seed.criarSeed)({ cenario: "demo" });
      this.gravar(import_core.NOMES_TABELAS, true);
      this.salvarCache();
      this.marcar();
    }
  };
  return __toCommonJS(gas_store_exports);
})();
