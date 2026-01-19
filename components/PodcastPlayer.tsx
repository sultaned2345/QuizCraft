"use client";

import React, { useState, useRef } from "react";
import { Play, Pause, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface PodcastPlayerProps {
  content: string;
  title: string;
  sourceId: string;
  sourceType: "document" | "note";
  existingPodcast?: {
    audioUrl: string;
    transcript: any;
  };
}

export function PodcastPlayer({ content, title, sourceId, sourceType, existingPodcast }: PodcastPlayerProps) {
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(existingPodcast?.audioUrl || null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/podcasts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, title, sourceId, sourceType }),
      });

      if (!res.ok) throw new Error("Failed to generate");

      const data = await res.json();
      setAudioUrl(data.audioUrl);
      toast({ title: "Podcast Ready!", description: "Listen to your AI generated discussion." });
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Could not generate podcast. Content might be too long.", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <Card className="w-full mt-6 bg-gradient-to-br from-indigo-950/20 to-purple-950/20 border-indigo-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          AI Podcast Review
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!audioUrl ? (
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              Turn these notes into an engaging audio discussion between two AI hosts.
            </p>
            <Button onClick={handleGenerate} disabled={loading} className="w-full sm:w-auto">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Script & Audio...
                </>
              ) : (
                "Generate Podcast"
              )}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
             {/* Hidden Audio Element */}
            <audio 
              ref={audioRef} 
              src={audioUrl} 
              onEnded={() => setIsPlaying(false)}
              onPause={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
            />

            {/* Visualizer & Controls */}
            <div className="w-full h-24 bg-black/20 rounded-lg flex items-center justify-center overflow-hidden relative">
              {/* Fallback simplified visualizer */}
              {isPlaying && (
                <div className="flex gap-1 items-end h-1/2">
                   {[...Array(20)].map((_, i) => (
                      <div 
                        key={i} 
                        className="w-1 bg-indigo-500 animate-pulse" 
                        style={{ height: `${Math.random() * 100}%`, animationDuration: '0.5s' }}
                      />
                   ))}
                </div>
              )}
              {!isPlaying && <div className="text-muted-foreground text-sm">Paused</div>}
            </div>

            <Button size="lg" className="rounded-full w-12 h-12 p-0" onClick={togglePlay}>
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}