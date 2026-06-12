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
      <header className="app-header">
        <div className="container">
          <span style={{ fontSize: '1.8rem' }}>📸</span>
          <div>
            <h1>WikiPicture</h1>
            <p>Find Wikipedia articles that need your travel photos</p>
          </div>
        </div>
      </header>

      <PrivacyBanner />

      <main className="container" style={{ paddingTop: '1.5rem', paddingBottom: '2rem' }}>
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

      <footer className="app-footer">
        <div className="container" style={{ display: 'block' }}>
          WikiPicture — Find Wikipedia articles that need your photos
        </div>
      </footer>
    </div>
  );
}
