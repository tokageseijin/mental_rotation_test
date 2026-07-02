import { RANK_LABELS_JA, type RankTier } from '../types';
import { nextRank, rankBands, rankProgress, ratingToRank } from '../skill/rating';

const TIER_COLOR: Record<RankTier, string> = {
  Iron: '#8a8f98',
  Bronze: '#a9743e',
  Silver: '#8fa0ad',
  Gold: '#d3a534',
  Platinum: '#4fb0a5',
  Emerald: '#2fa565',
  Diamond: '#4a90d9',
  Master: '#8a5cd1',
  Grandmaster: '#d6455f',
};

export function RankBadge({ rating, compact = false }: { rating: number; compact?: boolean }) {
  const tier = ratingToRank(rating);
  const upcoming = nextRank(tier);
  const progress = rankProgress(rating);

  // Hover legend: all tiers + rating ranges, current tier bolded.
  const tooltip = (
    <div className="rank-tooltip" role="tooltip">
      {rankBands().map((b) => (
        <div key={b.tier} className={`rank-row${b.tier === tier ? ' current' : ''}`}>
          <span aria-hidden className="dot" style={{ background: TIER_COLOR[b.tier] }} />
          <span className="name">{RANK_LABELS_JA[b.tier]}</span>
          <span className="range">
            {b.min}–{b.max}
          </span>
        </div>
      ))}
    </div>
  );

  const badge = (
    <span className="rank-hover">
      <span className="rank-badge">
        <span
          aria-hidden
          style={{ width: 12, height: 12, borderRadius: 3, background: TIER_COLOR[tier] }}
        />
        {RANK_LABELS_JA[tier]}
        <span className="muted" style={{ fontWeight: 500 }}>
          {Math.round(rating)}
        </span>
      </span>
      {tooltip}
    </span>
  );

  if (compact) return badge;

  return (
    <div>
      {badge}
      {upcoming && (
        <div style={{ marginTop: 8, maxWidth: 220 }}>
          <div className="progress" aria-hidden>
            <span style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <div className="muted" style={{ marginTop: 4 }}>
            次: {RANK_LABELS_JA[upcoming]}
          </div>
        </div>
      )}
    </div>
  );
}
