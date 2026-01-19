// src/components/dashboard/RecentActivity.tsx
import Link from "next/link";
import { Clock, FileText, Folder, CheckCircle } from "lucide-react";
import { getUser } from "@/lib/auth"; 
import { getRecentActivity, type ActivityItem } from "@/lib/dashboard-data"; // Import the type
import { formatDistanceToNow } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Icon mapper helper
const getIcon = (type: string) => {
  switch (type) {
    case "document": return <FileText className="h-4 w-4 text-blue-500" />;
    case "quiz": return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "note": return <FileText className="h-4 w-4 text-amber-500" />;
    case "project": return <Folder className="h-4 w-4 text-purple-500" />;
    default: return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
};

export async function RecentActivity() {
  const user = await getUser();
  if (!user) return null;

  // Ensure activities is an array with explicit typing
  let activities: ActivityItem[] = []; 
  try {
    activities = await getRecentActivity(user.id);
  } catch (e) {
    console.error("RecentActivity fetch error:", e);
  }

  // Double check it's an array
  const safeActivities = Array.isArray(activities) ? activities : [];

  if (safeActivities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest actions will appear here.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No recent activity found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Your latest actions across the platform.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {safeActivities.map((activity) => (
          <div
            key={`${activity.type}-${activity.id}`}
            className="flex items-center gap-4 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-background border">
              {getIcon(activity.type)}
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium leading-none">
                <Link href={activity.url} className="hover:underline">
                  {activity.title}
                </Link>
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(activity.date), { addSuffix: true })}
              </p>
            </div>
            <div className="text-xs text-muted-foreground capitalize">
              {activity.type}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}