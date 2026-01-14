import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PenTool, ArrowRight, Sparkles } from 'lucide-react';

export function EssayGraderWidget() {
  return (
    <Card className="col-span-1 md:col-span-2 hover:shadow-lg transition-all border-primary/20 bg-gradient-to-br from-card to-primary/5">
      <CardHeader>
        <div className="flex items-center justify-between">
            <div className="space-y-1">
                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                    <PenTool className="h-6 w-6 text-primary" />
                    Essay Grader
                </CardTitle>
                <CardDescription>
                    AI-powered analysis for your essays and papers
                </CardDescription>
            </div>
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
            </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
            Upload your essay or paste your text to get instant feedback on grammar, structure, coherence, and argumentation. 
            Our AI analyzes your writing style and suggests improvements to help you get better grades.
        </p>
        <div className="flex gap-3">
            <Link href="/essay-grader" className="w-full">
                <Button size="lg" className="w-full gap-2 group">
                    Grade My Essay
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
            </Link>
        </div>
      </CardContent>
    </Card>
  );
}