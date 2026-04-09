/**
 * Dashboard Data
 * Contains type definitions and mock data for appointments, patients, and requests
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no-show';

export interface Appointment {
  id: string;
  name: string;
  service: string;
  time: string;
  date: string; // YYYY-MM-DD format
  age: number;
  gender: string;
  contact: string;
  email: string;
  notes: string;
  imageUrl: string | number; // string for URI, number for require()
  initials?: string;
  status?: AppointmentStatus;
}

export interface Patient extends Appointment {
  // Patient extends appointment with all the same fields
  // Can add additional patient-specific fields here if needed
  medicalHistory?: string;
  lastVisit?: string;
}

export interface Request extends Appointment {
  // Request extends appointment with all the same fields
  // Can add additional request-specific fields here if needed
  requestDate?: string;
  priority?: 'low' | 'medium' | 'high';
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const SERVICE_OPTIONS = [
  'Cleaning',
  'Whitening',
  'Fillings',
  'Root Canal',
  'Extraction',
  'Braces Consultation',
  'Implants Consultation',
  'X-Ray',
  'Check-Up',
  'Aligners',
  'Root Canals',
  'Orthodontics',
] as const;

export const GENDER_OPTIONS = [
  'Male',
  'Female',
  'Non-binary',
  'Others',
] as const;

export const generateTimeOptions = (): string[] => {
  const times: string[] = [];
  for (let hours = 9; hours <= 16; hours++) {
    for (let minutes = 0; minutes < 60; minutes += 30) {
      if (hours === 16 && minutes > 30) break;
      const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      times.push(timeStr);
    }
  }
  return times;
};

export const TIME_OPTIONS = generateTimeOptions();

// ============================================================================
// SAMPLE APPOINTMENTS DATA
// ============================================================================

export const SAMPLE_APPOINTMENTS: Appointment[] = [
  {
    id: 'apt-1',
    name: 'Mart Emman',
    service: 'Whitening',
    time: '10:00',
    date: '2026-04-07',
    age: 28,
    gender: 'Male',
    contact: '0917-123-4567',
    email: 'mart.emman@email.com',
    notes: 'Patient requests extra numbing gel. History of sensitivity.',
    imageUrl: require('../assets/images/researchers/mart.jpg'),
    status: 'scheduled',
  },
  {
    id: 'apt-2',
    name: 'Jendri Jacin',
    service: 'Aligners',
    time: '13:00',
    date: '2026-04-07',
    age: 34,
    gender: 'Male',
    contact: '0918-234-5678',
    email: 'jendri.jacin@email.com',
    notes: 'First time for aligners. No allergies reported.',
    imageUrl: require('../assets/images/researchers/jendri.jpg'),
    status: 'scheduled',
  },
  {
    id: 'apt-3',
    name: 'Kyler Per',
    service: 'Root Canals',
    time: '15:00',
    date: '2026-04-07',
    age: 41,
    gender: 'Male',
    contact: '0919-345-6789',
    email: 'kyler.per@email.com',
    notes: 'Follow-up for root canal. Mild swelling last visit.',
    imageUrl: require('../assets/images/researchers/kyler.jpg'),
    status: 'completed',
  },
  {
    id: 'apt-4',
    name: 'Sarah Johnson',
    service: 'Cleaning',
    time: '09:00',
    date: '2026-03-27',
    age: 22,
    gender: 'Female',
    contact: '0916-111-2222',
    email: 'sarah.johnson@email.com',
    notes: 'Regular dental check-up and cleaning. No issues reported.',
    imageUrl: require('../assets/images/user.png'),
    status: 'no-show',
  },
  {
    id: 'apt-5',
    name: 'Michael Chen',
    service: 'Fillings',
    time: '11:30',
    date: '2026-03-27',
    age: 45,
    gender: 'Male',
    contact: '0920-333-4444',
    email: 'michael.chen@email.com',
    notes: 'Cavity filling on upper left molars. Patient has dental anxiety.',
    imageUrl: require('../assets/images/user.png'),
    status: 'cancelled',
  },
];

// ============================================================================
// SAMPLE REQUESTS DATA
// ============================================================================

export const SAMPLE_REQUESTS: Request[] = [
  {
    id: 'req-1',
    name: 'Marie Yan',
    service: 'Cleaning',
    time: '16:00',
    date: '2026-04-07',
    age: 25,
    gender: 'Female',
    contact: '0917-555-1234',
    email: 'marie.yan@email.com',
    notes: 'Request for cleaning. No known allergies.',
    imageUrl: require('../assets/images/researchers/mariel.jpg'),
    priority: 'medium',
  },
];

// ============================================================================
// SAMPLE PATIENTS DATA
// ============================================================================

export const SAMPLE_PATIENTS: Patient[] = [
  {
    id: 'pat-1',
    name: 'Mart Emman',
    service: 'Whitening',
    time: '10:00',
    date: '2026-04-01',
    age: 28,
    gender: 'Male',
    contact: '0917-123-4567',
    email: 'mart.emman@email.com',
    notes: 'Patient requests extra numbing gel. History of sensitivity.',
    imageUrl: require('../assets/images/researchers/mart.jpg'),
    status: 'scheduled',
    lastVisit: '2026-03-15',
  },
  {
    id: 'pat-2',
    name: 'Jendri Jacin',
    service: 'Aligners',
    time: '13:00',
    date: '2026-04-02',
    age: 34,
    gender: 'Male',
    contact: '0918-234-5678',
    email: 'jendri.jacin@email.com',
    notes: 'First time for aligners. No allergies reported.',
    imageUrl: require('../assets/images/researchers/jendri.jpg'),
    status: 'scheduled',
    lastVisit: '2026-03-20',
  },
  {
    id: 'pat-3',
    name: 'Kyler Per',
    service: 'Root Canals',
    time: '15:00',
    date: '2026-03-30',
    age: 41,
    gender: 'Male',
    contact: '0919-345-6789',
    email: 'kyler.per@email.com',
    notes: 'Follow-up for root canal. Mild swelling last visit.',
    imageUrl: require('../assets/images/researchers/kyler.jpg'),
    status: 'completed',
    lastVisit: '2026-02-14',
  },
  {
    id: 'pat-4',
    name: 'Marie Yan',
    service: 'Cleaning',
    time: '16:00',
    date: '2026-04-01',
    age: 25,
    gender: 'Female',
    contact: '0917-555-1234',
    email: 'marie.yan@email.com',
    notes: 'Request for cleaning. No known allergies.',
    imageUrl: require('../assets/images/researchers/mariel.jpg'),
    status: 'scheduled',
    lastVisit: '2026-01-10',
  },
  {
    id: 'pat-5',
    name: 'Sarah Johnson',
    service: 'Orthodontics',
    time: '11:00',
    date: '2026-04-03',
    age: 22,
    gender: 'Female',
    contact: '0916-111-2222',
    email: 'sarah.johnson@email.com',
    notes: 'Braces adjustment needed.',
    imageUrl: require('../assets/images/user.png'),
    status: 'scheduled',
    lastVisit: '2026-03-10',
  },
  {
    id: 'pat-6',
    name: 'Michael Chen',
    service: 'Check-Up',
    time: '14:30',
    date: '2026-04-04',
    age: 45,
    gender: 'Male',
    contact: '0920-333-4444',
    email: 'michael.chen@email.com',
    notes: 'Regular checkup. Previous cavity history.',
    imageUrl: require('../assets/images/user.png'),
    status: 'scheduled',
    lastVisit: '2026-02-28',
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get current date in YYYY-MM-DD format
 */
export const getToday = (): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toLocaleDateString('en-CA');
};

/**
 * Filter appointments by date
 */
export const getAppointmentsByDate = (
  appointments: Appointment[],
  date: string
): Appointment[] => {
  return appointments.filter((apt) => apt.date === date);
};

/**
 * Filter appointments by status
 */
export const getAppointmentsByStatus = (
  appointments: Appointment[],
  status: AppointmentStatus
): Appointment[] => {
  return appointments.filter((apt) => apt.status === status);
};

/**
 * Search appointments by name, email, or contact
 */
export const searchAppointments = (
  appointments: Appointment[],
  query: string
): Appointment[] => {
  const lowerQuery = query.toLowerCase();
  return appointments.filter(
    (apt) =>
      apt.name.toLowerCase().includes(lowerQuery) ||
      apt.email.toLowerCase().includes(lowerQuery) ||
      apt.contact.toLowerCase().includes(lowerQuery)
  );
};
