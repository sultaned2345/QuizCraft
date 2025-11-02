// src/components/dashboard/QuizPerformanceChart.tsx
'use client';

import { QuizAttempt } from '@/types/database';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format } from 'date-fns';

interface QuizPerformanceChartProps {
  attempts: QuizAttempt[];
}

export function QuizPerformanceChart({ attempts }: QuizPerformanceChartProps) {
  if (attempts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Performance</CardTitle>
          <CardDescription>No recent quiz attempts found.</CardDescription>
        </CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center text-muted-foreground">
          <p>Take a quiz to see your progress!</p>
        </CardContent>
      </Card>
    );
  }

  // Format data for the chart
  const chartData = attempts
    .map((attempt) => ({
      name: format(new Date(attempt.created_at), 'MMM d'),
      // Calculate percentage, ensuring no division by zero
      Score: attempt.total > 0 ? (attempt.score / attempt.total) * 100 : 0,
    }))
    .reverse(); // Show oldest to newest

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Performance</CardTitle>
        <CardDescription>Your scores on recent quiz attempts.</CardDescription>
      </CardHeader>
      <CardContent className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 20, left: -20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
            <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis
              fontSize={12}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                borderColor: 'hsl(var(--border))',
                borderRadius: 'var(--radius)',
              }}
              formatter={(value: number) => [`${value.toFixed(0)}%`, 'Score']}
            />
            <Line
              type="monotone"
              dataKey="Score"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{
                fill: 'hsl(var(--primary))',
                r: 4,
              }}
              activeDot={{
                r: 6,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}