import { create } from 'zustand';
import { jobsApi } from '../services/api';
import type { Job } from '../types';

interface JobsState {
  jobs: Job[];
  selectedJob: Job | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchJobs: () => Promise<void>;
  fetchJob: (id: string) => Promise<void>;
  setSelectedJob: (job: Job | null) => void;
  clearError: () => void;
}

export const useJobsStore = create<JobsState>((set) => ({
  jobs: [],
  selectedJob: null,
  isLoading: false,
  error: null,

  fetchJobs: async () => {
    set({ isLoading: true, error: null });
    try {
      const jobs = await jobsApi.getAll();
      set({ jobs, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  fetchJob: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const job = await jobsApi.get(id);
      set({ selectedJob: job, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  setSelectedJob: (job) => set({ selectedJob: job }),

  clearError: () => set({ error: null }),
}));
