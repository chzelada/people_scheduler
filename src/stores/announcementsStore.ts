import { create } from 'zustand';
import type { Announcement, CreateAnnouncementRequest, UpdateAnnouncementRequest } from '../types';
import { announcementsApi } from '../services/api';

interface AnnouncementsState {
  announcements: Announcement[];
  activeAnnouncements: Announcement[];
  isLoading: boolean;
  error: string | null;
  fetchAll: () => Promise<void>;
  fetchActive: () => Promise<void>;
  createAnnouncement: (request: CreateAnnouncementRequest) => Promise<Announcement>;
  updateAnnouncement: (id: string, request: UpdateAnnouncementRequest) => Promise<Announcement>;
  deleteAnnouncement: (id: string) => Promise<void>;
}

export const useAnnouncementsStore = create<AnnouncementsState>((set, get) => ({
  announcements: [],
  activeAnnouncements: [],
  isLoading: false,
  error: null,

  fetchAll: async () => {
    set({ isLoading: true, error: null });
    try {
      const announcements = await announcementsApi.getAll();
      set({ announcements, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  fetchActive: async () => {
    set({ isLoading: true, error: null });
    try {
      const activeAnnouncements = await announcementsApi.getActive();
      set({ activeAnnouncements, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  createAnnouncement: async (request: CreateAnnouncementRequest) => {
    const announcement = await announcementsApi.create(request);
    await get().fetchAll();
    return announcement;
  },

  updateAnnouncement: async (id: string, request: UpdateAnnouncementRequest) => {
    const announcement = await announcementsApi.update(id, request);
    await get().fetchAll();
    return announcement;
  },

  deleteAnnouncement: async (id: string) => {
    await announcementsApi.delete(id);
    await get().fetchAll();
  },
}));
