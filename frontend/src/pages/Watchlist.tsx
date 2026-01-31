import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trash2, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/apiClient';
import { useWatchlistStore } from '../state/watchlistStore';

interface WatchlistItem {
    id: number;
    ticker: string;
    company_name: string;
    added_at: string;
    // Optional fields we might fetch individually later
    price?: number;
    change?: number;
}

export default function Watchlist() {
    const navigate = useNavigate();
    const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchWatchlist();
    }, []);

    const fetchWatchlist = async () => {
        try {
            const response = await apiClient.get('/watchlist/');
            setWatchlist(response.data);

            // Here we could fetch live prices for each ticker
            // But for now, we just display the stored info
        } catch (error) {
            console.error("Failed to fetch watchlist", error);
        } finally {
            setLoading(false);
        }
    };

    const removeFromStore = useWatchlistStore((state) => state.removeFromWatchlist);

    const handleRemove = async (ticker: string) => {
        try {
            await removeFromStore(ticker); // Updates global store & calls API
            setWatchlist(prev => prev.filter(item => item.ticker !== ticker)); // Updates local UI
        } catch (error) {
            console.error("Failed to remove from watchlist", error);
        }
    };

    if (loading) return <div className="p-12 text-center text-muted-foreground">Loading Watchlist...</div>;

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-3xl font-bold text-foreground">Your Watchlist</h1>
                <p className="text-muted-foreground mt-2">Track your favorite stocks.</p>
            </header>

            {watchlist.length === 0 ? (
                <div className="text-center py-20 bg-muted/30 rounded-2xl border border-dashed border-border">
                    <TrendingUp className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground">Watchlist is empty</h3>
                    <p className="text-muted-foreground mt-1">Star tickers in Stock Picks to see them here.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {watchlist.map((item, idx) => (
                        <motion.div
                            key={item.ticker}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ delay: idx * 0.1 }}
                            whileHover={{ y: -5 }}
                            onClick={() => navigate(`/?ticker=${item.ticker}`)}
                            className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow relative group cursor-pointer hover:bg-accent/40"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-bold text-foreground">{item.ticker}</h3>
                                    <p className="text-muted-foreground text-sm">{item.company_name}</p>
                                </div>
                                <div className="p-2 bg-muted rounded-lg">
                                    <TrendingUp className="w-5 h-5 text-muted-foreground" />
                                </div>
                            </div>

                            <div className="border-t border-border pt-4 mt-2 flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">
                                    Added {new Date(item.added_at).toLocaleDateString()}
                                </span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemove(item.ticker);
                                    }}
                                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                                    title="Remove from watchlist"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
