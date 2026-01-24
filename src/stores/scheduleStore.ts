import { create } from 'zustand';
import { scheduleApi, exportApi } from '../services/api';
import type {
  Schedule,
  GenerateScheduleRequest,
  SchedulePreview,
  UpdateAssignmentRequest,
  FairnessScore
} from '../types';

interface ScheduleState {
  schedules: Schedule[];
  currentSchedule: Schedule | null;
  preview: SchedulePreview | null;
  fairnessScores: FairnessScore[];
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;

  // Actions
  fetchSchedules: () => Promise<void>;
  fetchSchedule: (id: string) => Promise<void>;
  fetchScheduleByMonth: (year: number, month: number) => Promise<void>;
  generateSchedule: (request: GenerateScheduleRequest) => Promise<SchedulePreview>;
  saveSchedule: () => Promise<Schedule>;
  updateAssignment: (request: UpdateAssignmentRequest) => Promise<void>;
  publishSchedule: (id: string) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  fetchFairnessScores: (year: number) => Promise<void>;
  exportSchedule: (id: string) => Promise<string>;
  setPreview: (preview: SchedulePreview | null) => void;
  clearError: () => void;
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  schedules: [],
  currentSchedule: null,
  preview: null,
  fairnessScores: [],
  isLoading: false,
  isGenerating: false,
  error: null,

  fetchSchedules: async () => {
    set({ isLoading: true, error: null });
    try {
      const schedules = await scheduleApi.getAll();
      set({ schedules, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  fetchSchedule: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const schedule = await scheduleApi.get(id);
      set({ currentSchedule: schedule, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  fetchScheduleByMonth: async (year: number, month: number) => {
    set({ isLoading: true, error: null });
    try {
      const schedule = await scheduleApi.getByMonth(year, month);
      set({ currentSchedule: schedule, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  generateSchedule: async (request: GenerateScheduleRequest) => {
    set({ isGenerating: true, error: null });
    try {
      const preview = await scheduleApi.generate(request);
      set({ preview, isGenerating: false });
      return preview;
    } catch (error) {
      set({ error: String(error), isGenerating: false });
      throw error;
    }
  },

  saveSchedule: async () => {
    const { preview } = get();
    if (!preview) throw new Error('No schedule preview to save');

    set({ isLoading: true, error: null });
    try {
      const schedule = await scheduleApi.save(preview);
      set((state) => ({
        schedules: [...state.schedules.filter(s => s.id !== schedule.id), schedule],
        currentSchedule: schedule,
        preview: null,
        isLoading: false,
      }));
      return schedule;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  updateAssignment: async (request: UpdateAssignmentRequest) => {
    set({ isLoading: true, error: null });
    try {
      const assignment = await scheduleApi.updateAssignment(request);

      // Update the assignment in the current schedule
      set((state) => {
        if (!state.currentSchedule) return { isLoading: false };

        const updatedServiceDates = state.currentSchedule.service_dates.map(sd => ({
          ...sd,
          assignments: sd.assignments.map(a =>
            a.id === assignment.id ? assignment : a
          ),
        }));

        return {
          currentSchedule: {
            ...state.currentSchedule,
            service_dates: updatedServiceDates,
          },
          isLoading: false,
        };
      });
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  publishSchedule: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const schedule = await scheduleApi.publish(id);
      set((state) => ({
        schedules: state.schedules.map(s => s.id === schedule.id ? schedule : s),
        currentSchedule: state.currentSchedule?.id === schedule.id ? schedule : state.currentSchedule,
        isLoading: false,
      }));
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  deleteSchedule: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await scheduleApi.delete(id);
      set((state) => ({
        schedules: state.schedules.filter(s => s.id !== id),
        currentSchedule: state.currentSchedule?.id === id ? null : state.currentSchedule,
        isLoading: false,
      }));
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  fetchFairnessScores: async (year: number) => {
    set({ isLoading: true, error: null });
    try {
      const fairnessScores = await scheduleApi.getFairnessScores(year);
      set({ fairnessScores, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  exportSchedule: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const path = await exportApi.exportSchedule(id);
      set({ isLoading: false });
      return path;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  setPreview: (preview) => set({ preview }),

  clearError: () => set({ error: null }),
}));
