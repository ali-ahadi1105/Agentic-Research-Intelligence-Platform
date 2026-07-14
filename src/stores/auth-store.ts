"use client";

import { create } from "zustand";
import type { User, Organization } from "@/types";
import { api } from "@/lib/api";

interface AuthState {
  user: User | null;
  organization: Organization | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  organization: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,

  initialize: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.auth.me();
      set({
        user: data.user,
        organization: data.organization,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      set({
        user: null,
        organization: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  login: async (email, password) => {
    set({ error: null, isLoading: true });
    try {
      const data = await api.auth.login(email, password);
      set({
        user: data.user,
        organization: data.organization,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "خطا در ورود",
        isLoading: false,
      });
      throw err;
    }
  },

  register: async (email, password, name) => {
    set({ error: null, isLoading: true });
    try {
      const data = await api.auth.register(email, password, name);
      set({
        user: data.user,
        organization: data.organization,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "خطا در ثبت‌نام",
        isLoading: false,
      });
      throw err;
    }
  },

  logout: async () => {
    try {
      await api.auth.logout();
    } catch {
      // ignore
    }
    set({
      user: null,
      organization: null,
      isAuthenticated: false,
    });
  },

  clearError: () => set({ error: null }),
}));
