// src/components/dashboard/StudyHeatmap.tsx
'use client';

import CalendarHeatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';
import { Tooltip } from 'react-tooltip'; // Use the dedicated library for this chart

interface ActivityData {
  date: string; // YYYY-MM-DD
  count: number;
}

export function StudyHeatmap({ data }: { data: ActivityData[] }) {
  const today = new Date();
  
  // Helper to shift date for the view range
  const shiftDate = (date: Date, numDays: number) => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + numDays);
    return newDate;
  };

  return (
    <div className="w-full p-6 bg-card rounded-xl border border-border shadow-sm">
      <div className="flex items-center justify-between mb-6">
         <h3 className="text-lg font-semibold flex items-center gap-2">
            Study Consistency
         </h3>
         <span className="text-xs text-muted-foreground">Last 5 months</span>
      </div>
      
      <div className="w-full overflow-x-auto">
        <div className="min-w-[600px]"> {/* Ensure it doesn't squish on mobile */}
            <CalendarHeatmap
                startDate={shiftDate(today, -150)} 
                endDate={today}
                values={data}
                classForValue={(value) => {
                    if (!value || value.count === 0) return 'color-empty';
                    // Clamp count between 1 and 4 for CSS classes
                    return `color-scale-${Math.min(value.count, 4)}`; 
                }}
                tooltipDataAttrs={(value: any) => {
                    // Tooltip logic for react-tooltip
                    if (!value || !value.date) {
                        return { 'data-tooltip-id': 'heatmap-tooltip', 'data-tooltip-content': 'No activity' };
                    }
                    return {
                        'data-tooltip-id': 'heatmap-tooltip',
                        'data-tooltip-content': `${value.date}: ${value.count} activities`,
                    };
                }}
                showWeekdayLabels
                gutterSize={3} // Spacing between squares
            />
        </div>
      </div>
      
      {/* The actual Tooltip component */}
      <Tooltip id="heatmap-tooltip" style={{ fontSize: '12px', padding: '8px 12px', borderRadius: '8px' }} />
    </div>
  );
}