// Firebase App 및 Firestore, Auth SDK CDN import
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyD8V6mVYsjHsw8Gcuv909d7bppo1DQNX1M",
  authDomain: "igpartners-ddbf9.firebaseapp.com",
  projectId: "igpartners-ddbf9",
  storageBucket: "igpartners-ddbf9.firebasestorage.app",
  messagingSenderId: "217909826370",
  appId: "1:217909826370:web:69e559a57b2d8a70bd6edb",
  measurementId: "G-2RG951Y39M"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let analytics;
try {
  analytics = getAnalytics(app);
} catch (error) {
  console.warn("Firebase Analytics failed to initialize:", error);
}

export { app, db, auth, analytics };
// Build cache bust: 2026-06-27T16:30:00
