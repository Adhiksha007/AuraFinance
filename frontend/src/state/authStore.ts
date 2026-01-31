import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '../api/apiClient';

export interface User {
    id: number;
    email: string;
    username: string;
    full_name?: string;
    phone_number?: string;
    profile_image?: string;
    is_active: boolean;
    is_superuser: boolean;
    is_2fa_enabled: boolean;
    is_phone_verified: boolean;
    is_email_verified: boolean;
}

interface AuthState {
    token: string | null;
    user: User | null;
    setAuth: (token: string, user: any) => void;
    logout: () => void;
    fetchUser: () => Promise<void>;
    updateUser: (updates: Partial<User>) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            token: null,
            user: null,
            setAuth: (token, user) => set({ token, user }),
            logout: () => set({ token: null, user: null }),

            fetchUser: async () => {
                try {
                    const response = await apiClient.get('/users/me');
                    set({ user: response.data });
                } catch (error) {
                    console.error('Failed to fetch user profile:', error);
                }
            },

            updateUser: async (updates) => {
                try {
                    // Optimistic update
                    const currentUser = get().user;
                    if (currentUser) {
                        set({ user: { ...currentUser, ...updates } });
                    }

                    const response = await apiClient.patch('/users/me', updates);
                    set({ user: response.data });
                } catch (error) {
                    console.error('Failed to update user profile:', error);
                    // Revert or show error could go here
                }
            }
        }),
        {
            name: 'auth-storage',
        }
    )
);
