import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging';

const firebaseConfig = {
  projectId: 'smileguard-67e16',
  appId: '1:1000239306890:android:21f597f3d0da613cc57573',
  messagingSenderId: '1000239306890',
  apiKey: 'AIzaSyCxSGPlnVzXvHz1KbgLHnwpyrsHoJNaTq0',
};

let app: any = null;

export const initFirebase = () => {
  if (!app) {
    try {
      app = initializeApp(firebaseConfig);
      console.log('✅ Firebase initialized');
    } catch (err) {
      console.error('❌ Firebase init failed:', err);
    }
  }
  return app;
};

export const getFirebaseMessaging = () => {
  const firebase = initFirebase();
  if (firebase) {
    return getMessaging(firebase);
  }
  return null;
};
