// src/components/dashboard/MissionLog.tsx
import Link from "next/link";
import { FileText, BrainCircuit, Layers, FolderKanban, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const iconMap: Record<string, any> = {
  document: FileText,
  quiz: BrainCircuit,
  note: Layers,
  project: FolderKanban,
};

export function MissionLog({ items }: { items: any[] }) {
  if (items.length === 0) {
    return (
       <div className="p-8 text-center text-muted-foreground text-sm font-serif italic">
         Your study journey begins here. Upload a file to start logging activity.
       </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-border/60">
      {items.map((item, index) => {
        const Icon = iconMap[item.type] || FileText;
        
        return (
          <div key={`${item.type}-${item.id}`} className="relative group">
            {/* Timeline Dot */}
            <div className={cn(
              "absolute -left-[23px] top-1 h-6 w-6 rounded-full border-2 border-background flex items-center justify-center z-10",
              index === 0 ? "bg-primary text-primary-foreground scale-110 shadow-md" : "bg-muted text-muted-foreground"
            )}>
              <Icon className="h-3 w-3" />
            </div>

            {/* Content Card */}
            <Link 
              href={item.url}
              className="block -mt-1 p-3 rounded-xl hover:bg-muted/50 transition-all duration-200 group-hover:translate-x-1"
            >
              <div className="flex items-center justify-between mb-1">
                 <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {item.title}
                 </p>
                 <span className="text-[10px] text-muted-foreground whitespace-nowrap font-sans">
                   {formatDistanceToNow(new Date(item.date), { addSuffix: true })}
                 </span>
              </div>
              <p className="text-xs text-muted-foreground capitalize flex items-center gap-1">
                {item.type} <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
            </Link>
          </div>
        );
      })}
    </div>
  );
}