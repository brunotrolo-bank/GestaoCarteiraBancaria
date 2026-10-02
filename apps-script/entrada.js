/* GERADO por scripts/build-gas.ts a partir do repositório — não editar à mão (npm run gas:build). Entrada do backend: apiChamar / instalarEm */
"use strict";
var CARTEIRA = (() => {
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

  // global:@carteira/api
  var require_api = __commonJS({
    "global:@carteira/api"(exports, module) {
      module.exports = CARTEIRA_API;
    }
  });

  // global:./gas-store.ts
  var require_gas_store = __commonJS({
    "global:./gas-store.ts"(exports, module) {
      module.exports = CARTEIRA_ARMAZENAMENTO;
    }
  });

  // apps/gas/src/entrada.ts
  var entrada_exports = {};
  __export(entrada_exports, {
    apiChamar: () => apiChamar,
    instalarEm: () => instalarEm
  });
  var import_api = __toESM(require_api(), 1);
  var import_gas_store = __toESM(require_gas_store(), 1);
  function apiChamar(req) {
    const escrita = req.metodo === "POST";
    const lock = escrita ? LockService.getScriptLock() : null;
    if (lock) lock.waitLock(25e3);
    try {
      const store = new import_gas_store.GasStore(planilhaId());
      return (0, import_api.criarManipulador)({ store, simulacaoPapel: true })(req);
    } finally {
      if (lock) lock.releaseLock();
    }
  }
  function instalarEm(id) {
    new import_gas_store.GasStore(id, { semear: true });
  }
  return __toCommonJS(entrada_exports);
})();
