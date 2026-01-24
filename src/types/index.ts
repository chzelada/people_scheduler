// Person types
export interface Person {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  preferred_frequency: PreferredFrequency;
  max_consecutive_weeks: number;
  preference_level: number;
  active: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  job_ids: string[];
}

export type PreferredFrequency = 'weekly' | 'bimonthly' | 'monthly';

export interface CreatePersonRequest {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  preferred_frequency?: PreferredFrequency;
  max_consecutive_weeks?: number;
  preference_level?: number;
  notes?: string;
  job_ids: string[];
}

export interface UpdatePersonRequest {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  preferred_frequency?: PreferredFrequency;
  max_consecutive_weeks?: number;
  preference_level?: number;
  active?: boolean;
  notes?: string;
  job_ids?: string[];
}

// Job types
export interface Job {
  id: string;
  name: string;
  description?: string;
  people_required: number;
  color: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateJobRequest {
  name: string;
  description?: string;
  people_required?: number;
  color?: string;
}

export interface UpdateJobRequest {
  id: string;
  name?: string;
  description?: string;
  people_required?: number;
  color?: string;
  active?: boolean;
}

// Schedule types
export type ScheduleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface Schedule {
  id: string;
  name: string;
  year: number;
  month: number;
  status: ScheduleStatus;
  created_at?: string;
  updated_at?: string;
  published_at?: string;
  service_dates: ServiceDate[];
}

export interface ServiceDate {
  id: string;
  schedule_id: string;
  service_date: string;
  notes?: string;
  created_at?: string;
  assignments: Assignment[];
}

export interface Assignment {
  id: string;
  service_date_id: string;
  job_id: string;
  person_id: string;
  position: number;
  manual_override: boolean;
  created_at?: string;
  updated_at?: string;
  person_name?: string;
  job_name?: string;
}

export interface GenerateScheduleRequest {
  year: number;
  month: number;
  name?: string;
}

export interface UpdateAssignmentRequest {
  assignment_id: string;
  new_person_id: string;
}

export interface SchedulePreview {
  schedule: Schedule;
  conflicts: ScheduleConflict[];
  fairness_scores: FairnessScore[];
}

export type ConflictType = 'insufficient_people' | 'sibling_violation' | 'consecutive_weeks_exceeded' | 'unavailable_person';

export interface ScheduleConflict {
  service_date: string;
  job_id: string;
  conflict_type: ConflictType;
  message: string;
  affected_person_ids: string[];
}

export interface JobAssignmentCount {
  job_id: string;
  job_name: string;
  count: number;
}

export interface FairnessScore {
  person_id: string;
  person_name: string;
  total_assignments: number;
  assignments_this_year: number;
  assignments_by_job: JobAssignmentCount[];
  last_assignment_date?: string;
  fairness_score: number;
}

// Sibling group types
export type PairingRule = 'TOGETHER' | 'SEPARATE';

export interface SiblingGroup {
  id: string;
  name: string;
  pairing_rule: PairingRule;
  created_at?: string;
  updated_at?: string;
  member_ids: string[];
}

export interface CreateSiblingGroupRequest {
  name: string;
  pairing_rule: PairingRule;
  member_ids: string[];
}

export interface UpdateSiblingGroupRequest {
  id: string;
  name?: string;
  pairing_rule?: PairingRule;
  member_ids?: string[];
}

// Unavailability types
export interface Unavailability {
  id: string;
  person_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
  recurring: boolean;
  created_at?: string;
  person_name?: string;
}

export interface CreateUnavailabilityRequest {
  person_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
  recurring?: boolean;
}

export interface UpdateUnavailabilityRequest {
  id: string;
  start_date?: string;
  end_date?: string;
  reason?: string;
  recurring?: boolean;
}
