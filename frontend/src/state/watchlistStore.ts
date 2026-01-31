import { create } from 'zustand';
import apiClient from '../api/apiClient';

interface WatchlistState {
    watchlistSet: Set<string>;
    loading: boolean;
    error: string | null;
    fetchWatchlist: () => Promise<void>;
    addToWatchlist: (ticker: string, company_name?: string) => Promise<void>;
    removeFromWatchlist: (ticker: string) => Promise<void>;
    isInWatchlist: (ticker: string) => boolean;
}

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
    watchlistSet: new Set(),
    loading: false,
    error: null,

    fetchWatchlist: async () => {
        set({ loading: true, error: null });
        try {
            const response = await apiClient.get('/watchlist/');
            const tickers = new Set<string>(response.data.map((item: any) => item.ticker));
            set({ watchlistSet: tickers, loading: false });
        } catch (error) {
            set({ error: 'Failed to fetch watchlist', loading: false });
        }
    },

    addToWatchlist: async (ticker: string, company_name?: string) => {
        // Optimistic update
        const currentSet = new Set(get().watchlistSet);
        currentSet.add(ticker);
        set({ watchlistSet: currentSet });

        try {
            await apiClient.post('/watchlist/', { ticker, company_name: company_name || ticker });
        } catch (error: any) {
            // Revert on error
            const revertedSet = new Set(get().watchlistSet);
            revertedSet.delete(ticker);
            set({ watchlistSet: revertedSet, error: 'Failed to add to watchlist' });
            console.error(error);
            throw error;
        }
    },

    removeFromWatchlist: async (ticker: string) => {
        // Optimistic update
        const currentSet = new Set(get().watchlistSet);
        currentSet.delete(ticker);
        set({ watchlistSet: currentSet });

        try {
            await apiClient.delete(`/watchlist/${ticker}`);
        } catch (error: any) {
            // Revert on error
            const revertedSet = new Set(get().watchlistSet);
            revertedSet.add(ticker);
            set({ watchlistSet: revertedSet, error: 'Failed to remove from watchlist' });
            console.error(error);
            throw error;
        }
    },

    isInWatchlist: (ticker: string) => {
        return get().watchlistSet.has(ticker);
    }
}));
