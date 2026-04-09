/**
 * Shared date formatting utilities
 * Used across multiple components for consistent date formatting
 */

/**
 * Format date of birth from various formats (mm/dd/YYYY or ISO)
 * @param dateStr - Date string in mm/dd/YYYY or ISO format
 * @returns Formatted date string like "January 15, 2020"
 */
export const formatDateOfBirth = (dateStr: string): string => {
  if (!dateStr) return "Not provided";
  try {
    // Handle mm/dd/YYYY format
    if (dateStr.includes('/')) {
      const [month, day, year] = dateStr.split('/');
      const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    
    // Handle ISO date format
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    
    return dateStr;
  } catch {
    return dateStr;
  }
};

/**
 * Format appointment date from various formats (YYYY-MM-DD or mm/dd/YYYY)
 * @param dateStr - Date string in YYYY-MM-DD or mm/dd/YYYY format
 * @returns Formatted date string like "January 15, 2020"
 */
export const formatAppointmentDate = (dateStr: string): string => {
  if (!dateStr) return "Not provided";
  try {
    // Handle YYYY-MM-DD format
    if (dateStr.includes('-')) {
      const [year, month, day] = dateStr.split('-');
      const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    
    // Handle mm/dd/YYYY format
    if (dateStr.includes('/')) {
      const [month, day, year] = dateStr.split('/');
      const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    
    // Try parsing as ISO date
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    
    return dateStr;
  } catch {
    return dateStr;
  }
};

/**
 * Format date and time for appointment display
 * @param dateStr - Date string
 * @returns Formatted with year, month, day, hour, and minute
 */
export const formatDateWithTime = (dateStr: string): string => {
  if (!dateStr) return "Not provided";
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
};
