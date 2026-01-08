// components/dashboard/MissionLog.tsx
import { ActivityItem } from "@/lib/dashboard-data";
import { FileText, FileQuestion, StickyNote, FolderKanban, Clock, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

const iconMap = {
  document: FileText,
  quiz: FileQuestion,
  note: StickyNote,
  project: FolderKanban,
};

const colorMap = {
  document: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  quiz: "text-primary bg-primary/10 border-primary/20",
  note: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  project: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
};

export function MissionLog({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return <div className="text-muted-foreground text-sm font-mono">Log is empty. Initialize first task.</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-xl font-mono font-bold tracking-tight mb-6 flex items-center gap-2">
        <Clock className="w-5 h-5 text-muted-foreground" />
        MISSION LOG
      </h2>
      
      <div className="space-y-3">
        {items.map((item) => {
          const Icon = iconMap[item.type];
          const colorClass = colorMap[item.type];

          return (
            <Link 
              key={`${item.type}-${item.id}`} 
              href={item.url}
              className="group flex items-center gap-4 rounded-xl border border-white/5 bg-card/40 p-3 transition-all hover:bg-card/80 hover:border-white/10 hover:shadow-lg hover:shadow-primary/5"
            >
              {/* Icon Box */}
              <div className={`h-10 w-10 shrink-0 rounded-lg border flex items-center justify-center ${colorClass}`}>
                <Icon className="h-5 w-5" />
              </div>

              {/* Text Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                  {item.title}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono mt-0.5">
                  <span className="uppercase tracking-wider opacity-70">{item.type}</span>
                  <span>•</span>
                  <span>{formatDistanceToNow(new Date(item.date), { addSuffix: true })}</span>
                </div>
              </div>

              {/* Arrow Action */}
              <div className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}