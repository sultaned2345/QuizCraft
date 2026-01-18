import { Flame, Clock, Target } from "lucide-react";

interface StatProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  color: "orange" | "blue" | "green";
}

function StatCard({ label, value, icon, trend, color }: StatProps) {
  const colorStyles = {
    orange: "from-orange-500/20 to-red-500/20 border-orange-500/20 text-orange-300",
    blue: "from-blue-500/20 to-cyan-500/20 border-blue-500/20 text-blue-300",
    green: "from-green-500/20 to-emerald-500/20 border-green-500/20 text-green-300",
  };

  return (
    <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${colorStyles[color]} p-4 backdrop-blur-md transition-all hover:scale-[1.02]`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white/60">{label}</p>
          <h3 className="mt-1 text-2xl font-bold text-white tracking-tight">{value}</h3>
          {trend && <p className="mt-1 text-xs text-white/40">{trend}</p>}
        </div>
        <div className={`p-3 rounded-lg bg-white/5 border border-white/10 ${colorStyles[color].split(" ")[3]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export function DashboardStatsGrid({ stats }: { stats: any }) {
  if (!stats) return null;

  return (
    // Updated to grid-cols-3 for better balance without XP
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard
        label="Day Streak"
        value={stats.streak}
        icon={<Flame className="w-5 h-5" />}
        trend="Keep it burning!"
        color="orange"
      />
      <StatCard
        label="Study Hours"
        value={stats.studyHours}
        icon={<Clock className="w-5 h-5" />}
        trend="This week"
        color="blue"
      />
      <StatCard
        label="Quizzes Mastered"
        value={stats.quizzesMastered}
        icon={<Target className="w-5 h-5" />}
        trend="Score > 80%"
        color="green"
      />
    </div>
  );
}