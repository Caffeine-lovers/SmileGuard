/**
 * Shared status helper functions
 * All statuses aligned to shades of clinic green:
 * - scheduled: Mint / Emerald Green (#10B981)
 * - completed: Deep Forest Green (#047857)
 * - pending: Lime / Chartreuse Green (#65A30D)
 * - cancelled: Muted Sage Green (#6B9080)
 * - no-show: Olive / Moss Green (#4D7C0F)
 * - declined: Deep Pine / Spruce Green (#0F766E)
 */

export const getStatusColor = (status?: string): string => {
  switch (status?.toLowerCase()) {
    case 'pending':
      return '#65A30D'; // Lime / Chartreuse Green
    case 'scheduled':
      return '#10B981'; // Mint / Emerald Green
    case 'completed':
      return '#047857'; // Deep Forest Green
    case 'cancelled':
      return '#6B9080'; // Muted Sage Green
    case 'no-show':
      return '#4D7C0F'; // Olive / Moss Green
    case 'declined':
      return '#0F766E'; // Deep Pine / Spruce Green
    default:
      return '#10B981';
  }
};

export const getStatusBgColor = (status?: string): string => {
  switch (status?.toLowerCase()) {
    case 'pending':
      return '#ECFCCB'; // Light Lime Green
    case 'scheduled':
      return '#D1FAE5'; // Light Mint/Emerald Green
    case 'completed':
      return '#DCFCE7'; // Light Deep Forest Green
    case 'cancelled':
      return '#E2E8F0'; // Light Muted Sage / Gray
    case 'no-show':
      return '#F1F5E8'; // Light Olive / Moss Green
    case 'declined':
      return '#CCFBF1'; // Light Pine / Spruce Green
    default:
      return '#D1FAE5';
  }
};

export const getStatusLabel = (status?: string): string => {
  switch (status?.toLowerCase()) {
    case 'pending':
      return 'Pending';
    case 'scheduled':
      return 'Scheduled';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'no-show':
      return 'No Show';
    case 'declined':
      return 'Declined';
    default:
      return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Scheduled';
  }
};
