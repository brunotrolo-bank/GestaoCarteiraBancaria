import type { Db, SegmentoCliente } from '../model/types.ts';
import { addDays, diaDe, type ISODate } from '../shared/dates.ts';
import { resolverAcessos } from '../acesso/index.ts';
import { situacao } from '../delegacao/index.ts';
import { clientesVisiveis, resumoAgencia, type Contexto } from './index.ts';

/**
 * Análises da carteira visível (Torre de Controle e Carteira): concentração, faixas, tendência, engajamento, oportunidades
 * e insights em linguagem de negócio. Tudo determinístico, calculado só sobre o que o ator pode ver (FR-INS-002).
 */
export type Severidade = 'critico' | 'atencao' | 'info' | 'positivo';
export interface Insight {
  severidade: Severidade;
  titulo: string;
  detalhe: string;
  destino?: 'cockpit' | 'posicoes' | 'carteira' | 'delegacoes';
}

export interface ClienteResumo { id_cliente: string; nome: string; segmento: SegmentoCliente; aum: number; id_posicao: string }

export interface AnaliseCarteira {
  calculado_em: string;
  escopo: 'Agencia' | 'Carteira';
  por_segmento: { segmento: SegmentoCliente; clientes: number; aum: number }[];
  concentracao: { maior_cliente_pct: number; top10_pct: number; top20pct_clientes_pct: number; curva: { pct_clientes: number; pct_aum: number }[] };
  faixas_aum: { faixa: string; clientes: number; aum: number }[];
  faixas_score: { faixa: string; clientes: number }[];
  produtos_por_cliente: { produtos: string; clientes: number }[];
  serie_mensal: { mes: string; contratacoes: number; interacoes: number; novos_clientes: number }[];
  canais_90d: { canal: string; interacoes: number }[];
  mapa_posicao_segmento: { id_posicao: string; nome_posicao: string; celulas: { segmento: SegmentoCliente; clientes: number }[] }[];
  engajamento: { sem_contato_90d: number; pct_sem_contato: number; prioritarios: (ClienteResumo & { dias_sem_contato: number | null })[] };
  oportunidades: (ClienteResumo & { produtos_ativos: number; produtos_faltantes: string[] })[];
  top_clientes: (ClienteResumo & { pct_do_total: number })[];
  delegacoes: { vigentes: number; expirando_7d: number };
  insights: Insight[];
}

const SEGMENTOS: SegmentoCliente[] = ['UHNW', 'Private', 'Alta Renda', 'Varejo'];
const FAIXAS_AUM: { faixa: string; ate: number }[] = [
  { faixa: 'Até R$ 250 mil', ate: 250_000 },
  { faixa: 'R$ 250 mil – 1 mi', ate: 1_000_000 },
  { faixa: 'R$ 1 – 5 mi', ate: 5_000_000 },
  { faixa: 'R$ 5 – 25 mi', ate: 25_000_000 },
  { faixa: 'Acima de R$ 25 mi', ate: Infinity },
];
const FAIXAS_SCORE: { faixa: string; ate: number }[] = [
  { faixa: 'Até 499', ate: 499 },
  { faixa: '500 – 699', ate: 699 },
  { faixa: '700 – 849', ate: 849 },
  { faixa: '850 ou mais', ate: Infinity },
];
const DIAS_SEM_CONTATO = 90;
const MESES_SERIE = 12;

const pct = (a: number, b: number): number => (b === 0 ? 0 : Math.round((a / b) * 1000) / 10);
const centavos = (xs: number[]): number => xs.reduce((a, b) => a + Math.round(b * 100), 0) / 100;
const dias = (de: ISODate, ate: ISODate): number => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
/** Os `n` últimos meses COMPLETOS antes de `hoje` (o mês corrente é parcial e distorceria a tendência). */
const mesesAte = (hoje: ISODate, n: number): string[] => {
  const [a, m] = hoje.split('-').map(Number) as [number, number];
  return Array.from({ length: n }, (_, i) => {
    const total = a * 12 + (m - 1) - (n - i);
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
  });
};
const brl = (v: number): string => (v >= 1e9 ? `R$ ${(v / 1e9).toFixed(2).replace('.', ',')} bi` : v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1).replace('.', ',')} mi` : `R$ ${Math.round(v / 1e3)} mil`);

export function analiseCarteira(db: Db, ctx: Contexto): AnaliseCarteira {
  const hoje = diaDe(ctx.instante);
  const resumo = resumoAgencia(db, ctx);
  const ativos = clientesVisiveis(db, ctx).filter((c) => c.status === 'Ativo');
  const idsVisiveis = new Set(clientesVisiveis(db, ctx).map((c) => c.id_cliente));
  const totalAum = centavos(ativos.map((c) => c.volume_aum));
  const resumir = (c: (typeof ativos)[number]): ClienteResumo => ({ id_cliente: c.id_cliente, nome: c.nome_razao_social, segmento: c.segmento_cliente, aum: c.volume_aum, id_posicao: c.posicao_no_instante });

  // concentração (Pareto)
  const porAum = [...ativos].sort((a, b) => b.volume_aum - a.volume_aum || a.id_cliente.localeCompare(b.id_cliente));
  const acumulado = (n: number): number => pct(centavos(porAum.slice(0, n).map((c) => c.volume_aum)), totalAum);
  const curva = Array.from({ length: 11 }, (_, i) => ({ pct_clientes: i * 10, pct_aum: acumulado(Math.round((porAum.length * i) / 10)) }));
  const concentracao = { maior_cliente_pct: acumulado(1), top10_pct: acumulado(10), top20pct_clientes_pct: acumulado(Math.ceil(porAum.length * 0.2)), curva };

  const faixa = <T extends { ate: number }>(faixas: T[], valor: number): T => faixas.find((f) => valor <= f.ate)!;
  const faixas_aum = FAIXAS_AUM.map((f) => {
    const doGrupo = ativos.filter((c) => faixa(FAIXAS_AUM, c.volume_aum) === f);
    return { faixa: f.faixa, clientes: doGrupo.length, aum: centavos(doGrupo.map((c) => c.volume_aum)) };
  });
  const faixas_score = FAIXAS_SCORE.map((f) => ({ faixa: f.faixa, clientes: ativos.filter((c) => faixa(FAIXAS_SCORE, c.score_risco) === f).length }));

  // produtos
  const produtosAtivos = new Map<string, Set<string>>();
  for (const p of db.fct_produtos_cliente) {
    if (p.status !== 'Ativo' || !idsVisiveis.has(p.id_cliente)) continue;
    produtosAtivos.set(p.id_cliente, (produtosAtivos.get(p.id_cliente) ?? new Set()).add(p.codigo_produto));
  }
  const qtd = (id: string): number => produtosAtivos.get(id)?.size ?? 0;
  const nomeProduto = new Map(db.ref_produtos.map((p) => [p.codigo, p.nome]));
  const produtos_por_cliente = [0, 1, 2, 3, 4].map((n) => ({
    produtos: n === 4 ? '4 ou mais' : n === 0 ? 'Nenhum' : n === 1 ? '1 produto' : `${n} produtos`,
    clientes: ativos.filter((c) => (n === 4 ? qtd(c.id_cliente) >= 4 : qtd(c.id_cliente) === n)).length,
  }));

  // série mensal
  const meses = mesesAte(hoje, MESES_SERIE);
  const mesDe = (d: string): string => d.slice(0, 7);
  const serie_mensal = meses.map((mes) => ({
    mes,
    contratacoes: db.fct_produtos_cliente.filter((p) => idsVisiveis.has(p.id_cliente) && mesDe(p.data_contratacao) === mes).length,
    interacoes: db.fct_interacoes_crm.filter((i) => idsVisiveis.has(i.id_cliente) && mesDe(i.data) === mes).length,
    novos_clientes: clientesVisiveis(db, ctx).filter((c) => mesDe(c.data_carteirizacao) === mes).length,
  }));

  // engajamento
  const inicio90 = addDays(hoje, -DIAS_SEM_CONTATO);
  const ultimoContato = new Map<string, ISODate>();
  const canais = new Map<string, number>();
  for (const i of db.fct_interacoes_crm) {
    if (!idsVisiveis.has(i.id_cliente) || i.data > hoje) continue;
    if (i.data > (ultimoContato.get(i.id_cliente) ?? '')) ultimoContato.set(i.id_cliente, i.data);
    if (i.data > inicio90) canais.set(i.canal, (canais.get(i.canal) ?? 0) + 1);
  }
  const semContato = ativos.filter((c) => (ultimoContato.get(c.id_cliente) ?? '') <= inicio90);
  const prioritarios = [...semContato]
    .sort((a, b) => b.volume_aum - a.volume_aum || a.id_cliente.localeCompare(b.id_cliente))
    .slice(0, 6)
    .map((c) => ({ ...resumir(c), dias_sem_contato: ultimoContato.has(c.id_cliente) ? dias(ultimoContato.get(c.id_cliente)!, hoje) : null }));

  // oportunidades de cross-sell: maior AUM com menos produtos
  const oportunidades = ativos
    .filter((c) => qtd(c.id_cliente) <= 2)
    .sort((a, b) => b.volume_aum - a.volume_aum || a.id_cliente.localeCompare(b.id_cliente))
    .slice(0, 6)
    .map((c) => ({
      ...resumir(c),
      produtos_ativos: qtd(c.id_cliente),
      produtos_faltantes: db.ref_produtos.filter((p) => !produtosAtivos.get(c.id_cliente)?.has(p.codigo)).map((p) => p.nome),
    }));

  const mapa_posicao_segmento = resumo.posicoes.map((p) => ({
    id_posicao: p.id_posicao,
    nome_posicao: p.nome_posicao,
    celulas: SEGMENTOS.map((segmento) => ({ segmento, clientes: ativos.filter((c) => c.posicao_no_instante === p.id_posicao && c.segmento_cliente === segmento).length })),
  }));

  const visiveis = new Set(resolverAcessos(db, ctx.idGerente, ctx.instante).posicoes.map((p) => p.id_posicao));
  const delegacoesVigentes = db.fct_delegacoes.filter((d) => visiveis.has(d.id_posicao_origem) && situacao(d, ctx.instante) === 'Em Vigor');
  const delegacoes = { vigentes: delegacoesVigentes.length, expirando_7d: delegacoesVigentes.filter((d) => dias(hoje, d.data_fim) <= 7).length };

  const top_clientes = porAum.slice(0, 5).map((c) => ({ ...resumir(c), pct_do_total: pct(c.volume_aum, totalAum) }));

  // ---------- insights em linguagem de negócio ----------
  const insights: Insight[] = [];
  for (const p of resumo.posicoes.filter((x) => x.status === 'Ativa' && x.desbalanceamento === 'Acima')) {
    const folga = resumo.posicoes.filter((x) => x.status === 'Ativa' && x.utilizacao < 0.9).sort((a, b) => a.utilizacao - b.utilizacao)[0];
    insights.push({
      severidade: 'critico',
      titulo: `${p.nome_posicao} acima da capacidade`,
      detalhe: `${p.clientes_ativos} clientes para ${p.capacidade} vagas (${Math.round(p.utilizacao * 100)}%).${folga ? ` ${folga.nome_posicao} tem folga (${Math.round(folga.utilizacao * 100)}%): simule a redistribuição.` : ''}`,
      destino: 'posicoes',
    });
  }
  for (const p of resumo.posicoes.filter((x) => x.status === 'Ativa' && x.desbalanceamento === 'Abaixo')) {
    insights.push({ severidade: 'atencao', titulo: `${p.nome_posicao} subutilizada`, detalhe: `Apenas ${Math.round(p.utilizacao * 100)}% da capacidade em uso; pode receber clientes de posições sobrecarregadas.`, destino: 'posicoes' });
  }
  for (const p of resumo.posicoes.filter((x) => x.vaga && x.status === 'Ativa')) {
    insights.push({ severidade: 'critico', titulo: `${p.nome_posicao} sem titular`, detalhe: `A posição tem ${p.clientes_ativos} clientes e nenhum gerente titular vigente.`, destino: 'posicoes' });
  }
  if (delegacoes.expirando_7d > 0) {
    insights.push({ severidade: 'atencao', titulo: `${delegacoes.expirando_7d} cobertura(s) terminam em até 7 dias`, detalhe: 'Confirme o retorno do titular ou renove a delegação antes do fim da vigência.', destino: 'delegacoes' });
  }
  if (ativos.length > 0 && concentracao.top10_pct >= 40) {
    insights.push({ severidade: 'atencao', titulo: 'Carteira concentrada', detalhe: `Os 10 maiores clientes somam ${concentracao.top10_pct.toString().replace('.', ',')}% do AUM; o maior sozinho responde por ${concentracao.maior_cliente_pct.toString().replace('.', ',')}%.`, destino: 'carteira' });
  }
  const valiosos = semContato.filter((c) => c.volume_aum >= 1_000_000);
  if (valiosos.length > 0) {
    insights.push({ severidade: 'critico', titulo: `${valiosos.length} clientes acima de R$ 1 mi sem contato há mais de ${DIAS_SEM_CONTATO} dias`, detalhe: `Somam ${brl(centavos(valiosos.map((c) => c.volume_aum)))} em AUM. Priorize o relacionamento.`, destino: 'carteira' });
  } else if (semContato.length > 0) {
    insights.push({ severidade: 'atencao', titulo: `${semContato.length} clientes sem contato há mais de ${DIAS_SEM_CONTATO} dias`, detalhe: 'Nenhum acima de R$ 1 mi, mas vale retomar o relacionamento.', destino: 'carteira' });
  }
  const menor = [...resumo.penetracao_por_produto].sort((a, b) => a.penetracao - b.penetracao)[0];
  if (menor && ativos.length > 0) {
    insights.push({ severidade: 'info', titulo: `${menor.nome} é o produto menos contratado`, detalhe: `Penetração de ${Math.round(menor.penetracao * 100)}% (${menor.clientes} de ${ativos.length} clientes): maior espaço de venda cruzada.`, destino: 'carteira' });
  }
  const recente = serie_mensal.slice(-3).reduce((a, m) => a + m.interacoes, 0);
  const anterior = serie_mensal.slice(-6, -3).reduce((a, m) => a + m.interacoes, 0);
  if (anterior > 0 && recente > anterior) {
    insights.push({ severidade: 'positivo', titulo: 'Relacionamento em alta', detalhe: `${recente} interações nos últimos 3 meses contra ${anterior} nos 3 anteriores (+${Math.round((recente / anterior - 1) * 100)}%).` });
  }
  const ordem: Record<Severidade, number> = { critico: 0, atencao: 1, info: 2, positivo: 3 };
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
    insights,
  };
}
