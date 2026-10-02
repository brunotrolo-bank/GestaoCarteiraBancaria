import * as React from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { CalendarClock } from 'lucide-react';
import {
  Aviso, AreaTexto, Botao, Campo, CampoSelecao, EstadoErro, Esqueleto, Gaveta, GavetaConteudo, Rotulo, Selo, TabelaDados, dataBR,
} from '@carteira/ui';
import { useConsulta, type Delegacao, type PropsMfe, type Situacao } from '@carteira/sdk';
import { CalendarioDelegacoes, VARIANTE, aVencer } from './calendario';

/** MFE do domínio 02 — Delegação temporária (J2: cobertura de férias). A situação vem derivada do servidor. */

export default function DelegacaoMfe({ api, sessao, versao, ehGerenteGeral, emitir }: PropsMfe) {
  const lista = useConsulta(() => api.delegacoes(), [sessao.papel, sessao.dataSimulada, versao]);
  const atores = useConsulta(() => api.atores(), [sessao.dataSimulada, versao]);
  const [nova, setNova] = React.useState(false);
  const [erroAcao, setErroAcao] = React.useState<string | null>(null);
  const [visao, setVisao] = React.useState<'tabela' | 'calendario'>('tabela');
  const referencia = sessao.dataSimulada ?? diaCorrente();

  const nomes = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const a of atores.dados?.atores ?? []) if (a.id_gerente) m.set(a.id_gerente, a.rotulo.split('—')[1]?.trim() ?? a.id_gerente);
    return m;
  }, [atores.dados]);

  async function agir(fn: () => Promise<unknown>) {
    setErroAcao(null);
    try {
      await fn();
      emitir({ tipo: 'dados-alterados', origem: 'delegacao' });
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Falha na operação.');
    }
  }

  if (lista.carregando && !lista.dados) return <div aria-busy="true"><Esqueleto className="h-80" /></div>;
  if (lista.erro) return <EstadoErro mensagem={lista.erro.message} aoTentar={lista.recarregar} />;

  const itens = lista.dados?.itens ?? [];
  const vencendo = aVencer(itens, referencia);

  const colunas: ColumnDef<Delegacao, any>[] = [
    { accessorKey: 'id_delegacao', header: 'Código', meta: { rotulo: 'Código' } },
    { accessorKey: 'id_posicao_origem', header: 'Posição coberta', meta: { rotulo: 'Posição coberta' } },
    { id: 'delegado', header: 'Delegado', accessorFn: (d) => nomes.get(d.id_gerente_delegado) ?? d.id_gerente_delegado, meta: { rotulo: 'Delegado' } },
    { id: 'periodo', header: 'Período', accessorFn: (d) => d.data_inicio, cell: ({ row }) => <span className="tnum">{dataBR(row.original.data_inicio)} a {dataBR(row.original.data_fim)}</span>, meta: { rotulo: 'Período' } },
    { accessorKey: 'escopo', header: 'Escopo', meta: { rotulo: 'Escopo' } },
    { accessorKey: 'motivo', header: 'Motivo', meta: { rotulo: 'Motivo' } },
    { accessorKey: 'situacao', header: 'Situação', cell: ({ getValue }) => <Selo variante={VARIANTE[getValue<Situacao>()]}>{getValue<string>()}</Selo>, meta: { rotulo: 'Situação' } },
    {
      id: 'acoes', header: 'Ações', enableSorting: false,
      cell: ({ row }) => {
        const d = row.original;
        const ativa = d.status_aprovacao === 'Submetida' || d.status_aprovacao === 'Aprovada';
        return (
          <span className="flex flex-wrap gap-2">
            {ehGerenteGeral && d.status_aprovacao === 'Submetida' ? (
              <>
                <Botao tamanho="sm" variante="secundario" onClick={(e) => { e.stopPropagation(); void agir(() => api.aprovarDelegacao(d.id_delegacao)); }}>Aprovar</Botao>
                <Botao tamanho="sm" variante="fantasma" onClick={(e) => { e.stopPropagation(); void agir(() => api.rejeitarDelegacao(d.id_delegacao)); }}>Rejeitar</Botao>
              </>
            ) : null}
            {ativa ? <Botao tamanho="sm" variante="fantasma" onClick={(e) => { e.stopPropagation(); void agir(() => api.revogarDelegacao(d.id_delegacao)); }}>Revogar</Botao> : null}
          </span>
        );
      },
      meta: { rotulo: 'Ações' },
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display-lg text-foreground">Delegações</h1>
          <p className="mt-1 text-body-md text-secondary-foreground">Cobertura temporária de uma posição por outro gerente. Expira sozinha no dia seguinte ao fim; o titular ausente fica em somente leitura.</p>
        </div>
        <Botao onClick={() => setNova(true)}><CalendarClock aria-hidden className="size-4" /> Nova delegação</Botao>
      </header>
      {erroAcao ? <Aviso variante="critico" titulo="Operação não concluída">{erroAcao}</Aviso> : null}
      {vencendo.length > 0 ? (
        <Aviso variante="atencao" titulo={`${vencendo.length} ${vencendo.length === 1 ? 'cobertura vence' : 'coberturas vencem'} em até 7 dias`}>
          {vencendo.map((d) => `${d.id_posicao_origem} (até ${dataBR(d.data_fim)})`).join(' · ')} — renove ou planeje a devolução.
        </Aviso>
      ) : null}
      <div className="flex gap-2" role="group" aria-label="Modo de visualização">
        <Botao tamanho="sm" variante={visao === 'tabela' ? 'secundario' : 'fantasma'} onClick={() => setVisao('tabela')}>Tabela</Botao>
        <Botao tamanho="sm" variante={visao === 'calendario' ? 'secundario' : 'fantasma'} onClick={() => setVisao('calendario')}>Calendário</Botao>
      </div>
      {visao === 'tabela' ? (
        <TabelaDados colunas={colunas} dados={itens} rotulo="Delegações" tamanhoPagina={10} buscaPlaceholder="Buscar delegação…" />
      ) : (
        <CalendarioDelegacoes itens={itens} nomes={nomes} referencia={referencia} />
      )}
      <Gaveta open={nova} onOpenChange={setNova}>
        {nova ? (
          <GavetaConteudo titulo="Nova delegação" descricao="Fica Submetida até a aprovação do Gerente Geral; só então concede acesso.">
            <FormularioDelegacao api={api} ehGerenteGeral={ehGerenteGeral} dataPadrao={sessao.dataSimulada} aoConcluir={() => { setNova(false); emitir({ tipo: 'dados-alterados', origem: 'delegacao' }); }} />
          </GavetaConteudo>
        ) : null}
      </Gaveta>
    </div>
  );
}

/** Dia corrente (AAAA-MM-DD) no fuso de São Paulo — referência do calendário quando não há data simulada. */
function diaCorrente(): string {
  try { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); } catch { return new Date().toISOString().slice(0, 10); }
}

function FormularioDelegacao({ api, ehGerenteGeral, dataPadrao, aoConcluir }: { api: PropsMfe['api']; ehGerenteGeral: boolean; dataPadrao: string | null; aoConcluir: () => void }) {
  const posicoes = useConsulta(() => api.posicoes(), []);
  const atores = useConsulta(() => api.atores(), []);
  const [origem, setOrigem] = React.useState('');
  const [delegado, setDelegado] = React.useState('');
  const base = dataPadrao ?? new Date().toISOString().slice(0, 10);
  const [inicio, setInicio] = React.useState(base);
  const [fim, setFim] = React.useState(base);
  const [escopo, setEscopo] = React.useState('Total');
  const [motivo, setMotivo] = React.useState('');
  const [erro, setErro] = React.useState<string | null>(null);
  const [enviando, setEnviando] = React.useState(false);

  const origens = (posicoes.dados?.itens ?? []).filter((p) => ehGerenteGeral || p.origens.some((o) => o.origem === 'Titular'));
  const delegados = (atores.dados?.atores ?? []).filter((a) => a.id_gerente);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await api.submeterDelegacao({ id_posicao_origem: origem, id_gerente_delegado: delegado, data_inicio: inicio, data_fim: fim, motivo, escopo });
      aoConcluir();
    } catch (x) {
      setErro(x instanceof Error ? x.message : 'Falha ao submeter.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <CampoSelecao id="deleg-origem" rotulo="Posição a ser coberta" valor={origem} aoMudar={setOrigem} opcoes={origens.map((p) => ({ valor: p.id_posicao, rotulo: `${p.nome_posicao} (${p.id_posicao})` }))} />
      <CampoSelecao id="deleg-delegado" rotulo="Gerente delegado" valor={delegado} aoMudar={setDelegado} opcoes={delegados.map((a) => ({ valor: a.id_gerente!, rotulo: a.rotulo }))} />
      <div className="grid grid-cols-2 gap-3">
        <div><Rotulo htmlFor="deleg-inicio">Início (inclusive)</Rotulo><Campo id="deleg-inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} required /></div>
        <div><Rotulo htmlFor="deleg-fim">Fim (inclusive)</Rotulo><Campo id="deleg-fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} required /></div>
      </div>
      <CampoSelecao id="deleg-escopo" rotulo="Escopo" valor={escopo} aoMudar={setEscopo} opcoes={['Total', 'Apenas Consulta', 'Apenas Emergencial'].map((t) => ({ valor: t, rotulo: t }))} />
      <div><Rotulo htmlFor="deleg-motivo">Motivo</Rotulo><AreaTexto id="deleg-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} required /></div>
      {erro ? <Aviso variante="critico">{erro}</Aviso> : null}
      <div className="flex justify-end"><Botao type="submit" disabled={!origem || !delegado || !motivo || enviando}>{enviando ? 'Enviando…' : 'Submeter delegação'}</Botao></div>
    </form>
  );
}
