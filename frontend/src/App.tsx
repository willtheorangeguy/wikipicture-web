import { useEffect, useState } from 'react';
import { useProgress } from './hooks/useProgress';
import { getResults } from './api/client';
import type { ResultsResponse } from './types';
import { DropZone } from './components/DropZone';
import { ProgressView } from './components/ProgressView';
import { ResultsTable } from './components/ResultsTable';
import { DownloadButton } from './components/DownloadButton';
import { PrivacyBanner } from './components/PrivacyBanner';

type AppState = 'upload' | 'processing' | 'results';

export default function App() {
  const [appState, setAppState] = useState<AppState>('upload');
  const [jobId, setJobId] = useState<string | null>(null);
  const [results, setResults] = useState<ResultsResponse | null>(null);

  // Track progress status at the App level to drive state transitions
  const { status } = useProgress(appState === 'processing' ? jobId : null);

  function handleJobStarted(id: string) {
    setJobId(id);
    setAppState('processing');
  }

  // Transition: processing done → fetch results → results view
  useEffect(() => {
    if (status === 'done' && jobId && appState === 'processing') {
      getResults(jobId)
        .then(data => {
          setResults(data);
          setAppState('results');
        })
        .catch(console.error);
    }
  }, [status, jobId, appState]);

  function handleReset() {
    setJobId(null);
    setResults(null);
    setAppState('upload');
  }

  return (
    <div>
      <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '1rem 0' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.75rem' }}>📷</span>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#1e293b', lineHeight: 1.2 }}>
              WikiPicture
            </h1>
            <p style={{ fontSize: '0.825rem', color: '#64748b' }}>
              Find Wikipedia articles that need your travel photos
            </p>
          </div>
        </div>
      </header>

      <PrivacyBanner />

      <main className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
        {appState === 'upload' && (
          <DropZone onJobStarted={handleJobStarted} />
        )}

        {appState === 'processing' && jobId && (
          <ProgressView jobId={jobId} />
        )}

        {appState === 'results' && results && jobId && (
          <div>
            <div style={{ marginBottom: '1.25rem' }}>
              <DownloadButton jobId={jobId} onReset={handleReset} />
            </div>
            <ResultsTable
              opportunities={results.opportunities}
              totalPhotos={results.total_photos}
            />
          </div>
        )}
      </main>
    </div>
  );
}
