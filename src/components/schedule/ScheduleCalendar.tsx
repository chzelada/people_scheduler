import React from 'react';
import { format, parseISO } from 'date-fns';
import type { Schedule, Job } from '../../types';

interface ScheduleCalendarProps {
  schedule: Schedule;
  jobs: Job[];
  onAssignmentClick?: (assignmentId: string, serviceDateId: string) => void;
}

export function ScheduleCalendar({ schedule, jobs, onAssignmentClick }: ScheduleCalendarProps) {
  const getJobColor = (jobId: string) => {
    return jobs.find((j) => j.id === jobId)?.color || '#6B7280';
  };

  return (
    <div className="space-y-6">
      {schedule.service_dates.map((serviceDate) => {
        const date = parseISO(serviceDate.service_date);

        // Group assignments by job
        const assignmentsByJob: Record<string, typeof serviceDate.assignments> = {};
        serviceDate.assignments.forEach((assignment) => {
          if (!assignmentsByJob[assignment.job_id]) {
            assignmentsByJob[assignment.job_id] = [];
          }
          assignmentsByJob[assignment.job_id].push(assignment);
        });

        return (
          <div key={serviceDate.id} className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {format(date, 'EEEE, MMMM d, yyyy')}
              </h3>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(assignmentsByJob).map(([jobId, assignments]) => {
                  const job = jobs.find((j) => j.id === jobId);
                  const jobColor = getJobColor(jobId);

                  return (
                    <div key={jobId} className="border rounded-lg overflow-hidden">
                      <div
                        className="px-3 py-2 text-white font-medium"
                        style={{ backgroundColor: jobColor }}
                      >
                        {job?.name || jobId}
                      </div>
                      <ul className="divide-y divide-gray-100">
                        {assignments
                          .sort((a, b) => a.position - b.position)
                          .map((assignment) => (
                            <li
                              key={assignment.id}
                              onClick={() => onAssignmentClick?.(assignment.id, serviceDate.id)}
                              className={`px-3 py-2 flex items-center justify-between ${
                                onAssignmentClick ? 'cursor-pointer hover:bg-gray-50' : ''
                              }`}
                            >
                              <span className="text-sm text-gray-900">
                                {assignment.person_name || assignment.person_id}
                              </span>
                              {assignment.manual_override && (
                                <span className="text-xs text-orange-500">(manual)</span>
                              )}
                            </li>
                          ))}
                      </ul>
                    </div>
                  );
                })}
              </div>

              {serviceDate.notes && (
                <div className="mt-4 text-sm text-gray-500">
                  <strong>Notes:</strong> {serviceDate.notes}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
