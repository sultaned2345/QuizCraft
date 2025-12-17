// src/components/notes/KnowledgeGraph.tsx
'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import { fetcher } from '@/lib/fetcher';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';

// Dynamic import for the graph library (it doesn't support Server Side Rendering)
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full text-muted-foreground">Loading Graph Engine...</div>
});

type GraphNode = {
  id: string;
  label: string;
  group: string;
  val: number;
};

type GraphLink = {
  source: string;
  target: string;
};

type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
};

export function KnowledgeGraph() {
  const { session } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const graphRef = useRef<any>();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Data with SWR (Replaces the slow loop)
  // We pass the token to the fetcher wrapper
  const { data: apiResponse, error, isLoading, mutate } = useSWR(
    session?.access_token ? ['/api/notes/graph', session.access_token] : null,
    ([url, token]) => fetcher<GraphData>(url, token),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  );

  // 2. Handle Responsive Resizing
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    window.addEventListener('resize', updateDimensions);
    updateDimensions(); // Initial call
    
    // Slight delay to ensure container is rendered
    const timeout = setTimeout(updateDimensions, 100);
    return () => {
      window.removeEventListener('resize', updateDimensions);
      clearTimeout(timeout);
    };
  }, []);

  // 3. Theme Configuration
  const isDark = theme === 'dark';
  const colors = {
    bg: isDark ? '#020817' : '#ffffff', // matches tailwind background
    node: isDark ? '#60a5fa' : '#3b82f6', // blue-400 : blue-500
    text: isDark ? '#e2e8f0' : '#1e293b', // slate-200 : slate-800
    link: isDark ? '#334155' : '#cbd5e1', // slate-700 : slate-300
  };

  const handleNodeClick = (node: any) => {
    router.push(`/notes/${node.id}`);
  };

  if (isLoading) {
    return (
      <Card className="h-[600px] w-full flex items-center justify-center border-dashed">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Mapping your knowledge...</p>
        </div>
      </Card>
    );
  }

  if (error || !apiResponse?.success) {
    return (
      <Card className="h-[600px] w-full flex items-center justify-center border-dashed bg-red-50/10">
        <div className="flex flex-col items-center gap-2">
          <p className="text-red-500">Failed to load graph.</p>
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
        </div>
      </Card>
    );
  }

  const graphData = apiResponse?.data || { nodes: [], links: [] };

  if (graphData.nodes.length === 0) {
     return (
      <Card className="h-[600px] w-full flex items-center justify-center border-dashed">
        <p className="text-muted-foreground">No notes found. Create notes to see your graph!</p>
      </Card>
    );
  }

  return (
    <Card className="relative w-full overflow-hidden border-2 h-[600px]">
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
         <Button variant="secondary" size="icon" onClick={() => graphRef.current?.zoomToFit(400)}>
            <RefreshCw className="h-4 w-4" />
         </Button>
         <Button variant="secondary" size="icon" onClick={() => graphRef.current?.d3ReheatSimulation()}>
             <ZoomIn className="h-4 w-4" /> {/* Re-trigger simulation acting as 'focus' */}
         </Button>
      </div>
      
      <CardContent className="p-0 h-full" ref={containerRef}>
        <ForceGraph2D
          ref={graphRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          backgroundColor={colors.bg}
          
          // Node Styling
          nodeLabel="label"
          nodeColor={() => colors.node}
          nodeRelSize={6}
          
          // Link Styling
          linkColor={() => colors.link}
          linkWidth={1.5}
          linkDirectionalParticles={2}
          linkDirectionalParticleWidth={2}
          
          // Text/Label Styling
          nodeCanvasObject={(node: any, ctx, globalScale) => {
            const label = node.label;
            const fontSize = 12/globalScale;
            ctx.font = `${fontSize}px Sans-Serif`;
            const textWidth = ctx.measureText(label).width;
            const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); // some padding

            // Draw Node Circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI, false);
            ctx.fillStyle = node.group === 'untagged' ? (isDark ? '#94a3b8' : '#64748b') : colors.node;
            ctx.fill();

            // Draw Label only on hover or high zoom
            if (globalScale > 1.5) {
                ctx.fillStyle = colors.text;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(label, node.x, node.y + 8);
            }
          }}
          
          // Interaction
          onNodeClick={handleNodeClick}
          cooldownTicks={100}
        />
      </CardContent>
    </Card>
  );
}