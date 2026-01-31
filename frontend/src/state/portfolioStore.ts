import { create } from 'zustand';

interface PortfolioState {
    // Inputs
    risk: number[];
    amount: number;
    horizon: number;
    assets: number;

    // Results
    result: any;
    tableData: any[];
    beta: number | null;
    mcData: any;
    sentiment: any;

    // Actions
    setInputs: (inputs: Partial<{ risk: number[]; amount: number; horizon: number; assets: number }>) => void;
    setResults: (results: Partial<{ result: any; tableData: any[]; beta: number | null; mcData: any; sentiment: any }>) => void;
    reset: () => void;
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
    // Default Inputs
    risk: [0.5],
    amount: 10000,
    horizon: 10,
    assets: 5,

    // Default Results
    result: null,
    tableData: [],
    beta: null,
    mcData: null,
    sentiment: null,

    setInputs: (inputs) => set((state) => ({ ...state, ...inputs })),
    setResults: (results) => set((state) => ({ ...state, ...results })),
    reset: () => set({
        // Reset only results, keep inputs or reset all? 
        // User said "clear the recommendation", usually implies creating a fresh state.
        // We'll reset results but keep default inputs or current inputs?
        // Let's reset results only to allow re-running easily.
        result: null,
        tableData: [],
        beta: null,
        mcData: null,
        sentiment: null
    })
}));
