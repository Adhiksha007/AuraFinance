export interface GoalBase {
    name: string;
    target_amount: number;
    target_date: string; // YYYY-MM-DD
    current_savings: number;
    monthly_contribution: number;
    risk_profile?: string;
}

export interface SimulationRequest extends GoalBase { }

export interface YearlyProjection {
    year: number;
    amount: number;
    contribution: number;
    growth: number;
}

export interface ScenarioProjections {
    median: YearlyProjection[];
    worst: YearlyProjection[];
    best: YearlyProjection[];
}

export interface ETFDetail {
    ticker: string;
    name: string;
    percent: number;
    desc: string;
}

export interface SimulationResult {
    success_probability: number;
    gap_amount: number;
    projected_amount_at_deadline: number;
    recommended_allocation: { [key: string]: number };
    etf_suggestions: { [key: string]: ETFDetail };
    yearly_projections: YearlyProjection[];
    scenarios: ScenarioProjections;
    on_track: boolean;
    suggestions: { [key: string]: number };
}
