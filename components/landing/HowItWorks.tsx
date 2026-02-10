import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Smartphone, Camera, Brain, CircuitBoard, Activity, CheckCircle, ArrowDown } from 'lucide-react-native';

const HowItWorks: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>How It Works</Text>
        <Text style={styles.subtitle}>
          We’ve simplified dental monitoring into three secure steps.
        </Text>
      </View>

      {/* Steps Container */}
      <View style={styles.stepsContainer}>
        {/* Connecting Line */}
        <View style={styles.connectingLine} />

        {/* --- STEP 1: CAPTURE --- */}
        <View style={styles.stepCard}>
          <View style={styles.iconContainer}>
            <Smartphone size={40} color="#94a3b8" />
            <View style={styles.badge}>
              <Camera size={16} color="white" />
            </View>
          </View>
          <Text style={styles.stepTitle}>1. Capture & Upload</Text>
          <Text style={styles.stepDesc}>
            Use your phone to take guided photos. Encrypted for your privacy.
          </Text>
        </View>

        {/* Arrow Connector */}
        <View style={styles.arrowContainer}>
          <ArrowDown size={32} color="#22d3ee" />
        </View>

        {/* --- STEP 2: AI ANALYSIS --- */}
        <View style={styles.stepCard}>
          <View style={styles.iconContainer}>
            <Brain size={40} color="#0891b2" />
            <View style={{ position: 'absolute', bottom: -5, right: -5, opacity: 0.5 }}>
               <CircuitBoard size={24} color="#22d3ee" />
            </View>
          </View>
          <Text style={styles.stepTitle}>2. AI-Driven Analysis</Text>
          <Text style={styles.stepDesc}>
            Our Python AI scans for inflammation and tissue health instantly.
          </Text>
        </View>

        {/* Arrow Connector */}
        <View style={styles.arrowContainer}>
           <ArrowDown size={32} color="#22d3ee" />
        </View>

        {/* --- STEP 3: TRACK PROGRESS --- */}
        <View style={styles.stepCard}>
          <View style={styles.iconContainer}>
            <Activity size={40} color="#334155" />
            <View style={[styles.badge, { backgroundColor: '#22c55e' }]}>
              <CheckCircle size={16} color="white" />
            </View>
          </View>
          <Text style={styles.stepTitle}>3. Track Progress</Text>
          <Text style={styles.stepDesc}>
            View your recovery timeline and know exactly when to see a doctor.
          </Text>
        </View>

      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 40,
    backgroundColor: '#f8fafc', // Changed to white to blend with main page
    alignItems: 'center',
    width: '100%',
  },
  header: {
    paddingVertical: 20,
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  stepsContainer: {
    width: '100%',
    alignItems: 'center',
    position: 'relative',
  },
  connectingLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    zIndex: -1,
  },
  stepCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    // Shadow
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    marginBottom: 0,
    zIndex: 1,
  },
  iconContainer: {
    width: 80,
    height: 80,
    backgroundColor: '#f0f9ff',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#0891b2',
    padding: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'white',
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  stepDesc: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  arrowContainer: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    paddingVertical: 10,
  },
});

export default HowItWorks;