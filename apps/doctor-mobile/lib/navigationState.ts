// Temporary state holder for preserving patient details modal state during navigation
let preservedPatientState: {
  patient: any;
  visible: boolean;
} | null = null;

export function preservePatientDetailsState(patient: any) {
  preservedPatientState = { patient, visible: true };
  console.log('Preserved patient state:', patient?.id);
}

export function getPreservedPatientState() {
  const state = preservedPatientState;
  preservedPatientState = null; // Clear after retrieval
  return state;
}

export function clearPreservedPatientState() {
  preservedPatientState = null;
}
