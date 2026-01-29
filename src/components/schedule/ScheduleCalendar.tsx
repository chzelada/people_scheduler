import React from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { DroppableSlot } from './DroppableSlot';
import type { Schedule, Job, Assignment } from '../../types';

interface ScheduleCalendarProps {
  schedule: Schedule;
  jobs: Job[];
  editable?: boolean;
  onEditAssignment?: (assignment: Assignment, serviceDate: string) => void;
  onSwapAssignments?: (assignmentId1: string, assignmentId2: string) => Promise<void>;
  onMoveAssignment?: (assignmentId: string, targetServiceDateId: string, targetJobId: string, targetPosition: number) => Promise<void>;
  onClearAssignment?: (assignmentId: string) => Promise<void>;
}

export function ScheduleCalendar({
  schedule,
  jobs,
  editable = false,
  onEditAssignment,
  onSwapAssignments,
  onMoveAssignment,
  onClearAssignment,
}: ScheduleCalendarProps) {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [activeAssignment, setActiveAssignment] = React.useState<Assignment | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const getJobColor = (jobId: string) => {
    return jobs.find((j) => j.id === jobId)?.color || '#6B7280';
  };

  // Build a map of all assignments by slot ID for quick lookup
  const assignmentsBySlot = React.useMemo(() => {
    const map = new Map<string, Assignment>();
    schedule.service_dates.forEach((sd) => {
      sd.assignments.forEach((assignment) => {
        const slotId = `${assignment.service_date_id}:${assignment.job_id}:${assignment.position}`;
        map.set(slotId, assignment);
      });
    });
    return map;
  }, [schedule]);

  // Find assignment by ID
  const findAssignmentById = React.useCallback((id: string): Assignment | null => {
    for (const sd of schedule.service_dates) {
      const found = sd.assignments.find((a) => a.id === id);
      if (found) return found;
    }
    return null;
  }, [schedule]);

  // Parse slot ID
  const parseSlotId = (slotId: string) => {
    const parts = slotId.split(':');
    return {
      service_date_id: parts[0],
      job_id: parts[1],
      position: parseInt(parts[2], 10),
    };
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    const assignment = findAssignmentById(active.id as string);
    setActiveAssignment(assignment);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveAssignment(null);

    console.log('DragEnd - active:', active.id, 'over:', over?.id);

    if (!over || active.id === over.id) {
      console.log('DragEnd - early return: no over or same id');
      return;
    }

    const sourceAssignment = findAssignmentById(active.id as string);
    if (!sourceAssignment || !sourceAssignment.person_id) {
      console.log('DragEnd - early return: no source or empty source');
      return;
    }

    const overId = over.id as string;

    // Check if over.id is a slot ID (contains colons) or an assignment ID
    // Slot ID format: "service_date_id:job_id:position"
    let targetAssignment: Assignment | null = null;

    if (overId.includes(':')) {
      // It's a slot ID - look up by slot
      targetAssignment = assignmentsBySlot.get(overId) || null;
      console.log('DragEnd - slot lookup:', overId, targetAssignment?.person_name);
    } else {
      // It's an assignment ID - find it directly
      targetAssignment = findAssignmentById(overId);
      console.log('DragEnd - assignment lookup:', overId, targetAssignment?.person_name);
    }

    if (targetAssignment && sourceAssignment.id !== targetAssignment.id) {
      if (targetAssignment.person_id) {
        // Both have people - swap
        console.log('DragEnd - SWAP:', sourceAssignment.person_name, '<->', targetAssignment.person_name);
        if (onSwapAssignments) {
          await onSwapAssignments(sourceAssignment.id, targetAssignment.id);
        }
      } else {
        // Target is empty - move
        console.log('DragEnd - MOVE:', sourceAssignment.person_name, '->', targetAssignment.position_name);
        if (onMoveAssignment) {
          await onMoveAssignment(
            sourceAssignment.id,
            targetAssignment.service_date_id,
            targetAssignment.job_id,
            targetAssignment.position
          );
        }
      }
    } else {
      console.log('DragEnd - no target or same assignment');
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setActiveAssignment(null);
  };

  const handleClear = async (assignment: Assignment) => {
    if (onClearAssignment) {
      await onClearAssignment(assignment.id);
    }
  };

  const handleEdit = (assignment: Assignment, serviceDate: string) => {
    if (onEditAssignment) {
      onEditAssignment(assignment, serviceDate);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
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
                  {format(date, "EEEE d 'de' MMMM, yyyy", { locale: es })}
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
                            .map((assignment) => {
                              const slotId = `${assignment.service_date_id}:${assignment.job_id}:${assignment.position}`;
                              return (
                                <li key={assignment.id}>
                                  <DroppableSlot
                                    slotId={slotId}
                                    assignment={assignment}
                                    editable={editable}
                                    onEdit={(a) => handleEdit(a, serviceDate.service_date)}
                                    onClear={handleClear}
                                  />
                                </li>
                              );
                            })}
                        </ul>
                      </div>
                    );
                  })}
                </div>

                {serviceDate.notes && (
                  <div className="mt-4 text-sm text-gray-500">
                    <strong>Notas:</strong> {serviceDate.notes}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <DragOverlay>
        {activeAssignment && activeAssignment.person_id && (
          <div className="bg-white shadow-lg rounded-lg px-3 py-2 border-2 border-primary-500">
            <div className="flex flex-col">
              {activeAssignment.position_name && (
                <span className="text-xs font-medium text-gray-500">
                  {activeAssignment.position_name}
                </span>
              )}
              <span className="text-sm text-gray-900 font-medium">
                {activeAssignment.person_name}
              </span>
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
