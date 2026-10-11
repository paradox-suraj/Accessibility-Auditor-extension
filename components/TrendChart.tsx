import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export type TrendDataPoint = {
  date: string;
  score: number;
};

export function TrendChart({ data }: { data: TrendDataPoint[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-500">
        No historical data available.
      </div>
    );
  }

  const chartData = data.length === 1 ? [data[0], data[0]] : data;

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 15, right: 15, left: -15, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#6B7280" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "#6B7280" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "6px",
              border: "1px solid #E5E7EB",
              boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
              fontSize: "12px",
            }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#2563EB"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#2563EB", strokeWidth: 1.5, stroke: "#fff" }}
            activeDot={{ r: 5, fill: "#2563EB", stroke: "#fff", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
