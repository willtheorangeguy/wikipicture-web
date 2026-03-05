import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useUpload } from '../hooks/useUpload';

const ACCEPTED_EXTS = ['.jpg', '.jpeg', '.heic', '.heif'];
const ACCEPTED_MIME = ['image/jpeg', 'image/heic', 'image/heif'];
const MAX_FILES = 50;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024; // 100 MB

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileWithPreview {
  file: File;
  preview: string | null;
}

interface DropZoneProps {
  onJobStarted: (jobId: string) => void;
}

type DropZoneState = 'idle' | 'dragover' | 'selected' | 'uploading';

export function DropZone({ onJobStarted }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<DropZoneState>('idle');
  const [items, setItems] = useState<FileWithPreview[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { upload, jobId, isLoading, error } = useUpload();

  // Trigger onJobStarted when jobId arrives
  useEffect(() => {
    if (jobId) {
      onJobStarted(jobId);
    }
  }, [jobId, onJobStarted]);

  // Keep state in sync with isLoading
  useEffect(() => {
    if (isLoading) {
      setState('uploading');
    } else if (!isLoading && state === 'uploading' && !jobId) {
      // upload failed — revert to selected so user can retry
      setState('selected');
    }
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const buildPreviews = (files: File[]): FileWithPreview[] =>
    files.map((file) => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }));

  const validateAndSet = useCallback((incoming: File[]) => {
    setValidationError(null);

    // Filter non-image MIME types
    const rejected = incoming.filter(
      (f) => !ACCEPTED_MIME.includes(f.type) && !ACCEPTED_EXTS.some((ext) => f.name.toLowerCase().endsWith(ext))
    );
    if (rejected.length) {
      setValidationError(
        `${rejected.length} file(s) rejected: only JPG/JPEG/HEIC/HEIF images are accepted.`
      );
    }

    const valid = incoming.filter(
      (f) => ACCEPTED_MIME.includes(f.type) || ACCEPTED_EXTS.some((ext) => f.name.toLowerCase().endsWith(ext))
    );

    // Merge with existing, de-duplicate by name
    setItems((prev) => {
      const existing = prev.map((i) => i.file);
      const merged = [...existing];
      for (const f of valid) {
        if (!merged.find((e) => e.name === f.name && e.size === f.size)) {
          merged.push(f);
        }
      }

      if (merged.length > MAX_FILES) {
        setValidationError(`Only ${MAX_FILES} files allowed. ${merged.length - MAX_FILES} file(s) were dropped.`);
        return buildPreviews(merged.slice(0, MAX_FILES));
      }

      const totalSize = merged.reduce((sum, f) => sum + f.size, 0);
      if (totalSize > MAX_TOTAL_BYTES) {
        setValidationError(`Total size (${formatSize(totalSize)}) exceeds the 100 MB limit.`);
      }

      return buildPreviews(merged);
    });

    setState('selected');
  }, []);

  const removeFile = (index: number) => {
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) {
        setState('idle');
        setValidationError(null);
      }
      return next;
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setState('dragover');
  };

  const handleDragLeave = () => {
    setState(items.length > 0 ? 'selected' : 'idle');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    validateAndSet(files);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    validateAndSet(files);
    // reset so same files can be re-selected if removed
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleSubmit = async () => {
    const files = items.map((i) => i.file);
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > MAX_TOTAL_BYTES) {
      setValidationError(`Total size (${formatSize(totalSize)}) exceeds the 100 MB limit.`);
      return;
    }
    await upload(files);
  };

  // ── styles ──────────────────────────────────────────────────────────────────

  const dropZoneStyle: React.CSSProperties = {
    border: `2px dashed ${state === 'dragover' ? '#2563eb' : '#cbd5e1'}`,
    borderRadius: '0.75rem',
    background: state === 'dragover' ? '#eff6ff' : '#f8fafc',
    padding: '3rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
    textAlign: 'center',
    minHeight: '220px',
  };

  const totalSize = items.reduce((sum, i) => sum + i.file.size, 0);
  const overLimit = totalSize > MAX_TOTAL_BYTES;

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <div className="card" data-testid="dropzone" style={{ padding: '1.5rem' }}>
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.heic,.heif"
        style={{ display: 'none' }}
        onChange={handleInputChange}
      />

      {/* Validation / upload error banners */}
      {validationError && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.7rem 1rem',
            borderRadius: '0.5rem',
            background: '#fee2e2',
            color: '#b91c1c',
            fontSize: '0.875rem',
          }}
        >
          {validationError}
        </div>
      )}

      {error && state !== 'uploading' && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.7rem 1rem',
            borderRadius: '0.5rem',
            background: '#fee2e2',
            color: '#b91c1c',
            fontSize: '0.875rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>Upload failed: {error}</span>
          <button
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem' }}
            onClick={() => setState('selected')}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── IDLE / DRAG-OVER ── */}
      {(state === 'idle' || state === 'dragover') && (
        <div
          style={dropZoneStyle}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          aria-label="Drop zone for photo upload"
        >
          {/* Camera icon */}
          <svg
            width="52"
            height="52"
            viewBox="0 0 24 24"
            fill="none"
            stroke={state === 'dragover' ? '#2563eb' : '#94a3b8'}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>

          <div>
            <p style={{ fontSize: '1.05rem', fontWeight: 600, color: '#334155' }}>
              Drag &amp; drop your photos here
            </p>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>
              or click to browse
            </p>
          </div>

          <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            Accepted: JPG, JPEG, HEIC, HEIF &nbsp;·&nbsp; Max 50 files &nbsp;·&nbsp; Max 100 MB total
          </p>
        </div>
      )}

      {/* ── FILES SELECTED ── */}
      {state === 'selected' && (
        <div>
          {/* Drop zone stays active at top so user can add more */}
          <div
            style={{
              ...dropZoneStyle,
              minHeight: '80px',
              padding: '1rem',
              marginBottom: '1rem',
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
            aria-label="Drop more photos or click to browse"
          >
            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Drop more photos or click to add
            </p>
          </div>

          {/* Count badge + total size */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '0.75rem',
            }}
          >
            <span
              className="badge badge-green"
              style={{ fontSize: '0.8rem' }}
            >
              {items.length} photo{items.length !== 1 ? 's' : ''} selected
            </span>
            <span
              style={{
                fontSize: '0.8rem',
                color: overLimit ? '#b91c1c' : '#64748b',
                fontWeight: overLimit ? 600 : 400,
              }}
            >
              Total: {formatSize(totalSize)}{overLimit ? ' — exceeds 100 MB limit' : ''}
            </span>
          </div>

          {/* File list */}
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.25rem' }}>
            {items.map(({ file, preview }, idx) => (
              <li
                key={`${file.name}-${file.size}-${idx}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.45rem 0.6rem',
                  borderRadius: '0.4rem',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}
              >
                {preview ? (
                  <img
                    src={preview}
                    alt=""
                    style={{
                      width: '36px',
                      height: '36px',
                      objectFit: 'cover',
                      borderRadius: '0.3rem',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '0.3rem',
                      background: '#e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontSize: '0.65rem',
                      color: '#94a3b8',
                      fontWeight: 600,
                    }}
                  >
                    IMG
                  </div>
                )}
                <span
                  style={{
                    flex: 1,
                    fontSize: '0.825rem',
                    color: '#334155',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {file.name}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', flexShrink: 0 }}>
                  {formatSize(file.size)}
                </span>
                <button
                  onClick={() => removeFile(idx)}
                  aria-label={`Remove ${file.name}`}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    fontSize: '1rem',
                    lineHeight: 1,
                    padding: '0.1rem 0.3rem',
                    borderRadius: '0.25rem',
                    flexShrink: 0,
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = '#b91c1c')}
                  onMouseOut={(e) => (e.currentTarget.style.color = '#94a3b8')}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          {/* Submit */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setItems([]);
                setValidationError(null);
                setState('idle');
              }}
            >
              Clear all
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={items.length === 0 || overLimit}
            >
              Analyze {items.length} photo{items.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {/* ── UPLOADING ── */}
      {state === 'uploading' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            padding: '2.5rem 1rem',
          }}
        >
          {/* Spinner */}
          <svg
            width="44"
            height="44"
            viewBox="0 0 44 44"
            aria-label="Uploading"
            style={{ animation: 'spin 0.9s linear infinite' }}
          >
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <circle
              cx="22"
              cy="22"
              r="18"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="4"
            />
            <path
              d="M40 22a18 18 0 0 0-18-18"
              fill="none"
              stroke="#2563eb"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
          <p style={{ fontSize: '1rem', fontWeight: 500, color: '#334155' }}>
            Uploading {items.length} photo{items.length !== 1 ? 's' : ''}…
          </p>
          <button className="btn btn-primary" disabled>
            Uploading…
          </button>
        </div>
      )}
    </div>
  );
}
