import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast"; // Assuming standard shadcn toast hook

interface UseStudyTimerProps {
  activityType?: "quiz" | "flashcard" | "note_reading" | "general";
  resourceId?: string;
}

export function useStudyTimer({ activityType = "general", resourceId }: UseStudyTimerProps = {}) {
  const [isActive, setIsActive] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const lastSyncTimeRef = useRef<number>(Date.now());
  const { toast } = useToast();

  // Sync with API every 30 seconds or when pausing
  const syncTime = useCallback(async (durationDelta: number) => {
    if (durationDelta <= 0) return;

    try {
      const res = await fetch("/api/study/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          activityType,
          resourceId,
          durationDelta,
        }),
      });

      if (!res.ok) throw new Error("Failed to sync time");
      
      const data = await res.json();
      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
      }
    } catch (error) {
      console.error("Failed to log study time:", error);
    }
  }, [sessionId, activityType, resourceId]);

  // Main Timer Loop
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isActive) {
      startTimeRef.current = Date.now();
      lastSyncTimeRef.current = Date.now();

      interval = setInterval(() => {
        const now = Date.now();
        const deltaSeconds = Math.floor((now - lastSyncTimeRef.current) / 1000);

        if (deltaSeconds >= 1) {
          setSeconds((prev) => prev + deltaSeconds);
          
          // Sync every 30 seconds
          if (seconds > 0 && seconds % 30 === 0) {
            syncTime(deltaSeconds); 
          }
          
          lastSyncTimeRef.current = now;
        }
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isActive, seconds, syncTime]);

  // Handle Tab Visibility (Pause when user leaves tab to ensure accuracy)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isActive) {
        setIsActive(false);
        const now = Date.now();
        const delta = Math.floor((now - lastSyncTimeRef.current) / 1000);
        syncTime(delta);
        toast({ title: "Focus Paused", description: "Timer paused while you were away." });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isActive, syncTime, toast]);

  const toggleTimer = () => {
    if (isActive) {
      // Pausing: Sync remaining time
      const now = Date.now();
      const delta = Math.floor((now - lastSyncTimeRef.current) / 1000);
      syncTime(delta);
    }
    setIsActive(!isActive);
  };

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h > 0 ? `${h}:` : ""}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return { isActive, seconds, toggleTimer, formatTime };
}