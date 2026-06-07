import { cn, scoreColor, scoreBg } from '@/lib/utils';

interface ScoreCardProps {
  label: string;
  score: number;
  explanation?: string;
  className?: string;
}

export function ScoreCard({ label, score, explanation, className }: ScoreCardProps) {
  const isLow = score < 40;
  return (
    <div className={cn('bg-card border border-border rounded-xl p-4', className)}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className={cn('text-2xl font-bold', scoreColor(score))}>{score}</span>
      </div>
      <div className="w-full bg-secondary rounded-full h-2 mb-3">
        <div
          className={cn('h-2 rounded-full transition-all', scoreBg(score))}
          style={{ width: `${score}%` }}
        />
      </div>
      {isLow && (
        <p className="text-xs text-amber-400 mb-2">
          💡 Low scores highlight areas for improvement, not failure.
        </p>
      )}
      {explanation && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{explanation}</p>
      )}
    </div>
  );
}
