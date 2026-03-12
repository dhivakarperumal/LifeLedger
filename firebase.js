import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp } from "firebase/app";
import {
  getReactNativePersistence,
  initializeAuth
} from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBGUaDif7Qe5O4qGOCQChuTiTe__G077PM",
  authDomain: "expensivetrackerdairy.firebaseapp.com",
  projectId: "expensivetrackerdairy",
  storageBucket: "expensivetrackerdairy.firebasestorage.app",
  messagingSenderId: "449656809142",
  appId: "1:449656809142:web:3962c630d1a09305ace817",
};

const app = initializeApp(firebaseConfig);

// ✅ Correct for React Native (persistent login)
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

// ✅ Firestore — Force Long Polling to fix transport errors on Android/iOS emulators & Expo Go.
//    experimentalForceLongPolling: true  → always use HTTP long-poll, never WebSocket/gRPC
//    This resolves: "eam 0x... transport errored" and "code=unavailable" errors.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});