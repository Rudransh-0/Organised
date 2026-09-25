// src/lib/categories.ts

/**
 * Maps AI-generated category labels to the calibrated design-system colors.
 * Categories are free-form text from the AI, so we do fuzzy matching
 * against known groups, with a fallback.
 */

export interface CategoryColorMapping {
  label: string;
  color: string;
}

const CATEGORY_MAP: Record<string, string> = {
  // Work / Deep Focus → Slate Indigo
  'work': '#475569',
  'deep focus': '#475569',
  'study': '#475569',
  'school': '#475569',
  'homework': '#475569',
  'office': '#475569',
  'career': '#475569',
  'professional': '#475569',
  'finance': '#475569',
  'business': '#475569',

  // Personal / Home → Forest Celadon
  'personal': '#2E6F54',
  'home': '#2E6F54',
  'living': '#2E6F54',
  'family': '#2E6F54',
  'household': '#2E6F54',
  'chores': '#2E6F54',

  // Urgent / Vital → Warm Brick
  'urgent': '#A8422B',
  'vital': '#A8422B',
  'important': '#A8422B',
  'critical': '#A8422B',
  'emergency': '#A8422B',

  // Errands / Shopping → Raw Ochre
  'errands': '#8C6D3B',
  'shopping': '#8C6D3B',
  'groceries': '#8C6D3B',
  'errand': '#8C6D3B',
  'supplies': '#8C6D3B',
  'purchases': '#8C6D3B',

  // Health / Wellness → Dusty Sage
  'health': '#5A786B',
  'wellness': '#5A786B',
  'fitness': '#5A786B',
  'exercise': '#5A786B',
  'medical': '#5A786B',
  'self-care': '#5A786B',
  'selfcare': '#5A786B',
  'mental health': '#5A786B',

  // Social
  'social': '#6B5B73',
  'friends': '#6B5B73',
  'relationship': '#6B5B73',
  'communication': '#6B5B73',
};

const FALLBACK_COLOR = '#64748B'; // Muted Slate

export function getCategoryColor(category: string): string {
  const normalized = category.toLowerCase().trim();
  if (CATEGORY_MAP[normalized]) return CATEGORY_MAP[normalized];

  // Fuzzy: check if category contains any known keyword
  for (const [keyword, color] of Object.entries(CATEGORY_MAP)) {
    if (normalized.includes(keyword) || keyword.includes(normalized)) {
      return color;
    }
  }

  return FALLBACK_COLOR;
}

/**
 * Build a legend of active category→color mappings from the current task list.
 */
export function buildCategoryLegend(categories: string[]): CategoryColorMapping[] {
  const unique = [...new Set(categories)];
  return unique.map((label) => ({
    label,
    color: getCategoryColor(label),
  }));
}
