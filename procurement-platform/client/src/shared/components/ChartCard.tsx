/* Renders the shared Chart Card UI while keeping page-specific presentation near its workflow data. */
import { Card, CardContent } from '@mui/material';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { chartSeries } from '@/shared/data/fixtures';

type ChartCardProps = {
  title: string;
};

export function ChartCard({ title }: ChartCardProps) {
  return (
    <Card className="px-card">
      <CardContent>
        <h3>{title}</h3>
        <div className="px-chart">
          <ResponsiveContainer>
            <AreaChart data={chartSeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="bids" stroke="#008080" fill="rgba(0,128,128,0.18)" />
              <Area type="monotone" dataKey="awards" stroke="#1769b2" fill="rgba(23,105,178,0.12)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
