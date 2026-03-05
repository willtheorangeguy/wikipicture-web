import type { ResultsResponse } from '../types';

const BASE = '/api';

export async function uploadPhotos(files: File[]): Promise<{ job_id: string }> {
  const form = new FormData();
  for (const file of files) {
    form.append('photos', file);
  }
  const res = await fetch(`${BASE}/upload`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
  return res.json() as Promise<{ job_id: string }>;
}

export async function getResults(jobId: string): Promise<ResultsResponse> {
  const res = await fetch(`${BASE}/results/${encodeURIComponent(jobId)}`);
  if (!res.ok) throw new Error(`Failed to fetch results: ${res.status} ${res.statusText}`);
  return res.json() as Promise<ResultsResponse>;
}

export async function deleteJob(jobId: string): Promise<void> {
  const res = await fetch(`${BASE}/job/${encodeURIComponent(jobId)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete job: ${res.status} ${res.statusText}`);
}

export function getDownloadUrl(jobId: string): string {
  return `${BASE}/download/${encodeURIComponent(jobId)}`;
}
