// src/components/dashboard/QuizPerformanceChart.tsx
'use client';

import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format } from 'date-fns';
import { Trophy, Target, TrendingUp } from 'lucide-react';

interface QuizPerformanceChartProps {
  attempts: any[];
}

export function QuizPerformanceChart({ attempts }: QuizPerformanceChartProps) {
  const { chartData, averageScore, totalQuizzes } = useMemo(() => {
    if (attempts.length === 0) return { chartData: [], averageScore: 0, totalQuizzes: 0 };

    const data = attempts.map((attempt) => ({
      name: format(new Date(attempt.created_at), 'MMM d'),
      Score: attempt.total > 0 ? Math.round((attempt.score / attempt.total) * 100) : 0,
      title: attempt.quiz?.title || 'Untitled Quiz',
    })).reverse();

    const avg = data.reduce((acc, curr) => acc + curr.Score, 0) / data.length;

    return { chartData: data, averageScore: Math.round(avg), totalQuizzes: attempts.length };
  }, [attempts]);

  if (attempts.length === 0) {
    return (
      <Card className="h-[350px] flex flex-col justify-center items-center text-center p-6 border-dashed">
        <div className="bg-muted rounded-full p-4 mb-4">
          <TrendingUp className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="font-serif font-semibold text-xl">No Data Yet</h3>
        <p className="text-muted-foreground mt-2 max-w-xs mx-auto">
          Complete your first quiz to see your performance analytics here.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="bg-background p-2 rounded-xl shadow-sm">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Avg. Score</p>
              <p className="text-2xl font-serif font-bold text-primary">{averageScore}%</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-secondary/5 border-secondary/10">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="bg-background p-2 rounded-xl shadow-sm">
              <Trophy className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Total Quizzes</p>
              <p className="text-2xl font-serif font-bold text-secondary">{totalQuizzes}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Chart */}
      <Card className="h-[350px]">
        <CardContent className="h-full pt-6">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" strokeOpacity={0.4} />
              <XAxis 
                dataKey="name" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
                tick={{ fill: 'var(--muted-foreground)' }}
                dy={10}
              />
              <YAxis
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
                tick={{ fill: 'var(--muted-foreground)' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--card)', 
                  borderColor: 'var(--border)', 
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' 
                }}
                itemStyle={{ color: 'var(--primary)', fontWeight: 'bold' }}
              />
              <Area
                type="monotone"
                dataKey="Score"
                stroke="var(--primary)"
                fillOpacity={1}
                fill="url(#colorScore)"
                strokeWidth={3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}