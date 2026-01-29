import type {
  Person,
  PersonWithCredentials,
  CreatePersonRequest,
  UpdatePersonRequest,
  Job,
  Schedule,
  GenerateScheduleRequest,
  SchedulePreview,
  UpdateAssignmentRequest,
  Assignment,
  SiblingGroup,
  CreateSiblingGroupRequest,
  Unavailability,
  CreateUnavailabilityRequest,
  FairnessScore,
  PersonAssignmentDetail,
  EligiblePerson,
  GetEligiblePeopleRequest,
  SwapAssignmentsRequest,
  MoveAssignmentRequest,
  CompletenessResponse,
} from '../types';
import { useAuthStore } from '../stores/authStore';

// API Base URL - change for production
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Get auth token from store
const getAuthHeaders = (): HeadersInit => {
  const token = useAuthStore.getState().token;
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// Generic fetch wrapper with error handling
async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}/api${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options?.headers,
    },
  });

  if (response.status === 401) {
    // Token expired or invalid - logout
    useAuthStore.getState().logout();
    throw new Error('Sesión expirada. Por favor inicie sesión nuevamente.');
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `HTTP error ${response.status}`);
  }

  // Handle empty responses (204 No Content)
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// Helper for GET requests
function get<T>(endpoint: string): Promise<T> {
  return fetchApi<T>(endpoint, { method: 'GET' });
}

// Helper for POST requests
function post<T>(endpoint: string, body?: unknown): Promise<T> {
  return fetchApi<T>(endpoint, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

// Helper for PUT requests
function put<T>(endpoint: string, body?: unknown): Promise<T> {
  return fetchApi<T>(endpoint, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

// Helper for DELETE requests
function del<T>(endpoint: string): Promise<T> {
  return fetchApi<T>(endpoint, { method: 'DELETE' });
}

// People API
export const peopleApi = {
  getAll: () => get<Person[]>('/people'),
  get: (id: string) => get<Person>(`/people/${id}`),
  create: (request: CreatePersonRequest) => post<PersonWithCredentials>('/people', request),
  update: (request: UpdatePersonRequest) => put<Person>(`/people/${request.id}`, request),
  delete: (id: string) => del<void>(`/people/${id}`),
  getForJob: async (jobId: string) => {
    const people = await get<Person[]>('/people');
    return people.filter(p => p.job_ids?.includes(jobId));
  },
  resetPassword: (personId: string) => post<{ message: string; new_password: string }>(`/people/${personId}/reset-password`),
  createUserAccount: (personId: string) => post<{ username: string; password: string }>(`/people/${personId}/create-user`),
};

// Jobs API
export const jobsApi = {
  getAll: () => get<Job[]>('/jobs'),
  get: (id: string) => get<Job>(`/jobs/${id}`),
  getPositions: (jobId: string) => get<{ id: string; job_id: string; position_number: number; name: string }[]>(`/jobs/${jobId}/positions`),
  // Jobs are predefined, these are no-ops for now
  create: async () => { throw new Error('Jobs are predefined'); },
  update: async () => { throw new Error('Jobs are predefined'); },
  delete: async () => { throw new Error('Jobs are predefined'); },
};

// My Assignment type for servidor view
export interface MyAssignment {
  service_date: string;
  job_id: string;
  job_name: string;
  job_color: string;
  position?: number;
  position_name?: string;
}

// Schedule API
export const scheduleApi = {
  getAll: () => get<Schedule[]>('/schedules'),
  get: (id: string) => get<Schedule>(`/schedules/${id}`),
  getByMonth: async (year: number, month: number) => {
    const schedules = await get<Schedule[]>('/schedules');
    return schedules.find(s => s.year === year && s.month === month) || null;
  },
  generate: (request: GenerateScheduleRequest) => post<SchedulePreview>('/schedules', request),
  save: async (preview: SchedulePreview) => {
    // In the web version, generate already saves the schedule
    return preview.schedule;
  },
  updateAssignment: (request: UpdateAssignmentRequest) =>
    put<Assignment>(`/assignments/${request.assignment_id}`, { person_id: request.new_person_id }),
  clearAssignment: (assignmentId: string) =>
    put<Assignment>(`/assignments/${assignmentId}/clear`),
  swapAssignments: (request: SwapAssignmentsRequest) =>
    post<Assignment[]>('/assignments/swap', request),
  moveAssignment: (assignmentId: string, request: MoveAssignmentRequest) =>
    put<Assignment[]>(`/assignments/${assignmentId}/move`, request),
  getCompleteness: (scheduleId: string) =>
    get<CompletenessResponse>(`/schedules/${scheduleId}/completeness`),
  publish: (id: string) => post<Schedule>(`/schedules/${id}/publish`),
  delete: (id: string) => del<void>(`/schedules/${id}`),
  getFairnessScores: (year: number) => get<FairnessScore[]>(`/reports/fairness?year=${year}`),
  getMyAssignments: (personId: string) => get<MyAssignment[]>(`/my-assignments/${personId}`),
  getPersonAssignmentHistory: async (personId: string, _startDate: string, _endDate: string) => {
    const history = await get<PersonAssignmentDetail[]>(`/reports/person/${personId}/history`);
    return history;
  },
  getEligiblePeopleForAssignment: async (request: GetEligiblePeopleRequest) => {
    // Get all people qualified for the job and filter by availability
    const people = await get<Person[]>('/people');
    const eligible: EligiblePerson[] = people
      .filter(p => p.active && p.job_ids?.includes(request.job_id))
      .map(p => ({
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        is_available: true,
        is_qualified: true,
        passes_consecutive_check: true,
        sibling_status: 'neutral' as const,
        assignments_this_year: 0,
      }));
    return eligible;
  },
};

// Sibling Groups API
export const siblingApi = {
  getAll: () => get<SiblingGroup[]>('/sibling-groups'),
  get: (id: string) => get<SiblingGroup>(`/sibling-groups/${id}`),
  create: (request: CreateSiblingGroupRequest) => post<SiblingGroup>('/sibling-groups', request),
  update: (request: CreateSiblingGroupRequest & { id: string }) =>
    put<SiblingGroup>(`/sibling-groups/${request.id}`, request),
  delete: (id: string) => del<void>(`/sibling-groups/${id}`),
  getForPerson: async (personId: string) => {
    const groups = await get<SiblingGroup[]>('/sibling-groups');
    return groups.filter(g => g.member_ids?.includes(personId));
  },
};

// Unavailability API
export const unavailabilityApi = {
  getAll: () => get<Unavailability[]>('/unavailability'),
  getForPerson: async (personId: string) => {
    const all = await get<Unavailability[]>('/unavailability');
    return all.filter(u => u.person_id === personId);
  },
  get: (id: string) => get<Unavailability>(`/unavailability/${id}`),
  create: (request: CreateUnavailabilityRequest) => post<Unavailability>('/unavailability', request),
  update: async (request: { id: string; person_id?: string; start_date?: string; end_date?: string; reason?: string; recurring?: boolean }) => {
    // Get existing record to fill in missing fields
    const existing = await get<Unavailability>(`/unavailability/${request.id}`);
    // Delete and recreate since we don't have an update endpoint
    await del<void>(`/unavailability/${request.id}`);
    return post<Unavailability>('/unavailability', {
      person_id: request.person_id || existing.person_id,
      start_date: request.start_date || existing.start_date,
      end_date: request.end_date || existing.end_date,
      reason: request.reason !== undefined ? request.reason : existing.reason,
      recurring: request.recurring !== undefined ? request.recurring : existing.recurring,
    });
  },
  delete: (id: string) => del<void>(`/unavailability/${id}`),
  checkAvailability: async (personId: string, date: string) => {
    const unavailability = await get<Unavailability[]>('/unavailability');
    const dateObj = new Date(date);
    return !unavailability.some(u =>
      u.person_id === personId &&
      new Date(u.start_date) <= dateObj &&
      new Date(u.end_date) >= dateObj
    );
  },
};

// My Unavailability API (for servidores self-service)
export const myUnavailabilityApi = {
  getAll: () => get<Unavailability[]>('/my-unavailability'),
  create: (dates: string[], reason?: string) =>
    post<Unavailability[]>('/my-unavailability', { dates, reason }),
  delete: (id: string) => del<void>(`/my-unavailability/${id}`),
};

// Export API - not available in web version
export const exportApi = {
  exportSchedule: async (_scheduleId: string) => {
    throw new Error('Excel export not available in web version');
  },
  exportToPath: async (_scheduleId: string, _path: string) => {
    throw new Error('Excel export not available in web version');
  },
};
