'use client';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, BookOpen, FileText, Trash2 } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  onDelete: (id: string) => void; // FIX: Added onDelete prop
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  // Mock mastery score for now (will connect to real stats later)
  const masteryScore = 0; 
  const lastActive = project.updated_at 
    ? formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })
    : 'Just now';

  return (
    <div className="h-full">
      <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/50 h-full flex flex-col overflow-hidden">
        {/* Main Clickable Area */}
        <Link href={`/projects/${project.id}`} className="flex-1 flex flex-col">
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
        </Link>

        {/* Footer with Actions */}
        <CardFooter className="pt-3 border-t bg-muted/20 text-xs text-muted-foreground flex justify-between items-center">
          <span>Active {lastActive}</span>
          
          <div className="flex items-center gap-1">
             {/* Delete Button with Confirmation */}
             <AlertDialog>
               <AlertDialogTrigger asChild>
                 <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-muted-foreground hover:text-destructive transition-colors"
                 >
                   <Trash2 className="w-4 h-4" />
                 </Button>
               </AlertDialogTrigger>
               <AlertDialogContent>
                 <AlertDialogHeader>
                   <AlertDialogTitle>Delete Project?</AlertDialogTitle>
                   <AlertDialogDescription>
                     This will permanently delete "{project.title}" and all its contents. This action cannot be undone.
                   </AlertDialogDescription>
                 </AlertDialogHeader>
                 <AlertDialogFooter>
                   <AlertDialogCancel>Cancel</AlertDialogCancel>
                   <AlertDialogAction 
                     onClick={() => onDelete(project.id)}
                     className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                   >
                     Delete
                   </AlertDialogAction>
                 </AlertDialogFooter>
               </AlertDialogContent>
             </AlertDialog>
            
             <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary ml-2" />
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}