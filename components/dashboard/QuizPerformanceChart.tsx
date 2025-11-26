// src/components/dashboard/QuizPerformanceChart.tsx
'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { QuizAttempt } from '@/types/database';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  TooltipProps,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format } from 'date-fns';
import { Trophy, Target, TrendingUp } from 'lucide-react';

// Extend the base type to include the joined Quiz Title
interface ExtendedQuizAttempt extends QuizAttempt {
  quiz?: {
    title: string;
  };
}

interface QuizPerformanceChartProps {
  attempts: ExtendedQuizAttempt[];
}

// Custom Tooltip Component for better UX
const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold mb-1">{label}</p>
        <p className="text-primary font-bold text-lg">{data.Score.toFixed(0)}%</p>
        <p className="text-muted-foreground text-xs mt-1 max-w-[200px] truncate">
          {data.quizTitle || 'Quiz'}
        </p>
      </div>
    );
  }
  return null;
};

export function QuizPerformanceChart({ attempts }: QuizPerformanceChartProps) {
  const router = useRouter();

  // 1. Memoize calculations to prevent re-renders
  const { chartData, averageScore, totalQuizzes } = useMemo(() => {
    if (attempts.length === 0) return { chartData: [], averageScore: 0, totalQuizzes: 0 };

    const data = attempts
      .map((attempt) => ({
        id: attempt.id,
        quizId: attempt.quiz_id,
        name: format(new Date(attempt.created_at || new Date()), 'MMM d'),
        fullDate: format(new Date(attempt.created_at || new Date()), 'PPP'),
        Score: attempt.total > 0 ? (attempt.score / attempt.total) * 100 : 0,
        quizTitle: attempt.quiz?.title || 'Unknown Quiz',
      }))
      .reverse();

    const totalScore = data.reduce((acc, curr) => acc + curr.Score, 0);
    const avg = totalScore / data.length;

    return {
      chartData: data,
      averageScore: Math.round(avg),
      totalQuizzes: attempts.length,
    };
  }, [attempts]);

  // Handle empty state
  if (attempts.length === 0) {
    return (
      <Card className="h-full flex flex-col justify-center items-center text-center p-6">
        <div className="bg-muted rounded-full p-3 mb-4">
          <TrendingUp className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-lg">No Data Yet</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-[200px]">
          Take your first quiz to unlock performance analytics.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="bg-primary/10 p-2 rounded-full">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Average Score</p>
              <p className="text-2xl font-bold">{averageScore}%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="bg-primary/10 p-2 rounded-full">
              <Trophy className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Quizzes Taken</p>
              <p className="text-2xl font-bold">{totalQuizzes}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Chart */}
      <Card className="h-[300px]"> {/* Increased height for better visibility */}
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Score History</CardTitle>
          <CardDescription>Your performance over the last {attempts.length} quizzes</CardDescription>
        </CardHeader>
        <CardContent className="h-[220px] w-full pl-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              onClick={(e) => {
                // Navigate to quiz result on click
                if (e && e.activePayload && e.activePayload[0]) {
                   // Ensure the route /quiz/result/[attemptId] or similar exists
                   // router.push(`/quiz/results/${e.activePayload[0].payload.id}`);
                   console.log("Clicked attempt:", e.activePayload[0].payload.id);
                }
              }}
            >
              <defs>
                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
              <XAxis 
                dataKey="name" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
                tickMargin={10}
              />
              <YAxis
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
                domain={[0, 100]}
                width={40}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area
                type="monotone"
                dataKey="Score"
                stroke="hsl(var(--primary))"
                fillOpacity={1}
                fill="url(#colorScore)"
                strokeWidth={2}
                activeDot={{ r: 6, cursor: 'pointer', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}