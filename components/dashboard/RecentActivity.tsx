// components/dashboard/RecentActivity.tsx
import { FileText, Scroll, Layout } from "lucide-react";

// Mock data structure passed from parent
export function RecentActivity({ items }: { items: any[] }) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'document': return <FileText className="h-4 w-4 text-blue-500" />;
      case 'quiz': return <Scroll className="h-4 w-4 text-orange-500" />;
      case 'project': return <Layout className="h-4 w-4 text-purple-500" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Jump Back In</h3>
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item) => (
          <Link key={item.id} href={item.url} className="block group">
            <div className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:shadow-md transition-all">
              <div className="bg-secondary p-2 rounded-lg group-hover:bg-background transition-colors">
                {getIcon(item.type)}
              </div>
              <div className="overflow-hidden">
                <p className="font-medium truncate">{item.title}</p>
                <p className="text-xs text-muted-foreground">Edited {item.date}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}