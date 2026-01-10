'use client';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, BookOpen, FileText, BrainCircuit } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

interface ProjectCardProps {
  project: {
    id: string;
    title: string;
    description?: string | null;
    updated_at?: Date | string | null;
    _count?: {
      links: number; // Count of documents/notes linked
    };
  };
}

export function ProjectCard({ project }: ProjectCardProps) {
  // Mock mastery score for now (will connect to real stats later)
  const masteryScore = 0; 
  const lastActive = project.updated_at 
    ? formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })
    : 'Just now';

  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/50 cursor-pointer h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <CardTitle className="text-xl font-bold group-hover:text-primary transition-colors">
                {project.title}
              </CardTitle>
              <p className="text-xs text-muted-foreground line-clamp-1">
                {project.description || "No description"}
              </p>
            </div>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <BookOpen size={16} />
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 pb-2">
          <div className="flex gap-2 mb-4">
             {/* Dynamic Badges based on content type would go here */}
            <Badge variant="secondary" className="text-xs font-normal">
              <FileText className="w-3 h-3 mr-1" />
              {project._count?.links || 0} Items
            </Badge>
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Mastery</span>
              <span>{masteryScore}%</span>
            </div>
            <Progress value={masteryScore} className="h-1.5" />
          </div>
        </CardContent>

        <CardFooter className="pt-3 border-t bg-muted/20 text-xs text-muted-foreground flex justify-between">
          <span>Active {lastActive}</span>
          <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
        </CardFooter>
      </Card>
    </Link>
  );
}