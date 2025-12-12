'use client';
import CalendarHeatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';
import { Tooltip } from '@/components/ui/tooltip';

interface ActivityData {
  date: string; // YYYY-MM-DD
  count: number;
}

export function StudyHeatmap({ data }: { data: ActivityData[] }) {
  const today = new Date();
  const shiftDate = (date: Date, numDays: number) => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + numDays);
    return newDate;
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4 bg-card rounded-xl border border-muted">
      <h3 className="text-lg font-semibold mb-4">Study Consistency</h3>
      <CalendarHeatmap
        startDate={shiftDate(today, -150)} // Show last 5 months
        endDate={today}
        values={data}
        classForValue={(value) => {
          if (!value) return 'color-empty';
          return `color-scale-${Math.min(value.count, 4)}`; // Classes: color-scale-1 to 4
        }}
        tooltipDataAttrs={(value: any) => ({
          'data-tip': value.date ? `${value.date}: ${value.count} quizzes` : 'No study',
        })}
        showWeekdayLabels
      />
      {/* You need to add CSS for .color-scale-1 through 4 in globals.css */}
    </div>
  );
}