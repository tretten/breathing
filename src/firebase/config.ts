// src/firebase/config.ts
// ============================================================================
// Firebase Configuration
// ============================================================================

import { initializeApp } from 'firebase/app';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';

// Replace with your Firebase config from Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyAJbZ5eVH7GySL6d5kl2n2DvE7OLrdCvSE",
  authDomain: "breathing-stan.firebaseapp.com",
  databaseURL: "https://breathing-stan-default-rtdb.firebaseio.com",
  projectId: "breathing-stan",
  storageBucket: "breathing-stan.firebasestorage.app",
  messagingSenderId: "839370645444",
  appId: "1:839370645444:web:ab9c853e5b048cacce0e91",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database
export const db = getDatabase(app);

// Connect to emulator in development (optional)
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  connectDatabaseEmulator(db, 'localhost', 9000);
}

export default app;
