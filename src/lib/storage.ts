// src/lib/storage.ts

/**
 * Local-first storage via localStorage.
 * This is the source of truth for anonymous users.
 */

import type { Task } from '@/types';

const STORAGE_KEY = 'organised_tasks';

export function loadTasks(): Task[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as Task[];
  } catch {
    return [];
  }
}

export function saveTasks(tasks: Task[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.error('[Storage] Failed to save tasks:', e);
  }
}

export function clearTasks(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
