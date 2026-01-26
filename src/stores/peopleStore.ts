import { create } from 'zustand';
import { peopleApi } from '../services/api';
import type { Person, PersonWithCredentials, CreatePersonRequest, UpdatePersonRequest } from '../types';

interface PeopleState {
  people: Person[];
  selectedPerson: Person | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchPeople: () => Promise<void>;
  fetchPerson: (id: string) => Promise<void>;
  createPerson: (request: CreatePersonRequest) => Promise<PersonWithCredentials>;
  updatePerson: (request: UpdatePersonRequest) => Promise<Person>;
  deletePerson: (id: string) => Promise<void>;
  resetPassword: (personId: string) => Promise<string>;
  createUserAccount: (personId: string) => Promise<{ username: string; password: string }>;
  setSelectedPerson: (person: Person | null) => void;
  clearError: () => void;
}

export const usePeopleStore = create<PeopleState>((set, get) => ({
  people: [],
  selectedPerson: null,
  isLoading: false,
  error: null,

  fetchPeople: async () => {
    set({ isLoading: true, error: null });
    try {
      const people = await peopleApi.getAll();
      set({ people, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  fetchPerson: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const person = await peopleApi.get(id);
      set({ selectedPerson: person, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  createPerson: async (request: CreatePersonRequest) => {
    set({ isLoading: true, error: null });
    try {
      const person = await peopleApi.create(request);
      set((state) => ({
        people: [...state.people, person],
        isLoading: false,
      }));
      return person;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  updatePerson: async (request: UpdatePersonRequest) => {
    set({ isLoading: true, error: null });
    try {
      const person = await peopleApi.update(request);
      set((state) => ({
        people: state.people.map((p) => (p.id === person.id ? person : p)),
        selectedPerson: state.selectedPerson?.id === person.id ? person : state.selectedPerson,
        isLoading: false,
      }));
      return person;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  deletePerson: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await peopleApi.delete(id);
      set((state) => ({
        people: state.people.filter((p) => p.id !== id),
        selectedPerson: state.selectedPerson?.id === id ? null : state.selectedPerson,
        isLoading: false,
      }));
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  resetPassword: async (personId: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await peopleApi.resetPassword(personId);
      set({ isLoading: false });
      return result.new_password;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  createUserAccount: async (personId: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await peopleApi.createUserAccount(personId);
      // Update the person in the list to include the new username
      set((state) => ({
        people: state.people.map((p) =>
          p.id === personId ? { ...p, username: result.username } : p
        ),
        isLoading: false,
      }));
      return result;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  setSelectedPerson: (person) => set({ selectedPerson: person }),

  clearError: () => set({ error: null }),
}));
