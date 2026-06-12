import { useState } from 'react';
import type { OpportunityOut } from '../types';

type SortKey = 'location_name' | 'score' | 'recommendation' | 'images';
type SortDir = 'asc' | 'desc';

const SATURATION_BADGE: Record<string, string> = {
  NONE:      'badge-green',
  LOW:       'badge-green',
  MEDIUM:    'badge-yellow',
  HIGH:      'badge-orange',
  SATURATED: 'badge-red',
};

/** Maps a score to the report's four-tier colour bucket. */
function scoreColor(score: number): 'green' | 'yellow' | 'orange' | 'red' {
  if (score >= 70) return 'green';
  if (score >= 45) return 'yellow';
  if (score >= 25) return 'orange';
  return 'red';
}

/** Full-row tint class, mirroring the HTML report's recommendation rows. */
function rowClass(score: number): string {
  if (score >= 70) return 'row-highly-recommended';
  if (score >= 45) return 'row-recommended';
  if (score >= 25) return 'row-considered';
  return 'row-not-recommended';
}

interface Props {
  opportunities: OpportunityOut[];
  totalPhotos: number;
}

export function ResultsTable({ opportunities, totalPhotos }: Props) {
  const [sortKey, setSortKey]   = useState<SortKey>('score');
  const [sortDir, setSortDir]   = useState<SortDir>('desc');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const highCount      = opportunities.filter(o => o.score >= 70).length;
  const withGps        = opportunities.length;
  const uniqueLocations = new Set(
    opportunities.map(o => o.location_name || `${o.latitude},${o.longitude}`)
  ).size;

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'location_name' ? 'asc' : 'desc');
    }
  }

  function toggleExpand(filename: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(filename) ? next.delete(filename) : next.add(filename);
      return next;
    });
  }

  function sortValue(o: OpportunityOut, key: SortKey): string | number {
    switch (key) {
      case 'images': return o.best_article?.image_count ?? -1;
      case 'score':  return o.score;
      default:       return (o[key] ?? '').toString().toLowerCase();
    }
  }

  const sorted = [...opportunities].sort((a, b) => {
    const av = sortValue(a, sortKey);
    const bv = sortValue(b, sortKey);
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ?  1 : -1;
    return 0;
  });

  function SortTh({ col, label }: { col: SortKey; label: string }) {
    const active = sortKey === col;
    return (
      <th
        className="sortable"
        onClick={() => toggleSort(col)}
        title={`Sort by ${label}`}
      >
        {label}
        <span className="sort-arrow">
          {active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </th>
    );
  }

  if (opportunities.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📸</div>
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
      {/* Stat cards — same summary tiles as the HTML report */}
      <div className="stats">
        <div className="stat-card">
          <div className="value">{totalPhotos}</div>
          <div className="label">Photos Scanned</div>
        </div>
        <div className="stat-card">
          <div className="value">{withGps}</div>
          <div className="label">Opportunities Found</div>
        </div>
        <div className="stat-card">
          <div className="value">{uniqueLocations}</div>
          <div className="label">Unique Locations</div>
        </div>
        <div className="stat-card">
          <div className="value">{highCount}</div>
          <div className="label">Highly Recommended</div>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Thumbnail</th>
              <SortTh col="location_name"  label="Location" />
              <SortTh col="score"          label="Score" />
              <SortTh col="recommendation" label="Recommendation" />
              <th>Wikipedia Article</th>
              <SortTh col="images"         label="Best Article Images" />
              <th>Commons Saturation</th>
              <th>Key Reasons</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(opp => {
              const isExp = expanded.has(opp.filename);
              const reasons = opp.reasons ?? [];
              const color = scoreColor(opp.score);
              return (
                <tr key={opp.filename} className={rowClass(opp.score)}>
                  {/* Thumbnail */}
                  <td>
                    {opp.thumbnail_b64 ? (
                      <img
                        className="thumb"
                        src={`data:image/jpeg;base64,${opp.thumbnail_b64}`}
                        alt={opp.filename}
                        title={opp.filename}
                        loading="lazy"
                      />
                    ) : (
                      <div className="thumb" title={opp.filename} />
                    )}
                  </td>

                  {/* Location */}
                  <td style={{ maxWidth: 280 }}>
                    {opp.location_name || (
                      <span style={{ color: 'var(--color-gray-500)' }}>
                        {opp.latitude.toFixed(4)}, {opp.longitude.toFixed(4)}
                      </span>
                    )}
                  </td>

                  {/* Score */}
                  <td data-value={opp.score}>
                    <span className={`score-bar score-${color}`}>
                      <span className="bar" style={{ width: `${Math.min(opp.score, 100)}px` }} />
                      <span className="num">{opp.score}</span>
                    </span>
                  </td>

                  {/* Recommendation */}
                  <td style={{ whiteSpace: 'nowrap' }}>{opp.recommendation}</td>

                  {/* Wikipedia Article */}
                  <td>
                    {opp.best_article ? (
                      <a
                        href={opp.best_article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {opp.best_article.title}
                      </a>
                    ) : (
                      <span style={{ color: 'var(--color-gray-300)' }}>No article found</span>
                    )}
                  </td>

                  {/* Best Article Images */}
                  <td data-value={opp.best_article?.image_count ?? 0}>
                    {opp.best_article ? opp.best_article.image_count : '—'}
                  </td>

                  {/* Commons Saturation */}
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {opp.commons ? (
                      <>
                        <span className={`badge ${SATURATION_BADGE[opp.commons.saturation] ?? 'badge-yellow'}`}>
                          {opp.commons.saturation}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)', marginLeft: '0.4rem' }}>
                          {opp.commons.nearby_image_count} nearby
                        </span>
                      </>
                    ) : (
                      <span style={{ color: 'var(--color-gray-500)' }}>—</span>
                    )}
                  </td>

                  {/* Key Reasons */}
                  <td style={{ minWidth: 200 }}>
                    {reasons.length === 0 ? (
                      <span style={{ color: 'var(--color-gray-500)' }}>—</span>
                    ) : (
                      <>
                        <ul>
                          {(isExp ? reasons : reasons.slice(0, 2)).map((r, i) => (
                            <li key={i}>{r}</li>
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
  );
}
