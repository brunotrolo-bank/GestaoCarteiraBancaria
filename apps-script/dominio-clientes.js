/* GERADO por scripts/build-gas.ts a partir do repositório — não editar à mão (npm run gas:build). Domínio: clientes */
"use strict";
var DOM_clientes = (() => {
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

  // global:../acesso/index.ts
  var require_acesso = __commonJS({
    "global:../acesso/index.ts"(exports, module) {
      module.exports = CARTEIRA_DOMINIOS.acesso;
    }
  });

  // packages/core/src/clientes/index.ts
  var index_exports = {};
  __export(index_exports, {
    aderenteAoSegmento: () => aderenteAoSegmento,
    apenasDigitos: () => apenasDigitos,
    cadastrarCliente: () => cadastrarCliente,
    clienteMascarado: () => clienteMascarado,
    cnpjValido: () => cnpjValido,
    contarClientesDaPosicao: () => contarClientesDaPosicao,
    cpfValido: () => cpfValido,
    desfazerLote: () => desfazerLote,
    documentoValido: () => documentoValido,
    ehDocumentoSintetico: () => ehDocumentoSintetico,
    executarRedistribuicao: () => executarRedistribuicao,
    gerarCnpj: () => gerarCnpj,
    gerarCpf: () => gerarCpf,
    interacoesDoCliente: () => interacoesDoCliente,
    mascararDocumento: () => mascararDocumento,
    obterCliente: () => obterCliente,
    produtosDoCliente: () => produtosDoCliente,
    revelarDocumento: () => revelarDocumento,
    simularRedistribuicao: () => simularRedistribuicao,
    transferirCliente: () => transferirCliente,
    utilizacaoPosicao: () => utilizacaoPosicao
  });
  var import_db = __toESM(require_db(), 1);
  var import_dates = __toESM(require_dates(), 1);
  var import_errors = __toESM(require_errors(), 1);
  var import_registro = __toESM(require_registro(), 1);
  var import_posicoes = __toESM(require_posicoes(), 1);
  var import_acesso = __toESM(require_acesso(), 1);

  // packages/core/src/clientes/documento.ts
  function apenasDigitos(doc) {
    return (doc != null ? doc : "").replace(/\D/g, "");
  }
  function digitoCpf(base) {
    const soma = base.reduce((acc, n, i) => acc + n * (base.length + 1 - i), 0);
    const resto = soma * 10 % 11;
    return resto === 10 ? 0 : resto;
  }
  function digitoCnpj(base) {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = base.reduce((acc, n, i) => acc + n * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  }
  function cpfValido(doc) {
    const d = apenasDigitos(doc);
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    const n = [...d].map(Number);
    return digitoCpf(n.slice(0, 9)) === n[9] && digitoCpf(n.slice(0, 10)) === n[10];
  }
  function cnpjValido(doc) {
    const d = apenasDigitos(doc);
    if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
    const n = [...d].map(Number);
    return digitoCnpj(n.slice(0, 12)) === n[12] && digitoCnpj(n.slice(0, 13)) === n[13];
  }
  function documentoValido(doc) {
    const len = apenasDigitos(doc).length;
    return len === 11 ? cpfValido(doc) : len === 14 ? cnpjValido(doc) : false;
  }
  function gerarCpf(base9) {
    const n = [...base9].map(Number);
    const d1 = digitoCpf(n);
    const d2 = digitoCpf([...n, d1]);
    return `${base9}${d1}${d2}`;
  }
  function gerarCnpj(base12) {
    const n = [...base12].map(Number);
    const d1 = digitoCnpj(n);
    const d2 = digitoCnpj([...n, d1]);
    return `${base12}${d1}${d2}`;
  }
  function ehDocumentoSintetico(doc) {
    const d = apenasDigitos(doc);
    return d.length === 11 && d.startsWith("999") || d.length === 14 && d.startsWith("99999");
  }
  function mascararDocumento(doc) {
    const d = apenasDigitos(doc);
    if (d.length === 11) return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
    if (d.length === 14) return `**.***.${d.slice(5, 8)}/${d.slice(8, 12)}-**`;
    return "***";
  }

  // packages/core/src/clientes/index.ts
  var SEGMENTOS = ["UHNW", "Private", "Alta Renda", "Varejo"];
  var ADERENCIA = {
    Private: ["UHNW", "Private"],
    "Alta Renda": ["Alta Renda"],
    "Middle Market": ["Varejo"],
    Misto: SEGMENTOS
  };
  function utilizacaoPosicao(db, idPosicao, delta = 0) {
    const p = (0, import_posicoes.obterPosicao)(db, idPosicao);
    const ativos = db.dim_clientes.filter((c) => c.id_posicao_carteira === idPosicao && c.status === "Ativo").length + delta;
    return { id_posicao: idPosicao, clientes_ativos: ativos, capacidade: p.capacidade_max_contas, utilizacao: ativos / p.capacidade_max_contas };
  }
  function contarClientesDaPosicao(db, idPosicao) {
    return db.dim_clientes.filter((c) => c.id_posicao_carteira === idPosicao).length;
  }
  function obterCliente(db, id) {
    const c = db.dim_clientes.find((x) => x.id_cliente === id);
    (0, import_errors.exigir)(c, "CLIENTE_INEXISTENTE", `Cliente ${id} n\xE3o existe.`);
    return c;
  }
  function aderenteAoSegmento(segmentoPosicao, segmentoCliente) {
    return ADERENCIA[segmentoPosicao].includes(segmentoCliente);
  }
  function clienteMascarado(c) {
    const { cpf_cnpj, ...resto } = c;
    return { ...resto, cpf_cnpj_mascarado: mascararDocumento(cpf_cnpj) };
  }
  function cadastrarCliente(db, clock, entrada, ator) {
    var _a, _b;
    (0, import_posicoes.exigirGerenteGeral)(db, ator);
    (0, import_errors.exigir)((_a = entrada.nome_razao_social) == null ? void 0 : _a.trim(), "DADOS_INVALIDOS", "Nome \xE9 obrigat\xF3rio.");
    (0, import_errors.exigir)(documentoValido(entrada.cpf_cnpj), "DOCUMENTO_INVALIDO", "CPF/CNPJ inv\xE1lido.");
    const doc = apenasDigitos(entrada.cpf_cnpj);
    (0, import_errors.exigir)(!db.dim_clientes.some((c) => apenasDigitos(c.cpf_cnpj) === doc), "DOCUMENTO_DUPLICADO", "CPF/CNPJ j\xE1 cadastrado.");
    (0, import_errors.exigir)(SEGMENTOS.includes(entrada.segmento_cliente), "DADOS_INVALIDOS", "Segmento inv\xE1lido.");
    (0, import_errors.exigir)(Number.isInteger(entrada.score_risco) && entrada.score_risco >= 1 && entrada.score_risco <= 1e3, "DADOS_INVALIDOS", "Score deve estar entre 1 e 1000.");
    (0, import_errors.exigir)(entrada.volume_aum >= 0 && entrada.faixa_renda_faturamento >= 0, "DADOS_INVALIDOS", "Valores monet\xE1rios n\xE3o podem ser negativos.");
    const posicao = (0, import_posicoes.obterPosicao)(db, entrada.id_posicao_carteira);
    (0, import_errors.exigir)(posicao.status === "Ativa", "POSICAO_DESTINO_INDISPONIVEL", "A posi\xE7\xE3o n\xE3o est\xE1 Ativa.");
    const agora = clock.agora();
    const cliente = {
      id_cliente: (0, import_db.proximoId)("CLI", db.dim_clientes.map((c) => c.id_cliente), 4),
      nome_razao_social: entrada.nome_razao_social.trim(),
      cpf_cnpj: doc,
      segmento_cliente: entrada.segmento_cliente,
      faixa_renda_faturamento: entrada.faixa_renda_faturamento,
      volume_aum: entrada.volume_aum,
      score_risco: entrada.score_risco,
      id_posicao_carteira: posicao.id_posicao,
      data_carteirizacao: (0, import_dates.diaDe)(agora),
      status: (_b = entrada.status) != null ? _b : "Ativo"
    };
    return (0, import_db.emTransacao)(db, () => {
      db.dim_clientes.push(cliente);
      db.bridge_vinculo_carteira.push({
        id_vinculo: (0, import_db.proximoId)("VIN", db.bridge_vinculo_carteira.map((v) => v.id_vinculo), 5),
        id_cliente: cliente.id_cliente,
        id_posicao: posicao.id_posicao,
        inicio_em: agora.toISOString(),
        fim_em: null
      });
      (0, import_registro.auditar)(db, clock, ator.idGerente, "CLIENTE_CARTEIRIZADO", "dim_clientes", cliente.id_cliente, { id_posicao: posicao.id_posicao });
      (0, import_registro.publicar)(db, clock, "ClienteCarteirizado", { id_cliente: cliente.id_cliente, id_posicao: posicao.id_posicao });
      return cliente;
    });
  }
  function simularRedistribuicao(db, entrada) {
    const destino = (0, import_posicoes.obterPosicao)(db, entrada.id_posicao_destino);
    const ids = [...new Set(entrada.ids_clientes)];
    const clientes = ids.map((id) => obterCliente(db, id));
    const mover = clientes.filter((c) => c.id_posicao_carteira !== destino.id_posicao);
    const ignorados = clientes.filter((c) => c.id_posicao_carteira === destino.id_posicao).map((c) => c.id_cliente);
    const posicoesEnvolvidas = [.../* @__PURE__ */ new Set([destino.id_posicao, ...mover.map((c) => c.id_posicao_carteira)])];
    const antes = posicoesEnvolvidas.map((p) => utilizacaoPosicao(db, p));
    const depois = posicoesEnvolvidas.map((p) => {
      const saindo = mover.filter((c) => c.id_posicao_carteira === p && c.status === "Ativo").length;
      const entrando = p === destino.id_posicao ? mover.filter((c) => c.status === "Ativo").length : 0;
      return utilizacaoPosicao(db, p, entrando - saindo);
    });
    const avisos = [];
    for (const c of mover) {
      if (!aderenteAoSegmento(destino.segmento_especialidade, c.segmento_cliente)) {
        avisos.push({ codigo: "ADERENCIA_SEGMENTO", id_cliente: c.id_cliente, mensagem: `Segmento ${c.segmento_cliente} n\xE3o \xE9 aderente \xE0 especialidade ${destino.segmento_especialidade}.` });
      }
      if (c.status === "Inativo") avisos.push({ codigo: "CLIENTE_INATIVO", id_cliente: c.id_cliente, mensagem: "Cliente inativo n\xE3o pode ser redistribu\xEDdo." });
    }
    const depoisDestino = depois.find((u) => u.id_posicao === destino.id_posicao);
    if (depoisDestino.utilizacao > 1) avisos.push({ codigo: "CAPACIDADE_EXCEDIDA", mensagem: `Destino ficaria com ${Math.round(depoisDestino.utilizacao * 100)}% da capacidade.` });
    return { id_posicao_destino: destino.id_posicao, clientes_a_mover: mover.map((c) => c.id_cliente), ignorados_ja_no_destino: ignorados, antes, depois, avisos };
  }
  function moverCliente(db, clock, c, destino, lote, motivo, ator, tipo) {
    const agora = clock.agora().toISOString();
    const atual = db.bridge_vinculo_carteira.find((v) => v.id_cliente === c.id_cliente && v.fim_em === null);
    if (atual) atual.fim_em = agora;
    db.bridge_vinculo_carteira.push({
      id_vinculo: (0, import_db.proximoId)("VIN", db.bridge_vinculo_carteira.map((v) => v.id_vinculo), 5),
      id_cliente: c.id_cliente,
      id_posicao: destino,
      inicio_em: agora,
      fim_em: null
    });
    const origem = c.id_posicao_carteira;
    c.id_posicao_carteira = destino;
    c.data_carteirizacao = (0, import_dates.diaDe)(clock.agora());
    const mov = {
      id_movimentacao: (0, import_db.proximoId)("MOV", db.fct_movimentacao_carteira.map((m) => m.id_movimentacao), 6),
      id_lote: lote,
      id_cliente: c.id_cliente,
      id_posicao_origem: origem,
      id_posicao_destino: destino,
      motivo,
      ator,
      instante: agora,
      tipo
    };
    db.fct_movimentacao_carteira.push(mov);
    (0, import_registro.publicar)(db, clock, "ClienteRealocado", { id_cliente: c.id_cliente, de: origem, para: destino, id_lote: lote });
    return mov;
  }
  function executarRedistribuicao(db, clock, entrada, ator) {
    (0, import_posicoes.exigirGerenteGeral)(db, ator);
    return aplicarLote(db, clock, entrada, ator);
  }
  function aplicarLote(db, clock, entrada, ator) {
    var _a, _b, _c;
    (0, import_errors.exigir)((_a = entrada.motivo) == null ? void 0 : _a.trim(), "MOTIVO_OBRIGATORIO", "Motivo \xE9 obrigat\xF3rio.");
    const idLote = ((_b = entrada.chave_idempotencia) == null ? void 0 : _b.trim()) || (0, import_db.proximoId)("LOTE", [...new Set(db.fct_movimentacao_carteira.map((m) => m.id_lote))], 4);
    const existentes = db.fct_movimentacao_carteira.filter((m) => m.id_lote === idLote);
    if (existentes.length > 0) return { id_lote: idLote, repetido: true, movimentacoes: existentes, capacidade_excedida: false };
    const destino = (0, import_posicoes.obterPosicao)(db, entrada.id_posicao_destino);
    (0, import_errors.exigir)(destino.status === "Ativa", "POSICAO_DESTINO_INDISPONIVEL", "A posi\xE7\xE3o de destino n\xE3o est\xE1 Ativa.");
    const ids = [...new Set(entrada.ids_clientes)];
    const clientes = ids.map((id) => obterCliente(db, id));
    const inativos = clientes.filter((c) => c.status === "Inativo");
    (0, import_errors.exigir)(inativos.length === 0, "CLIENTE_INATIVO", "H\xE1 clientes inativos no lote.", { ids: inativos.map((c) => c.id_cliente) });
    const mover = clientes.filter((c) => c.id_posicao_carteira !== destino.id_posicao);
    (0, import_errors.exigir)(mover.length > 0, "LOTE_VAZIO", "Nenhum cliente a mover.");
    const sim = simularRedistribuicao(db, entrada);
    const excedida = sim.depois.find((u) => u.id_posicao === destino.id_posicao).utilizacao > 1;
    if (excedida) (0, import_errors.exigir)((_c = entrada.justificativa) == null ? void 0 : _c.trim(), "JUSTIFICATIVA_OBRIGATORIA", "Capacidade excedida exige justificativa.");
    return (0, import_db.emTransacao)(db, () => {
      var _a2;
      const movimentacoes = mover.map((c) => moverCliente(db, clock, c, destino.id_posicao, idLote, entrada.motivo.trim(), ator.idGerente, mover.length === 1 ? "Transferencia" : "Redistribuicao"));
      (0, import_registro.auditar)(db, clock, ator.idGerente, "LOTE_REDISTRIBUIDO", "fct_movimentacao_carteira", idLote, {
        destino: destino.id_posicao,
        clientes: movimentacoes.length,
        motivo: entrada.motivo.trim(),
        justificativa: (_a2 = entrada.justificativa) != null ? _a2 : null
      });
      (0, import_registro.publicar)(db, clock, "LoteRedistribuido", { id_lote: idLote, destino: destino.id_posicao, clientes: movimentacoes.length });
      if (excedida) (0, import_registro.publicar)(db, clock, "CapacidadeExcedida", { id_posicao: destino.id_posicao, id_lote: idLote });
      return { id_lote: idLote, repetido: false, movimentacoes, capacidade_excedida: excedida };
    });
  }
  function transferirCliente(db, clock, entrada, ator) {
    const ator_ = db.dim_gerentes.find((g) => g.id_gerente === ator.idGerente);
    (0, import_errors.exigir)(ator_ && ator_.status === "Ativo", "NAO_AUTORIZADO", "Ator desconhecido ou inativo.");
    if (ator_.perfil !== "Gerente Geral") (0, import_acesso.exigirAcessoCliente)(db, ator.idGerente, entrada.id_cliente, clock.agora(), "Escrita");
    return aplicarLote(
      db,
      clock,
      { ids_clientes: [entrada.id_cliente], id_posicao_destino: entrada.id_posicao_destino, motivo: entrada.motivo, justificativa: entrada.justificativa, chave_idempotencia: entrada.chave_idempotencia },
      ator
    );
  }
  function desfazerLote(db, clock, idLote, ator) {
    (0, import_posicoes.exigirGerenteGeral)(db, ator);
    const originais = db.fct_movimentacao_carteira.filter((m) => m.id_lote === idLote && m.tipo !== "Compensacao");
    (0, import_errors.exigir)(originais.length > 0, "LOTE_INEXISTENTE", `Lote ${idLote} n\xE3o existe.`);
    const idDesfazer = `${idLote}-DESFAZER`;
    (0, import_errors.exigir)(!db.fct_movimentacao_carteira.some((m) => m.id_lote === idDesfazer), "LOTE_JA_DESFEITO", "Lote j\xE1 foi desfeito.");
    for (const m of originais) {
      const c = obterCliente(db, m.id_cliente);
      (0, import_errors.exigir)(c.id_posicao_carteira === m.id_posicao_destino, "LOTE_NAO_DESFAZIVEL", "Cliente j\xE1 foi movimentado depois do lote.", { id_cliente: c.id_cliente });
    }
    return (0, import_db.emTransacao)(db, () => {
      const movimentacoes = originais.map((m) => moverCliente(db, clock, obterCliente(db, m.id_cliente), m.id_posicao_origem, idDesfazer, `Desfazer ${idLote}`, ator.idGerente, "Compensacao"));
      (0, import_registro.auditar)(db, clock, ator.idGerente, "LOTE_DESFEITO", "fct_movimentacao_carteira", idLote, { clientes: movimentacoes.length });
      (0, import_registro.publicar)(db, clock, "LoteDesfeito", { id_lote: idLote });
      return { id_lote: idDesfazer, repetido: false, movimentacoes, capacidade_excedida: false };
    });
  }
  function revelarDocumento(db, clock, idCliente, ator) {
    const g = db.dim_gerentes.find((x) => x.id_gerente === ator.idGerente);
    (0, import_errors.exigir)(g && g.status === "Ativo", "NAO_AUTORIZADO", "Ator desconhecido ou inativo.");
    const c = obterCliente(db, idCliente);
    const decisao = (0, import_acesso.decidirCliente)(db, ator.idGerente, idCliente, clock.agora());
    const ehTitular = decisao.origens.some((o) => o.origem === "Titular");
    (0, import_errors.exigir)(g.perfil === "Gerente Geral" || ehTitular, "ACESSO_NEGADO", "Apenas o titular da posi\xE7\xE3o ou o Gerente Geral revelam o documento.");
    (0, import_registro.auditar)(db, clock, ator.idGerente, "DOCUMENTO_REVELADO", "dim_clientes", idCliente, {});
    return c.cpf_cnpj;
  }
  function produtosDoCliente(db, idCliente) {
    return db.fct_produtos_cliente.filter((p) => p.id_cliente === idCliente);
  }
  function interacoesDoCliente(db, idCliente) {
    return db.fct_interacoes_crm.filter((i) => i.id_cliente === idCliente).sort((a, b) => b.data.localeCompare(a.data));
  }
  return __toCommonJS(index_exports);
})();
CARTEIRA_DOMINIOS.clientes = DOM_clientes;
