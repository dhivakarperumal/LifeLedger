import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { Animated, Image, Text, TouchableOpacity, View } from "react-native";
import { auth, db } from "../firebase";

export default function TopHeader() {
  const [open, setOpen] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const remindersFadeAnim = useRef(new Animated.Value(0)).current;

  const userDisplayName = auth.currentUser?.displayName || (auth.currentUser?.email ? auth.currentUser.email.split('@')[0].replace(/[._]/g, ' ') : "Account User");
  const userInitial = userDisplayName.trim().charAt(0).toUpperCase();

  const [reminderCount, setReminderCount] = useState(0);
  const [latestReminders, setLatestReminders] = useState<any[]>([]);
  const [selectedReminder, setSelectedReminder] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [detailFadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(detailFadeAnim, {
      toValue: showDetails ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showDetails]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: open ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [open]);

  useEffect(() => {
    Animated.timing(remindersFadeAnim, {
      toValue: remindersOpen ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [remindersOpen]);

  useEffect(() => {
    if (!auth.currentUser?.uid) return;
    const q = query(
      collection(db, "reminders"),
      where("userId", "==", auth.currentUser.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort: closest time first? Or just newest created? 
      // Usually reminders should show upcoming ones.
      setLatestReminders(list.sort((a: any, b: any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)).slice(0, 5));
      setReminderCount(snapshot.size);
    });
    return () => unsubscribe();
  }, []);

  // 🔥 Firebase Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setOpen(false);
      router.replace("/login"); // redirect after logout
    } catch (error) {
      console.log("Logout Error:", error);
    }
  };

  const formatReminderTime = (timestamp: any) => {
    if (!timestamp) return "";
    try {
      const date = timestamp.toDate();
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString([], { day: 'numeric', month: 'short' });
    } catch {
      return "";
    }
  };

  const EVENT_TYPES = [
    { label: "Birthday", icon: "gift", color: "#ec4899" },
    { label: "Meeting", icon: "people", color: "#3b82f6" },
    { label: "Bill", icon: "receipt", color: "#ef4444" },
    { label: "Task", icon: "checkbox", color: "#10b981" },
    { label: "Goal", icon: "trophy", color: "#f59e0b" },
    { label: "Other", icon: "notifications", color: "#6366f1" },
  ];

  return (
    <View className="bg-gray-900 px-5 pt-12 pb-4 shadow-md z-50">

      {/* Header Row */}
      <View className="flex-row items-center justify-between px-0 py-0">

        <View className="flex-row items-center gap-3">
          <View className="bg-white w-10 h-10 rounded-full items-center justify-center p-1.5 shadow-sm">
            <Image
              source={require("../assets/images/logo.png")}
              className="w-full h-full"
              resizeMode="contain"
            />
          </View>
          <Text className="text-xl font-black text-white tracking-tight">
            LifeLedger
          </Text>
        </View>


        {/* Right Section */}
        <View className="flex-row items-center">

          {/* Notification */}
          <TouchableOpacity
            onPress={() => {
              setRemindersOpen(!remindersOpen);
              setOpen(false);
            }}
            className="mr-4 relative"
          >
            <Ionicons name="notifications-outline" size={24} color="#ffffff" />

            {reminderCount > 0 && (
              <View className="absolute -top-2 -right-2 bg-red-500 min-w-[18px] h-[18px] px-1 rounded-full items-center justify-center">
                <Text className="text-white text-[10px] font-bold">{reminderCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setOpen(!open);
              setRemindersOpen(false);
            }}
            className="bg-white w-10 h-10 rounded-full items-center justify-center shadow-lg border-2 border-[#2f5d34]"
          >
            <Text className="text-blue-900 font-black text-lg">
              {userInitial}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Profile Dropdown */}
      {open && (
        <Animated.View
          style={{ opacity: fadeAnim }}
          className="absolute right-5 top-24 bg-white rounded-2xl w-64 p-6 z-50 shadow-2xl border border-gray-100"
        >
          {/* User Info Section */}
          <View className="mb-5 pb-5 border-b border-gray-100 items-center">
            <View className="w-16 h-16 rounded-full bg-emerald-50 items-center justify-center mb-3">
              <Text className="text-emerald-700 font-black text-2xl">{userInitial}</Text>
            </View>
            <Text className="text-gray-900 font-black text-base text-center capitalize" numberOfLines={1}>
              {userDisplayName}
            </Text>
            <Text className="text-gray-400 text-[10px] font-medium text-center italic" numberOfLines={1}>
              {auth.currentUser?.email || "User Session"}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => {
              setOpen(false);
              router.push("/(settingsMore)/profile");
            }}
            className="flex-row items-center py-3 px-2 rounded-2xl active:bg-gray-50 mb-1"
          >
            <View className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center mr-3">
              <Ionicons name="person-outline" size={20} color="#4b5563" />
            </View>
            <Text className="text-gray-700 font-bold text-sm">Profile Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setOpen(false);
              router.push("/(settingsMore)/settings");
            }}
            className="flex-row items-center py-3 px-2 rounded-2xl active:bg-gray-50 mb-2"
          >
            <View className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center mr-3">
              <Ionicons name="settings-outline" size={20} color="#4b5563" />
            </View>
            <Text className="text-gray-700 font-bold text-sm">App Settings</Text>
          </TouchableOpacity>

          <View className="h-[1px] bg-gray-100 my-2" />

          {/* 🔥 Logout */}
          <TouchableOpacity
            onPress={handleLogout}
            className="flex-row items-center py-3 px-2 rounded-2xl active:bg-red-50"
          >
            <View className="w-10 h-10 rounded-full bg-red-50 items-center justify-center mr-3">
              <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            </View>
            <Text className="text-red-500 font-black text-xs uppercase tracking-widest">Sign Out</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Reminders Dropdown */}
      {remindersOpen && (
        <Animated.View
          style={{ opacity: remindersFadeAnim }}
          className="absolute right-5 top-24 bg-white rounded-2xl w-72 p-5 z-50 shadow-2xl border border-gray-100"
        >
          <View className="flex-row justify-between items-center mb-4 pb-2 border-b border-gray-100">
            <Text className="text-gray-900 font-black text-sm uppercase tracking-wider">Quick Reminders</Text>
            <TouchableOpacity onPress={() => { setRemindersOpen(false); router.push("/(tabs)/reminders"); }}>
              <Text className="text-emerald-600 text-[10px] font-black italic">SEE ALL</Text>
            </TouchableOpacity>
          </View>

          {latestReminders.length === 0 ? (
            <View className="py-8 items-center">
              <Ionicons name="notifications-off-outline" size={32} color="#d1d5db" />
              <Text className="text-gray-400 text-xs mt-2 font-bold">No upcoming reminders</Text>
            </View>
          ) : (
            <View>
              {latestReminders.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => {
                    setSelectedReminder(item);
                    setShowDetails(true);
                    setRemindersOpen(false);
                  }}
                  className="mb-3 flex-row items-center gap-3 bg-gray-50/50 p-3 rounded-xl border border-gray-100/50"
                >
                  <View className="w-2 h-2 rounded-full bg-emerald-500" />
                  <View className="flex-1">
                    <Text className="text-gray-800 font-black text-xs leading-tight" numberOfLines={1}>{item.title}</Text>
                    <Text className="text-gray-400 text-[9px] font-bold italic mt-1">{formatReminderTime(item.time || item.createdAt)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={12} color="#cbd5e1" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            onPress={() => {
              setRemindersOpen(false);
              router.push("/(tabs)/reminders");
            }}
            className="mt-2 bg-emerald-600 py-3 rounded-xl items-center justify-center shadow-lg"
          >
            <Text className="text-white font-black text-[10px] tracking-[2px] uppercase">Plan Your Day</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Quick View Details Modal */}
      {showDetails && selectedReminder && (
        <View className="absolute inset-0 w-screen h-screen items-center justify-center z-[100]" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <Animated.View 
            style={{ opacity: detailFadeAnim, transform: [{ scale: detailFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }}
            className="bg-white w-[85%] rounded-[32px] p-8 shadow-2xl"
          >
            {/* Header */}
            <View className="flex-row justify-between items-start mb-6">
              <View className="bg-emerald-50 px-3 py-1 rounded-full">
                <Text className="text-emerald-700 font-black text-[9px] uppercase tracking-widest">{selectedReminder.type || "REMINDER"}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDetails(false)} className="bg-gray-100 p-2 rounded-full">
                <Ionicons name="close" size={20} color="#4b5563" />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View className="items-center mb-6">
              <View className="w-16 h-16 rounded-3xl bg-gray-50 items-center justify-center mb-4 shadow-sm">
                <Ionicons 
                  name={(EVENT_TYPES.find(t => t.label === selectedReminder.type)?.icon as any) || "notifications"} 
                  size={32} 
                  color={(EVENT_TYPES.find(t => t.label === selectedReminder.type)?.color) || "#10b981"} 
                />
              </View>
              <Text className="text-xl font-black text-gray-900 text-center mb-2 px-2">{selectedReminder.title}</Text>
              <View className="flex-row items-center bg-gray-50 px-4 py-2 rounded-2xl">
                <Ionicons name="time-outline" size={14} color="#6b7280" className="mr-2" />
                <Text className="text-gray-500 font-bold text-xs ml-1">
                  {selectedReminder.time ? selectedReminder.time : formatReminderTime(selectedReminder.createdAt)}
                </Text>
              </View>
            </View>

            {selectedReminder.description && (
              <View className="bg-gray-50 rounded-2xl p-4 mb-6">
                <Text className="text-gray-600 font-medium text-xs leading-5 text-center italic">
                  "{selectedReminder.description}"
                </Text>
              </View>
            )}

            {/* Actions */}
            <TouchableOpacity 
              onPress={() => {
                setShowDetails(false);
                router.push("/(tabs)/reminders");
              }}
              className="bg-emerald-600 py-4 rounded-2xl items-center justify-center shadow-lg active:scale-95 transition-all"
            >
              <Text className="text-white font-black text-xs uppercase tracking-[2px]">Manage All Reminders</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}
    </View>
  );
}