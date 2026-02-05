import React from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  Alert 
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

// Define User Interface
export interface User {
  name: string;
  role: string;
  specialty?: string;
}

export default function DoctorDashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  
  const handlePress = (name: string) => {
    Alert.alert("Patient Details", `You pressed on ${name}'s profile.`);
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f7fb" }}>
        {/* Header Bar */}
        <View style={styles.topBar}>
           <Text style={styles.topBarText}>SmileGuard MD</Text>
           <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
              <Text style={{color: "white", fontWeight:"bold"}}>Logout</Text>
           </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.Container}>
            <Text style={[styles.Header, { marginBottom: 20 }]}>
              Welcome, {user.name}
            </Text>

            {/* Stats Panel */}
            <View style={styles.FirstPanel}>
              <View style={[styles.Panel, styles.shadow]}>
                <Text style={styles.statNumber}>67</Text>
                <Text style={styles.statLabel}>Patients</Text>
              </View>

              <View style={[styles.Panel, styles.shadow]}>
                <Text style={styles.statNumber}>21</Text>
                <Text style={styles.statLabel}>Appointments</Text>
              </View>

              <View style={[styles.Panel, styles.shadow]}>
                <Text style={styles.statNumber}>911</Text>
                <Text style={styles.statLabel}>Treatments</Text>
              </View>
            </View>

            {/* Quick Actions Header */}
            <View style={styles.sectionHeader}>
              <Text style={styles.Header}>Quick Actions</Text>
            </View>

            {/* Dashboard Columns */}
            <View style={styles.dashboardColumns}>
              
              {/* Left Column: Appointments */}
              <View style={styles.column}>
                <Text style={styles.subHeader}>Today Appointments:</Text>
                
                {/* Appointment Card 1 */}
                <TouchableOpacity 
                  style={styles.card} 
                  onPress={() => handlePress("Mart Emman")}
                >
                   {/* Replace source with your actual image path or a URI */}
                  <Image source={{uri: "https://via.placeholder.com/40"}} style={styles.Icon} />
                  <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>Mart Emman</Text>
                    <Text style={styles.cardSubtitle}>Whitening</Text>
                  </View>
                  <Text style={styles.timeText}>10:00</Text>
                </TouchableOpacity>

                {/* Appointment Card 2 */}
                <TouchableOpacity 
                  style={styles.card} 
                  onPress={() => handlePress("Jendri Jacin")}
                >
                  <Image source={{uri: "https://via.placeholder.com/40"}} style={styles.Icon} />
                  <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>Jendri Jacin</Text>
                    <Text style={styles.cardSubtitle}>Aligners</Text>
                  </View>
                  <Text style={styles.timeText}>13:00</Text>
                </TouchableOpacity>

                 {/* Appointment Card 3 */}
                 <TouchableOpacity 
                  style={styles.card} 
                  onPress={() => handlePress("Kyler Per")}
                >
                  <Image source={{uri: "https://via.placeholder.com/40"}} style={styles.Icon} />
                  <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>Kyler Per</Text>
                    <Text style={styles.cardSubtitle}>Root Canals</Text>
                  </View>
                  <Text style={styles.timeText}>15:00</Text>
                </TouchableOpacity>
              </View>

              {/* Right Column: Details / Requests */}
              <View style={styles.column}>
                <Text style={styles.subHeader}>Next Patient Details:</Text>
                <View style={[styles.detailsCard, styles.shadow]}>
                  <Text style={{ textAlign: "center", color: "#555" }}>
                    <Text style={{fontWeight: "bold"}}>Patient Name:</Text> Mart Emman{"\n\n"}
                    <Text style={{fontWeight: "bold"}}>Notes:</Text> Patient requests extra numbing gel. History of sensitivity.
                  </Text>
                </View>

                <Text style={[styles.subHeader, {marginTop: 20}]}>Requests:</Text>
                <View style={styles.card}>
                   <Image source={{uri: "https://via.placeholder.com/40"}} style={styles.Icon} />
                   <View style={styles.cardText}>
                     <Text style={styles.cardTitle}>Marie Yan</Text>
                     <Text style={styles.cardSubtitle}>Request: Cleaning</Text>
                   </View>
                   {/* Action Buttons */}
                   <View style={{flexDirection:'row', gap: 5}}>
                      <View style={[styles.actionBtn, {backgroundColor: '#4ade80'}]} />
                      <View style={[styles.actionBtn, {backgroundColor: '#f87171'}]} />
                   </View>
                </View>
              </View>

            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  topBar: {
    height: 60,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eee"
  },
  topBarText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0b7fab"
  },
  logoutBtn: {
    backgroundColor: "#ef4444",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6
  },
  scrollContent: {
    paddingBottom: 40,
  },
  Container: {
    flex: 1,
    alignItems: "center",
    padding: 20,
  },
  Header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#0b7fab",
    textAlign: "center",
  },
  subHeader: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 10,
  },
  sectionHeader: {
    width: "100%",
    marginTop: 30,
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    paddingBottom: 10,
  },
  
  // Stats Panel
  FirstPanel: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: 10,
    flexWrap: "wrap", 
  },
  Panel: {
    backgroundColor: "#ffffff",
    flex: 1,
    minWidth: 100, // Responsive width
    paddingVertical: 20,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#0b7fab",
  },
  statLabel: {
    fontSize: 14,
    color: "#666",
  },

  // Dashboard Columns
  dashboardColumns: {
    flexDirection: "row",
    width: "100%",
    flexWrap: "wrap", // Allows stacking on small screens
    gap: 20,
  },
  column: {
    flex: 1,
    minWidth: 300, // If screen is small, this column takes full width
  },

  // Cards
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  detailsCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    minHeight: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardText: {
    flex: 1,
    marginLeft: 10,
  },
  cardTitle: {
    fontWeight: "bold",
    fontSize: 14,
    color: "#333",
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#777",
  },
  timeText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0b7fab",
  },
  Icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#eee",
  },
  actionBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  shadow: {
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 5,
  }
});