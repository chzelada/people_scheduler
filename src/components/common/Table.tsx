import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Search, X } from 'lucide-react';

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
  filterable?: boolean;
  getValue?: (item: T) => string | number | boolean | null | undefined;
}

type SortDirection = 'asc' | 'desc' | null;

interface SortState {
  key: string;
  direction: SortDirection;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  enableSorting?: boolean;
  enableFiltering?: boolean;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = 'No data available',
  enableSorting = false,
  enableFiltering = false,
}: TableProps<T>) {
  const [sort, setSort] = useState<SortState | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const handleSort = (column: Column<T>) => {
    if (!enableSorting || column.sortable === false) return;

    setSort((current) => {
      if (current?.key !== column.key) {
        return { key: column.key, direction: 'asc' };
      }
      if (current.direction === 'asc') {
        return { key: column.key, direction: 'desc' };
      }
      return null;
    });
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const clearFilter = (key: string) => {
    setFilters((current) => {
      const newFilters = { ...current };
      delete newFilters[key];
      return newFilters;
    });
    setActiveFilter(null);
  };

  const getItemValue = (item: T, column: Column<T>): string => {
    if (column.getValue) {
      const val = column.getValue(item);
      return val != null ? String(val) : '';
    }
    const val = (item as Record<string, unknown>)[column.key];
    return val != null ? String(val) : '';
  };

  const processedData = useMemo(() => {
    let result = [...data];

    // Apply filters
    if (enableFiltering) {
      Object.entries(filters).forEach(([key, filterValue]) => {
        if (filterValue) {
          const column = columns.find((c) => c.key === key);
          if (column && column.filterable !== false) {
            result = result.filter((item) => {
              const itemValue = getItemValue(item, column).toLowerCase();
              return itemValue.includes(filterValue.toLowerCase());
            });
          }
        }
      });
    }

    // Apply sorting
    if (enableSorting && sort) {
      const column = columns.find((c) => c.key === sort.key);
      if (column) {
        result.sort((a, b) => {
          const aVal = getItemValue(a, column);
          const bVal = getItemValue(b, column);

          // Check for ISO date format (yyyy-MM-dd)
          const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (isoDateRegex.test(aVal) && isoDateRegex.test(bVal)) {
            const comparison = aVal.localeCompare(bVal);
            return sort.direction === 'asc' ? comparison : -comparison;
          }

          // Try numeric comparison (only for pure numbers)
          const aNum = parseFloat(aVal);
          const bNum = parseFloat(bVal);
          if (!isNaN(aNum) && !isNaN(bNum) && String(aNum) === aVal && String(bNum) === bVal) {
            return sort.direction === 'asc' ? aNum - bNum : bNum - aNum;
          }

          // String comparison
          const comparison = aVal.localeCompare(bVal, 'es', { sensitivity: 'base' });
          return sort.direction === 'asc' ? comparison : -comparison;
        });
      }
    }

    return result;
  }, [data, filters, sort, columns, enableFiltering, enableSorting]);

  const hasActiveFilters = Object.values(filters).some((v) => v);

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => {
              const isSortable = enableSorting && column.sortable !== false && column.header;
              const isFilterable = enableFiltering && column.filterable !== false && column.header;
              const isSorted = sort?.key === column.key;
              const hasFilter = filters[column.key];

              return (
                <th
                  key={column.key}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.className || ''}`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      {isSortable ? (
                        <button
                          onClick={() => handleSort(column)}
                          className="flex items-center gap-1 hover:text-gray-700 transition-colors group"
                        >
                          <span>{column.header}</span>
                          <span className="flex flex-col">
                            <ChevronUp
                              className={`w-3 h-3 -mb-1 ${
                                isSorted && sort?.direction === 'asc'
                                  ? 'text-primary-600'
                                  : 'text-gray-300 group-hover:text-gray-400'
                              }`}
                            />
                            <ChevronDown
                              className={`w-3 h-3 ${
                                isSorted && sort?.direction === 'desc'
                                  ? 'text-primary-600'
                                  : 'text-gray-300 group-hover:text-gray-400'
                              }`}
                            />
                          </span>
                        </button>
                      ) : (
                        <span>{column.header}</span>
                      )}
                      {isFilterable && (
                        <button
                          onClick={() => setActiveFilter(activeFilter === column.key ? null : column.key)}
                          className={`ml-1 p-0.5 rounded hover:bg-gray-200 transition-colors ${
                            hasFilter ? 'text-primary-600' : 'text-gray-400'
                          }`}
                        >
                          <Search className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    {activeFilter === column.key && (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={filters[column.key] || ''}
                          onChange={(e) => handleFilterChange(column.key, e.target.value)}
                          placeholder="Filtrar..."
                          className="w-full px-2 py-1 text-xs font-normal normal-case border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                          autoFocus
                        />
                        {hasFilter && (
                          <button
                            onClick={() => clearFilter(column.key)}
                            className="p-0.5 text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {processedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-8 text-center text-gray-500">
                No se encontraron resultados con los filtros aplicados
              </td>
            </tr>
          ) : (
            processedData.map((item) => (
              <tr
                key={keyExtractor(item)}
                onClick={() => onRowClick?.(item)}
                className={onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${column.className || ''}`}
                  >
                    {column.render
                      ? column.render(item)
                      : (item as Record<string, unknown>)[column.key] as React.ReactNode}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {hasActiveFilters && (
        <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-500 flex items-center justify-between">
          <span>
            Mostrando {processedData.length} de {data.length} registros
          </span>
          <button
            onClick={() => {
              setFilters({});
              setActiveFilter(null);
            }}
            className="text-primary-600 hover:text-primary-800"
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
}
