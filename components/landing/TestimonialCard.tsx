import { User } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

interface TestimonialCardProps {
  quote: string;
  name: string;
  title: string;
}

export function TestimonialCard({ quote, name, title }: TestimonialCardProps) {
  return (
    <Card className="h-full flex flex-col bg-card/40 backdrop-blur-sm border-white/10 shadow-lg hover:shadow-xl transition-all duration-300 group hover:-translate-y-1">
      <CardContent className="pt-6 flex-1">
        <blockquote className="text-lg leading-relaxed text-foreground/90">
          &ldquo;{quote}&rdquo;
        </blockquote>
      </CardContent>
      <CardFooter>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
            <User className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold">{name}</p>
            <p className="text-sm text-muted-foreground">{title}</p>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}