import React, { useState, useEffect } from "react";
import { View, Text, FlatList, Image, StyleSheet, TouchableOpacity, ScrollView, TextInput } from "react-native";
import { AppointmentType } from "../dashboard/DoctorDashboard";

interface AllAppointmentsProps {
  appointments: AppointmentType[];
  onUpdateAppointmentStatus?: (appointmentId: string, status: 'scheduled' | 'arrived' | 'finished') => void;
}

const getToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const getDateString = (date: Date) => {
  return date.toLocaleDateString('en-CA'); // "YYYY-MM-DD"
};

const getMonthDays = (year: number, month: number) => {
  const days = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  return days;
};

const AllAppointments: React.FC<AllAppointmentsProps> = ({ appointments, onUpdateAppointmentStatus }) => {
  const today = getToday();
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth());
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [appointmentStatuses, setAppointmentStatuses] = useState<{ [id: string]: 'scheduled' | 'arrived' | 'finished' }>({});

  // Initialize statuses from appointments
  useEffect(() => {
    const statuses: { [id: string]: 'scheduled' | 'arrived' | 'finished' } = {};
    appointments.forEach((apt) => {
      statuses[apt.id] = apt.status || 'scheduled';
    });
    setAppointmentStatuses(statuses);
  }, [appointments]);

  // Handle status update
  const handleUpdateStatus = (aptId: string, newStatus: 'scheduled' | 'arrived' | 'finished') => {
    setAppointmentStatuses((prev) => ({
      ...prev,
      [aptId]: newStatus,
    }));
    // Call parent callback if provided
    if (onUpdateAppointmentStatus) {
      onUpdateAppointmentStatus(aptId, newStatus);
    }
  };

  // Handle search and auto-navigation
  useEffect(() => {
    // Build appointment map inside effect to avoid dependency loop
    const appointmentsByDate: { [date: string]: AppointmentType[] } = {};
    appointments.forEach((apt) => {
      const dateStr = apt.date || getDateString(today);
      if (!appointmentsByDate[dateStr]) appointmentsByDate[dateStr] = [];
      appointmentsByDate[dateStr].push(apt);
    });

    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      const matchingDates = Object.keys(appointmentsByDate).filter((dateStr) =>
        appointmentsByDate[dateStr].some((apt) => apt.name.toLowerCase().includes(searchLower))
      );
      
      // Auto-navigate to first matching date
      if (matchingDates.length > 0) {
        const firstMatchDate = new Date(matchingDates[0]);
        setSelectedDate(firstMatchDate);
        setCurrentMonth(firstMatchDate.getMonth());
        setCurrentYear(firstMatchDate.getFullYear());
      }
    }
  }, [searchQuery, appointments]);

  // Map of date string to appointments (for rendering)
  const appointmentsByDate: { [date: string]: AppointmentType[] } = {};
  appointments.forEach((apt) => {
    const dateStr = apt.date || getDateString(today);
    if (!appointmentsByDate[dateStr]) appointmentsByDate[dateStr] = [];
    appointmentsByDate[dateStr].push(apt);
  });

  const days = getMonthDays(currentYear, currentMonth);
  const selectedDateStr = getDateString(selectedDate);
  let appointmentsForSelected = appointmentsByDate[selectedDateStr] || [];
  
  // Filter appointments based on search query
  if (searchQuery.trim()) {
    const searchLower = searchQuery.toLowerCase();
    appointmentsForSelected = appointmentsForSelected.filter((apt) =>
      apt.name.toLowerCase().includes(searchLower)
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Appointments</Text>
      {/* Global Search */}
      <TextInput
        style={styles.globalSearchInput}
        placeholder="Search patient by name across calendar..."
        placeholderTextColor="#999"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      {/* Calendar Controls */}
      <View style={styles.calendarHeader}>
        <TouchableOpacity onPress={() => {
          if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(currentYear - 1);
          } else {
            setCurrentMonth(currentMonth - 1);
          }
        }}>
          <Text style={styles.monthNav}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>
          {new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
        </Text>
        <TouchableOpacity onPress={() => {
          if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(currentYear + 1);
          } else {
            setCurrentMonth(currentMonth + 1);
          }
        }}>
          <Text style={styles.monthNav}>{'>'}</Text>
        </TouchableOpacity>
      </View>
      {/* Calendar Grid */}
      <View style={styles.calendarGrid}>
      {/* Weekday headers */}
      <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
        {['S', 'M', 'T', 'W', 'Th', 'F', 'S'].map((d, i) => (
          <Text key={`dow-${i}`} style={styles.dayOfWeek}>{d}</Text>
        ))}
      </View>

      {/* Calendar weeks */}
      {(() => {
        const rows: React.ReactNode[] = [];
        let cells: React.ReactNode[] = [];

        // Empty cells before first day
        for (let i = 0; i < days[0].getDay(); i++) {
          cells.push(<View key={`empty-${i}`} style={styles.dayCell} />);
        }

        days.forEach((date) => {
          const dateStr = getDateString(date);
          const hasApt = !!appointmentsByDate[dateStr];
          const isSelected = dateStr === selectedDateStr;
          const dayOfWeek = date.getDay(); // 0 = Sunday, 2 = Tuesday
          const isUnavailable = dayOfWeek === 0 || dayOfWeek === 2; // Sunday or Tuesday

          cells.push(
            <TouchableOpacity
              key={`day-${dateStr}`}
              style={[styles.dayCell, hasApt && styles.dayWithApt, isSelected && styles.selectedDay, isUnavailable && styles.disabledDay]}
              onPress={() => !isUnavailable && setSelectedDate(date)}
              disabled={isUnavailable}
            >
              <Text style={[styles.dayNum, isSelected && { color: '#fff' }, isUnavailable && { color: '#bbb' }]}>{date.getDate()}</Text>
            </TouchableOpacity>
          );

          if (cells.length === 7) {
            rows.push(<View key={`row-${rows.length}`} style={{ flexDirection: 'row' }}>{cells}</View>);
            cells = [];
          }
        });

        // Fill last row with empty cells
        if (cells.length > 0) {
          while (cells.length < 7) {
            cells.push(<View key={`empty-end-${cells.length}`} style={styles.dayCell} />);
          }
          rows.push(<View key={`row-${rows.length}`} style={{ flexDirection: 'row' }}>{cells}</View>);
        }

        return rows;
      })()}
    </View>
      {/* Appointments for selected day */}
      <Text style={styles.selectedDayLabel}>
        Appointments for {selectedDate.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        })}
      </Text>
      <FlatList
        data={appointmentsForSelected}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const currentStatus = appointmentStatuses[item.id] || 'scheduled';
          const getStatusColor = (status: string) => {
            if (status === 'scheduled') return '#FFC107';
            if (status === 'arrived') return '#2196F3';
            if (status === 'finished') return '#4CAF50';
            return '#999';
          };
          
          return (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <Image source={typeof item.imageUrl === "string" ? { uri: item.imageUrl } : item.imageUrl} style={styles.icon} />
                <View style={styles.info}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.detail}>Service: {item.service}</Text>
                  <Text style={styles.detail}>Time: {item.time}</Text>
                  <Text style={styles.detail}>Contact: {item.contact}</Text>
                  <View style={styles.statusContainer}>
                    <Text style={[styles.statusBadge, { backgroundColor: getStatusColor(currentStatus) }]}>
                      {currentStatus.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={[styles.statusButton, currentStatus === 'scheduled' && styles.statusButtonActive]}
                  onPress={() => handleUpdateStatus(item.id, 'scheduled')}
                >
                  <Text style={[styles.buttonText, currentStatus === 'scheduled' && { color: '#fff' }]}>Scheduled</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.statusButton, currentStatus === 'arrived' && styles.statusButtonActive]}
                  onPress={() => handleUpdateStatus(item.id, 'arrived')}
                >
                  <Text style={[styles.buttonText, currentStatus === 'arrived' && { color: '#fff' }]}>Arrived</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.statusButton, currentStatus === 'finished' && styles.statusButtonActive]}
                  onPress={() => handleUpdateStatus(item.id, 'finished')}
                >
                  <Text style={[styles.buttonText, currentStatus === 'finished' && { color: '#fff' }]}>Finished</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No appointments found.</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    gap: 12,
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0b7fab',
    marginHorizontal: 8,
  },
  monthNav: {
    fontSize: 18,
    color: '#0b7fab',
    fontWeight: 'bold',
    paddingHorizontal: 8,
  },
  calendarGrid: {
    flexDirection: 'column',
    flexWrap: 'wrap',
    marginBottom: 12,
    backgroundColor: '#eaf6fb',
    borderRadius: 8,
    padding: 4,
  },
  dayOfWeek: {
    width: 43,
    height: 32,
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#0b7fab',
    marginBottom: 2,
  },
  dayCell: {
    width: 41,
    height: 32,
    margin: 2,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  dayWithApt: {
    backgroundColor: '#ffebcc',
    borderColor: '#f59e42',
    borderWidth: 1,
  },
  selectedDay: {
    backgroundColor: '#0b7fab',
  },  disabledDay: {
    backgroundColor: "#e8e8e8",
    opacity: 0.6,
  },  dayNum: {
    fontSize: 14,
    color: '#333',
    fontWeight: 'bold',
  },
  selectedDayLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0b7fab',
    marginVertical: 8,
    textAlign: 'center',
  },
  globalSearchInput: {
    backgroundColor: '#fff',
    borderColor: '#0b7fab',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 14,
    color: '#333',
  },
  container: {
    flex: 1,
    backgroundColor: "#f0f8ff",
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#0b7fab",
    marginBottom: 16,
    textAlign: "center",
  },
  card: {
    flexDirection: "column",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#eee",
    marginRight: 12,
  },
  info: {
    flex: 1,
    marginBottom: 8,
  },
  statusContainer: {
    marginTop: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    alignSelf: 'flex-start',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  statusButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  statusButtonActive: {
    backgroundColor: '#0b7fab',
    borderColor: '#0b7fab',
  },
  buttonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
  },
  name: {
    fontWeight: "bold",
    fontSize: 16,
    color: "#333",
  },
  detail: {
    fontSize: 12,
    color: "#555",
  },
  empty: {
    textAlign: "center",
    color: "#888",
    marginTop: 40,
  },
});

export default AllAppointments;
