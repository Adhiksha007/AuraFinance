import type { SimulationRequest, SimulationResult } from "../types/goal";
import apiClient from "../api/apiClient";
import type { GoalBase } from "../types/goal"; // Added this import based on the change in simulateGoal signature

const GOAL_API_PREFIX = "/goals";

export const GoalService = {
    calculateMonths: (targetDate: string): number => {
        const today = new Date();
        const target = new Date(targetDate);
        const diffTime = Math.abs(target.getTime() - today.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(1, Math.floor(diffDays / 30.44));
    },
    simulateGoal: async (data: GoalBase): Promise<SimulationResult> => {
        const response = await apiClient.post(`${GOAL_API_PREFIX}/simulate`, data);
        return response.data;
    },
};
