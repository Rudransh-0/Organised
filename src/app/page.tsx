// src/app/page.tsx
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import InputEngine from '@/components/InputEngine';
import TaskBoard from '@/components/TaskBoard';
import { extractAction } from '@/app/actions/extract';
import { parseDueDate } from '@/lib/date-parser';
import { computeUrgencyColumn } from '@/lib/urgency';
import { loadTasks, saveTasks } from '@/lib/storage';
import type { Task, AIExtractedTask } from '@/types';

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [preservedText, setPreservedText] = useState<string | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load tasks from localStorage on mount
  useEffect(() => {
    setTasks(loadTasks());
  }, []);

  // Persist tasks to localStorage whenever they change
  useEffect(() => {
    if (tasks.length > 0 || loadTasks().length > 0) {
      saveTasks(tasks);
    }
  }, [tasks]);

  const handleSubmit = useCallback(async (rawInput: string) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setPreservedText(rawInput); // Preserve in case of failure

    try {
      const result = await extractAction(rawInput);

      if (result.status === 'unavailable') {
        setErrorMessage(result.message);
        setIsProcessing(false);
        return;
      }

      // Process each extracted task
      const now = new Date().toISOString();
      const newTasks: Task[] = result.tasks.map((extracted: AIExtractedTask) => {
        const dueDate = parseDueDate(extracted.raw_segment);
        const urgencyColumn = computeUrgencyColumn(dueDate);

        return {
          id: crypto.randomUUID(),
          raw_input: rawInput,
          title: extracted.title,
          category: extracted.category,
          urgency_column: urgencyColumn,
          urgency_pinned: false,
          due_date: dueDate,
          created_at: now,
        };
      });

      setTasks((prev) => [...prev, ...newTasks]);
      setPreservedText(''); // Clear input on success
      setErrorMessage(null);
    } catch (err) {
      console.error('[Page] Extraction error:', err);
      setErrorMessage(
        "We're experiencing heavy traffic right now — please wait a moment and try again."
      );
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleUpdateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, ...updates } : task))
    );
  }, []);

  const handleDeleteTask = useCallback((id: string) => {
    setTasks((prev) => {
      const task = prev.find((t) => t.id === id);
      if (task) {
        setPendingDelete(task);
        // Clear any existing undo timer
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        // Set new undo timer (7 seconds)
        undoTimerRef.current = setTimeout(() => {
          setPendingDelete(null);
          undoTimerRef.current = null;
        }, 7000);
      }
      return prev.filter((t) => t.id !== id);
    });
  }, []);

  const handleUndoDelete = useCallback(() => {
    if (pendingDelete) {
      setTasks((prev) => [...prev, pendingDelete]);
      setPendingDelete(null);
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
        undoTimerRef.current = null;
      }
    }
  }, [pendingDelete]);

  return (
    <main className="app-main">
      <header className="app-header">
        <h1 className="app-title">Organised</h1>
        <p className="app-subtitle">Get it out of your head</p>
      </header>

      <InputEngine
        onSubmit={handleSubmit}
        isProcessing={isProcessing}
        preservedText={preservedText}
      />

      {errorMessage && (
        <div className="error-banner">
          <p>{errorMessage}</p>
        </div>
      )}

      <TaskBoard
        tasks={tasks}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
        onUndoDelete={handleUndoDelete}
        pendingDelete={pendingDelete}
      />
    </main>
  );
}
