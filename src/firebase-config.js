import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyDKpfusYsj5MX-Cmy5WqAtfygATw-lWfKo",
  authDomain: "december-debutante-auction.firebaseapp.com",
  projectId: "december-debutante-auction",
  storageBucket: "december-debutante-auction.firebasestorage.app",
  messagingSenderId: "861467845952",
  appId: "1:861467845952:web:a6e57174ff8e72580806a5",
  measurementId: "G-Q5GK42WC68"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { database };
