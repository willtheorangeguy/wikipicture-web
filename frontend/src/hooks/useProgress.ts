import { useState, useEffect, useRef } from 'react';
import type { ProgressEvent, JobStatus } from '../types';

interface UseProgressResult {
  events: ProgressEvent[];
  status: JobStatus;
  isConnected: boolean;
}

export function useProgress(jobId: string | null): UseProgressResult {
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [status, setStatus] = useState<JobStatus>('queued');
  const [isConnected, setIsConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const es = new EventSource(`/api/job/${encodeURIComponent(jobId)}`);
    esRef.current = es;
    setIsConnected(true);

    es.onmessage = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data as string) as ProgressEvent;
        setEvents(prev => [...prev, event]);
        // Belt-and-suspenders: treat step=="done" as terminal
        if (event.step === 'done') {
          setStatus('done');
          es.close();
          setIsConnected(false);
        }
      } catch {
        // ignore malformed events
      }
    };

    es.addEventListener('status', (e: MessageEvent) => {
      const newStatus = (e.data as string).trim() as JobStatus;
      setStatus(newStatus);
      if (newStatus === 'done' || newStatus === 'failed') {
        es.close();
        setIsConnected(false);
      }
    });

    es.onerror = () => {
      setIsConnected(false);
      es.close();
    };

    return () => {
      es.close();
      setIsConnected(false);
    };
  }, [jobId]);

  return { events, status, isConnected };
}
