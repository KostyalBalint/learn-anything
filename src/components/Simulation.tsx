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
