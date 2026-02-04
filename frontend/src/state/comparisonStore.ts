import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PortfolioMetrics {
    selected_assets: string[];
    weights: Record<string, number>;
    expected_return: number;
    volatility: number;
    sharpe_ratio: number;
    portfolio_beta: number;
    var: number;
}

interface ComparisonResponse {
    quantum: PortfolioMetrics;
    classical: PortfolioMetrics;
}

interface ComparisonState {
    // Inputs
    riskTolerance: number;
    investmentAmount: number;
    timeHorizon: number;
    numAssets: number;

    // Results
    comparison: ComparisonResponse | null;

    // Actions
    setInputs: (inputs: Partial<{
        riskTolerance: number;
        investmentAmount: number;
        timeHorizon: number;
        numAssets: number;
    }>) => void;
    setComparison: (comparison: ComparisonResponse) => void;
    reset: () => void;
}

export const useComparisonStore = create<ComparisonState>()(
    persist(
        (set) => ({
            // Default Inputs
            riskTolerance: 50,
            investmentAmount: 10000,
            timeHorizon: 5,
            numAssets: 4,

            // Default Results
            comparison: null,

            setInputs: (inputs) => set((state) => ({ ...state, ...inputs })),
            setComparison: (comparison) => set({ comparison }),
            reset: () => set({
                comparison: null
            })
        }),
        {
            name: 'comparison-storage',
            storage: {
                getItem: (name) => {
                    const str = sessionStorage.getItem(name);
                    return str ? JSON.parse(str) : null;
                },
                setItem: (name, value) => {
                    sessionStorage.setItem(name, JSON.stringify(value));
                },
                removeItem: (name) => sessionStorage.removeItem(name),
            },
            partialize: (state) => ({
                riskTolerance: state.riskTolerance,
                investmentAmount: state.investmentAmount,
                timeHorizon: state.timeHorizon,
                numAssets: state.numAssets,
                comparison: state.comparison
            }) as unknown as ComparisonState,
        }
    )
);
