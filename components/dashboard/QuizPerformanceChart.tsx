// src/components/dashboard/QuizPerformanceChart.tsx
'use client';

import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { TrendingUp, Award } from 'lucide-react';

interface QuizPerformanceChartProps {
  attempts: any[];
}

export function QuizPerformanceChart({ attempts }: QuizPerformanceChartProps) {
  const { chartData, averageScore } = useMemo(() => {
    if (attempts.length === 0) return { chartData: [], averageScore: 0 };

    const data = attempts.map((attempt) => ({
      name: format(new Date(attempt.created_at), 'MMM d'),
      score: attempt.total > 0 ? Math.round((attempt.score / attempt.total) * 100) : 0,
      title: attempt.quiz?.title || 'Untitled Quiz',
    })).reverse();

    const avg = data.reduce((acc, curr) => acc + curr.score, 0) / data.length;
    return { chartData: data, averageScore: Math.round(avg) };
  }, [attempts]);

  if (attempts.length === 0) {
    return (
      <Card className="h-[300px] flex flex-col justify-center items-center text-center p-6 border-dashed bg-muted/20">
        <TrendingUp className="w-10 h-10 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground text-sm font-medium">Complete a quiz to see analytics</p>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
            <div>
                <p className="text-sm text-muted-foreground font-medium">Average Mastery</p>
                <div className="flex items-baseline gap-2">
                    <h3 className="text-3xl font-serif font-bold text-foreground">{averageScore}%</h3>
                    {averageScore > 80 && <span className="text-xs font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">Great!</span>}
                </div>
            </div>
            <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                <Award className="w-5 h-5 text-primary" />
            </div>
        </div>

        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="name" 
                fontSize={11} 
                tickLine={false} 
                axisLine={false} 
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                dy={10}
              />
              <YAxis hide domain={[0, 100]} />
              <Tooltip 
                cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border bg-popover p-2 shadow-md">
                        <p className="text-[10px] text-muted-foreground mb-1">{payload[0].payload.name}</p>
                        <p className="text-sm font-bold text-popover-foreground">{payload[0].value}%</p>
                        <p className="text-xs text-primary truncate max-w-[150px]">{payload[0].payload.title}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#colorScore)"
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}