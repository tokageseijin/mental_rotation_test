import { RANK_LABELS_JA, type RankTier } from '../types';
import { nextRank, rankProgress, ratingToRank } from '../skill/rating';

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
  const badge = (
    <div className="rank-badge">
      <span aria-hidden style={{ width: 12, height: 12, borderRadius: 3, background: TIER_COLOR[tier] }} />
      {RANK_LABELS_JA[tier]}
      <span className="muted" style={{ fontWeight: 500 }}>
        {Math.round(rating)}
      </span>
    </div>
  );

  // Compact = just the pill, for overlaying on the sample image.
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
