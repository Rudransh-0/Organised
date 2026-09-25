// src/components/EditMenu.tsx
'use client';

import { useState } from 'react';
import type { Task } from '@/types';

interface EditMenuProps {
  task: Task;
  onSave: (updates: Partial<Pick<Task, 'title' | 'category' | 'due_date'>>) => void;
  onClose: () => void;
}

export default function EditMenu({ task, onSave, onClose }: EditMenuProps) {
  const [title, setTitle] = useState(task.title);
  const [category, setCategory] = useState(task.category);
  const [dueDate, setDueDate] = useState(
    task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : ''
  );

  const handleSave = () => {
    const updates: Partial<Pick<Task, 'title' | 'category' | 'due_date'>> = {};
    if (title !== task.title) updates.title = title;
    if (category !== task.category) updates.category = category;

    const newDueDate = dueDate ? new Date(dueDate + 'T00:00:00').toISOString() : null;
    if (newDueDate !== task.due_date) updates.due_date = newDueDate;

    onSave(updates);
    onClose();
  };

  const handleClearDate = () => {
    setDueDate('');
  };

  return (
    <div className="edit-overlay" onClick={onClose}>
      <div className="edit-menu" onClick={(e) => e.stopPropagation()}>
        <div className="edit-header">
          <h3>Edit Task</h3>
          <button onClick={onClose} className="edit-close" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="edit-body">
          <label className="edit-label">
            <span>Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="edit-input"
            />
          </label>

          <label className="edit-label">
            <span>Category</span>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="edit-input"
            />
          </label>

          <label className="edit-label">
            <span>Due Date</span>
            <div className="edit-date-row">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="edit-input edit-date-input"
              />
              {dueDate && (
                <button
                  type="button"
                  onClick={handleClearDate}
                  className="clear-date-btn"
                >
                  Clear date
                </button>
              )}
            </div>
          </label>
        </div>

        <div className="edit-footer">
          <button onClick={onClose} className="edit-cancel-btn">
            Cancel
          </button>
          <button onClick={handleSave} className="edit-save-btn">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
