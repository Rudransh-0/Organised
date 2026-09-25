// src/components/TaskBoard.tsx
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Task, UrgencyColumn } from '@/types';
import { computeUrgencyColumn } from '@/lib/urgency';
import { getCategoryColor, buildCategoryLegend } from '@/lib/categories';
import EditMenu from './EditMenu';

interface TaskBoardProps {
  tasks: Task[];
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onUndoDelete: () => void;
  pendingDelete: Task | null;
}

const COLUMNS: { key: UrgencyColumn; label: string }[] = [
  { key: 'Urgent', label: 'URGENT' },
  { key: 'Upcoming', label: 'UPCOMING' },
  { key: 'Backlog', label: 'BACKLOG' },
  { key: 'Undefined', label: 'UNDEFINED' },
];

function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return 'No date';
  const d = new Date(dueDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function TaskBoard({
  tasks,
  onUpdateTask,
  onDeleteTask,
  onUndoDelete,
  pendingDelete,
}: TaskBoardProps) {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [highlightColumns, setHighlightColumns] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [mobileActiveColumn, setMobileActiveColumn] = useState<UrgencyColumn>('Urgent');
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recompute urgency_column for unpinned tasks on every render
  const processedTasks = tasks.map((task) => {
    if (task.urgency_pinned) return task;
    return {
      ...task,
      urgency_column: computeUrgencyColumn(task.due_date),
    };
  });

  // Group tasks by column
  const columnTasks: Record<UrgencyColumn, Task[]> = {
    Urgent: [],
    Upcoming: [],
    Backlog: [],
    Undefined: [],
  };
  processedTasks.forEach((t) => {
    columnTasks[t.urgency_column].push(t);
  });

  // Build category legend from active tasks
  const categories = processedTasks.map((t) => t.category).filter(Boolean);
  const legend = buildCategoryLegend(categories);

  // Long-press handler (mobile)
  const handlePointerDown = useCallback((taskId: string) => {
    longPressTimer.current = setTimeout(() => {
      setActiveCardId(taskId);
      setHighlightColumns(true);
    }, 500);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Right-click handler (desktop)
  const handleContextMenu = useCallback((e: React.MouseEvent, taskId: string) => {
    e.preventDefault();
    setActiveCardId(taskId);
    setHighlightColumns(true);
  }, []);

  // Move task to column
  const handleColumnTap = useCallback(
    (column: UrgencyColumn) => {
      if (!activeCardId || !highlightColumns) return;
      onUpdateTask(activeCardId, {
        urgency_column: column,
        urgency_pinned: true,
      });
      setActiveCardId(null);
      setHighlightColumns(false);
    },
    [activeCardId, highlightColumns, onUpdateTask]
  );

  // Complete task
  const handleComplete = useCallback(
    (taskId: string) => {
      onDeleteTask(taskId);
      setActiveCardId(null);
      setHighlightColumns(false);
    },
    [onDeleteTask]
  );

  // Dismiss active state on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.task-card') && !target.closest('.column-header')) {
        setActiveCardId(null);
        setHighlightColumns(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const isEmpty = processedTasks.length === 0;

  if (isEmpty) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="empty-icon-svg">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14,2 14,8 20,8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </div>
        <h2 className="empty-state-title">Your board is clear</h2>
        <p className="empty-state-text">
          Try saying or typing something like:
        </p>
        <div className="empty-state-examples">
          <span className="example-chip">&ldquo;Remind me to call Mom tomorrow&rdquo;</span>
          <span className="example-chip">&ldquo;Finish the report by Friday, buy groceries, gym at 6pm&rdquo;</span>
          <span className="example-chip">&ldquo;Pay electric bill tonight and schedule dentist appointment&rdquo;</span>
        </div>
        <p className="empty-state-hint">
          Long-press or right-click any card to edit, move, or complete it.
        </p>
      </div>
    );
  }

  return (
    <div className="task-board-wrapper">
      {/* Mobile column switcher */}
      <div className="mobile-column-switcher">
        {COLUMNS.map((col) => (
          <button
            key={col.key}
            onClick={() => setMobileActiveColumn(col.key)}
            className={`mobile-tab ${mobileActiveColumn === col.key ? 'mobile-tab-active' : ''}`}
          >
            {col.label}
            <span className="mobile-tab-count">{columnTasks[col.key].length}</span>
          </button>
        ))}
      </div>

      {/* Desktop 4-column board */}
      <div className="columns-grid">
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className={`column ${highlightColumns ? 'column-highlight' : ''} ${
              mobileActiveColumn === col.key ? 'column-mobile-active' : ''
            }`}
            onClick={() => handleColumnTap(col.key)}
          >
            <div className="column-header">
              <span className="column-label">{col.label}</span>
              <span className="column-count">{String(columnTasks[col.key].length).padStart(2, '0')}</span>
            </div>

            <div className="column-tasks">
              {columnTasks[col.key].map((task, idx) => (
                <div
                  key={task.id}
                  className={`task-card ${activeCardId === task.id ? 'task-card-active' : ''}`}
                  style={{
                    '--category-color': getCategoryColor(task.category),
                    '--stagger': `${idx * 40}ms`,
                  } as React.CSSProperties}
                  onPointerDown={() => handlePointerDown(task.id)}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  onContextMenu={(e) => handleContextMenu(e, task.id)}
                >
                  <div className="card-category-bar" />

                  <div className="card-content">
                    <h4 className="card-title">{task.title}</h4>
                    <div className="card-meta">
                      <span className="card-category">{task.category}</span>
                      <span className="card-date">
                        {formatDueDate(task.due_date)}
                        {task.urgency_pinned && (
                          <span className="pin-indicator" title="Manually pinned">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                              <path d="M16 2l-4 4-4-1-5 5 4 4-5 8 8-5 4 4 5-5-1-4 4-4z" />
                            </svg>
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Action icons — visible when card is active */}
                  {activeCardId === task.id && (
                    <div className="card-actions">
                      <button
                        className="action-complete"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleComplete(task.id);
                        }}
                        aria-label="Mark complete"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20,6 9,17 4,12" />
                        </svg>
                      </button>
                      <button
                        className="action-edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTask(task);
                          setActiveCardId(null);
                          setHighlightColumns(false);
                        }}
                        aria-label="Edit task"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="1" />
                          <circle cx="19" cy="12" r="1" />
                          <circle cx="5" cy="12" r="1" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Category Legend */}
      {legend.length > 0 && (
        <div className="category-legend">
          {legend.map((item) => (
            <div key={item.label} className="legend-item">
              <span
                className="legend-pip"
                style={{ backgroundColor: item.color }}
              />
              <span className="legend-label">{item.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Undo Toast */}
      {pendingDelete && (
        <div className="undo-toast">
          <span>Task completed</span>
          <button onClick={onUndoDelete} className="undo-btn">
            Undo
          </button>
        </div>
      )}

      {/* Edit Menu */}
      {editingTask && (
        <EditMenu
          task={editingTask}
          onSave={(updates) => {
            onUpdateTask(editingTask.id, updates);
          }}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  );
}
