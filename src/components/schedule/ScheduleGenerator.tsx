import React, { useState } from 'react';
import { Button, Select, Input } from '../common';
import type { GenerateScheduleRequest } from '../../types';

interface ScheduleGeneratorProps {
  onGenerate: (request: GenerateScheduleRequest) => Promise<void>;
  isLoading?: boolean;
}

const months = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

export function ScheduleGenerator({ onGenerate, isLoading }: ScheduleGeneratorProps) {
  const currentDate = new Date();
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [name, setName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onGenerate({
      year,
      month,
      name: name || undefined,
    });
  };

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() + i - 1);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Month"
          value={month.toString()}
          onChange={(e) => setMonth(parseInt(e.target.value))}
          options={months}
        />
        <Select
          label="Year"
          value={year.toString()}
          onChange={(e) => setYear(parseInt(e.target.value))}
          options={years.map((y) => ({ value: y.toString(), label: y.toString() }))}
        />
      </div>

      <Input
        label="Schedule Name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={`${months[month - 1].label} ${year}`}
      />

      <Button type="submit" isLoading={isLoading} className="w-full">
        Generate Schedule
      </Button>
    </form>
  );
}
