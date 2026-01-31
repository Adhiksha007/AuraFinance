import { create } from 'zustand';

interface NavigationState {
    lastVisitedPath: string;
    setLastVisitedPath: (path: string) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
    lastVisitedPath: '/dashboard', // Default fallback
    setLastVisitedPath: (path) => set({ lastVisitedPath: path }),
}));
