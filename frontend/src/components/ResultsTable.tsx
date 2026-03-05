import { useState } from 'react';
import type { OpportunityOut } from '../types';

type SortKey = 'filename' | 'location_name' | 'score' | 'recommendation';
type SortDir = 'asc' | 'desc';

const SATURATION_BADGE: Record<string, string> = {
  NONE:      'badge-green',
  LOW:       'badge-green',
  MEDIUM:    'badge-yellow',
  HIGH:      'badge-orange',
  SATURATED: 'badge-red',
};

function scoreBadgeClass(score: number): string {
  if (score >= 70) return 'badge-green';
  if (score >= 45) return 'badge-yellow';
  if (score >= 25) return 'badge-orange';
  return 'badge-red';
}

function scoreBarClass(score: number): string {
  if (score >= 70) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

function rowTint(score: number): string {
  if (score >= 70) return 'rgba(22,163,74,0.04)';
  if (score >= 45) return 'rgba(217,119,6,0.04)';
  if (score >= 25) return 'rgba(194,65,12,0.04)';
  return 'rgba(220,38,38,0.04)';
}

interface Props {
  opportunities: OpportunityOut[];
  totalPhotos: number;
}

export function ResultsTable({ opportunities, totalPhotos }: Props) {
  const [sortKey, setSortKey]   = useState<SortKey>('score');
  const [sortDir, setSortDir]   = useState<SortDir>('desc');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const highCount = opportunities.filter(o => o.score >= 70).length;

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function toggleExpand(filename: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(filename) ? next.delete(filename) : next.add(filename);
      return next;
    });
  }

  const sorted = [...opportunities].sort((a, b) => {
    let av: string | number = a[sortKey] ?? '';
    let bv: string | number = b[sortKey] ?? '';
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ?  1 : -1;
    return 0;
  });

  function SortTh({ col, label }: { col: SortKey; label: string }) {
    const active = sortKey === col;
    return (
      <th
        onClick={() => toggleSort(col)}
        style={{ cursor: 'pointer', userSelect: 'none' }}
        title={`Sort by ${label}`}
      >
        {label}{' '}
        <span style={{ opacity: active ? 1 : 0.35 }}>
          {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </th>
    );
  }

  if (opportunities.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📷</div>
        <p style={{ fontWeight: 600, marginBottom: '0.4rem' }}>No opportunities found</p>
        <p style={{ color: 'var(--color-gray-500)', fontSize: '0.9rem' }}>
          None of the analyzed photos matched Wikipedia articles needing images in their location.
          Try photos from less-photographed locations.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="results-table">
      {/* Summary */}
      <p style={{
        fontSize: '0.875rem',
        color: 'var(--color-gray-500)',
        marginBottom: '0.75rem',
      }}>
        Analyzed <strong>{totalPhotos}</strong> photos &middot; Found{' '}
        <strong>{opportunities.length}</strong> opportunities &middot;{' '}
        <strong>{highCount}</strong> highly recommended
      </p>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 68 }}>Thumb</th>
                <SortTh col="filename"      label="Photo" />
                <SortTh col="location_name" label="Location" />
                <SortTh col="score"         label="Score" />
                <SortTh col="recommendation" label="Recommendation" />
                <th>Wikipedia Article</th>
                <th>Commons</th>
                <th>Reasons</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(opp => {
                const isExp = expanded.has(opp.filename);
                const reasons = opp.reasons ?? [];
                return (
                  <tr key={opp.filename} style={{ background: rowTint(opp.score) }}>
                    {/* Thumbnail */}
                    <td style={{ padding: '0.5rem 0.6rem' }}>
                      {opp.thumbnail_b64 ? (
                        <img
                          src={`data:image/jpeg;base64,${opp.thumbnail_b64}`}
                          alt={opp.filename}
                          style={{
                            width: 60,
                            height: 60,
                            objectFit: 'cover',
                            borderRadius: 'var(--radius-sm)',
                            display: 'block',
                          }}
                        />
                      ) : (
                        <div style={{
                          width: 60,
                          height: 60,
                          background: 'var(--color-gray-200)',
                          borderRadius: 'var(--radius-sm)',
                        }} />
                      )}
                    </td>

                    {/* Photo filename */}
                    <td style={{ maxWidth: 160, wordBreak: 'break-all', fontSize: '0.8rem' }}>
                      {opp.filename}
                    </td>

                    {/* Location */}
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {opp.location_name || (
                        <span style={{ color: 'var(--color-gray-500)' }}>
                          {opp.latitude.toFixed(4)}, {opp.longitude.toFixed(4)}
                        </span>
                      )}
                    </td>

                    {/* Score */}
                    <td style={{ minWidth: 90 }}>
                      <div className="score-bar-track" style={{ marginBottom: '0.3rem' }}>
                        <div
                          className={`score-bar ${scoreBarClass(opp.score)}`}
                          style={{ width: `${opp.score}%` }}
                        />
                      </div>
                      <span className={`badge ${scoreBadgeClass(opp.score)}`}>
                        {opp.score}
                      </span>
                    </td>

                    {/* Recommendation */}
                    <td>
                      <span className={`badge ${scoreBadgeClass(opp.score)}`}>
                        {opp.recommendation}
                      </span>
                    </td>

                    {/* Wikipedia Article */}
                    <td>
                      {opp.best_article ? (
                        <a
                          href={opp.best_article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}
                        >
                          {opp.best_article.title}
                        </a>
                      ) : (
                        <span style={{ color: 'var(--color-gray-500)', fontStyle: 'italic' }}>
                          None found
                        </span>
                      )}
                    </td>

                    {/* Commons */}
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {opp.commons ? (
                        <>
                          <span className={`badge ${SATURATION_BADGE[opp.commons.saturation] ?? 'badge-yellow'}`}>
                            {opp.commons.saturation}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)', marginLeft: '0.35rem' }}>
                            {opp.commons.nearby_image_count}
                          </span>
                        </>
                      ) : (
                        <span style={{ color: 'var(--color-gray-500)' }}>—</span>
                      )}
                    </td>

                    {/* Reasons */}
                    <td style={{ minWidth: 180 }}>
                      {reasons.length === 0 ? (
                        <span style={{ color: 'var(--color-gray-500)' }}>—</span>
                      ) : (
                        <>
                          <ul style={{ paddingLeft: '1rem', margin: 0 }}>
                            {(isExp ? reasons : reasons.slice(0, 2)).map((r, i) => (
                              <li key={i} style={{ fontSize: '0.78rem', lineHeight: 1.4 }}>{r}</li>
                            ))}
                          </ul>
                          {reasons.length > 2 && (
                            <button
                              onClick={() => toggleExpand(opp.filename)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--color-primary)',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                padding: '0.15rem 0',
                                marginTop: '0.15rem',
                              }}
                            >
                              {isExp ? 'show less' : `+${reasons.length - 2} more`}
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
