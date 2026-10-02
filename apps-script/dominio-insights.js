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
    carteiraDoAtor: () => carteiraDoAtor,
    classificarUtilizacao: () => classificarUtilizacao,
    clientesVisiveis: () => clientesVisiveis,
    desbalanceamentos: () => desbalanceamentos,
    exigirAtorAtivo: () => exigirAtorAtivo,
    resumoAgencia: () => resumoAgencia,
    resumoPosicao: () => resumoPosicao,
    visao360: () => visao360
  });
  var import_dates = __toESM(require_dates(), 1);
  var import_errors = __toESM(require_errors(), 1);
  var import_acesso = __toESM(require_acesso(), 1);
  var import_delegacao = __toESM(require_delegacao(), 1);
  var import_posicoes = __toESM(require_posicoes(), 1);
  var import_clientes = __toESM(require_clientes(), 1);
  var LIMITE_SUPERIOR = 1;
  var LIMITE_INFERIOR = 0.5;
  var SEGMENTOS = ["UHNW", "Private", "Alta Renda", "Varejo"];
  function classificarUtilizacao(utilizacao) {
    if (utilizacao > LIMITE_SUPERIOR) return "Acima";
    if (utilizacao < LIMITE_INFERIOR) return "Abaixo";
    return null;
  }
  function posicaoVisivel(db, ctx) {
    return new Map((0, import_acesso.resolverAcessos)(db, ctx.idGerente, ctx.instante).posicoes.map((p) => [p.id_posicao, p]));
  }
  function clientesVisiveis(db, ctx) {
    const permitidas = posicaoVisivel(db, ctx);
    const resultado = [];
    for (const c of db.dim_clientes) {
      const posicao = (0, import_acesso.posicaoDoClienteEm)(db, c.id_cliente, ctx.instante);
      if (posicao && permitidas.has(posicao)) resultado.push({ ...c, posicao_no_instante: posicao });
    }
    return resultado;
  }
  var soma = (xs) => xs.reduce((a, b) => a + Math.round(b * 100), 0) / 100;
  var razao = (a, b) => b === 0 ? 0 : a / b;
  function resumoPosicao(db, ctx, acesso) {
    const p = db.dim_posicoes.find((x) => x.id_posicao === acesso.id_posicao);
    const ativos = db.dim_clientes.filter(
      (c) => c.status === "Ativo" && (0, import_acesso.posicaoDoClienteEm)(db, c.id_cliente, ctx.instante) === p.id_posicao
    );
    const ocupacao = (0, import_posicoes.titularVigente)(db, p.id_posicao, (0, import_dates.diaDe)(ctx.instante));
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
    const acessos = (0, import_acesso.resolverAcessos)(db, ctx.idGerente, ctx.instante);
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
      por_segmento: SEGMENTOS.map((s) => {
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
    const acessos = (0, import_acesso.resolverAcessos)(db, ctx.idGerente, ctx.instante);
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
          cobertura: { id_delegacao: d.id_delegacao, escopo: d.escopo, data_fim: d.data_fim, situacao: (0, import_delegacao.situacao)(d, ctx.instante) },
          clientes
        });
      }
    }
    return secoes.sort((a, b) => a.tipo === b.tipo ? a.posicao.id_posicao.localeCompare(b.posicao.id_posicao) : a.tipo === "Propria" ? -1 : 1);
  }
  function visao360(db, ctx, idCliente) {
    const cliente = db.dim_clientes.find((c) => c.id_cliente === idCliente);
    if (!cliente) throw new import_errors.DomainError("ACESSO_NEGADO", "Acesso negado ao cliente.");
    const decisao = (0, import_acesso.exigirAcessoCliente)(db, ctx.idGerente, idCliente, ctx.instante, "Leitura");
    const posId = (0, import_acesso.posicaoDoClienteEm)(db, idCliente, ctx.instante);
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
