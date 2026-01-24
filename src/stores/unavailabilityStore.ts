import { create } from 'zustand';
import { unavailabilityApi } from '../services/api';
import type { Unavailability, CreateUnavailabilityRequest, UpdateUnavailabilityRequest } from '../types';

interface UnavailabilityState {
  unavailability: Unavailability[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchAll: () => Promise<void>;
  fetchForPerson: (personId: string) => Promise<Unavailability[]>;
  create: (request: CreateUnavailabilityRequest) => Promise<Unavailability>;
  update: (request: UpdateUnavailabilityRequest) => Promise<Unavailability>;
  delete: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useUnavailabilityStore = create<UnavailabilityState>((set) => ({
  unavailability: [],
  isLoading: false,
  error: null,

  fetchAll: async () => {
    set({ isLoading: true, error: null });
    try {
      const unavailability = await unavailabilityApi.getAll();
      set({ unavailability, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  fetchForPerson: async (personId: string) => {
    set({ isLoading: true, error: null });
    try {
      const unavailability = await unavailabilityApi.getForPerson(personId);
      set({ isLoading: false });
      return unavailability;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  create: async (request: CreateUnavailabilityRequest) => {
    set({ isLoading: true, error: null });
    try {
      const record = await unavailabilityApi.create(request);
      set((state) => ({
        unavailability: [...state.unavailability, record],
        isLoading: false,
      }));
      return record;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  update: async (request: UpdateUnavailabilityRequest) => {
    set({ isLoading: true, error: null });
    try {
      const record = await unavailabilityApi.update(request);
      set((state) => ({
        unavailability: state.unavailability.map((u) => (u.id === record.id ? record : u)),
        isLoading: false,
      }));
      return record;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  delete: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await unavailabilityApi.delete(id);
      set((state) => ({
        unavailability: state.unavailability.filter((u) => u.id !== id),
        isLoading: false,
      }));
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
