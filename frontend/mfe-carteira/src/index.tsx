import * as React from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { ArrowRightLeft, Check, Eye, Minus } from 'lucide-react';
import {
  Abas, AbasConteudo, AbasGatilho, AbasLista, Aviso, AreaTexto, Botao, Campo, CampoSelecao, Cartao, CartaoDescricao, CartaoTitulo, Dialogo, DialogoConteudo, EstadoErro, EstadoVazio,
  Esqueleto, Gaveta, GavetaConteudo, Rotulo, Selo, SemPermissao, TabelaDados, dataBR, dataHoraBR, inteiro, moeda, percentual,
} from '@carteira/ui';
import {
  ApiErro, useConsulta, type Api, type ClienteMascarado, type PropsMfe, type ResultadoLote, type SecaoCarteira, type SimulacaoRedistribuicao, type Visao360,
} from '@carteira/sdk';

/** MFE do domínio 03 — Carteira: lista por posição, visão 360°, transferência e redistribuição em bloco (J3). */
export default function Carteira({ api, sessao, versao, ehGerenteGeral, emitir, comando }: PropsMfe) {
  const dados = useConsulta(() => api.minhaCarteira(), [sessao.papel, sessao.dataSimulada, versao]);
  const [aba, setAba] = React.useState<string | null>(null);
  const [cliente, setCliente] = React.useState<string | null>(null);
  const [assistente, setAssistente] = React.useState<{ origem?: string } | null>(null);
  const ultimoComando = React.useRef(0);

  React.useEffect(() => {
    if (comando && comando.nonce !== ultimoComando.current && comando.tipo === 'abrir-redistribuicao') {
      ultimoComando.current = comando.nonce;
      setAssistente({ origem: comando.idPosicaoOrigem });
    }
  }, [comando]);

  const secoes = dados.dados?.secoes ?? [];
  const chave = (s: SecaoCarteira): string => `${s.tipo}:${s.posicao.id_posicao}`;
  const ativa = secoes.find((s) => chave(s) === aba) ?? secoes[0];

  if (dados.carregando && !dados.dados) return <div aria-busy="true" className="flex flex-col gap-4"><Esqueleto className="h-10 w-64" /><Esqueleto className="h-96" /></div>;
  if (dados.erro) return dados.erro instanceof ApiErro && dados.erro.status === 403 ? <SemPermissao /> : <EstadoErro mensagem={dados.erro.message} aoTentar={dados.recarregar} />;
  if (secoes.length === 0) return <EstadoVazio titulo="Nenhuma carteira visível">Este papel não é titular de posição nem tem delegação vigente nesta data. Troque o papel ou a data no topo.</EstadoVazio>;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display-lg text-foreground">Carteira</h1>
          <p className="mt-1 text-body-md text-secondary-foreground">{ehGerenteGeral ? 'Todas as carteiras da agência, uma por posição.' : 'Sua carteira e as coberturas temporárias vigentes.'}</p>
        </div>
        {ehGerenteGeral ? <Botao onClick={() => setAssistente({})}><ArrowRightLeft aria-hidden className="size-4" /> Redistribuir clientes</Botao> : null}
      </header>

      <Abas value={chave(ativa!)} onValueChange={setAba}>
        <AbasLista aria-label="Carteiras" className="overflow-x-auto">
          {secoes.map((s) => (
            <AbasGatilho key={chave(s)} value={chave(s)}>
              {s.tipo === 'Delegada' ? 'Carteira Delegada' : ehGerenteGeral ? s.posicao.nome_posicao : 'Minha Carteira'}
              {s.tipo === 'Delegada' ? <Selo variante="tag">Cobertura temporária</Selo> : null}
            </AbasGatilho>
          ))}
        </AbasLista>
        {secoes.map((s) => (
          <AbasConteudo key={chave(s)} value={chave(s)} className="mt-6">
            <SecaoLista secao={s} aoAbrir={setCliente} />
          </AbasConteudo>
        ))}
      </Abas>

      <Gaveta open={cliente !== null} onOpenChange={(a) => { if (!a) setCliente(null); }}>
        {cliente ? (
          <GavetaConteudo titulo="Visão 360° do cliente" descricao={cliente} className="max-w-none w-[min(98vw,84rem)]">
            <Visao360Painel api={api} idCliente={cliente} sessao={sessao} versao={versao} ehGerenteGeral={ehGerenteGeral} aoMudar={() => emitir({ tipo: 'dados-alterados', origem: 'carteira' })} />
          </GavetaConteudo>
        ) : null}
      </Gaveta>

      {assistente ? (
        <Gaveta open onOpenChange={(a) => { if (!a) setAssistente(null); }}>
          <GavetaConteudo className="max-w-3xl" titulo="Redistribuir clientes" descricao="Simule primeiro; só depois confirme. Cada movimentação fica registrada em auditoria.">
            <AssistenteRedistribuicao api={api} origemInicial={assistente.origem} aoConcluir={() => emitir({ tipo: 'dados-alterados', origem: 'carteira' })} />
          </GavetaConteudo>
        </Gaveta>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Lista de clientes de uma seção */
function SecaoLista({ secao, aoAbrir }: { secao: SecaoCarteira; aoAbrir: (id: string) => void }) {
  const [segmento, setSegmento] = React.useState('todos');
  const [status, setStatus] = React.useState('todos');
  const filtrados = secao.clientes.filter((c) => (segmento === 'todos' || c.segmento_cliente === segmento) && (status === 'todos' || c.status === status));
  const p = secao.posicao;

  const colunas: ColumnDef<ClienteMascarado, any>[] = [
    { accessorKey: 'id_cliente', header: 'Código', meta: { rotulo: 'Código' } },
    { id: 'nome', header: 'Cliente', accessorFn: (c) => c.nome_razao_social, cell: ({ row }) => (<div><p className="text-body-md text-foreground">{row.original.nome_razao_social}</p><p className="tnum text-caption text-muted-foreground">{row.original.cpf_cnpj_mascarado}</p></div>), meta: { rotulo: 'Cliente' } },
    { accessorKey: 'segmento_cliente', header: 'Segmento', cell: ({ getValue }) => <Selo variante="neutro">{getValue<string>()}</Selo>, meta: { rotulo: 'Segmento' } },
    { accessorKey: 'status', header: 'Status', meta: { rotulo: 'Status' } },
    { accessorKey: 'volume_aum', header: 'AUM', cell: ({ getValue }) => moeda(getValue<number>()), meta: { numerica: true, rotulo: 'AUM' } },
    { accessorKey: 'score_risco', header: 'Score de risco', cell: ({ getValue }) => inteiro(getValue<number>()), meta: { numerica: true, rotulo: 'Score de risco' } },
    { accessorKey: 'data_carteirizacao', header: 'Na carteira desde', cell: ({ getValue }) => dataBR(getValue<string>()), meta: { rotulo: 'Na carteira desde' } },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Cartao>
          <CartaoDescricao>Posição</CartaoDescricao>
          <p className="mt-1 text-heading-md text-foreground">{p.nome_posicao}</p>
          <p className="text-caption text-muted-foreground">Titular: {p.titular?.nome ?? 'vaga'}</p>
        </Cartao>
        <Cartao>
          <CartaoDescricao>Capacidade</CartaoDescricao>
          <p className="tnum mt-1 text-display-md text-foreground">{percentual(p.utilizacao)}</p>
          <p className="tnum text-caption text-muted-foreground">{inteiro(p.clientes_ativos)} de {inteiro(p.capacidade)} clientes ativos
            {p.desbalanceamento ? <> · <Selo variante={p.desbalanceamento === 'Acima' ? 'critico' : 'atencao'}>{p.desbalanceamento === 'Acima' ? 'Acima do limite' : 'Abaixo do mínimo'}</Selo></> : null}</p>
        </Cartao>
        <Cartao>
          <CartaoDescricao>Acesso</CartaoDescricao>
          <p className="mt-1 text-heading-md text-foreground">{p.modo === 'Escrita' ? 'Leitura e escrita' : 'Somente leitura'}</p>
          {secao.cobertura ? <p className="tnum text-caption text-muted-foreground">Cobertura ({secao.cobertura.escopo}) até {dataBR(secao.cobertura.data_fim)} · {secao.cobertura.situacao}</p> : <p className="text-caption text-muted-foreground">Titularidade da posição</p>}
        </Cartao>
      </div>
      {p.modo === 'Leitura' && secao.tipo === 'Propria' && !p.origens.some((o) => o.origem === 'GerenteGeral') ? (
        <Aviso variante="atencao" titulo="Posição em cobertura temporária">Enquanto a delegação estiver vigente, esta carteira fica em somente leitura para o titular ausente.</Aviso>
      ) : null}
      <TabelaDados
        colunas={colunas}
        dados={filtrados}
        rotulo={`Clientes de ${p.nome_posicao}`}
        aoClicarLinha={(c) => aoAbrir(c.id_cliente)}
        buscaPlaceholder="Buscar cliente…"
        filtros={(
          <>
            <CampoSelecao id={`seg-${p.id_posicao}`} rotulo="Segmento" className="w-44" valor={segmento} aoMudar={setSegmento} opcoes={[{ valor: 'todos', rotulo: 'Todos' }, ...['UHNW', 'Private', 'Alta Renda', 'Varejo'].map((s) => ({ valor: s, rotulo: s }))]} />
            <CampoSelecao id={`st-${p.id_posicao}`} rotulo="Status" className="w-44" valor={status} aoMudar={setStatus} opcoes={[{ valor: 'todos', rotulo: 'Todos' }, ...['Ativo', 'Em Prospecção', 'Inativo'].map((s) => ({ valor: s, rotulo: s }))]} />
          </>
        )}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ Visão 360° */
function Visao360Painel({ api, idCliente, sessao, versao, ehGerenteGeral, aoMudar }: { api: Api; idCliente: string; sessao: PropsMfe['sessao']; versao: number; ehGerenteGeral: boolean; aoMudar: () => void }) {
  const v = useConsulta(() => api.visao360(idCliente), [idCliente, sessao.papel, sessao.dataSimulada, versao]);
  const [documento, setDocumento] = React.useState<string | null>(null);
  const [erroDoc, setErroDoc] = React.useState<string | null>(null);
  const [transferindo, setTransferindo] = React.useState(false);

  if (v.carregando) return <div aria-busy="true" className="flex flex-col gap-3"><Esqueleto className="h-24" /><Esqueleto className="h-40" /></div>;
  if (v.erro) return v.erro instanceof ApiErro && v.erro.status === 403 ? <SemPermissao>Você não tem titularidade nem delegação vigente sobre este cliente.</SemPermissao> : <EstadoErro mensagem={v.erro.message} aoTentar={v.recarregar} />;
  const d = v.dados as Visao360;
  const c = d.cliente;
  const escrita = d.decisao.modo === 'Escrita' || ehGerenteGeral;

  async function revelar() {
    setErroDoc(null);
    try { setDocumento((await api.revelarDocumento(idCliente)).cpf_cnpj); } catch (e) { setErroDoc(e instanceof Error ? e.message : 'Falha ao revelar.'); }
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Cabeçalho em largura total: identificação + indicadores em blocos que se redistribuem conforme a largura */}
      <Cartao>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-heading-lg text-foreground">{c.nome_razao_social}</p>
            <p className="tnum mt-1 text-body-tabular text-secondary-foreground">{documento ?? c.cpf_cnpj_mascarado}</p>
          </div>
          <div className="flex flex-wrap gap-2"><Selo variante="tag">{c.segmento_cliente}</Selo><Selo variante="neutro">{c.status}</Selo></div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {documento ? <p className="text-caption text-secondary-foreground">Documento revelado — esta ação foi registrada em auditoria.</p> : (
            <Botao variante="secundario" tamanho="sm" onClick={() => void revelar()}><Eye aria-hidden className="size-4" /> Revelar documento</Botao>
          )}
        </div>
        {erroDoc ? <Aviso variante="critico" className="mt-3">{erroDoc}</Aviso> : null}
        <dl className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-4">
          {[['AUM', moeda(c.volume_aum)], ['Renda / faturamento', moeda(c.faixa_renda_faturamento)], ['Score de risco', `${inteiro(c.score_risco)} / 1.000`], ['Posição atual', d.posicao_atual.nome_posicao], ['Na carteira desde', dataBR(c.data_carteirizacao)]].map(([k, val]) => (
            <div key={k} className="rounded-md bg-secondary px-4 py-3">
              <dt className="text-caption text-secondary-foreground">{k}</dt>
              <dd className="tnum mt-1 text-body-md text-foreground">{val}</dd>
            </div>
          ))}
        </dl>
      </Cartao>

      {/* Três blocos de mesma altura (items-stretch): nunca sobra "buraco" abaixo de uma coluna mais curta */}
      <div className="grid flex-1 grid-cols-1 items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Cartao className="flex flex-col" aria-labelledby="t360-prod">
          <h2 id="t360-prod" className="text-heading-md text-foreground">Penetração de produtos</h2>
          <ul className="mt-3 flex flex-1 flex-col gap-2">
            {d.produtos.map((p) => (
              <li key={p.codigo} className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-body-md">
                {p.contratado ? <Check aria-hidden className="size-4 shrink-0 text-foreground" /> : <Minus aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
                <span className={p.contratado ? 'text-foreground' : 'text-muted-foreground'}>{p.nome}</span>
                <span className="ml-auto text-caption text-muted-foreground">{p.contratado ? `desde ${dataBR(p.data_contratacao)}` : 'não contratado'}</span>
              </li>
            ))}
          </ul>
        </Cartao>

        <Cartao className="flex flex-col" aria-labelledby="t360-hist">
          <h2 id="t360-hist" className="text-heading-md text-foreground">Histórico de posições</h2>
          <ol className="mt-3 flex flex-1 flex-col gap-4 border-l border-border pl-4">
            {[...d.linha_do_tempo].reverse().map((t) => (
              <li key={t.inicio_em} className="relative">
                <span aria-hidden className="absolute -left-[21px] top-1.5 size-2.5 rounded-pill bg-primary" />
                <p className="text-body-md text-foreground">{t.nome_posicao}</p>
                <p className="tnum text-caption text-muted-foreground">{dataHoraBR(t.inicio_em)} → {t.fim_em ? dataHoraBR(t.fim_em) : 'atual'}</p>
              </li>
            ))}
          </ol>
        </Cartao>

        <Cartao className="flex flex-col md:col-span-2 xl:col-span-1" aria-labelledby="t360-crm">
          <h2 id="t360-crm" className="text-heading-md text-foreground">Histórico de CRM</h2>
          {d.interacoes.length === 0 ? <p className="mt-3 text-body-md text-muted-foreground">Nenhuma interação registrada.</p> : (
            <ul className="mt-3 flex max-h-96 flex-1 flex-col gap-3 overflow-y-auto pr-1">
              {d.interacoes.map((i) => (
                <li key={i.id_interacao} className="rounded-md border border-border p-3">
                  <p className="text-caption text-muted-foreground">{dataBR(i.data)} · {i.canal}</p>
                  {/* Texto de terceiros: renderizado como texto (nunca HTML) — FR-API-007. */}
                  <p className="mt-1 text-body-md text-foreground">{i.nota}</p>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>

      <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-wrap items-center justify-end gap-3 border-t border-border bg-card px-6 py-4">
        {escrita ? <Botao onClick={() => setTransferindo(true)}><ArrowRightLeft aria-hidden className="size-4" /> Transferir de posição</Botao> : <Aviso variante="informativo" className="w-full">Seu acesso a este cliente é somente leitura.</Aviso>}
      </div>
      {transferindo ? <Transferir api={api} cliente={c} aoFechar={() => setTransferindo(false)} aoConcluir={() => { setTransferindo(false); aoMudar(); }} /> : null}
    </div>
  );
}

function Transferir({ api, cliente, aoFechar, aoConcluir }: { api: Api; cliente: ClienteMascarado; aoFechar: () => void; aoConcluir: () => void }) {
  const atores = useConsulta(() => api.atores(), []);
  const [destino, setDestino] = React.useState('');
  const [motivo, setMotivo] = React.useState('');
  const [justificativa, setJustificativa] = React.useState('');
  const [precisaJustificar, setPrecisaJustificar] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [enviando, setEnviando] = React.useState(false);
  const destinos = (atores.dados?.atores ?? []).filter((a) => a.papel !== 'GG' && a.papel !== cliente.id_posicao);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await api.transferir(cliente.id_cliente, { id_posicao_destino: destino, motivo, justificativa: justificativa || undefined });
      aoConcluir();
    } catch (x) {
      if (x instanceof ApiErro && x.codigo === 'JUSTIFICATIVA_OBRIGATORIA') setPrecisaJustificar(true);
      setErro(x instanceof Error ? x.message : 'Falha na transferência.');
    } finally { setEnviando(false); }
  }

  return (
    <Dialogo open onOpenChange={(a) => { if (!a) aoFechar(); }}>
      <DialogoConteudo titulo="Transferir de posição" descricao={`${cliente.nome_razao_social} deixa a posição atual; o histórico é preservado.`}>
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <CampoSelecao id="transf-destino" rotulo="Posição de destino" valor={destino} aoMudar={setDestino} opcoes={destinos.map((a) => ({ valor: a.papel, rotulo: a.rotulo }))} />
          <div><Rotulo htmlFor="transf-motivo">Motivo</Rotulo><AreaTexto id="transf-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} required /></div>
          {precisaJustificar ? <div><Rotulo htmlFor="transf-just">Justificativa (capacidade excedida)</Rotulo><AreaTexto id="transf-just" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} required /></div> : null}
          {erro ? <Aviso variante={precisaJustificar ? 'atencao' : 'critico'}>{erro}</Aviso> : null}
          <div className="flex justify-end gap-3"><Botao type="button" variante="secundario" onClick={aoFechar}>Cancelar</Botao><Botao type="submit" disabled={!destino || !motivo || enviando}>{enviando ? 'Transferindo…' : 'Confirmar transferência'}</Botao></div>
        </form>
      </DialogoConteudo>
    </Dialogo>
  );
}

/* ------------------------------------------------------------------ Assistente de redistribuição: simular → confirmar → resultado/desfazer */
function AssistenteRedistribuicao({ api, origemInicial, aoConcluir }: { api: Api; origemInicial?: string; aoConcluir: () => void }) {
  const atores = useConsulta(() => api.atores(), []);
  const posicoes = (atores.dados?.atores ?? []).filter((a) => a.papel !== 'GG');
  const [origem, setOrigem] = React.useState(origemInicial ?? '');
  const [destino, setDestino] = React.useState('');
  const [quantidade, setQuantidade] = React.useState(20);
  const [ids, setIds] = React.useState<string[]>([]);
  const [simulacao, setSimulacao] = React.useState<SimulacaoRedistribuicao | null>(null);
  const [motivo, setMotivo] = React.useState('');
  const [justificativa, setJustificativa] = React.useState('');
  const [lote, setLote] = React.useState<ResultadoLote | null>(null);
  const [desfeito, setDesfeito] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [ocupado, setOcupado] = React.useState(false);
  const chave = React.useRef(`LOTE-UI-${Date.now()}`);

  const excedida = simulacao?.avisos.some((a) => a.codigo === 'CAPACIDADE_EXCEDIDA') ?? false;
  const nome = (id: string): string => posicoes.find((p) => p.papel === id)?.rotulo.split('—')[0]?.trim() ?? id;

  async function simular(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    try {
      const pagina = await api.clientes({ posicao: origem, status: 'Ativo', limit: quantidade });
      const escolhidos = pagina.itens.map((c) => c.id_cliente);
      if (escolhidos.length === 0) throw new Error('A posição de origem não tem clientes ativos visíveis.');
      setIds(escolhidos);
      setSimulacao(await api.simularRedistribuicao({ ids_clientes: escolhidos, id_posicao_destino: destino }));
    } catch (x) { setErro(x instanceof Error ? x.message : 'Falha na simulação.'); } finally { setOcupado(false); }
  }

  async function confirmar() {
    setErro(null);
    setOcupado(true);
    try {
      setLote(await api.redistribuir({ ids_clientes: ids, id_posicao_destino: destino, motivo, justificativa: justificativa || undefined }, chave.current));
      aoConcluir();
    } catch (x) { setErro(x instanceof Error ? x.message : 'Falha ao executar.'); } finally { setOcupado(false); }
  }

  async function desfazer() {
    if (!lote) return;
    setOcupado(true);
    try { await api.desfazerLote(lote.id_lote); setDesfeito(true); aoConcluir(); } catch (x) { setErro(x instanceof Error ? x.message : 'Falha ao desfazer.'); } finally { setOcupado(false); }
  }

  if (lote) {
    return (
      <div className="flex flex-col gap-4">
        <Aviso titulo={desfeito ? 'Lote desfeito' : 'Redistribuição concluída'}>
          {desfeito ? `As movimentações do lote ${lote.id_lote} foram compensadas; o histórico foi preservado.` : `${inteiro(lote.movimentacoes.length)} clientes movidos para ${nome(destino)} no lote ${lote.id_lote}. Auditoria registrada.`}
        </Aviso>
        {!desfeito ? <Botao variante="secundario" onClick={() => void desfazer()} disabled={ocupado}>Desfazer lote</Botao> : null}
        {erro ? <Aviso variante="critico">{erro}</Aviso> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={simular} className="flex flex-col gap-4">
        <CampoSelecao id="red-origem" rotulo="Posição de origem" valor={origem} aoMudar={(v) => { setOrigem(v); setSimulacao(null); }} opcoes={posicoes.map((a) => ({ valor: a.papel, rotulo: a.rotulo }))} />
        <CampoSelecao id="red-destino" rotulo="Posição de destino" valor={destino} aoMudar={(v) => { setDestino(v); setSimulacao(null); }} opcoes={posicoes.filter((a) => a.papel !== origem).map((a) => ({ valor: a.papel, rotulo: a.rotulo }))} />
        <div><Rotulo htmlFor="red-qtd">Quantidade de clientes ativos a mover</Rotulo><Campo id="red-qtd" type="number" min={1} max={200} value={quantidade} onChange={(e) => { setQuantidade(Number(e.target.value)); setSimulacao(null); }} className="tnum" /></div>
        <Botao type="submit" variante={simulacao ? 'secundario' : 'primario'} disabled={!origem || !destino || ocupado}>{ocupado && !simulacao ? 'Simulando…' : 'Simular'}</Botao>
      </form>

      {simulacao ? (
        <section aria-label="Resultado da simulação" className="flex flex-col gap-4">
          <h2 className="text-heading-md text-foreground">Antes e depois</h2>
          <table className="w-full text-body-md">
            <thead><tr className="text-caption text-muted-foreground"><th className="py-2 text-left font-normal">Posição</th><th className="py-2 text-right font-normal">Antes</th><th className="py-2 text-right font-normal">Depois</th></tr></thead>
            <tbody>
              {simulacao.depois.map((u) => {
                const a = simulacao.antes.find((x) => x.id_posicao === u.id_posicao)!;
                return (
                  <tr key={u.id_posicao} className="border-t border-border">
                    <td className="py-2">{nome(u.id_posicao)}</td>
                    <td className="tnum py-2 text-right text-body-tabular">{inteiro(a.clientes_ativos)} · {percentual(a.utilizacao)}</td>
                    <td className="tnum py-2 text-right text-body-tabular">{inteiro(u.clientes_ativos)} · {percentual(u.utilizacao)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {simulacao.avisos.map((a, i) => <Aviso key={i} variante={a.codigo === 'CAPACIDADE_EXCEDIDA' ? 'atencao' : 'informativo'}>{a.mensagem}</Aviso>)}
          <div><Rotulo htmlFor="red-motivo">Motivo</Rotulo><AreaTexto id="red-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} required /></div>
          {excedida ? <div><Rotulo htmlFor="red-just">Justificativa (capacidade excedida)</Rotulo><AreaTexto id="red-just" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} required /></div> : null}
          <Botao onClick={() => void confirmar()} disabled={!motivo.trim() || (excedida && !justificativa.trim()) || ocupado}>{ocupado ? 'Executando…' : `Confirmar redistribuição de ${inteiro(simulacao.clientes_a_mover.length)} clientes`}</Botao>
        </section>
      ) : null}
      {erro ? <Aviso variante="critico">{erro}</Aviso> : null}
    </div>
  );
}
