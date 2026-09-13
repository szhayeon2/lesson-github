import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyCqhNgKsjg1rx3SpyqxNAqpjObixxLI6iI",
  authDomain: "class-github.firebaseapp.com",
  projectId: "class-github",
  storageBucket: "class-github.firebasestorage.app",
  messagingSenderId: "483602443765",
  appId: "1:483602443765:web:204c0052585c066f5d84bc"
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
