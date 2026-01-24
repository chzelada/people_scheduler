import { create } from 'zustand';
import { jobsApi } from '../services/api';
import type { Job, CreateJobRequest, UpdateJobRequest } from '../types';

interface JobsState {
  jobs: Job[];
  selectedJob: Job | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchJobs: () => Promise<void>;
  fetchJob: (id: string) => Promise<void>;
  createJob: (request: CreateJobRequest) => Promise<Job>;
  updateJob: (request: UpdateJobRequest) => Promise<Job>;
  deleteJob: (id: string) => Promise<void>;
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

  createJob: async (request: CreateJobRequest) => {
    set({ isLoading: true, error: null });
    try {
      const job = await jobsApi.create(request);
      set((state) => ({
        jobs: [...state.jobs, job],
        isLoading: false,
      }));
      return job;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  updateJob: async (request: UpdateJobRequest) => {
    set({ isLoading: true, error: null });
    try {
      const job = await jobsApi.update(request);
      set((state) => ({
        jobs: state.jobs.map((j) => (j.id === job.id ? job : j)),
        selectedJob: state.selectedJob?.id === job.id ? job : state.selectedJob,
        isLoading: false,
      }));
      return job;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  deleteJob: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await jobsApi.delete(id);
      set((state) => ({
        jobs: state.jobs.filter((j) => j.id !== id),
        selectedJob: state.selectedJob?.id === id ? null : state.selectedJob,
        isLoading: false,
      }));
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  setSelectedJob: (job) => set({ selectedJob: job }),

  clearError: () => set({ error: null }),
}));
