import { ActivityItem } from "@/lib/dashboard-data";
import { FileText, BrainCircuit, Layers, FolderKanban, Clock, ArrowUpRight, CircleDot } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

const iconMap = {
  document: FileText,
  quiz: BrainCircuit,
  note: Layers,
  project: FolderKanban,
};

export function MissionLog({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return <div className="text-muted-foreground text-sm font-mono p-4">Log empty. Initialize activity.</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-6 px-1">
         <Clock className="w-4 h-4 text-muted-foreground" />
         <h2 className="text-sm font-mono font-bold tracking-wider text-muted-foreground uppercase">
           Mission Log
         </h2>
      </div>
      
      <div className="space-y-0 relative">
        {/* Timeline Line */}
        <div className="absolute left-6 top-4 bottom-4 w-px bg-border/50" />

        {items.map((item, index) => {
          const Icon = iconMap[item.type];
          
          return (
            <div key={`${item.type}-${item.id}`} className="relative group">
              
              <Link 
                href={item.url}
                className="flex items-center gap-4 p-3 rounded-2xl hover:bg-muted/50 transition-all duration-200"
              >
                {/* Timeline Dot & Icon */}
                <div className="relative z-10 h-12 w-12 shrink-0 rounded-xl border border-border bg-background flex items-center justify-center group-hover:border-primary/50 group-hover:text-primary transition-colors shadow-sm">
                  <Icon className="h-5 w-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                     <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {item.title}
                     </p>
                     <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono mt-0.5">
                    <span className="uppercase tracking-wider text-[10px]">{item.type}</span>
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <span>{formatDistanceToNow(new Date(item.date), { addSuffix: true })}</span>
                  </div>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}