import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getPatientAppointments } from "../../lib/profilesPatients";
import { getStatusColor, getStatusBgColor } from "../../lib/statusHelpers";
import { formatDateWithTime } from "../../lib/dateFormatters";
import AppointmentEdit from "./appointmentEdit";

interface AppointmentHistoryProps {
  patientId: string;
  patientName: string;
  doctorId: string;
  onBack: () => void;
}

const categorizeAppointments = (appointments: any[]) => {
  // Get today's date at midnight in local timezone
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const past: any[] = [];
  const current: any[] = [];
  const future: any[] = [];

  appointments.forEach((appt) => {
    // Parse appointment_date string (format: YYYY-MM-DD)
    const dateParts = appt.appointment_date.split('T')[0].split('-');
    const apptDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
    apptDate.setHours(0, 0, 0, 0);
    
    const timeDiff = apptDate.getTime() - today.getTime();
    const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

    if (daysDiff === 0) {
      // Same day = current/today
      current.push(appt);
    } else if (daysDiff > 0) {
      // Future dates
      future.push(appt);
    } else {
      // Past dates
      past.push(appt);
    }
  });

  return { past, current, future };
};

function AppointmentCard({ appointment, onEdit }: { appointment: any; onEdit: (appt: any) => void }) {
  const formattedDate = (() => {
    try {
      if (appointment.appointment_date && appointment.appointment_time) {
        const dateStr = String(appointment.appointment_date).trim(); // YYYY-MM-DD
        const timeStr = String(appointment.appointment_time).trim(); // HH:MM
        
        // Parse date
        const dateParts = dateStr.split('-').map(Number);
        if (dateParts.length !== 3 || dateParts.some(isNaN)) {
          console.warn('⚠️ Invalid date format:', appointment.appointment_date);
          return 'Invalid date format';
        }
        
        // Parse time
        const timeParts = timeStr.split(':').map(Number);
        if (timeParts.length < 2 || timeParts.some(isNaN)) {
          console.warn('⚠️ Invalid time format:', appointment.appointment_time);
          return 'Invalid time format';
        }
        
        const [year, month, day] = dateParts;
        const [hour, minute] = timeParts;
        
        // Validate date components
        if (month < 1 || month > 12 || day < 1 || day > 31) {
          console.warn('⚠️ Invalid date components:', { year, month, day });
          return 'Invalid date';
        }
        
        const date = new Date(year, month - 1, day, hour, minute);
        
        // Verify the date is valid
        if (isNaN(date.getTime())) {
          console.warn('⚠️ Failed to create valid date:', { year, month, day, hour, minute });
          return 'Invalid date';
        }
        
        return date.toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      }
      
      console.warn('⚠️ Missing appointment date or time:', {
        appointment_date: appointment.appointment_date,
        appointment_time: appointment.appointment_time,
      });
      return 'Date/Time not available';
    } catch (error) {
      console.error('❌ Error formatting date:', error, { appointment });
      return 'Error formatting date';
    }
  })();

  const statusColor = getStatusColor(appointment.status);
  const statusBgColor = getStatusBgColor(appointment.status);

  return (
    <View style={styles.appointmentCard}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardService}>{appointment.service || 'General Appointment'}</Text>
          <Text style={styles.cardDate}>{formattedDate}</Text>
        </View>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusBgColor },
            ]}
          >
            <Text style={[styles.statusText, { color: statusColor }]}>
              {appointment.status?.charAt(0).toUpperCase() + appointment.status?.slice(1) || 'Scheduled'}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => onEdit(appointment)}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>
      </View>
      {appointment.notes && (
        <View style={styles.cardBody}>
          <Text style={styles.cardNotes}>{appointment.notes}</Text>
        </View>
      )}
    </View>
  );
}

export default function AppointmentHistory({
  patientId,
  patientName,
  doctorId,
  onBack,
}: AppointmentHistoryProps) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'current' | 'future' | 'past'>('all');
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    loadAppointments();
  }, [patientId]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const appts = await getPatientAppointments(patientId);
      setAppointments(appts);
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditAppointment = (appointment: any) => {
    setEditingAppointment(appointment);
    setShowEditModal(true);
  };

  const handleSaveAppointment = () => {
    // Reload appointments after save
    loadAppointments();
  };

  const { past, current, future } = categorizeAppointments(appointments);

  // Debug categorization
  console.log('📅 Appointment Categorization:');
  console.log(`   Today: ${current.length} appointments`);
  console.log(`   Future: ${future.length} appointments`);
  console.log(`   Past: ${past.length} appointments`);
  if (current.length > 0) {
    console.log('   Today appointments:', current.map(a => ({ date: a.appointment_date, service: a.service })));
  }

  const getFilteredAppointments = () => {
    switch (activeTab) {
      case 'current':
        return current;
      case 'future':
        return future;
      case 'past':
        return past;
      case 'all':
      default:
        return appointments;
    }
  };

  const filteredAppointments = getFilteredAppointments();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9f9f9' }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Image
            source={require('../../assets/images/icon/back.png')}
            style={{ width: 24, height: 24, resizeMode: 'contain' }}
          />
          <Text style={styles.backButton}>Back</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Appointment History</Text>
          <Text style={styles.headerSubtitle}>{patientName}</Text>
        </View>
        <View style={{ width: 50 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
            All ({appointments.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'current' && styles.activeTab]}
          onPress={() => setActiveTab('current')}
        >
          <Text style={[styles.tabText, activeTab === 'current' && styles.activeTabText]}>
            Today ({current.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'future' && styles.activeTab]}
          onPress={() => setActiveTab('future')}
        >
          <Text style={[styles.tabText, activeTab === 'future' && styles.activeTabText]}>
            Future ({future.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'past' && styles.activeTab]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.activeTabText]}>
            Past ({past.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 20 }}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#0b7fab" />
            <Text style={styles.loadingText}>Loading appointments...</Text>
          </View>
        ) : filteredAppointments.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>
              {activeTab === 'all'
                ? 'No appointments found'
                : `No ${activeTab} appointments`}
            </Text>
          </View>
        ) : (
          <>
            {activeTab === 'all' && current.length > 0 && (
              <>
                <Text style={styles.categoryTitle}>Today's Appointments</Text>
                {current.map((appt: any) => (
                  <AppointmentCard key={appt.id} appointment={appt} onEdit={handleEditAppointment} />
                ))}
              </>
            )}

            {activeTab === 'all' && future.length > 0 && (
              <>
                <Text style={styles.categoryTitle}>Upcoming Appointments</Text>
                {future.map((appt: any) => (
                  <AppointmentCard key={appt.id} appointment={appt} onEdit={handleEditAppointment} />
                ))}
              </>
            )}

            {activeTab === 'all' && past.length > 0 && (
              <>
                <Text style={styles.categoryTitle}>Past Appointments</Text>
                {past.map((appt: any) => (
                  <AppointmentCard key={appt.id} appointment={appt} onEdit={handleEditAppointment} />
                ))}
              </>
            )}

            {activeTab !== 'all' && filteredAppointments.length > 0 && (
              <>
                {filteredAppointments.map((appt: any) => (
                  <AppointmentCard key={appt.id} appointment={appt} onEdit={handleEditAppointment} />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Edit Appointment Modal */}
      {editingAppointment && (
        <AppointmentEdit
          visible={showEditModal}
          appointment={editingAppointment}
          doctorId={doctorId}
          onClose={() => {
            setShowEditModal(false);
            setEditingAppointment(null);
          }}
          onSave={handleSaveAppointment}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: '#ddd',
    borderBottomWidth: 1,
    backgroundColor: '#fff',
  },
  backButton: {
    fontSize: 16,
    color: '#0b7fab',
    fontWeight: '600',
    width: 50,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0b7fab',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomColor: '#e0e0e0',
    borderBottomWidth: 1,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#0b7fab',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  activeTabText: {
    color: '#fff',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#0b7fab',
    fontWeight: '600',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0b7fab',
    marginTop: 16,
    marginBottom: 12,
  },
  appointmentCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  cardService: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0b7fab',
    marginBottom: 4,
  },
  cardDate: {
    fontSize: 12,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardBody: {
    marginTop: 8,
    paddingTop: 8,
    borderTopColor: '#f0f0f0',
    borderTopWidth: 1,
  },
  cardNotes: {
    fontSize: 12,
    color: '#555',
    lineHeight: 18,
  },
  editButton: {
    backgroundColor: '#0b7fab',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
});
