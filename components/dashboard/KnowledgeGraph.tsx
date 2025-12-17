"use client";
import React, { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

// Dynamically import to avoid SSR issues with canvas
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

export function KnowledgeGraph() {
  const [data, setData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/knowledge-graph")
      .then((res) => res.json())
      .then((graphData) => {
        setData(graphData);
        setLoading(false);
      });
  }, []);

  return (
    <Card className="h-[500px] flex flex-col">
      <CardHeader>
        <CardTitle>Your Knowledge Graph</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 relative overflow-hidden" ref={containerRef}>
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ForceGraph2D
            width={containerRef.current?.clientWidth || 600}
            height={400}
            graphData={data}
            nodeLabel="name"
            nodeAutoColorBy="group"
            linkDirectionalParticles={2}
            linkDirectionalParticleSpeed={0.005}
            backgroundColor="rgba(0,0,0,0)" // Transparent
            onNodeClick={(node) => {
               // Add navigation logic here, e.g., router.push(`/documents/${node.id}`)
               console.log("Clicked", node);
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}