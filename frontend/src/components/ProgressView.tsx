import { useProgress } from '../hooks/useProgress';

const STEP_LABELS: Record<string, string> = {
  extracting: 'Extracting GPS data',
  geocoding:  'Finding locations',
  wikipedia:  'Searching Wikipedia',
  commons:    'Checking Wikimedia Commons',
  done:       'Complete!',
};

function stepLabel(step: string): string {
  return STEP_LABELS[step] ?? (step.charAt(0).toUpperCase() + step.slice(1));
}

interface Props {
  jobId: string;
}

export function ProgressView({ jobId }: Props) {
  const { events, status } = useProgress(jobId);
  const latest = events[events.length - 1] ?? null;

  const current = latest?.current ?? 0;
  const total   = latest?.total   ?? 0;
  const pct     = total > 0 ? Math.round((current / total) * 100) : 0;
  const step    = latest?.step ?? '';

  if (status === 'failed') {
    return (
      <div className="card" style={{ borderColor: 'var(--color-danger)' }}>
        <div style={{
          background: '#fee2e2',
          color: '#b91c1c',
          borderRadius: 'var(--radius-sm)',
          padding: '1rem 1.25rem',
          fontWeight: 500,
        }}>
          <span style={{ marginRight: '0.5rem' }}>✕</span>
          Analysis failed: {latest?.message ?? 'Unknown error'}
        </div>
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '2rem', color: 'var(--color-success)', marginBottom: '0.5rem' }}>✓</div>
        <p style={{ color: 'var(--color-success)', fontWeight: 600 }}>
          Analysis complete! Loading results…
        </p>
      </div>
    );
  }

  return (
    <div className="card" data-testid="progress-view">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <Spinner />
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>
          {step ? stepLabel(step) : 'Starting…'}
        </span>
      </div>

      <div className="progress-bar-track" style={{ marginBottom: '0.5rem' }}>
        <div
          className="progress-bar"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.8rem',
        color: 'var(--color-gray-500)',
        marginBottom: '0.75rem',
      }}>
        <span>{total > 0 ? `${current} of ${total} photos analyzed` : 'Preparing…'}</span>
        <span>{pct}%</span>
      </div>

      {latest?.message && (
        <p style={{ fontSize: '0.85rem', color: 'var(--color-gray-700)' }}>
          {latest.message}
        </p>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block',
      width: '1.1rem',
      height: '1.1rem',
      border: '2px solid var(--color-gray-200)',
      borderTopColor: 'var(--color-primary)',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  );
}
