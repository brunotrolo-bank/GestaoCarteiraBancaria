import { SlidersHorizontal } from 'lucide-react';
import { Botao, Cartao, CartaoDescricao, CartaoTitulo, Selo, inteiro, moedaCompacta, percentual } from '@carteira/ui';
import { type MetaPosicaoAtingimento } from '@carteira/sdk';

/** Atingimento das metas por posição (AUM e clientes) e os limites de alerta de cada uma. */
export function PainelMetas({ metas, aoConfigurar, ehGerenteGeral }: { metas: MetaPosicaoAtingimento[]; aoConfigurar: () => void; ehGerenteGeral: boolean }) {
  return (
    <section aria-label="Metas por posição">
      <Cartao>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CartaoTitulo>Metas por posição</CartaoTitulo>
            <CartaoDescricao>Atingimento de AUM e de clientes ativos, e o intervalo de utilização que dispara alerta em cada posição.</CartaoDescricao>
          </div>
          <Botao variante="secundario" tamanho="sm" onClick={aoConfigurar}><SlidersHorizontal aria-hidden className="size-4" /> {ehGerenteGeral ? 'Configurar metas e alertas' : 'Ver posições'}</Botao>
        </div>
        <ul className="mt-4 grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-2">
          {metas.map((m) => (
            <li key={m.id_posicao}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-body-md text-foreground">{m.nome_posicao}</span>
                <span className="text-caption text-secondary-foreground">
                  Alerta fora de {percentual(m.utilizacao_minima, 0)}–{percentual(m.utilizacao_maxima, 0)} · hoje {percentual(m.utilizacao, 0)}
                  {m.desbalanceamento ? <> <Selo variante={m.desbalanceamento === 'Acima' ? 'critico' : 'atencao'}>{m.desbalanceamento === 'Acima' ? 'Acima do limite' : 'Abaixo do mínimo'}</Selo></> : null}
                </span>
              </div>
              <Barra rotulo="AUM" pct={m.pct_meta_aum} detalhe={m.meta_aum > 0 ? `${moedaCompacta(m.aum)} de ${moedaCompacta(m.meta_aum)}` : 'sem meta'} />
              <Barra rotulo="Clientes" pct={m.pct_meta_clientes} detalhe={m.meta_clientes > 0 ? `${inteiro(m.clientes)} de ${inteiro(m.meta_clientes)}` : 'sem meta'} />
            </li>
          ))}
        </ul>
      </Cartao>
    </section>
  );
}

function Barra({ rotulo, pct, detalhe }: { rotulo: string; pct: number | null; detalhe: string }) {
  const v = pct ?? 0;
  return (
    <div className="mt-2 flex items-center gap-3">
      <span className="w-14 shrink-0 text-caption text-secondary-foreground">{rotulo}</span>
      <div className="h-2 flex-1 rounded-pill bg-secondary" role="progressbar" aria-label={`Meta de ${rotulo}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(v, 100)} aria-valuetext={pct === null ? 'sem meta' : `${pct}% da meta`}>
        <div className={v >= 100 ? 'h-2 rounded-pill bg-chart-3' : v < 70 && pct !== null ? 'h-2 rounded-pill bg-chart-4' : 'h-2 rounded-pill bg-chart-1'} style={{ width: `${Math.min(v, 100)}%` }} />
      </div>
      <span className="tnum w-44 shrink-0 text-right text-caption text-secondary-foreground"><span className="text-foreground">{pct === null ? '—' : `${pct}%`}</span> · {detalhe}</span>
    </div>
  );
}
