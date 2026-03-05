import { useState } from 'react';
import { getDownloadUrl, deleteJob } from '../api/client';

interface Props {
  jobId: string;
  onReset: () => void;
}

export function DownloadButton({ jobId, onReset }: Props) {
  const [resetting, setResetting] = useState(false);

  async function handleReset() {
    setResetting(true);
    try {
      await deleteJob(jobId);
    } catch {
      // best-effort delete; proceed regardless
    }
    onReset();
  }

  return (
    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
      <a
        href={getDownloadUrl(jobId)}
        download
        className="btn btn-primary"
      >
        ↓ Download HTML Report
      </a>
      <button
        className="btn btn-secondary"
        onClick={handleReset}
        disabled={resetting}
      >
        ↺ Analyze More Photos
      </button>
    </div>
  );
}
