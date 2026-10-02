import * as React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Aviso, Botao, Campo, Cartao, CartaoDescricao, CartaoTitulo, Dialogo, DialogoConteudo, Rotulo, inteiro, moeda, percentual } from '@carteira/ui';
import { type PropsMfe, type ResumoPosicao } from '@carteira/sdk';

const pct = (atual: number, meta: number): number => (meta > 0 ? Math.round((atual / meta) * 100) : 0);

/** Atingimento das metas e limites de alerta da posição; o Gerente Geral pode reconfigurá-los. */
export function CartaoMetas({ posicao, ehGerenteGeral, aoConfigurar }: { posicao: ResumoPosicao; ehGerenteGeral: boolean; aoConfigurar: () => void }) {
  const m = posicao.metas;
  return (
    <Cartao>
      <CartaoTitulo>Metas e alertas</CartaoTitulo>
      <CartaoDescricao>O alerta de capacidade dispara abaixo de {percentual(m.utilizacao_minima, 0)} ou acima de {percentual(m.utilizacao_maxima, 0)} de utilização.</CartaoDescricao>
      <div className="mt-4 flex flex-col gap-4">
        <Progresso rotulo="AUM" texto={m.meta_aum > 0 ? `${moeda(posicao.aum_total)} de ${moeda(m.meta_aum)}` : 'Sem meta de AUM definida'} valor={m.meta_aum > 0 ? pct(posicao.aum_total, m.meta_aum) : null} />
        <Progresso rotulo="Clientes ativos" texto={m.meta_clientes > 0 ? `${inteiro(posicao.clientes_ativos)} de ${inteiro(m.meta_clientes)}` : 'Sem meta de clientes definida'} valor={m.meta_clientes > 0 ? pct(posicao.clientes_ativos, m.meta_clientes) : null} />
      </div>
      {ehGerenteGeral ? <Botao variante="secundario" className="mt-4" onClick={aoConfigurar}><SlidersHorizontal aria-hidden className="size-4" /> Configurar metas e alertas</Botao> : null}
    </Cartao>
  );
}

function Progresso({ rotulo, texto, valor }: { rotulo: string; texto: string; valor: number | null }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-body-md">
        <span className="text-foreground">{rotulo}</span>
        <span className="tnum text-body-tabular text-secondary-foreground">{valor === null ? '—' : `${valor}% da meta`}</span>
      </div>
      <div className="mt-1 h-2 rounded-pill bg-secondary" role="progressbar" aria-label={`Atingimento da meta de ${rotulo}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(valor ?? 0, 100)} aria-valuetext={valor === null ? 'sem meta' : `${valor}%`}>
        <div className={valor !== null && valor >= 100 ? 'h-2 rounded-pill bg-chart-3' : 'h-2 rounded-pill bg-chart-1'} style={{ width: `${Math.min(valor ?? 0, 100)}%` }} />
      </div>
      <p className="mt-1 text-caption text-secondary-foreground">{texto}</p>
    </div>
  );
}

/** Formulário de metas e limites (valores em % na tela; a API recebe razões). */
export function ConfigurarMetas({ api, posicao, aoFechar, aoConcluir }: { api: PropsMfe['api']; posicao: ResumoPosicao; aoFechar: () => void; aoConcluir: (mensagem: string) => void }) {
  const m = posicao.metas;
  const [aum, setAum] = React.useState(String(m.meta_aum));
  const [clientes, setClientes] = React.useState(String(m.meta_clientes));
  const [minima, setMinima] = React.useState(String(Math.round(m.utilizacao_minima * 100)));
  const [maxima, setMaxima] = React.useState(String(Math.round(m.utilizacao_maxima * 100)));
  const [erro, setErro] = React.useState<string | null>(null);
  const [enviando, setEnviando] = React.useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await api.definirMetas(posicao.id_posicao, { meta_aum: Number(aum), meta_clientes: Number(clientes), utilizacao_minima: Number(minima) / 100, utilizacao_maxima: Number(maxima) / 100 });
      aoConcluir(`Metas e alertas de ${posicao.nome_posicao} atualizados.`);
    } catch (x) {
      setErro(x instanceof Error ? x.message : 'Falha ao salvar as metas.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialogo open onOpenChange={(a) => { if (!a) aoFechar(); }}>
      <DialogoConteudo titulo="Metas e alertas" descricao={`${posicao.nome_posicao}. Use 0 para ficar sem meta. A alteração fica registrada em auditoria.`}>
        <form onSubmit={salvar} className="flex flex-col gap-4">
          <div>
            <Rotulo htmlFor="meta-aum">Meta de AUM (R$)</Rotulo>
            <Campo id="meta-aum" type="number" min={0} step="any" inputMode="decimal" className="tnum" value={aum} onChange={(e) => setAum(e.target.value)} required />
          </div>
          <div>
            <Rotulo htmlFor="meta-clientes">Meta de clientes ativos</Rotulo>
            <Campo id="meta-clientes" type="number" min={0} step={1} className="tnum" value={clientes} onChange={(e) => setClientes(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Rotulo htmlFor="util-minima">Alerta abaixo de (% da capacidade)</Rotulo>
              <Campo id="util-minima" type="number" min={0} max={99} step={1} className="tnum" value={minima} onChange={(e) => setMinima(e.target.value)} required />
            </div>
            <div>
              <Rotulo htmlFor="util-maxima">Alerta acima de (% da capacidade)</Rotulo>
              <Campo id="util-maxima" type="number" min={1} max={300} step={1} className="tnum" value={maxima} onChange={(e) => setMaxima(e.target.value)} required />
            </div>
          </div>
          {erro ? <Aviso variante="critico">{erro}</Aviso> : null}
          <div className="flex justify-end gap-3">
            <Botao type="button" variante="secundario" onClick={aoFechar}>Cancelar</Botao>
            <Botao type="submit" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar'}</Botao>
          </div>
        </form>
      </DialogoConteudo>
    </Dialogo>
  );
}
