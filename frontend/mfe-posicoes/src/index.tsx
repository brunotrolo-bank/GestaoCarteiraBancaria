import * as React from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { UserRoundCog } from 'lucide-react';
import {
  Aviso, Botao, Campo, CampoSelecao, Cartao, CartaoDescricao, CartaoTitulo, Dialogo, DialogoConteudo, EstadoErro, Esqueleto, Gaveta, GavetaConteudo, Rotulo, Selo, SemPermissao,
  TabelaDados, AreaTexto, dataBR, inteiro, percentual,
} from '@carteira/ui';
import { ApiErro, useConsulta, type PropsMfe, type ResumoPosicao } from '@carteira/sdk';
import { CartaoMetas, ConfigurarMetas } from './metas';

/** MFE do domínio 01 — Posições, titularidade e troca de titular (J1: turnover sem atrito). */
export default function Posicoes({ api, sessao, versao, ehGerenteGeral, emitir }: PropsMfe) {
  const lista = useConsulta(() => api.posicoes(), [sessao.papel, sessao.dataSimulada, versao]);
  const [selecionada, setSelecionada] = React.useState<string | null>(null);

  if (lista.carregando && !lista.dados) return <div aria-busy="true"><Esqueleto className="h-96" /></div>;
  if (lista.erro) return lista.erro instanceof ApiErro && lista.erro.status === 403 ? <SemPermissao /> : <EstadoErro mensagem={lista.erro.message} aoTentar={lista.recarregar} />;
  const itens = lista.dados?.itens ?? [];

  const colunas: ColumnDef<ResumoPosicao, any>[] = [
    { id: 'posicao', header: 'Posição', accessorFn: (p) => p.nome_posicao, cell: ({ row }) => (<div><p className="text-body-md text-foreground">{row.original.nome_posicao}</p><p className="text-caption text-muted-foreground">{row.original.id_posicao}</p></div>), meta: { rotulo: 'Posição' } },
    { id: 'titular', header: 'Titular atual', accessorFn: (p) => p.titular?.nome ?? 'Vaga', cell: ({ row }) => row.original.titular?.nome ?? <Selo variante="atencao">Vaga</Selo>, meta: { rotulo: 'Titular atual' } },
    { accessorKey: 'segmento_especialidade', header: 'Especialidade', meta: { rotulo: 'Especialidade' } },
    { accessorKey: 'clientes_ativos', header: 'Clientes ativos', cell: ({ getValue }) => inteiro(getValue<number>()), meta: { numerica: true, rotulo: 'Clientes ativos' } },
    { accessorKey: 'utilizacao', header: 'Capacidade', cell: ({ row }) => `${percentual(row.original.utilizacao)} de ${inteiro(row.original.capacidade)}`, meta: { numerica: true, rotulo: 'Capacidade' } },
    { id: 'alerta', header: 'Alerta', accessorFn: (p) => p.desbalanceamento ?? '', cell: ({ row }) => row.original.desbalanceamento === 'Acima' ? <Selo variante="critico">Acima de {percentual(row.original.metas.utilizacao_maxima, 0)}</Selo> : row.original.desbalanceamento === 'Abaixo' ? <Selo variante="atencao">Abaixo de {percentual(row.original.metas.utilizacao_minima, 0)}</Selo> : <span className="text-secondary-foreground">Dentro dos limites</span>, meta: { rotulo: 'Alerta' } },
    { id: 'meta_aum', header: 'Meta de AUM', accessorFn: (p) => (p.metas.meta_aum > 0 ? p.aum_total / p.metas.meta_aum : -1), cell: ({ row }) => (row.original.metas.meta_aum > 0 ? `${Math.round((row.original.aum_total / row.original.metas.meta_aum) * 100)}%` : '—'), meta: { numerica: true, rotulo: 'Meta de AUM' } },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Selo variante="neutro">{getValue<string>()}</Selo>, meta: { rotulo: 'Status' } },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-display-lg text-foreground">Posições</h1>
        <p className="mt-1 text-body-md text-secondary-foreground">A carteira pertence à posição (a cadeira), nunca à pessoa. Trocar o titular não altera nenhum cliente.</p>
      </header>
      <TabelaDados colunas={colunas} dados={itens} rotulo="Posições" tamanhoPagina={10} aoClicarLinha={(p) => setSelecionada(p.id_posicao)} buscaPlaceholder="Buscar posição ou titular…" />
      <Gaveta open={selecionada !== null} onOpenChange={(a) => { if (!a) setSelecionada(null); }}>
        {selecionada ? (
          <GavetaConteudo titulo={itens.find((p) => p.id_posicao === selecionada)?.nome_posicao ?? selecionada} descricao={selecionada}>
            <DetalhePosicao api={api} posicao={itens.find((p) => p.id_posicao === selecionada)!} sessao={sessao} versao={versao} ehGerenteGeral={ehGerenteGeral} aoTrocar={() => emitir({ tipo: 'dados-alterados', origem: 'posicoes' })} />
          </GavetaConteudo>
        ) : null}
      </Gaveta>
    </div>
  );
}

function DetalhePosicao({ api, posicao, sessao, versao, ehGerenteGeral, aoTrocar }: { api: PropsMfe['api']; posicao: ResumoPosicao; sessao: PropsMfe['sessao']; versao: number; ehGerenteGeral: boolean; aoTrocar: () => void }) {
  const hist = useConsulta(() => api.historico(posicao.id_posicao), [posicao.id_posicao, sessao.papel, versao]);
  const [trocando, setTrocando] = React.useState(false);
  const [resultado, setResultado] = React.useState<string | null>(null);
  const [configurando, setConfigurando] = React.useState(false);
  return (
    <div className="flex flex-col gap-6">
      <Cartao>
        <CartaoTitulo>Titular vigente</CartaoTitulo>
        <p className="mt-2 text-display-md text-foreground">{posicao.titular?.nome ?? 'Posição vaga'}</p>
        <CartaoDescricao>A carteira com {inteiro(posicao.clientes_ativos)} clientes ativos permanece com a posição em qualquer troca ou vacância.</CartaoDescricao>
        {ehGerenteGeral ? <Botao className="mt-4" onClick={() => setTrocando(true)}><UserRoundCog aria-hidden className="size-4" /> Trocar titular</Botao> : null}
      </Cartao>
      {resultado ? <Aviso titulo="Atualizado">{resultado}</Aviso> : null}
      <CartaoMetas posicao={posicao} ehGerenteGeral={ehGerenteGeral} aoConfigurar={() => setConfigurando(true)} />
      {configurando ? <ConfigurarMetas api={api} posicao={posicao} aoFechar={() => setConfigurando(false)} aoConcluir={(msg) => { setConfigurando(false); setResultado(msg); aoTrocar(); }} /> : null}
      <section aria-label="Histórico de titularidade">
        <h2 className="text-heading-md text-foreground">Histórico de titularidade</h2>
        {hist.carregando ? <Esqueleto className="mt-3 h-24" /> : hist.erro ? <EstadoErro mensagem={hist.erro.message} aoTentar={hist.recarregar} /> : (
          <ol className="mt-3 flex flex-col gap-4 border-l border-border pl-4">
            {[...(hist.dados?.itens ?? [])].reverse().map((o) => (
              <li key={o.id_ocupacao} className="relative">
                <span aria-hidden className="absolute -left-[21px] top-1.5 size-2.5 rounded-pill bg-primary" />
                <p className="text-body-md text-foreground">{o.nome_gerente}</p>
                <p className="tnum text-caption text-muted-foreground">{dataBR(o.data_inicio)} → {o.data_fim ? dataBR(o.data_fim) : 'atual'} · {o.tipo_vinculo}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
      {trocando ? (
        <TrocarTitular api={api} posicao={posicao} dataPadrao={sessao.dataSimulada} aoFechar={() => setTrocando(false)} aoConcluir={(msg) => { setTrocando(false); setResultado(msg); aoTrocar(); }} />
      ) : null}
    </div>
  );
}

function TrocarTitular({ api, posicao, dataPadrao, aoFechar, aoConcluir }: { api: PropsMfe['api']; posicao: ResumoPosicao; dataPadrao: string | null; aoFechar: () => void; aoConcluir: (mensagem: string) => void }) {
  const gerentes = useConsulta(() => api.gerentes(), []);
  const [gerente, setGerente] = React.useState('');
  const [inicio, setInicio] = React.useState(dataPadrao ?? new Date().toISOString().slice(0, 10));
  const [tipo, setTipo] = React.useState('Titular Efetivo');
  const [motivo, setMotivo] = React.useState('');
  const [erro, setErro] = React.useState<string | null>(null);
  const [enviando, setEnviando] = React.useState(false);
  const disponiveis = (gerentes.dados?.itens ?? []).filter((g) => g.status === 'Ativo' && g.perfil !== 'Gerente Geral' && g.posicao === null);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await api.trocarTitular(posicao.id_posicao, { id_gerente: gerente, data_inicio: inicio, tipo_vinculo: tipo, motivo: motivo || undefined });
      const nome = disponiveis.find((g) => g.id_gerente === gerente)?.nome_completo ?? gerente;
      aoConcluir(`${nome} assume a posição em ${dataBR(inicio)}. Os ${inteiro(posicao.clientes_ativos)} clientes ativos continuam intactos na posição.`);
    } catch (x) {
      setErro(x instanceof Error ? x.message : 'Falha ao trocar o titular.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialogo open onOpenChange={(a) => { if (!a) aoFechar(); }}>
      <DialogoConteudo titulo="Trocar titular" descricao={`${posicao.nome_posicao}. Nenhum cliente será alterado.`}>
        <form onSubmit={confirmar} className="flex flex-col gap-4">
          {gerentes.carregando ? <Esqueleto className="h-10" /> : disponiveis.length === 0 ? (
            <Aviso variante="atencao">Não há gerente ativo disponível (sem posição). Cadastre ou desligue o titular de outra posição antes.</Aviso>
          ) : (
            <CampoSelecao id="novo-titular" rotulo="Novo titular (gerente sem posição)" valor={gerente} aoMudar={setGerente} opcoes={disponiveis.map((g) => ({ valor: g.id_gerente, rotulo: g.nome_completo }))} />
          )}
          <div>
            <Rotulo htmlFor="inicio-titular">Início da titularidade</Rotulo>
            <Campo id="inicio-titular" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} required />
          </div>
          <CampoSelecao id="tipo-vinculo" rotulo="Tipo de vínculo" valor={tipo} aoMudar={setTipo} opcoes={['Titular Efetivo', 'Trainee', 'Interino'].map((t) => ({ valor: t, rotulo: t }))} />
          <div>
            <Rotulo htmlFor="motivo-titular">Motivo (obrigatório em troca retroativa)</Rotulo>
            <AreaTexto id="motivo-titular" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          {erro ? <Aviso variante="critico">{erro}</Aviso> : null}
          <div className="flex justify-end gap-3">
            <Botao type="button" variante="secundario" onClick={aoFechar}>Cancelar</Botao>
            <Botao type="submit" disabled={!gerente || enviando}>{enviando ? 'Trocando…' : 'Confirmar troca'}</Botao>
          </div>
        </form>
      </DialogoConteudo>
    </Dialogo>
  );
}
