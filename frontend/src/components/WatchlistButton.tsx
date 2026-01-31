import { useState } from 'react';
import { Star } from 'lucide-react';
import { useWatchlistStore } from '../state/watchlistStore';

interface WatchlistButtonProps {
    ticker: string;
    companyName?: string;
    className?: string; // Allow custom styling
    showText?: boolean; // Option to hide text for compact views
}

export default function WatchlistButton({ ticker, companyName, className = '', showText = true }: WatchlistButtonProps) {
    const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlistStore();
    const isWatchlisted = isInWatchlist(ticker);
    const [loading, setLoading] = useState(false);

    const toggleWatchlist = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (loading) return;
        setLoading(true);

        try {
            if (isWatchlisted) {
                await removeFromWatchlist(ticker);
            } else {
                await addToWatchlist(ticker, companyName || ticker);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={toggleWatchlist}
            disabled={loading}
            className={`
                flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors z-20 relative cursor-pointer
                ${isWatchlisted
                    ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50'
                    : 'bg-muted/50 text-muted-foreground hover:bg-accent hover:text-accent-foreground border border-border/50'
                }
                ${className}
            `}
            title={isWatchlisted ? "Remove from Watchlist" : "Add to Watchlist"}
        >
            <Star className={`w-3.5 h-3.5 ${isWatchlisted ? 'fill-red-500 text-red-500' : ''}`} />
            {showText && <span>{isWatchlisted ? 'Remove' : 'Add'}</span>}
        </button>
    );
}
