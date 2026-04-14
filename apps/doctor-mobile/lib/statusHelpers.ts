/**
 * Shared status helper functions
 * Used across multiple components for consistent status color handling
 */

export const getStatusColor = (status?: string): string => {
  switch (status) {
    case 'scheduled':
      return '#FFC107';
    case 'completed':
      return '#4CAF50';
    case 'cancelled':
      return '#F44336';
    case 'no-show':
      return '#9C27B0';
    case 'declined':
      return '#FF6F00';
    default:
      return '#666';
  }
};

export const getStatusBgColor = (status?: string): string => {
  switch (status) {
    case 'scheduled':
      return '#FFF9C4';
    case 'completed':
      return '#C8E6C9';
    case 'cancelled':
      return '#FFCDD2';
    case 'no-show':
      return '#E1BEE7';
    case 'declined':
      return '#FFE0B2';
    default:
      return '#f5f5f5';
  }
};
