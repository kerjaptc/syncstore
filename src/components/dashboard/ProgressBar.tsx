import { Progress } from '@/components/ui/progress';
import { RefreshCw } from 'lucide-react';

interface ProgressBarProps {
  current: number;
  total: number;
  isActive: boolean;
  className?: string;
}

export function ProgressBar({ current, total, isActive, className = '' }: ProgressBarProps) {
  if (!isActive || total === 0) {
    return null;
  }

  const percentage = Math.round((current / total) * 100);

  return (
    <div className={`bg-white border rounded-lg p-4 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
          <span className="text-sm font-medium">Sync Progress</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {current} of {total} products
        </span>
      </div>
      
      <Progress value={percentage} className="h-2" />
      
      <div className="flex justify-between items-center mt-2">
        <span className="text-xs text-muted-foreground">
          {percentage}% complete
        </span>
        <span className="text-xs text-blue-600 font-medium">
          {total - current} remaining
        </span>
      </div>
    </div>
  );
}