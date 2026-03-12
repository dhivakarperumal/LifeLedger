import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../firebase";

export default function More() {
  const router = useRouter();
  const user = auth.currentUser;
  const [userName, setUserName] = useState(user?.displayName || "User");

  useEffect(() => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists() && snap.data().username) {
        setUserName(snap.data().username);
      } else {
        setUserName(user.displayName || "User");
      }
    });
    return () => unsub();
  }, [user]);

  const MenuItem = ({ icon, label, subLabel, route, color = "#2f5d34", bg = "#e8f1ec" }: any) => (
    <TouchableOpacity
      onPress={() => router.push(route)}
      className="bg-white p-5 rounded-[32px] shadow-sm border border-gray-100 flex-row items-center justify-between mb-4"
    >
      <View className="flex-row items-center flex-1">
        <View style={{ backgroundColor: bg }} className="w-14 h-14 rounded-2xl items-center justify-center mr-4">
          <Ionicons name={icon} size={28} color={color} />
        </View>
        <View className="flex-1 pr-2">
          <Text className="text-lg font-black text-gray-800">{label}</Text>
          <Text className="text-xs text-gray-400 font-bold uppercase tracking-wider">{subLabel}</Text>
        </View>
      </View>
      <View className="bg-gray-50 p-2 rounded-full">
        <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >

        {/* Profile Header */}
        <View className="px-6 pt-10 pb-8">
          <View className="flex-row items-center justify-between mb-8">
            <View className="flex-row items-center">
              <View className="w-20 h-20 bg-[#2f5d34] rounded-[24px] items-center justify-center shadow-xl border-4 border-white">
                <Text className="text-white text-3xl font-black">{userName?.charAt(0)?.toUpperCase() || "U"}</Text>
              </View>
              <View className="ml-5">
                <Text className="text-2xl font-black text-gray-900 tracking-tight">{userName}</Text>
                <View className="flex-row items-center bg-gray-100 self-start px-2 py-1 rounded-md mt-1">
                  <Ionicons name="shield-checkmark" size={12} color="#2f5d34" />
                  <Text className="text-[10px] font-black text-gray-500 ml-1 uppercase letter-tracking-widest">Premium Member</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/(settingsMore)/profile")}
              className="bg-white p-3 rounded-full shadow-sm border border-gray-100"
            >
              <Ionicons name="pencil" size={20} color="#374151" />
            </TouchableOpacity>
          </View>

          {/* Settings Grid Header */}
          <Text className="text-gray-400 font-black text-xs uppercase mb-6 tracking-widest ml-1">Account Management</Text>

          <MenuItem
            icon="person-outline"
            label="My Profile"
            subLabel="Edit personal details"
            route="/(settingsMore)/profile"
            color="#1e40af"
            bg="#eff6ff"
          />

          <MenuItem
            icon="cash-outline"
            label="Monthly Income"
            subLabel="Manage budget source"
            route="/(settingsMore)/income"
            color="#047857"
            bg="#ecfdf5"
          />

          <MenuItem
            icon="swap-horizontal-outline"
            label="Transactions"
            subLabel="View money movement"
            route="/(settingsMore)/transfer"
            color="#b45309"
            bg="#fffbeb"
          />

          {/* <MenuItem
            icon="add-circle-outline"
            label="Premium Features"
            subLabel="Unlock insights & maps"
            route="/(settingsMore)/addexpensive"
            color="#7c3aed"
            bg="#f5f3ff"
          /> */}

          <MenuItem
            icon="calendar-outline"
            label="Calendar & Reminders"
            subLabel="Meetings, Bills & Tasks"
            route="/(tabs)/reminders"
            color="#2f5d34"
            bg="#e8f1ec"
          />

          <MenuItem
            icon="bar-chart-outline"
            label="Analytics & Reports"
            subLabel="Weekly, Monthly & Custom reports"
            route="/(settingsMore)/reports"
            color="#6366f1"
            bg="#eef2ff"
          />

          <Text className="text-gray-400 font-black text-xs uppercase mt-8 mb-6 tracking-widest ml-1">App Settings</Text>

          <MenuItem
            icon="settings-outline"
            label="Settings"
            subLabel="Privacy & Notifications"
            route="/(settingsMore)/settings"
            color="#374151"
            bg="#f3f4f6"
          />

          <MenuItem
            icon="cloud-download-outline"
            label="Backup & Export"
            subLabel="PDF, ZIP & Cloud Sync"
            route="/(settingsMore)/backup"
            color="#0891b2"
            bg="#ecfeff"
          />



          {/* Quick Logout */}
          <TouchableOpacity
            onPress={async () => {
              await auth.signOut();
              router.replace("/login");
            }}
            className="mt-10 items-center justify-center"
          >
            <View className="bg-red-50 px-6 py-3 rounded-full border border-red-100 flex-row items-center">
              <Ionicons name="log-out-outline" size={18} color="#ef4444" />
              <Text className="text-red-500 font-black text-xs uppercase tracking-widest ml-2">Sign Out Account</Text>
            </View>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}