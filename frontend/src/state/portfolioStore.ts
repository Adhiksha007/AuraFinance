import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

export const usePortfolioStore = create<PortfolioState>()(
    persist(
        (set) => ({
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
                result: null,
                tableData: [],
                beta: null,
                mcData: null,
                sentiment: null
            })
        }),
        {
            name: 'portfolio-storage', // unique name
            partialize: (state) => ({
                risk: state.risk,
                amount: state.amount,
                horizon: state.horizon,
                assets: state.assets,
                result: state.result,
                tableData: state.tableData,
                beta: state.beta,
                mcData: state.mcData,
                sentiment: state.sentiment
            }), // explicit whitelist
        }
    )
);
