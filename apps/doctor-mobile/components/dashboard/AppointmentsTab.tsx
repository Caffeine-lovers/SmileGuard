import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  TextInput,
  Alert,
  Modal,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppointmentType } from "./DoctorDashboard";

interface AppointmentsTabProps {
  appointments: AppointmentType[];
  onUpdateAppointmentStatus: (appointmentId: string, status: 'scheduled' | 'completed' | 'cancelled' | 'no-show', shouldRemoveFromDashboard?: boolean) => void;
  styles: any;
}

export default function AppointmentsTab({
  appointments,
  onUpdateAppointmentStatus,
  styles,
}: AppointmentsTabProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [appointmentFilterBy, setAppointmentFilterBy] = useState<'all' | 'scheduled' | 'completed'>('all');
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [editingStatus, setEditingStatus] = useState<'scheduled' | 'completed' | 'cancelled' | 'no-show'>('scheduled');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  const STATUS_OPTIONS = ['scheduled', 'completed', 'cancelled', 'no-show'] as const;

  const getStatusColor = (status: string) => {
    if (status === 'scheduled') return '#FFC107';
    if (status === 'completed') return '#4CAF50';
    if (status === 'cancelled') return '#F44336';
    if (status === 'no-show') return '#9C27B0';
    return '#999';
  };

  // Calendar functions
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getAppointmentCountForDate = (dateStr: string) => {
    return appointments.filter(apt => apt.date === dateStr).length;
  };

  const isUnavailableDay = (date: Date) => {
    const dayOfWeek = date.getDay();
    // 0 = Sunday, 2 = Tuesday
    return dayOfWeek === 0 || dayOfWeek === 2;
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(formatDate(today));
  };

  const handleSaveStatus = () => {
    if (editingAppointmentId) {
      // Pass false to prevent removing the appointment from the list in the appointments tab
      onUpdateAppointmentStatus(editingAppointmentId, editingStatus, false);
      setEditingAppointmentId(null);
      Alert.alert("Success", "Appointment status updated successfully.");
    }
  };

  const handleCancelEdit = () => {
    setEditingAppointmentId(null);
    setShowStatusDropdown(false);
  };

  const formatStatus = (s: string) =>
  s.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('-');

  // Filter appointments
  const filteredAppointments = appointments.filter((apt) => {
    const matchesSearch =
      apt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.contact.includes(searchQuery);

    const matchesDate = selectedDate ? apt.date === selectedDate : true;

    if (appointmentFilterBy === 'all') return matchesSearch && matchesDate;
    if (appointmentFilterBy === 'scheduled') return matchesSearch && matchesDate && apt.status !== 'completed';
    if (appointmentFilterBy === 'completed') return matchesSearch && matchesDate && apt.status === 'completed';
    return matchesSearch && matchesDate;
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f0f8ff" }}>
      <ScrollView style={{ flex: 1 }}>
        {/* Header Section with Search and Filters */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 }}>
          <TextInput
            style={{
              backgroundColor: '#fff',
              borderColor: '#0b7fab',
              borderWidth: 1,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 14,
              color: '#333',
              marginBottom: 12,
            }}
            placeholder="Search by name, service, email, contact..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#666', alignSelf: 'center' }}>Filter:</Text>
            <TouchableOpacity
              onPress={() => setAppointmentFilterBy('all')}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
                backgroundColor: appointmentFilterBy === 'all' ? '#0b7fab' : '#e0e0e0',
                borderWidth: 1,
                borderColor: appointmentFilterBy === 'all' ? '#0b7fab' : '#ccc',
              }}
            >
              <Text style={{ fontSize: 12, color: appointmentFilterBy === 'all' ? '#fff' : '#333', fontWeight: '500' }}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setAppointmentFilterBy('scheduled')}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
                backgroundColor: appointmentFilterBy === 'scheduled' ? '#0b7fab' : '#e0e0e0',
                borderWidth: 1,
                borderColor: appointmentFilterBy === 'scheduled' ? '#0b7fab' : '#ccc',
              }}
            >
              <Text style={{ fontSize: 12, color: appointmentFilterBy === 'scheduled' ? '#fff' : '#333', fontWeight: '500' }}>Pending</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setAppointmentFilterBy('completed')}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
                backgroundColor: appointmentFilterBy === 'completed' ? '#0b7fab' : '#e0e0e0',
                borderWidth: 1,
                borderColor: appointmentFilterBy === 'completed' ? '#0b7fab' : '#ccc',
              }}
            >
              <Text style={{ fontSize: 12, color: appointmentFilterBy === 'completed' ? '#fff' : '#333', fontWeight: '500' }}>Completed</Text>
            </TouchableOpacity>
          </View>

          {/* Calendar View */}
          <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 12, borderColor: '#ddd', borderWidth: 1 }}>
            {/* Month Navigation */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <TouchableOpacity onPress={goToPreviousMonth} style={{ padding: 8 }}>
                <Text style={{ fontSize: 18, color: '#0b7fab', fontWeight: 'bold' }}>‹</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#333' }}>
                  {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
                <TouchableOpacity onPress={goToToday} style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#e3f2fd', borderRadius: 4 }}>
                  <Text style={{ fontSize: 11, color: '#0b7fab', fontWeight: 'bold' }}>Today</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={goToNextMonth} style={{ padding: 8 }}>
                <Text style={{ fontSize: 18, color: '#0b7fab', fontWeight: 'bold' }}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Weekday Headers */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => {
                const isUnavailable = index === 0 || index === 2; // Sunday or Tuesday
                return (
                  <Text key={day} style={{ fontSize: 11, fontWeight: 'bold', color: isUnavailable ? '#ff6b6b' : '#666', width: '14.28%', textAlign: 'center', opacity: isUnavailable ? 0.7 : 1 }}>
                    {day}
                  </Text>
                );
              })}
            </View>

            {/* Calendar Days */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {Array.from({ length: getFirstDayOfMonth(currentMonth) }).map((_, index) => (
                <View key={`empty-${index}`} style={{ width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center' }} />
              ))}
              {Array.from({ length: getDaysInMonth(currentMonth) }).map((_, index) => {
                const day = index + 1;
                const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                const dateStr = formatDate(date);
                const appointmentCount = getAppointmentCountForDate(dateStr);
                const isSelected = selectedDate === dateStr;
                const isToday = dateStr === formatDate(new Date());
                const isUnavailable = isUnavailableDay(date);

                return (
                  <TouchableOpacity
                    key={day}
                    onPress={() => !isUnavailable && setSelectedDate(isSelected ? null : dateStr)}
                    disabled={isUnavailable}
                    style={{
                      width: '14.28%',
                      aspectRatio: 1,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderRadius: 6,
                      backgroundColor: isUnavailable ? '#f0f0f0' : isSelected ? '#0b7fab' : isToday ? '#e3f2fd' : '#f9f9f9',
                      borderWidth: isUnavailable ? 1 : isToday ? 2 : 0,
                      borderColor: isUnavailable ? '#ddd' : isToday ? '#0b7fab' : 'transparent',
                      opacity: isUnavailable ? 0.5 : 1,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: isSelected ? 'bold' : '600', color: isUnavailable ? '#ccc' : isSelected ? '#fff' : '#333', textDecorationLine: isUnavailable ? 'line-through' : 'none' }}>
                      {day}
                    </Text>
                    {!isUnavailable && appointmentCount > 0 && (
                      <View
                        style={{
                          backgroundColor: isSelected ? '#fff' : '#0b7fab',
                          borderRadius: 8,
                          width: 14,
                          height: 14,
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginTop: 2,
                        }}
                      >
                        <Text style={{ fontSize: 9, fontWeight: 'bold', color: isSelected ? '#0b7fab' : '#fff' }}>
                          {appointmentCount}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Appointments List */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 }}>
          {selectedDate && (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#0b7fab', paddingBottom: 8 }}>
                📅 {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </Text>
            </View>
          )}
          {filteredAppointments.length === 0 ? (
            <Text style={{ textAlign: 'center', color: '#999', marginTop: 20, fontSize: 14 }}>
              {searchQuery ? `No appointments found matching "${searchQuery}"` : selectedDate ? 'No appointments on this date' : 'No appointments found'}
            </Text>
          ) : (
          filteredAppointments.map((appointment) => (
            <View
              key={appointment.id}
              style={[styles.card, styles.shadow, { marginBottom: 12, padding: 12 }]}
            >
              {/* Row 1: Image + (Name + Status) + Edit Button */}
              <View style={{ flexDirection: 'row', alignItems: 'center'}}>
                <Image
                  source={typeof appointment.imageUrl === "string" ? { uri: appointment.imageUrl } : appointment.imageUrl}
                  style={{ width: 50, height: 50, borderRadius: 25, marginRight: 12 }}
                />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 8 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#333' }}>{appointment.name}</Text>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 10,
                        backgroundColor: getStatusColor(appointment.status || 'scheduled'),
                      }}
                    >
                      <Text style={{ fontSize: 10, color: '#fff', fontWeight: 'bold' }}>
                        {appointment.status === 'scheduled' ? 'Pending' : 
                         appointment.status === 'completed' ? 'Completed' :
                         appointment.status === 'cancelled' ? 'Cancelled' : 'No-show'}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>{appointment.service}</Text>
                  <Text style={{ fontSize: 11, color: '#999' }}>{appointment.date} at {appointment.time}</Text>
                </View>
                {editingAppointmentId !== appointment.id && (
                  <TouchableOpacity
                    onPress={() => {
                      setEditingAppointmentId(appointment.id);
                      setEditingStatus(appointment.status || 'scheduled');
                    }}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      backgroundColor: '#0b7fab',
                      borderRadius: 6,
                      marginLeft: 8,
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>

              {editingAppointmentId === appointment.id && (
                <Modal
                  visible={true}
                  transparent={true}
                  animationType="fade"
                >
                  <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 20, width: '90%', maxWidth: 400 }}>
                      <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 16, textAlign: 'center' }}>Change Appointment Status</Text>
                      <View style={{ marginBottom: 16 }}>
                        <TouchableOpacity onPress={() => setShowStatusDropdown(!showStatusDropdown)}>
                          <View
                            style={{
                              borderColor: '#0b7fab',
                              borderWidth: 1,
                              borderRadius: 8,
                              paddingHorizontal: 12,
                              paddingVertical: 12,
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{ color: '#333', fontSize: 14 }}>{editingStatus}</Text>
                            <Text style={{ color: '#0b7fab', fontSize: 16 }}>{showStatusDropdown ? '▲' : '▼'}</Text>
                          </View>
                        </TouchableOpacity>
                        {showStatusDropdown && (
                          <View
                            style={{
                              borderColor: '#0b7fab',
                              borderWidth: 1,
                              borderTopWidth: 0,
                              borderBottomLeftRadius: 8,
                              borderBottomRightRadius: 8,
                              marginTop: -1,
                            }}
                          >
                            {STATUS_OPTIONS.map((status) => (
                              <TouchableOpacity
                                key={status}
                                onPress={() => {
                                  setEditingStatus(status);
                                  setShowStatusDropdown(false);
                                }}
                                style={{
                                  paddingHorizontal: 12,
                                  paddingVertical: 12,
                                  backgroundColor: editingStatus === status ? '#f0f0f0' : '#fff',
                                  borderBottomColor: '#ddd',
                                  borderBottomWidth: 1,
                                }}
                              >
                                <Text style={{ color: '#333', fontSize: 14 }}>
                                    {formatStatus(status)}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <TouchableOpacity
                          onPress={handleSaveStatus}
                          style={{
                            flex: 1,
                            backgroundColor: '#0b7fab',
                            paddingVertical: 12,
                            borderRadius: 8,
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={handleCancelEdit}
                          style={{
                            flex: 1,
                            backgroundColor: '#f0f0f0',
                            paddingVertical: 12,
                            borderRadius: 8,
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{ color: '#333', fontWeight: 'bold', fontSize: 13 }}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </Modal>
              )}
            </View>
          ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
