/**
 * Medical Intake Helpers
 * Normalization and formatting utilities for clinical fields (pregnancy_status, smoking_status)
 * Ensures consistency across patient web profile, bio-data, registration, and database constraints.
 */

/**
 * Normalizes pregnancy status string to database-compliant code: 'yes' | 'no' | 'na' | ''
 */
export function normalizePregnancyStatus(val?: string | null): string {
  if (!val) return '';
  const lower = val.trim().toLowerCase();
  if (lower === 'yes' || lower === 'pregnant' || lower === 'currently pregnant') return 'yes';
  if (lower === 'no' || lower === 'not pregnant' || lower === 'not_pregnant') return 'no';
  if (lower === 'na' || lower === 'n/a' || lower === 'not applicable' || lower === 'breastfeeding') return 'na';
  return '';
}

/**
 * Returns user-friendly formatted label for display
 */
export function formatPregnancyStatus(val?: string | null): string {
  const normalized = normalizePregnancyStatus(val);
  if (normalized === 'yes') return 'Currently pregnant';
  if (normalized === 'no') return 'Not pregnant';
  if (normalized === 'na') return 'Not applicable';
  return 'Not provided';
}

/**
 * Normalizes smoking status string to database-compliant code: 'never' | 'former' | 'current' | ''
 */
export function normalizeSmokingStatus(val?: string | null): string {
  if (!val) return '';
  const lower = val.trim().toLowerCase();
  if (lower === 'never' || lower === 'never smoked') return 'never';
  if (lower === 'former' || lower === 'former smoker') return 'former';
  if (lower === 'current' || lower === 'current smoker') return 'current';
  return '';
}

/**
 * Returns user-friendly formatted label for smoking status
 */
export function formatSmokingStatus(val?: string | null): string {
  const normalized = normalizeSmokingStatus(val);
  if (normalized === 'never') return 'Never smoked';
  if (normalized === 'former') return 'Former smoker';
  if (normalized === 'current') return 'Current smoker';
  return 'Not provided';
}
