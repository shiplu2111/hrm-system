// Lightweight SVG chart components — no external dependencies

export function LineChart({ data, height = 200, color = '#2563eb' }: { data: { label: string; value: number }[]; height?: number; color?: string }) {
  const w = 600;
  const h = height;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  const max = Math.max(...data.map((d) => d.value)) * 1.1;
  const min = 0;
  const range = max - min || 1;
  const step = chartW / (data.length - 1);

  const points = data.map((d, i) => ({
    x: padding.left + i * step,
    y: padding.top + chartH - ((d.value - min) / range) * chartH,
    label: d.label,
    value: d.value,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <line
          key={t}
          x1={padding.left}
          y1={padding.top + chartH * t}
          x2={padding.left + chartW}
          y2={padding.top + chartH * t}
          stroke="currentColor"
          strokeWidth="1"
          className="text-slate-200 dark:text-slate-700"
        />
      ))}
      {/* Area */}
      <path d={areaPath} fill="url(#lineGrad)" />
      {/* Line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.5" fill="rgb(var(--bg-surface))" stroke={color} strokeWidth="2" />
        </g>
      ))}
      {/* X labels */}
      {points.map((p, i) => (
        <text
          key={i}
          x={p.x}
          y={h - 8}
          textAnchor="middle"
          className="fill-slate-400 text-[10px]"
          fontSize="10"
        >
          {p.label}
        </text>
      ))}
    </svg>
  );
}

export function BarChart({ data, height = 200, color = '#2563eb' }: { data: { label: string; value: number }[]; height?: number; color?: string }) {
  const w = 600;
  const h = height;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  const max = Math.max(...data.map((d) => d.value)) * 1.1;
  const barW = (chartW / data.length) * 0.6;
  const gap = (chartW / data.length) * 0.4;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.9" />
          <stop offset="100%" stopColor={color} stopOpacity="0.5" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <line
          key={t}
          x1={padding.left}
          y1={padding.top + chartH * t}
          x2={padding.left + chartW}
          y2={padding.top + chartH * t}
          stroke="currentColor"
          strokeWidth="1"
          className="text-slate-200 dark:text-slate-700"
        />
      ))}
      {data.map((d, i) => {
        const barH = (d.value / max) * chartH;
        const x = padding.left + i * (barW + gap) + gap / 2;
        const y = padding.top + chartH - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx="3" fill="url(#barGrad)" />
            <text x={x + barW / 2} y={h - 8} textAnchor="middle" className="fill-slate-400" fontSize="10">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function DonutChart({ data, size = 180 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = size / 2 - 10;
  const innerRadius = radius * 0.62;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {data.map((d, i) => {
        const fraction = d.value / total;
        const dash = fraction * circumference;
        const segment = (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={d.color}
            strokeWidth={radius - innerRadius}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            strokeLinecap="butt"
          />
        );
        offset += dash;
        return segment;
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" className="fill-slate-900 dark:fill-slate-50" fontSize="22" fontWeight="700">
        {total}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" className="fill-slate-400" fontSize="11">
        Total
      </text>
    </svg>
  );
}
