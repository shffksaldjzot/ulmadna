'use client';

import dynamic from 'next/dynamic';
import type { ProcessResult } from '@/types/calculator';
import { formatWonExact } from '@/lib/format';

const PieChart = dynamic(() => import('recharts').then(m => m.PieChart), { ssr: false });
const Pie = dynamic(() => import('recharts').then(m => m.Pie), { ssr: false });
const Cell = dynamic(() => import('recharts').then(m => m.Cell), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });

const COLORS = ['#5C3A21', '#C9A96E', '#8B6914', '#A0522D', '#D2B48C', '#BC8F8F', '#CD853F', '#DEB887', '#F4A460', '#D2691E'];

interface CostChartProps {
  processes: ProcessResult[];
}

export default function CostChart({ processes }: CostChartProps) {
  // 상위 7개 + 나머지를 "기타"로 묶기
  const top = processes.slice(0, 7);
  const rest = processes.slice(7);
  const restTotal = rest.reduce((sum, p) => sum + p.amount, 0);

  const chartData = [
    ...top.map(p => ({ name: p.name, value: p.amount })),
    ...(restTotal > 0 ? [{ name: '기타', value: restTotal }] : []),
  ];

  return (
    <div>
      <h3 className="text-sm font-semibold text-brown mb-3">비용 비중을 한눈에</h3>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={90}
              dataKey="value"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              label={(props: any) => `${props.name ?? ''} ${((props.percent ?? 0) * 100).toFixed(0)}%`}
              labelLine={false}
              fontSize={11}
            >
              {chartData.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => formatWonExact(Number(value))}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
