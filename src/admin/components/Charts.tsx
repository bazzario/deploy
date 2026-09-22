/**
 * Minimal, dependency-free SVG chart primitives.
 *
 * Bazaario doesn't have a charting library installed, and pulling one in
 * just for a UI-preview dashboard would add an unnecessary dependency. These
 * three components (line, bar, donut) cover everything the admin analytics
 * page needs and can be swapped for a real charting lib later without
 * touching the pages that use them.
 */

interface LineChartProps {
  labels: string[];
  series: { name: string; data: number[]; color: string }[];
  height?: number;
}

export function LineChart({ labels, series, height = 220 }: LineChartProps) {
  const width = 600;
  const padding = 28;
  const max = Math.max(1, ...series.flatMap((s) => s.data));
  const stepX = (width - padding * 2) / (labels.length - 1 || 1);

  const toPoints = (data: number[]) =>
    data
      .map((v, i) => {
        const x = padding + i * stepX;
        const y = height - padding - (v / max) * (height - padding * 2);
        return `${x},${y}`;
      })
      .join(" ");

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[420px]" style={{ height }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={padding}
            x2={width - padding}
            y1={padding + f * (height - padding * 2)}
            y2={padding + f * (height - padding * 2)}
            stroke="#E7EAEE"
            strokeWidth={1}
          />
        ))}
        {series.map((s) => (
          <polyline key={s.name} points={toPoints(s.data)} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {series.map((s) =>
          s.data.map((v, i) => {
            const x = padding + i * stepX;
            const y = height - padding - (v / max) * (height - padding * 2);
            return <circle key={`${s.name}-${i}`} cx={x} cy={y} r={3} fill={s.color} />;
          }),
        )}
        {labels.map((label, i) => (
          <text key={label} x={padding + i * stepX} y={height - 6} fontSize={10} fill="#334155" textAnchor="middle">
            {label}
          </text>
        ))}
      </svg>
      <div className="flex flex-wrap gap-4 mt-2 px-1">
        {series.map((s) => (
          <div key={s.name} className="flex items-center gap-1.5 text-xs text-ink-soft">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}
          </div>
        ))}
      </div>
    </div>
  );
}

interface BarChartProps {
  labels: string[];
  data: number[];
  color?: string;
  height?: number;
}

export function BarChart({ labels, data, color = "#E8590C", height = 220 }: BarChartProps) {
  const width = 600;
  const padding = 28;
  const max = Math.max(1, ...data);
  const barWidth = (width - padding * 2) / data.length - 14;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[420px]" style={{ height }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={padding}
            x2={width - padding}
            y1={padding + f * (height - padding * 2)}
            y2={padding + f * (height - padding * 2)}
            stroke="#E7EAEE"
            strokeWidth={1}
          />
        ))}
        {data.map((v, i) => {
          const barHeight = (v / max) * (height - padding * 2);
          const x = padding + i * ((width - padding * 2) / data.length) + 7;
          const y = height - padding - barHeight;
          return <rect key={i} x={x} y={y} width={Math.max(barWidth, 6)} height={barHeight} rx={4} fill={color} />;
        })}
        {labels.map((label, i) => {
          const x = padding + i * ((width - padding * 2) / data.length) + (width - padding * 2) / data.length / 2;
          return (
            <text key={label} x={x} y={height - 6} fontSize={10} fill="#334155" textAnchor="middle">
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

interface DonutChartProps {
  segments: { label: string; value: number; color: string }[];
  size?: number;
}

export function DonutChart({ segments, size = 180 }: DonutChartProps) {
  const sum = segments.reduce((acc, s) => acc + s.value, 0);
  const total = sum || 1; // avoid dividing by zero; the label below shows the real sum
  const radius = size / 2 - 14;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E7EAEE" strokeWidth={18} />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {segments.map((s) => {
            const fraction = s.value / total;
            const dash = fraction * circumference;
            const circle = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth={18}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return circle;
          })}
        </g>
        <text x={size / 2} y={size / 2 - 4} textAnchor="middle" fontSize={20} fontWeight={700} fill="#0F1720">
          {sum.toLocaleString()}
        </text>
        <text x={size / 2} y={size / 2 + 14} textAnchor="middle" fontSize={10} fill="#334155">
          total
        </text>
      </svg>
      <ul className="space-y-1.5 text-xs">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-ink-soft">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-ink font-medium">{s.label}</span>
            <span>{s.value.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
