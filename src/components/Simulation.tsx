import { useState } from 'react';
import Chart, { type ChartProps } from './Chart';

export type Param = {
  name: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  default: number;
  unit?: string;
};

export type Readout = { label: string; value: string | number; hint?: string };

export type Model = {
  params: Param[];
  /** Pure function of the slider values. */
  run: (v: Record<string, number>) => {
    readouts: Readout[];
    chart?: Omit<ChartProps, 'height'>;
  };
};

/**
 * Models live here, not in MDX: props crossing the island boundary must be
 * serializable, so a page picks a model *by name*. To add one, add an entry
 * below and use `<Simulation model="your-key" client:visible />`.
 */
export const MODELS: Record<string, Model> = {
  /**
   * Kubernetes Horizontal Pod Autoscaler.
   * desired = ceil(current * currentMetric / targetMetric), clamped to [min,max],
   * and skipped entirely inside the 10% tolerance band.
   */
  hpa: {
    params: [
      { name: 'current', label: 'Current replicas', min: 1, max: 20, default: 4 },
      { name: 'cpu', label: 'Observed CPU per pod', min: 0, max: 200, default: 90, unit: '%' },
      { name: 'target', label: 'Target CPU per pod', min: 10, max: 150, default: 50, unit: '%' },
      { name: 'maxReplicas', label: 'maxReplicas', min: 1, max: 40, default: 20 },
    ],
    run: ({ current, cpu, target, maxReplicas }) => {
      const ratio = target === 0 ? 0 : cpu / target;
      const withinTolerance = Math.abs(ratio - 1) <= 0.1;
      const raw = Math.ceil(current * ratio);
      const desired = withinTolerance ? current : Math.min(Math.max(raw, 1), maxReplicas);

      // Total capacity is what the fleet can absorb at the target utilisation.
      const load = current * cpu;
      const data = Array.from({ length: maxReplicas }, (_, i) => {
        const replicas = i + 1;
        return {
          replicas,
          cpuPerPod: Math.round((load / replicas) * 10) / 10,
          target,
        };
      });

      return {
        readouts: [
          { label: 'Desired replicas', value: desired, hint: withinTolerance ? 'inside the 10% tolerance band — no scaling' : `ceil(${current} × ${cpu}/${target}) = ${raw}` },
          { label: 'Ratio', value: ratio.toFixed(2) },
          { label: 'CPU per pod after scaling', value: `${Math.round((load / desired) * 10) / 10}%` },
        ],
        chart: {
          type: 'line',
          data,
          xKey: 'replicas',
          xLabel: 'replicas',
          yLabel: 'CPU per pod (%)',
          series: [
            { key: 'cpuPerPod', label: 'CPU per pod' },
            { key: 'target', label: 'Target' },
          ],
        },
      };
    },
  },

  /**
   * Kubernetes scheduling as bin packing.
   * A node fits floor(allocatable / request) pods, and the remainder is stranded
   * — it counts as free CPU but can never hold another replica. Capacity is
   * therefore nodes * podsPerNode, not totalCpu / request.
   */
  scheduler: {
    params: [
      { name: 'nodes', label: 'Nodes', min: 1, max: 12, default: 4 },
      { name: 'allocatable', label: 'Allocatable CPU per node', min: 1000, max: 16000, step: 500, default: 4000, unit: 'm' },
      { name: 'request', label: 'CPU request per pod', min: 100, max: 4000, step: 100, default: 600, unit: 'm' },
      { name: 'replicas', label: 'Replicas wanted', min: 1, max: 60, default: 24 },
    ],
    run: ({ nodes, allocatable, request, replicas }) => {
      const perNode = Math.floor(allocatable / request);
      const fit = (n: number) => Math.min(replicas, n * perNode);

      const capacity = nodes * perNode;
      const scheduled = fit(nodes);
      const pending = replicas - scheduled;
      const strandedPerNode = allocatable - perNode * request;

      const data = Array.from({ length: 12 }, (_, i) => {
        const n = i + 1;
        return { nodes: n, running: fit(n), pending: replicas - fit(n) };
      });

      return {
        readouts: [
          {
            label: 'Pods per node',
            value: perNode,
            hint: `floor(${allocatable}m / ${request}m) — ${strandedPerNode}m stranded per node`,
          },
          {
            label: 'Pending',
            value: pending,
            hint: pending > 0 ? `capacity is ${capacity} pods` : 'every replica fits',
          },
          {
            label: 'Requested CPU',
            value: `${Math.round((scheduled * request) / (nodes * allocatable) * 100)}%`,
            hint: 'of allocatable — reserved, not necessarily used',
          },
        ],
        chart: {
          type: 'bar',
          data,
          xKey: 'nodes',
          xLabel: 'nodes',
          yLabel: 'pods',
          series: [
            { key: 'running', label: 'Running', stack: true },
            { key: 'pending', label: 'Pending', stack: true },
          ],
        },
      };
    },
  },

  /**
   * GitLab CI pipeline wall-clock time, stage-gated vs `needs:` (DAG), as a
   * function of how many jobs can run at once (runner concurrency).
   *
   * Stage-gated: each stage takes ceil(jobsPerStage / concurrency) * jobDuration,
   * and stages are serial — so extra concurrency beyond jobsPerStage buys nothing.
   * DAG: the pipeline is bounded by ceil(jobs / concurrency) * jobDuration, but
   * never faster than the dependency chain itself (stages * jobDuration).
   */
  'ci-throughput': {
    params: [
      { name: 'jobs', label: 'Jobs in the pipeline', min: 1, max: 48, default: 24 },
      { name: 'stages', label: 'Stages (dependency depth)', min: 1, max: 8, default: 4 },
      { name: 'jobDuration', label: 'Duration per job', min: 1, max: 15, default: 3, unit: ' min' },
      { name: 'concurrency', label: 'Concurrent runner slots', min: 1, max: 24, default: 4 },
    ],
    run: ({ jobs, stages, jobDuration, concurrency }) => {
      const staged = (c: number) =>
        stages * Math.ceil(jobs / stages / c) * jobDuration;
      // A DAG still cannot beat its own critical path: one job per stage, serial.
      const dag = (c: number) =>
        Math.max(Math.ceil(jobs / c) * jobDuration, stages * jobDuration);

      const stagedNow = staged(concurrency);
      const dagNow = dag(concurrency);
      const computeMinutes = jobs * jobDuration;

      const data = Array.from({ length: 24 }, (_, i) => {
        const c = i + 1;
        return { concurrency: c, staged: staged(c), dag: dag(c) };
      });

      return {
        readouts: [
          { label: 'Stage-gated', value: `${stagedNow} min`, hint: `${stages} serial stages` },
          {
            label: 'With needs:',
            value: `${dagNow} min`,
            hint: dagNow < stagedNow ? `${Math.round((1 - dagNow / stagedNow) * 100)}% faster` : 'no gain at this concurrency',
          },
          {
            label: 'Runner minutes billed',
            value: computeMinutes,
            hint: 'identical either way — concurrency buys latency, not compute',
          },
        ],
        chart: {
          type: 'line',
          data,
          xKey: 'concurrency',
          xLabel: 'concurrent runner slots',
          yLabel: 'pipeline wall clock (min)',
          series: [
            { key: 'staged', label: 'Stage-gated' },
            { key: 'dag', label: 'With needs:' },
          ],
        },
      };
    },
  },

  /**
   * Hungarian sole trader (egyéni vállalkozó) on átalányadózás, 2026 rules.
   *
   * jövedelem   = bevétel × (1 − költséghányad)
   * szja-alap   = jövedelem − 1 936 800 Ft (the tax-free half of the annual minimum wage)
   * járulékalap = szja-alap, but for a full-time trader at least 12 × the minimum
   *               wage (or the guaranteed minimum wage for skilled main activities).
   *
   * The minimum base is what makes the curve flat at the bottom: below roughly
   * 5.5M Ft of revenue the burden barely moves, because it is a floor, not a rate.
   */
  'ev-jarulek': {
    params: [
      { name: 'bevetel', label: 'Éves bevétel', min: 0, max: 38, step: 0.5, default: 12, unit: ' M Ft' },
      { name: 'koltseghanyad', label: 'Költséghányad', min: 45, max: 90, step: 5, default: 45, unit: '%' },
      { name: 'garantalt', label: 'Alap: 0 = minimálbér, 1 = gar. bérminimum', min: 0, max: 1, default: 0 },
      { name: 'mellekallas', label: '0 = főfoglalkozású, 1 = mellékállású', min: 0, max: 1, default: 0 },
    ],
    run: ({ bevetel, koltseghanyad, garantalt, mellekallas }) => {
      const MENTES = 1_936_800; // az éves minimálbér fele
      const minAlapEves = (garantalt ? 373_200 : 322_800) * 12;
      const ft = (n: number) => `${Math.round(n).toLocaleString('hu-HU')} Ft`;

      const terhek = (bevetelFt: number) => {
        const jovedelem = bevetelFt * (1 - koltseghanyad / 100);
        const szjaAlap = Math.max(0, jovedelem - MENTES);
        const jarulekAlap = mellekallas ? szjaAlap : Math.max(szjaAlap, minAlapEves);
        const szja = szjaAlap * 0.15;
        const tb = jarulekAlap * 0.185;
        const szocho = jarulekAlap * 0.13;
        return { jovedelem, szja, tb, szocho, osszes: szja + tb + szocho };
      };

      const be = bevetel * 1_000_000;
      const t = terhek(be);
      const netto = be - t.osszes;

      const data = Array.from({ length: 39 }, (_, i) => {
        const b = i * 1_000_000;
        const x = terhek(b);
        return {
          bevetel: i,
          kozteher: Math.round(x.osszes / 1000),
          netto: Math.round((b - x.osszes) / 1000),
        };
      });

      return {
        readouts: [
          {
            label: 'Átalányjövedelem',
            value: ft(t.jovedelem),
            hint: `${100 - koltseghanyad}% a bevételből, ebből ${ft(MENTES)} adómentes`,
          },
          {
            label: 'Éves közteher',
            value: ft(t.osszes),
            hint: `szja ${ft(t.szja)} · tb ${ft(t.tb)} · szocho ${ft(t.szocho)}`,
          },
          {
            label: 'Marad havonta',
            value: ft(netto / 12),
            hint: be > 0 ? `effektív teher: ${((t.osszes / be) * 100).toFixed(1)}%` : 'nincs bevétel',
          },
        ],
        chart: {
          type: 'line',
          data,
          xKey: 'bevetel',
          xLabel: 'éves bevétel (millió Ft)',
          yLabel: 'ezer Ft / év',
          series: [
            { key: 'netto', label: 'Nettó' },
            { key: 'kozteher', label: 'Közteher' },
          ],
        },
      };
    },
  },

  /**
   * The same sole trader under all three 2026 regimes, so the crossover is visible.
   *
   * Átalányadózás: 45% flat cost ratio, real costs irrelevant.
   * VSZJA: real costs deducted, kivét set to the minimum contribution base,
   *        then 9% on the profit and 15 + 13% on what is taken out as osztalék.
   * KATA:  600 000 Ft/year regardless of anything, + 40% above the 18M cap.
   *
   * KATA is only lawful for a full-time trader invoicing private individuals —
   * the model computes it anyway so the size of the gap is visible.
   */
  'ado-forma': {
    params: [
      { name: 'bevetel', label: 'Éves bevétel', min: 1, max: 38, step: 0.5, default: 15, unit: ' M Ft' },
      { name: 'koltseg', label: 'Valódi, számlázott költség', min: 0, max: 80, step: 5, default: 20, unit: '% a bevételből' },
      { name: 'garantalt', label: 'Alap: 0 = minimálbér, 1 = gar. bérminimum', min: 0, max: 1, default: 0 },
    ],
    run: ({ bevetel, koltseg, garantalt }) => {
      const MENTES = 1_936_800;
      const PLAFON = 7_747_200; // szocho adófizetési felső határ: 24 × minimálbér
      const minAlap = (garantalt ? 373_200 : 322_800) * 12;
      const ft = (n: number) => `${Math.round(n).toLocaleString('hu-HU')} Ft`;

      const atalany = (be: number) => {
        const jovedelem = be * 0.55;
        const szjaAlap = Math.max(0, jovedelem - MENTES);
        const jarulekAlap = Math.max(szjaAlap, minAlap);
        return szjaAlap * 0.15 + jarulekAlap * 0.315;
      };

      const vszja = (be: number) => {
        const koltsegFt = be * (koltseg / 100);
        // A kivét a saját munka díja — itt a minimum járulékalappal számolunk.
        const kivet = Math.min(minAlap, Math.max(0, be - koltsegFt));
        const jarulekAlap = Math.max(kivet, minAlap);
        const adoalap = Math.max(0, be - koltsegFt - kivet);
        const vallalkozoiSzja = adoalap * 0.09;
        const osztalek = adoalap - vallalkozoiSzja;
        const szochoKeret = Math.max(0, PLAFON - kivet);
        return (
          kivet * 0.15 +
          jarulekAlap * 0.315 +
          vallalkozoiSzja +
          osztalek * 0.15 +
          Math.min(osztalek, szochoKeret) * 0.13
        );
      };

      const kata = (be: number) => 600_000 + Math.max(0, be - 18_000_000) * 0.4;

      const be = bevetel * 1_000_000;
      const a = atalany(be);
      const v = vszja(be);
      const k = kata(be);
      const legjobb = Math.min(a, v, k);
      const nev = legjobb === k ? 'KATA' : legjobb === a ? 'Átalányadó' : 'VSZJA';

      const data = Array.from({ length: 39 }, (_, i) => {
        const b = i * 1_000_000;
        return {
          bevetel: i,
          atalany: Math.round(atalany(b) / 1000),
          vszja: Math.round(vszja(b) / 1000),
          kata: Math.round(kata(b) / 1000),
        };
      });

      return {
        readouts: [
          { label: 'Átalányadó (45%)', value: ft(a), hint: `effektív ${((a / be) * 100).toFixed(1)}%` },
          { label: 'VSZJA', value: ft(v), hint: `${koltseg}% valódi költséggel` },
          {
            label: 'KATA',
            value: ft(k),
            hint: bevetel > 18 ? '18 M Ft felett 40% különadóval' : `a legolcsóbb: ${nev}`,
          },
        ],
        chart: {
          type: 'line',
          data,
          xKey: 'bevetel',
          xLabel: 'éves bevétel (millió Ft)',
          yLabel: 'éves közteher (ezer Ft)',
          series: [
            { key: 'atalany', label: 'Átalányadó' },
            { key: 'vszja', label: 'VSZJA' },
            { key: 'kata', label: 'KATA' },
          ],
        },
      };
    },
  },
};

export type SimulationProps = {
  model: keyof typeof MODELS | string;
  title?: string;
  /** Override a model param's default, e.g. `{ current: 8 }`. */
  defaults?: Record<string, number>;
  chartHeight?: number;
};

export default function Simulation({ model, title, defaults, chartHeight = 260 }: SimulationProps) {
  const spec = MODELS[model];
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      (spec?.params ?? []).map((p) => [p.name, defaults?.[p.name] ?? p.default]),
    ),
  );

  if (!spec) {
    return (
      <p className="not-prose my-6 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">
        Unknown simulation model <code>{model}</code>. Add it to <code>MODELS</code> in
        <code> src/components/Simulation.tsx</code>.
      </p>
    );
  }

  const { readouts, chart } = spec.run(values);

  return (
    <section className="not-prose my-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      {title && (
        <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {spec.params.map((p) => (
          <label key={p.name} className="block">
            <span className="flex items-baseline justify-between text-sm text-slate-600 dark:text-slate-300">
              {p.label}
              <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {values[p.name]}
                {p.unit ?? ''}
              </span>
            </span>
            <input
              type="range"
              min={p.min}
              max={p.max}
              step={p.step ?? 1}
              value={values[p.name]}
              onChange={(e) =>
                setValues((v) => ({ ...v, [p.name]: Number(e.currentTarget.value) }))
              }
              className="mt-1 w-full accent-brand-600"
            />
          </label>
        ))}
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-3">
        {readouts.map((r) => (
          <div
            key={r.label}
            className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60"
          >
            <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {r.label}
            </dt>
            <dd className="text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {r.value}
            </dd>
            {r.hint && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{r.hint}</p>}
          </div>
        ))}
      </dl>

      {chart && (
        <div className="-mx-4 -mb-4">
          <Chart {...chart} height={chartHeight} />
        </div>
      )}
    </section>
  );
}
