import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type Series = {
  /** Key into each data row. */
  key: string;
  /** Legend/tooltip label. Defaults to `key`. */
  label?: string;
  /** Overrides the themed palette colour. */
  color?: string;
  stack?: boolean;
};

export type ChartProps = {
  type?: 'line' | 'bar' | 'area';
  data: Array<Record<string, string | number>>;
  xKey: string;
  series: Series[];
  xLabel?: string;
  yLabel?: string;
  height?: number;
  /** Hide the legend when a single series makes it redundant. */
  legend?: boolean;
};

const PALETTE = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5'];

/** Resolve CSS custom properties so the chart follows the light/dark theme. */
function useThemeColors() {
  const [colors, setColors] = useState({
    series: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a855f7'],
    grid: '#e2e8f0',
    axis: '#64748b',
  });

  useEffect(() => {
    const read = () => {
      const style = getComputedStyle(document.documentElement);
      const value = (name: string, fallback: string) =>
        style.getPropertyValue(name).trim() || fallback;
      setColors({
        series: PALETTE.map((name, i) => value(name, ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a855f7'][i]!)),
        grid: value('--chart-grid', '#e2e8f0'),
        axis: value('--chart-axis', '#64748b'),
      });
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return colors;
}

export default function Chart({
  type = 'line',
  data,
  xKey,
  series,
  xLabel,
  yLabel,
  height = 320,
  legend = true,
}: ChartProps) {
  const colors = useThemeColors();
  const color = (s: Series, i: number) => s.color ?? colors.series[i % colors.series.length]!;

  const axisProps = {
    stroke: colors.axis,
    tick: { fill: colors.axis, fontSize: 12 },
  };

  const shared = (
    <>
      <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
      <XAxis
        dataKey={xKey}
        {...axisProps}
        label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -4, fill: colors.axis } : undefined}
      />
      <YAxis
        {...axisProps}
        label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', fill: colors.axis } : undefined}
      />
      <Tooltip
        contentStyle={{
          background: 'var(--color-bg-elevated, white)',
          border: `1px solid ${colors.grid}`,
          borderRadius: '0.5rem',
          color: 'inherit',
        }}
        wrapperClassName="!text-slate-900 dark:!text-slate-900 text-sm"
      />
      {legend && series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: colors.axis }} />}
    </>
  );

  const margin = { top: 8, right: 12, bottom: xLabel ? 20 : 4, left: yLabel ? 12 : 0 };

  return (
    <div className="not-prose my-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <ResponsiveContainer width="100%" height={height}>
        {type === 'bar' ? (
          <BarChart data={data} margin={margin}>
            {shared}
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label ?? s.key}
                fill={color(s, i)}
                stackId={s.stack ? 'stack' : undefined}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        ) : type === 'area' ? (
          <AreaChart data={data} margin={margin}>
            {shared}
            {series.map((s, i) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label ?? s.key}
                stroke={color(s, i)}
                fill={color(s, i)}
                fillOpacity={0.25}
                stackId={s.stack ? 'stack' : undefined}
              />
            ))}
          </AreaChart>
        ) : (
          <LineChart data={data} margin={margin}>
            {shared}
            {series.map((s, i) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label ?? s.key}
                stroke={color(s, i)}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
