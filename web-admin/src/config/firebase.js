import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBGUaDif7Qe5O4qGOCQChuTiTe__G077PM",
  authDomain: "expensivetrackerdairy.firebaseapp.com",
  projectId: "expensivetrackerdairy",
  storageBucket: "expensivetrackerdairy.firebasestorage.app",
  messagingSenderId: "449656809142",
  appId: "1:449656809142:web:3962c630d1a09305ace817",
};

const app = initializeApp(firebaseConfig);

// Standard web auth
export const auth = getAuth(app);
export const db = getFirestore(app);
