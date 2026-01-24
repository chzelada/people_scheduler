import { invoke } from '@tauri-apps/api/core';
import type {
  Person,
  CreatePersonRequest,
  UpdatePersonRequest,
  Job,
  CreateJobRequest,
  UpdateJobRequest,
  Schedule,
  GenerateScheduleRequest,
  SchedulePreview,
  UpdateAssignmentRequest,
  Assignment,
  SiblingGroup,
  CreateSiblingGroupRequest,
  UpdateSiblingGroupRequest,
  Unavailability,
  CreateUnavailabilityRequest,
  UpdateUnavailabilityRequest,
  FairnessScore,
  PersonAssignmentDetail,
  EligiblePerson,
  GetEligiblePeopleRequest,
} from '../types';

// People API
export const peopleApi = {
  getAll: () => invoke<Person[]>('get_all_people'),
  get: (id: string) => invoke<Person>('get_person', { id }),
  create: (request: CreatePersonRequest) => invoke<Person>('create_person', { request }),
  update: (request: UpdatePersonRequest) => invoke<Person>('update_person', { request }),
  delete: (id: string) => invoke<void>('delete_person', { id }),
  getForJob: (jobId: string) => invoke<Person[]>('get_people_for_job', { jobId }),
};

// Jobs API
export const jobsApi = {
  getAll: () => invoke<Job[]>('get_all_jobs'),
  get: (id: string) => invoke<Job>('get_job', { id }),
  create: (request: CreateJobRequest) => invoke<Job>('create_job', { request }),
  update: (request: UpdateJobRequest) => invoke<Job>('update_job', { request }),
  delete: (id: string) => invoke<void>('delete_job', { id }),
};

// Schedule API
export const scheduleApi = {
  getAll: () => invoke<Schedule[]>('get_all_schedules'),
  get: (id: string) => invoke<Schedule>('get_schedule', { id }),
  getByMonth: (year: number, month: number) => invoke<Schedule | null>('get_schedule_by_month', { year, month }),
  generate: (request: GenerateScheduleRequest) => invoke<SchedulePreview>('generate_schedule', { request }),
  save: (preview: SchedulePreview) => invoke<Schedule>('save_schedule', { preview }),
  updateAssignment: (request: UpdateAssignmentRequest) => invoke<Assignment>('update_assignment', { request }),
  publish: (id: string) => invoke<Schedule>('publish_schedule', { id }),
  delete: (id: string) => invoke<void>('delete_schedule', { id }),
  getFairnessScores: (year: number) => invoke<FairnessScore[]>('get_fairness_scores', { year }),
  getPersonAssignmentHistory: (personId: string, startDate: string, endDate: string) =>
    invoke<PersonAssignmentDetail[]>('get_person_assignment_history', { personId, startDate, endDate }),
  getEligiblePeopleForAssignment: (request: GetEligiblePeopleRequest) =>
    invoke<EligiblePerson[]>('get_eligible_people_for_assignment', { request }),
};

// Sibling Groups API
export const siblingApi = {
  getAll: () => invoke<SiblingGroup[]>('get_all_sibling_groups'),
  get: (id: string) => invoke<SiblingGroup>('get_sibling_group', { id }),
  create: (request: CreateSiblingGroupRequest) => invoke<SiblingGroup>('create_sibling_group', { request }),
  update: (request: UpdateSiblingGroupRequest) => invoke<SiblingGroup>('update_sibling_group', { request }),
  delete: (id: string) => invoke<void>('delete_sibling_group', { id }),
  getForPerson: (personId: string) => invoke<SiblingGroup[]>('get_person_sibling_groups', { personId }),
};

// Unavailability API
export const unavailabilityApi = {
  getAll: () => invoke<Unavailability[]>('get_all_unavailability'),
  getForPerson: (personId: string) => invoke<Unavailability[]>('get_person_unavailability', { personId }),
  get: (id: string) => invoke<Unavailability>('get_unavailability', { id }),
  create: (request: CreateUnavailabilityRequest) => invoke<Unavailability>('create_unavailability', { request }),
  update: (request: UpdateUnavailabilityRequest) => invoke<Unavailability>('update_unavailability', { request }),
  delete: (id: string) => invoke<void>('delete_unavailability', { id }),
  checkAvailability: (personId: string, date: string) => invoke<boolean>('check_availability', { personId, date }),
};

// Export API
export const exportApi = {
  exportSchedule: (scheduleId: string) => invoke<string>('export_schedule', { scheduleId }),
  exportToPath: (scheduleId: string, path: string) => invoke<void>('export_schedule_to_path', { scheduleId, path }),
};
