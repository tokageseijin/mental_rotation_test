import { useEffect, useRef, useState } from 'react';
import { RANK_LABELS_JA } from '../types';
import { nextRank, rankProgress, ratingToRank } from '../skill/rating';
import { RankBadge } from './RankBadge';

// Rank + experience bar shown above the sample/animation. The bar is the
// progress toward the next rank; on each answer it animates the change:
//  - gain: the newly filled portion flashes a darker green
//  - loss: the removed portion flashes red as the fill recedes
interface DeltaSeg {
  left: number;
  width: number;
  kind: 'gain' | 'loss';
  key: number;
}

export function RankMeter({ rating }: { rating: number }) {
  const prev = useRef(rating);
  const [seg, setSeg] = useState<DeltaSeg | null>(null);

  useEffect(() => {
    const old = prev.current;
    if (old === rating) return;
    const tierChanged = ratingToRank(old) !== ratingToRank(rating);
    const oldP = rankProgress(old) * 100;
    const newP = rankProgress(rating) * 100;
    let next: DeltaSeg;
    if (tierChanged) {
      // crossing a tier boundary wraps the bar; flash the whole track
      next = { left: 0, width: 100, kind: rating > old ? 'gain' : 'loss', key: Date.now() };
    } else if (rating > old) {
      next = { left: oldP, width: newP - oldP, kind: 'gain', key: Date.now() };
    } else {
      next = { left: newP, width: oldP - newP, kind: 'loss', key: Date.now() };
    }
    setSeg(next);
    prev.current = rating;
  }, [rating]);

  const tier = ratingToRank(rating);
  const upcoming = nextRank(tier);
  const fill = rankProgress(rating) * 100;

  return (
    <div className="xp">
      <div className="xp-head">
        <RankBadge rating={rating} compact />
        {upcoming && <span className="muted">次のランク: {RANK_LABELS_JA[upcoming]}</span>}
      </div>
      <div className="xp-track">
        <div className="xp-fill" style={{ width: `${fill}%` }} />
        {seg && (
          <div
            key={seg.key}
            className={`xp-delta ${seg.kind}`}
            style={{ left: `${seg.left}%`, width: `${seg.width}%` }}
          />
        )}
      </div>
    </div>
  );
}
