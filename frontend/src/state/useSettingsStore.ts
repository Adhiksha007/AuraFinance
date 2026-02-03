import { create } from 'zustand';
import apiClient from '../api/apiClient';

export const RiskLevel = {
    CONSERVATIVE: "Conservative",
    MODERATE: "Moderate",
    AGGRESSIVE: "Aggressive"
} as const;

export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];

export const ComplexityLevel = {
    BEGINNER: "Beginner",
    EXPERT: "Expert"
} as const;

export type ComplexityLevel = (typeof ComplexityLevel)[keyof typeof ComplexityLevel];

export interface UserSettings {
    id: number;
    user_id: number;
    risk_level: RiskLevel;
    risk_score: number;
    theme: string;
    notifications_enabled: boolean;
    complexity_level: ComplexityLevel;
}

interface SettingsState {
    settings: UserSettings | null;
    loading: boolean;
    error: string | null;

    fetchSettings: () => Promise<void>;
    updateSettings: (updates: Partial<UserSettings>) => Promise<void>;
    calculateRiskLevel: (score: number) => RiskLevel;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
    settings: null,
    loading: false,
    error: null,

    fetchSettings: async () => {
        set({ loading: true, error: null });
        try {
            const response = await apiClient.get('/settings/');
            set({ settings: response.data, loading: false });
            if (response.data.theme) {
                localStorage.setItem('app_theme', response.data.theme);
            }
        } catch (error) {
            console.error('Failed to fetch settings:', error);
            set({ error: 'Failed to load settings', loading: false });
        }
    },

    updateSettings: async (updates) => {
        // Optimistic update
        const previousSettings = get().settings;
        if (!previousSettings) return;

        set({ settings: { ...previousSettings, ...updates } });

        try {
            const response = await apiClient.patch('/settings/', updates);
            set({ settings: response.data });
            if (updates.theme) {
                localStorage.setItem('app_theme', updates.theme);
            }
        } catch (error) {
            console.error('Failed to update settings:', error);
            set({ settings: previousSettings, error: 'Failed to update settings' });
        }
    },

    calculateRiskLevel: (score: number) => {
        if (score < 40) return RiskLevel.CONSERVATIVE;
        if (score < 70) return RiskLevel.MODERATE;
        return RiskLevel.AGGRESSIVE;
    }
}));
