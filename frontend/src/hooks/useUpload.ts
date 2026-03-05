import { useState, useCallback } from 'react';
import { uploadPhotos } from '../api/client';

interface UseUploadResult {
  upload: (files: File[]) => Promise<void>;
  jobId: string | null;
  isLoading: boolean;
  error: string | null;
}

export function useUpload(): UseUploadResult {
  const [jobId, setJobId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (files: File[]) => {
    setIsLoading(true);
    setError(null);
    try {
      const { job_id } = await uploadPhotos(files);
      setJobId(job_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { upload, jobId, isLoading, error };
}
