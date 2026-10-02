/* GERADO por scripts/build-gas.ts a partir do repositório — não editar à mão (npm run gas:build). Domínio: posicoes */
"use strict";
var DOM_posicoes = (() => {
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

  // packages/core/src/posicoes/index.ts
  var index_exports = {};
  __export(index_exports, {
    DomainError: () => import_errors.DomainError,
    LIMITES_PADRAO: () => LIMITES_PADRAO,
    alterarStatusPosicao: () => alterarStatusPosicao,
    cadastrarGerente: () => cadastrarGerente,
    criarPosicao: () => criarPosicao,
    definirMetas: () => definirMetas,
    desligarGerente: () => desligarGerente,
    exigirGerenteGeral: () => exigirGerenteGeral,
    historicoDaPosicao: () => historicoDaPosicao,
    metasDaPosicao: () => metasDaPosicao,
    obterGerente: () => obterGerente,
    obterPosicao: () => obterPosicao,
    ocupacaoDoGerente: () => ocupacaoDoGerente,
    posicaoVaga: () => posicaoVaga,
    titularVigente: () => titularVigente,
    trocarTitular: () => trocarTitular,
    validarNovaOcupacao: () => validarNovaOcupacao
  });
  var import_db = __toESM(require_db(), 1);
  var import_dates = __toESM(require_dates(), 1);
  var import_errors = __toESM(require_errors(), 1);
  var import_registro = __toESM(require_registro(), 1);
  var SEGMENTOS_POSICAO = ["Private", "Alta Renda", "Middle Market", "Misto"];
  var TRANSICOES = {
    Ativa: ["Congelada", "Extinta"],
    Congelada: ["Ativa", "Extinta"],
    Extinta: []
  };
  function exigirGerenteGeral(db, ator) {
    const g = db.dim_gerentes.find((x) => x.id_gerente === ator.idGerente);
    (0, import_errors.exigir)(g && g.status === "Ativo" && g.perfil === "Gerente Geral", "NAO_AUTORIZADO", "Opera\xE7\xE3o restrita ao Gerente Geral.");
    return g;
  }
  function obterPosicao(db, id) {
    const p = db.dim_posicoes.find((x) => x.id_posicao === id);
    (0, import_errors.exigir)(p, "POSICAO_INEXISTENTE", `Posi\xE7\xE3o ${id} n\xE3o existe.`);
    return p;
  }
  function obterGerente(db, id) {
    const g = db.dim_gerentes.find((x) => x.id_gerente === id);
    (0, import_errors.exigir)(g, "GERENTE_INEXISTENTE", `Gerente ${id} n\xE3o existe.`);
    return g;
  }
  function titularVigente(db, idPosicao, dia) {
    var _a;
    return (_a = db.bridge_ocupacao_posicao.find((o) => o.id_posicao === idPosicao && (0, import_dates.noIntervalo)(dia, o.data_inicio, o.data_fim))) != null ? _a : null;
  }
  function ocupacaoDoGerente(db, idGerente, dia) {
    var _a;
    return (_a = db.bridge_ocupacao_posicao.find((o) => o.id_gerente === idGerente && (0, import_dates.noIntervalo)(dia, o.data_inicio, o.data_fim))) != null ? _a : null;
  }
  function historicoDaPosicao(db, idPosicao) {
    obterPosicao(db, idPosicao);
    return db.bridge_ocupacao_posicao.filter((o) => o.id_posicao === idPosicao).sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
  }
  function criarPosicao(db, clock, entrada, ator) {
    var _a;
    exigirGerenteGeral(db, ator);
    (0, import_errors.exigir)((_a = entrada.nome_posicao) == null ? void 0 : _a.trim(), "DADOS_INVALIDOS", "Nome da posi\xE7\xE3o \xE9 obrigat\xF3rio.");
    (0, import_errors.exigir)(SEGMENTOS_POSICAO.includes(entrada.segmento_especialidade), "DADOS_INVALIDOS", "Segmento de especialidade inv\xE1lido.");
    (0, import_errors.exigir)(Number.isInteger(entrada.capacidade_max_contas) && entrada.capacidade_max_contas > 0, "DADOS_INVALIDOS", "Capacidade deve ser inteiro positivo.");
    (0, import_errors.exigir)(db.dim_agencias.some((a) => a.id_agencia === entrada.id_agencia), "DADOS_INVALIDOS", "Ag\xEAncia inexistente.");
    const prefixo = `POS-${entrada.id_agencia}`;
    const posicao = {
      id_posicao: (0, import_db.proximoId)(prefixo, db.dim_posicoes.map((p) => p.id_posicao), 3),
      nome_posicao: entrada.nome_posicao.trim(),
      id_agencia: entrada.id_agencia,
      segmento_especialidade: entrada.segmento_especialidade,
      capacidade_max_contas: entrada.capacidade_max_contas,
      status: "Ativa"
    };
    return (0, import_db.emTransacao)(db, () => {
      db.dim_posicoes.push(posicao);
      (0, import_registro.auditar)(db, clock, ator.idGerente, "POSICAO_CRIADA", "dim_posicoes", posicao.id_posicao, { nome: posicao.nome_posicao });
      (0, import_registro.publicar)(db, clock, "PosicaoCriada", { id_posicao: posicao.id_posicao });
      return posicao;
    });
  }
  function alterarStatusPosicao(db, clock, idPosicao, novo, ator) {
    exigirGerenteGeral(db, ator);
    const p = obterPosicao(db, idPosicao);
    (0, import_errors.exigir)(TRANSICOES[p.status].includes(novo), "TRANSICAO_INVALIDA", `Transi\xE7\xE3o ${p.status} \u2192 ${novo} n\xE3o permitida.`);
    if (novo === "Extinta") {
      const carteira = db.dim_clientes.filter((c) => c.id_posicao_carteira === idPosicao).length;
      (0, import_errors.exigir)(carteira === 0, "POSICAO_COM_CARTEIRA", "N\xE3o \xE9 poss\xEDvel extinguir posi\xE7\xE3o com clientes vinculados.", { clientes: carteira });
    }
    return (0, import_db.emTransacao)(db, () => {
      const anterior = p.status;
      p.status = novo;
      (0, import_registro.auditar)(db, clock, ator.idGerente, "POSICAO_STATUS_ALTERADO", "dim_posicoes", idPosicao, { de: anterior, para: novo });
      (0, import_registro.publicar)(db, clock, "PosicaoStatusAlterado", { id_posicao: idPosicao, de: anterior, para: novo });
      return p;
    });
  }
  function cadastrarGerente(db, clock, entrada, ator) {
    var _a, _b;
    exigirGerenteGeral(db, ator);
    (0, import_errors.exigir)((_a = entrada.nome_completo) == null ? void 0 : _a.trim(), "DADOS_INVALIDOS", "Nome \xE9 obrigat\xF3rio.");
    (0, import_errors.exigir)(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((_b = entrada.email_corporativo) != null ? _b : ""), "DADOS_INVALIDOS", "E-mail inv\xE1lido.");
    (0, import_errors.exigir)(["Gerente de Contas", "Gerente Geral"].includes(entrada.perfil), "DADOS_INVALIDOS", "Perfil inv\xE1lido.");
    const email = entrada.email_corporativo.toLowerCase();
    (0, import_errors.exigir)(!db.dim_gerentes.some((g) => g.email_corporativo.toLowerCase() === email), "EMAIL_DUPLICADO", "E-mail j\xE1 cadastrado.");
    const gerente = {
      id_gerente: (0, import_db.proximoId)("GER", db.dim_gerentes.map((g) => g.id_gerente), 3),
      nome_completo: entrada.nome_completo.trim(),
      email_corporativo: email,
      perfil: entrada.perfil,
      status: "Ativo"
    };
    return (0, import_db.emTransacao)(db, () => {
      db.dim_gerentes.push(gerente);
      (0, import_registro.auditar)(db, clock, ator.idGerente, "GERENTE_CADASTRADO", "dim_gerentes", gerente.id_gerente, { perfil: gerente.perfil });
      return gerente;
    });
  }
  function validarNovaOcupacao(db, nova) {
    const intervalo = { inicio: nova.data_inicio, fim: nova.data_fim };
    const sobrepoe = db.bridge_ocupacao_posicao.some(
      (o) => o.id_posicao === nova.id_posicao && (0, import_dates.intervalosSobrepostos)(intervalo, { inicio: o.data_inicio, fim: o.data_fim })
    );
    (0, import_errors.exigir)(!sobrepoe, "OCUPACAO_SOBREPOSTA", "A posi\xE7\xE3o j\xE1 possui titular no per\xEDodo informado.");
    const duplaAlocacao = db.bridge_ocupacao_posicao.some(
      (o) => o.id_gerente === nova.id_gerente && (0, import_dates.intervalosSobrepostos)(intervalo, { inicio: o.data_inicio, fim: o.data_fim })
    );
    (0, import_errors.exigir)(!duplaAlocacao, "GERENTE_JA_ALOCADO", "O gerente j\xE1 ocupa uma posi\xE7\xE3o no per\xEDodo informado.");
  }
  function trocarTitular(db, clock, entrada, ator) {
    var _a;
    exigirGerenteGeral(db, ator);
    (0, import_errors.exigir)((0, import_dates.isISODate)(entrada.data_inicio), "DATAS_INVALIDAS", "Data de in\xEDcio inv\xE1lida.");
    const posicao = obterPosicao(db, entrada.id_posicao);
    (0, import_errors.exigir)(posicao.status !== "Extinta", "POSICAO_EXTINTA", "Posi\xE7\xE3o extinta n\xE3o aceita titular.");
    const gerente = obterGerente(db, entrada.id_gerente);
    (0, import_errors.exigir)(gerente.status === "Ativo", "GERENTE_INDISPONIVEL", "Gerente n\xE3o est\xE1 Ativo.");
    (0, import_errors.exigir)(gerente.perfil !== "Gerente Geral", "PERFIL_INVALIDO", "O Gerente Geral n\xE3o ocupa posi\xE7\xE3o.");
    (0, import_errors.exigir)(["Titular Efetivo", "Trainee", "Interino"].includes(entrada.tipo_vinculo), "DADOS_INVALIDOS", "Tipo de v\xEDnculo inv\xE1lido.");
    const hoje = (0, import_dates.diaDe)(clock.agora());
    if (entrada.data_inicio < hoje) (0, import_errors.exigir)((_a = entrada.motivo) == null ? void 0 : _a.trim(), "MOTIVO_OBRIGATORIO", "Troca retroativa exige motivo.");
    return (0, import_db.emTransacao)(db, () => {
      var _a2, _b;
      const vigente = titularVigente(db, entrada.id_posicao, entrada.data_inicio);
      if (vigente) {
        (0, import_errors.exigir)(entrada.data_inicio > vigente.data_inicio, "INTERVALO_INVALIDO", "In\xEDcio da nova ocupa\xE7\xE3o deve ser posterior ao in\xEDcio da atual.");
        vigente.data_fim = (0, import_dates.addDays)(entrada.data_inicio, -1);
      }
      const nova = {
        id_ocupacao: (0, import_db.proximoId)("OCU", db.bridge_ocupacao_posicao.map((o) => o.id_ocupacao), 4),
        id_posicao: entrada.id_posicao,
        id_gerente: entrada.id_gerente,
        data_inicio: entrada.data_inicio,
        data_fim: null,
        tipo_vinculo: entrada.tipo_vinculo
      };
      validarNovaOcupacao(db, nova);
      db.bridge_ocupacao_posicao.push(nova);
      (0, import_registro.auditar)(db, clock, ator.idGerente, "TITULAR_ALTERADO", "bridge_ocupacao_posicao", nova.id_ocupacao, {
        id_posicao: nova.id_posicao,
        anterior: (_a2 = vigente == null ? void 0 : vigente.id_gerente) != null ? _a2 : null,
        novo: nova.id_gerente,
        inicio: nova.data_inicio,
        motivo: (_b = entrada.motivo) != null ? _b : null
      });
      (0, import_registro.publicar)(db, clock, "TitularAlterado", { id_posicao: nova.id_posicao, id_gerente: nova.id_gerente, data_inicio: nova.data_inicio });
      return nova;
    });
  }
  function desligarGerente(db, clock, idGerente, ator) {
    exigirGerenteGeral(db, ator);
    const g = obterGerente(db, idGerente);
    (0, import_errors.exigir)(g.status !== "Desligado", "TRANSICAO_INVALIDA", "Gerente j\xE1 desligado.");
    return (0, import_db.emTransacao)(db, () => {
      var _a;
      const hoje = (0, import_dates.diaDe)(clock.agora());
      const ocupacao = ocupacaoDoGerente(db, idGerente, hoje);
      g.status = "Desligado";
      if (ocupacao) {
        const ontem = (0, import_dates.addDays)(hoje, -1);
        ocupacao.data_fim = ontem >= ocupacao.data_inicio ? ontem : hoje;
        (0, import_registro.publicar)(db, clock, "PosicaoVagou", { id_posicao: ocupacao.id_posicao });
      }
      (0, import_registro.auditar)(db, clock, ator.idGerente, "GERENTE_DESLIGADO", "dim_gerentes", idGerente, { posicao: (_a = ocupacao == null ? void 0 : ocupacao.id_posicao) != null ? _a : null });
      return g;
    });
  }
  function posicaoVaga(db, idPosicao, dia) {
    return titularVigente(db, idPosicao, dia) === null;
  }
  var LIMITES_PADRAO = { utilizacao_minima: 0.5, utilizacao_maxima: 1 };
  function metasDaPosicao(db, idPosicao) {
    const m = db.cfg_metas_posicao.find((x) => x.id_posicao === idPosicao);
    return m ? { meta_aum: m.meta_aum, meta_clientes: m.meta_clientes, utilizacao_minima: m.utilizacao_minima, utilizacao_maxima: m.utilizacao_maxima } : { meta_aum: 0, meta_clientes: 0, ...LIMITES_PADRAO };
  }
  function definirMetas(db, clock, idPosicao, entrada, ator) {
    exigirGerenteGeral(db, ator);
    obterPosicao(db, idPosicao);
    const { meta_aum, meta_clientes, utilizacao_minima, utilizacao_maxima } = entrada;
    for (const [campo, v] of Object.entries(entrada)) (0, import_errors.exigir)(Number.isFinite(v), "DADOS_INVALIDOS", `${campo}: informe um n\xFAmero.`);
    (0, import_errors.exigir)(meta_aum >= 0, "DADOS_INVALIDOS", 'meta_aum: n\xE3o pode ser negativa (use 0 para "sem meta").');
    (0, import_errors.exigir)(Number.isInteger(meta_clientes) && meta_clientes >= 0, "DADOS_INVALIDOS", "meta_clientes: use um n\xFAmero inteiro maior ou igual a 0 (0 = sem meta).");
    (0, import_errors.exigir)(utilizacao_minima >= 0 && utilizacao_minima < 1, "DADOS_INVALIDOS", "utilizacao_minima: deve estar entre 0% e 100% (exclusive).");
    (0, import_errors.exigir)(utilizacao_maxima > utilizacao_minima && utilizacao_maxima <= 3, "DADOS_INVALIDOS", "utilizacao_maxima: deve ser maior que a m\xEDnima e no m\xE1ximo 300%.");
    return (0, import_db.emTransacao)(db, () => {
      const anterior = metasDaPosicao(db, idPosicao);
      const linha = { id_posicao: idPosicao, ...entrada, atualizado_por: ator.idGerente, atualizado_em: clock.agora().toISOString() };
      const i = db.cfg_metas_posicao.findIndex((x) => x.id_posicao === idPosicao);
      if (i >= 0) db.cfg_metas_posicao[i] = linha;
      else db.cfg_metas_posicao.push(linha);
      (0, import_registro.auditar)(db, clock, ator.idGerente, "POSICAO_METAS_DEFINIDAS", "cfg_metas_posicao", idPosicao, { de: anterior, para: entrada });
      (0, import_registro.publicar)(db, clock, "MetasPosicaoDefinidas", { id_posicao: idPosicao, ...entrada });
      return linha;
    });
  }
  return __toCommonJS(index_exports);
})();
CARTEIRA_DOMINIOS.posicoes = DOM_posicoes;
