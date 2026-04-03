import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { auth, db } from "../../firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { useData } from "../../context/DataContext";

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { 
    expenses, 
    diaries, 
    memories, 
    reminders, 
    isInitialLoadDone 
  } = useData();

  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState("User");

  // Derived states from global data
  const todayExpense = expenses.reduce((sum: number, e: any) => {
    const d = e.createdAt?.toDate ? e.createdAt.toDate() : null;
    const now = new Date();
    if (d && d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
      return sum + Number(e.amount || 0);
    }
    return sum;
  }, 0);

  const weekExpense = expenses.reduce((sum: number, e: any) => {
    const d = e.createdAt?.toDate ? e.createdAt.toDate() : null;
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    if (d && d >= sevenDaysAgo && d <= now) {
      return sum + Number(e.amount || 0);
    }
    return sum;
  }, 0);

  const monthExpense = expenses.reduce((sum: number, e: any) => {
    const d = e.createdAt?.toDate ? e.createdAt.toDate() : null;
    const now = new Date();
    if (d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
      return sum + Number(e.amount || 0);
    }
    return sum;
  }, 0);

  const categories = expenses.reduce((acc: any, e: any) => {
    const d = e.createdAt?.toDate ? e.createdAt.toDate() : null;
    const now = new Date();
    if (d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
      const cat = e.category || "Other";
      acc[cat] = (acc[cat] || 0) + Number(e.amount || 0);
    }
    return acc;
  }, {});

  const diaryPreview = diaries.length > 0 ? [...diaries].sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis())[0] : null;
  const photosPreview = [...memories].sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()).slice(0, 4);
  const upcomingReminders = [...reminders].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 3);
  const reminderCount = reminders.length;

  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [showNotificationPopup, setShowNotificationPopup] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);

  const quotes = [
  "A penny saved is a penny earned.",
  "Do not save what is left after spending, but spend what is left after saving.",
  "The art is not in making money, but in keeping it.",
  "Wealth consists not in having great possessions, but in having few wants.",
  "Beware of little expenses. A small leak will sink a great ship.",
  "The secret to wealth is simple: Find a way to do more for others than anyone else does. Become more valuable.",
  "Too many people spend money they haven't earned, to buy things they don't want, to impress people they don't like.",
  "An investment in knowledge pays the best interest.",
  "Be greedy when others are fearful, and fearful when others are greedy.",
  "Opportunities don't happen. You create them.",
  "Don't wait to buy real estate. Buy real estate and wait.",
  "Formal education will make you a living; self-education will make you a fortune.",
  "Money is a great servant but a bad master.",
  "Success is not final, failure is not fatal: it is the courage to continue that counts.",
  "Your work is going to fill a large part of your life, and the only way to be truly satisfied is to do what you believe is great work.",

  // 🔥 NEW ADDED QUOTES
  "Do something today that your future self will thank you for.",
  "Small daily improvements are the key to staggering long-term results.",
  "It's not your salary that makes you rich, it's your spending habits.",
  "Never depend on a single income. Make an investment to create a second source.",
  "The more you learn, the more you earn.",
  "Discipline is choosing between what you want now and what you want most.",
  "Rich people plan for three generations. Poor people plan for Saturday night.",
  "Financial freedom is available to those who learn about it and work for it.",
  "Don’t work for money. Make money work for you.",
  "If you don’t find a way to make money while you sleep, you will work until you die.",
  "Saving money is good, but investing it wisely is better.",
  "You must gain control over your money or the lack of it will forever control you.",
  "The habit of saving is itself an education.",
  "Success usually comes to those who are too busy to be looking for it.",
  "Dream big. Start small. Act now.",
  "The best investment you can make is in yourself.",
  "Focus on being productive instead of busy.",
  "Don’t be afraid to give up the good to go for the great.",
  "Great things never come from comfort zones.",
  "Consistency is what transforms average into excellence.",
  "Your income can grow only to the extent you do.",
  "Build assets before buying liabilities.",
  "Money grows where attention goes.",
  "The goal is not to look rich, but to be rich.",
  "Every master was once a beginner.",
  "Success doesn’t come from what you do occasionally, it comes from what you do consistently."
];

  const [quote, setQuote] = useState(quotes[Math.floor(Math.random() * quotes.length)]);

  useEffect(() => {
    setQuote(quotes[Math.floor(Math.random() * quotes.length)]);
  }, []);

  useEffect(() => {
    let unsubUser: (() => void) | undefined;

    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (unsubUser) {
        unsubUser();
        unsubUser = undefined;
      }

      if (user) {
        const userRef = doc(db, "users", user.uid);
        unsubUser = onSnapshot(userRef, (snap) => {
          if (snap.exists() && snap.data().username) {
            setUserName(snap.data().username);
          } else {
            setUserName(user.displayName || "User");
          }
        });
      } else {
        setUserName("User");
      }
    });

    return () => {
      unsubAuth();
      if (unsubUser) unsubUser();
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    // Data is synced automatically via onSnapshot in DataProvider
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const formattedDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  const monthlyBudget = 20000;
  const budgetPercent = Math.min((monthExpense / monthlyBudget) * 100, 100);
  const sortedCats = Object.entries(categories).sort((a: any, b: any) => b[1] - a[1]).slice(0, 4);

  const getCategoryStyles = (cat: string) => {
    const category = cat?.toLowerCase() || "";
    if (category.includes("food") || category.includes("eat") || category.includes("drink"))
      return { icon: "fast-food", bg: "bg-orange-100", color: "#f97316" };
    if (category.includes("travel") || category.includes("cab") || category.includes("petrol") || category.includes("fuel"))
      return { icon: "car", bg: "bg-blue-100", color: "#3b82f6" };
    if (category.includes("shop") || category.includes("buy") || category.includes("cloth"))
      return { icon: "cart", bg: "bg-purple-100", color: "#a855f7" };
    if (category.includes("bill") || category.includes("rent") || category.includes("emi"))
      return { icon: "receipt", bg: "bg-red-100", color: "#ef4444" };
    if (category.includes("health") || category.includes("med") || category.includes("doctor"))
      return { icon: "heart", bg: "bg-pink-100", color: "#ec4899" };
    if (category.includes("play") || category.includes("movie") || category.includes("game") || category.includes("fun"))
      return { icon: "game-controller", bg: "bg-indigo-100", color: "#6366f1" };
    if (category.includes("upi"))
      return { icon: "qr-code", bg: "bg-emerald-100", color: "#10b981" };

    return { icon: "wallet", bg: "bg-gray-100", color: "#6b7280" };
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "";
    try {
      const date = timestamp?.toDate ? timestamp.toDate() : (timestamp instanceof Date ? timestamp : new Date(timestamp));
      if (isNaN(date.getTime())) return "Recently";
      return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + " • " + date.toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return "Recently";
    }
  };

  const openTransactionDetails = (transaction: any) => {
    setSelectedTransaction(transaction);
    setShowDetailSheet(true);
  };

  if (!isInitialLoadDone && !refreshing) {
    return (
      <View style={{ flex: 1, backgroundColor: "#f9fafb", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#2f5d34" />
        <Text style={{ marginTop: 12, color: "#6b7280", fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>Loading Ledger...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 160 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >

        {/* BRAND GREEN GRADIENT HEADER */}
        <LinearGradient
          colors={['#1a361d', '#2f5d34', '#418249']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="px-5 pt-20 pb-12 rounded-b-[4px] shadow-xl"
        >
          <View className="flex-row justify-between items-center mb-6">
            <TouchableOpacity
              onPress={() => router.push("/(settingsMore)/profile")}
              className="flex-row items-center"
            >


              <View>
                <Text className="text-emerald-100 text-[10px] font-black uppercase tracking-[2px] mb-0.5">{formattedDate}</Text>
                <Text className="text-white text-2xl font-black tracking-tighter">👋 {getGreeting()},</Text>
                <Text className="text-yellow-400 text-xl font-black -mt-1">{userName}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowNotificationPopup(true)}
              className="w-12 h-12 bg-white/20 rounded-full items-center justify-center border border-white/20 shadow-sm"
            >
              <Ionicons name="notifications" size={24} color="#fff" />
              {reminderCount > 0 && (
                <View className="absolute -top-1 -right-1 bg-red-500 min-w-[20px] h-[20px] rounded-full border-2 border-[#2f5d34] items-center justify-center px-1">
                  <Text className="text-white text-[10px] font-black">{reminderCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View className="bg-white/10 p-4 rounded-3xl flex-row items-center border border-white/10">
            <View className="bg-yellow-400/20 w-10 h-10 rounded-full items-center justify-center mr-3">
              <Ionicons name="leaf" size={20} color="#facc15" />
            </View>
            <Text className="text-emerald-50 italic flex-1 text-sm font-medium leading-relaxed">"{quote}"</Text>
          </View>
        </LinearGradient>

        <View className="px-5 -mt-6">

          {/* QUICK ACTIONS */}
          <View className="flex-row justify-between mb-8">
            {[
              { label: "Expense", icon: "wallet", color: "text-[#2f5d34]", bg: "bg-[#e8f1ec]", route: "/(tabs)/expensetrack" },
              { label: "Diary", icon: "journal", color: "text-[#2f5d34]", bg: "bg-[#e8f1ec]", route: "/(tabs)/diarymaintenance" },
              { label: "Event", icon: "calendar", color: "text-[#2f5d34]", bg: "bg-[#e8f1ec]", route: "/(tabs)/reminders" },
              { label: "Memory", icon: "images", color: "text-[#2f5d34]", bg: "bg-[#e8f1ec]", route: "/(tabs)/memories" },
              { label: "Transfer", icon: "swap-horizontal", color: "text-[#2f5d34]", bg: "bg-[#e8f1ec]", route: "/(settingsMore)/transfer" }
            ].map((action, i) => (
              <TouchableOpacity key={i} onPress={() => router.push(action.route as any)} className="items-center w-[18%]">
                <View className={`w-14 h-14 ${action.bg} rounded-2xl items-center justify-center mb-2 shadow-sm border border-white`}>
                  <Ionicons name={action.icon as any} size={24} color="#2f5d34" />
                </View>
                <Text className="text-[10px] text-gray-700 font-bold text-center" numberOfLines={1}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* MAIN SUMMARY */}
          <Text className="text-xl font-extrabold text-gray-800 mb-3 ml-1">Overview</Text>
          <View className="bg-white p-6 rounded-[40px] shadow-lg shadow-gray-200 border border-gray-100 mb-8">
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <View className="bg-red-50 px-3 py-1.5 rounded-2xl self-start mb-2 border border-red-100">
                  <Text className="text-red-500 text-[10px] font-black uppercase tracking-widest">Today Spent</Text>
                </View>
                <Text className="text-4xl font-black text-gray-800 tracking-tighter">
                  ₹{todayExpense.toLocaleString()}
                </Text>
              </View>
              <LinearGradient
                colors={['#f4f7f5', '#e8f1ec']}
                className="p-4 rounded-3xl border border-gray-100 items-end"
              >
                <Text className="text-gray-400 text-[10px] font-bold tracking-widest uppercase mb-1.5">THIS WEEK</Text>
                <Text className="font-black text-gray-700 mb-3 text-sm">₹{weekExpense.toLocaleString()}</Text>
                <Text className="text-gray-400 text-[10px] font-bold tracking-widest uppercase mb-1.5">THIS MONTH</Text>
                <Text className="font-black text-gray-700 text-sm">₹{monthExpense.toLocaleString()}</Text>
              </LinearGradient>
            </View>

            <View className="h-[1px] bg-gray-50 mb-5" />

            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xs font-black text-gray-400 uppercase tracking-widest">Top Categories</Text>
              <TouchableOpacity>
                <Text className="text-[#2f5d34] text-[10px] font-bold uppercase tracking-widest">Analytics</Text>
              </TouchableOpacity>
            </View>

            {sortedCats.length > 0 ? (
              <View>
                <View className="flex-row items-center h-4 rounded-full overflow-hidden mb-4 bg-gray-100/50 p-[2px]">
                  {sortedCats.map((cat: any, index: number) => {
                    const colors = ["bg-[#2f5d34]", "bg-[#598c5b]", "bg-[#8dc38e]", "bg-[#c4deb0]"];
                    const color = colors[index % colors.length];
                    const pct = Math.max((cat[1] / monthExpense) * 100, 5);
                    return <View key={cat[0]} className={`h-full ${color} rounded-full`} style={{ width: `${pct}%`, marginRight: 2 }} />;
                  })}
                </View>
                <View className="flex-row flex-wrap">
                  {sortedCats.map((cat: any, index: number) => {
                    const textColors = ["text-[#2f5d34]", "text-[#598c5b]", "text-[#8dc38e]", "text-[#8bb37c]"];
                    const dotColors = ["bg-[#2f5d34]", "bg-[#598c5b]", "bg-[#8dc38e]", "bg-[#8bb37c]"];
                    const percentage = Math.round((cat[1] / monthExpense) * 100);
                    return (
                      <View key={cat[0]} className="flex-row items-center w-1/2 mb-3">
                        <View className={`w-3.5 h-3.5 rounded-full mr-2.5 shadow-sm ${dotColors[index % dotColors.length]}`} />
                        <Text className="text-sm font-bold text-gray-600 truncate">{cat[0]} <Text className={`font-black ${textColors[index % textColors.length]}`}>{percentage}%</Text></Text>
                      </View>
                    )
                  })}
                </View>
              </View>
            ) : (
              <View className="bg-gray-50 py-5 rounded-[24px] border border-gray-100 border-dashed items-center">
                <Ionicons name="stats-chart" size={24} color="#cbd5e1" className="mb-2" />
                <Text className="text-gray-400 text-xs text-center font-bold tracking-widest uppercase">No spending yet</Text>
              </View>
            )}
          </View>

          {/* BUDGET TRACKER */}
          <Text className="text-xl font-extrabold text-gray-800 mb-3 ml-1">Monthly Budget</Text>
          <View className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 mb-8">
            <View className="flex-row justify-between items-end mb-4">
              <View>
                <Text className="text-gray-400 font-semibold mb-1 text-xs uppercase tracking-wider">Remaining Balance</Text>
                <Text className="text-2xl font-black text-gray-800">
                  ₹{Math.max(monthlyBudget - monthExpense, 0).toLocaleString()}
                </Text>
              </View>
              <View className="items-end bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                <Text className={`font-black text-lg ${budgetPercent > 80 ? "text-red-500" : "text-[#2f5d34]"}`}>
                  {Math.round(budgetPercent)}%
                </Text>
                <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Used</Text>
              </View>
            </View>

            <View className="w-full h-4 bg-gray-100 rounded-full overflow-hidden mb-2">
              <View
                className={`h-full rounded-full ${budgetPercent > 80 ? "bg-red-500" : budgetPercent > 60 ? "bg-yellow-500" : "bg-[#2f5d34]"}`}
                style={{ width: `${budgetPercent}%` }}
              />
            </View>
            <View className="flex-row justify-between">
              <Text className="text-gray-400 text-[10px] font-bold tracking-wider">₹0</Text>
              <Text className="text-gray-400 text-[10px] font-bold tracking-wider">Lmt: ₹{monthlyBudget.toLocaleString()}</Text>
            </View>

            {budgetPercent > 80 && (
              <View className="flex-row items-center mt-4 bg-red-50 p-3 rounded-2xl border border-red-100">
                <Ionicons name="warning" size={20} color="#ef4444" className="mr-3" />
                <Text className="text-red-600 text-sm font-bold flex-1">Slow down! You are close to your monthly limit.</Text>
              </View>
            )}
          </View>

          {/* RECENT TRANSACTIONS */}
          <View className="flex-row justify-between items-center mb-4 ml-1">
            <Text className="text-xl font-extrabold text-gray-800">Recent Transactions</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/expensetrack")} className="bg-[#e8f1ec] px-3 py-1.5 rounded-full">
              <Text className="text-[#2f5d34] font-bold text-xs uppercase tracking-wider">View All</Text>
            </TouchableOpacity>
          </View>

          {expenses.length > 0 ? (
            <View className="mb-8">
              {expenses.slice(0, 5).map((item: any, index: number) => {
                const styles = getCategoryStyles(item.category);
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => openTransactionDetails(item)}
                    activeOpacity={0.85}
                    style={{
                      backgroundColor: "white",
                      borderRadius: 24,
                      padding: 16,
                      marginBottom: 12,
                      borderWidth: 1,
                      borderColor: "#f0f0f0",
                      elevation: 2,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.06,
                      shadowRadius: 8,
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                  >
                    {/* Category Icon */}
                    <View style={{
                      width: 52, height: 52, borderRadius: 18,
                      alignItems: "center", justifyContent: "center",
                      marginRight: 14, backgroundColor: styles.bg.replace("bg-", "")
                    }}
                      className={styles.bg}
                    >
                      <Ionicons name={styles.icon as any} size={22} color={styles.color} />
                    </View>

                    {/* Middle Info */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "800", color: "#1f2937", fontSize: 14, marginBottom: 2 }} numberOfLines={1}>
                        {item.name || item.category || "Payment"}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <View style={{ backgroundColor: "#f3f4f6", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 }}>
                          <Text style={{ color: "#6b7280", fontSize: 9, fontWeight: "800", textTransform: "uppercase" }}>
                            {item.category || "General"}
                          </Text>
                        </View>
                        {item.paymentMethod ? (
                          <View style={{ backgroundColor: "#f0fdf4", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 }}>
                            <Text style={{ color: "#2f5d34", fontSize: 9, fontWeight: "800", textTransform: "uppercase" }}>
                              {item.paymentMethod}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={{ color: "#9ca3af", fontSize: 10, fontWeight: "600", marginTop: 3 }}>
                        {item.createdAt ? item.createdAt.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + " • " + item.createdAt.toDate().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Just Now"}
                      </Text>
                    </View>

                    {/* Amount */}
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontWeight: "900", color: "#ef4444", fontSize: 17 }}>
                        -₹{Number(item.amount).toLocaleString("en-IN")}
                      </Text>
                      <Ionicons name="chevron-forward" size={12} color="#d1d5db" style={{ marginTop: 4 }} />
                    </View>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/expensetrack")}
                style={{ alignItems: "center", paddingVertical: 12, backgroundColor: "#f0fdf4", borderRadius: 18, borderWidth: 1, borderColor: "#dcfce7" }}
              >
                <Text style={{ color: "#2f5d34", fontWeight: "800", fontSize: 13, letterSpacing: 0.5 }}>View All Transactions →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ backgroundColor: "white", padding: 32, borderRadius: 32, borderWidth: 1.5, borderColor: "#e5e7eb", borderStyle: "dashed", marginBottom: 32, alignItems: "center" }}>
              <View style={{ backgroundColor: "#f9fafb", width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <Ionicons name="wallet-outline" size={32} color="#cbd5e1" />
              </View>
              <Text style={{ color: "#9ca3af", fontWeight: "600", marginBottom: 16, fontSize: 14 }}>No transactions yet</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/expensetrack")} style={{ backgroundColor: "#2f5d34", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 }}>
                <Text style={{ color: "white", fontWeight: "800", fontSize: 13 }}>+ Add First Expense</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* DIARY HIGHLIGHT */}
          <Text className="text-xl font-extrabold text-gray-800 mb-3 ml-1">Diary Spotlight</Text>
          <View className="bg-[#234626] p-6 rounded-[32px] shadow-sm mb-8 relative overflow-hidden">
            <LinearGradient
              colors={['#2f5d34', '#1f3e23']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
            {diaryPreview ? (
              <View>
                <View className="bg-white/20 self-start px-3 py-1 rounded-full mb-3 border border-white/20">
                  <Text className="text-white font-bold text-xs tracking-wider uppercase">
                    {diaryPreview.mood ? diaryPreview.mood : "Today's Memory"}
                  </Text>
                </View>
                <Text className="font-black text-white text-2xl mb-2 leading-tight">{diaryPreview.title}</Text>
                <Text className="text-[#a5d2ac] mb-5 italic font-medium leading-relaxed" numberOfLines={2}>"{diaryPreview.description}"</Text>

                <TouchableOpacity onPress={() => router.push("/(tabs)/diarymaintenance")} className="self-end bg-white px-5 py-2.5 rounded-full shadow-sm">
                  <Text className="font-black text-[#2f5d34] uppercase tracking-wider text-xs">Read Journal</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="items-center py-2">
                <View className="bg-white/20 w-16 h-16 rounded-full items-center justify-center mb-4">
                  <Ionicons name="book" size={28} color="#fff" />
                </View>
                <Text className="text-[#a5d2ac] font-semibold mb-5 text-center px-4">You haven't documented your day yet.</Text>
                <TouchableOpacity onPress={() => router.push("/(tabs)/diarymaintenance")} className="bg-white px-6 py-3 rounded-full shadow-sm w-full">
                  <Text className="text-[#2f5d34] font-black text-center tracking-widest uppercase text-xs">Write a Memory</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* MEMORIES */}
          <Text className="text-xl font-extrabold text-gray-800 mb-3 ml-1">Recent Snaps</Text>
          <View className="bg-white p-5 rounded-[32px] shadow-sm border border-gray-100 mb-8">
            {photosPreview.length > 0 ? (
              <View className="flex-row flex-wrap justify-between">
                {photosPreview.map((mem: any, index: number) => (
                  <View key={mem.id} className="w-[48%] mb-4">
                    <Image source={{ uri: mem.image }} className="w-full h-32 rounded-3xl bg-gray-100 mb-2 border border-gray-100" />
                    {mem.title && <Text className="font-bold text-gray-700 text-sm truncate px-1" numberOfLines={1}>{mem.title}</Text>}
                  </View>
                ))}
              </View>
            ) : (
              <View className="flex-row justify-between mb-4">
                <View className="w-[48%] h-32 bg-gray-50 flex border border-gray-200 border-dashed rounded-3xl items-center justify-center">
                  <Ionicons name="image" size={32} color="#cbd5e1" />
                </View>
                <View className="w-[48%] h-32 bg-gray-50 flex border border-gray-200 border-dashed rounded-3xl items-center justify-center">
                  <Ionicons name="image" size={32} color="#cbd5e1" />
                </View>
              </View>
            )}

            <TouchableOpacity onPress={() => router.push("/(tabs)/memories")} className="bg-[#f0f5f2] p-4 rounded-2xl flex-row justify-center items-center">
              <Text className="text-[#2f5d34] font-bold tracking-widest uppercase text-xs">View Full Gallery</Text>
            </TouchableOpacity>
          </View>

          {/* TASKS & REMINDERS */}
          <Text className="text-xl font-extrabold text-gray-800 mb-3 ml-1">Tasks For You</Text>
          <View className="mb-4">
            {[
              { title: "Review Spending", desc: "Check if you're inside the budget", color: "text-[#2f5d34]", bg: "bg-[#e8f1ec]", icon: "pie-chart", route: "/(tabs)/expensetrack" },
              { title: "Add Expenses", desc: "Log today's final purchases", color: "text-[#2f5d34]", bg: "bg-[#e8f1ec]", icon: "wallet", route: "/(tabs)/expensetrack" },
              { title: "Write Diary", desc: "Capture memories before the day ends", color: "text-[#2f5d34]", bg: "bg-[#e8f1ec]", icon: "book", route: "/(tabs)/diarymaintenance" },
            ].map((task, i) => (
              <TouchableOpacity key={i} onPress={() => router.push(task.route as any)} className={`bg-white p-4 rounded-3xl flex-row items-center mb-3 shadow-sm border border-gray-100`}>
                <View className={`${task.bg} w-12 h-12 rounded-2xl flex items-center justify-center mr-4`}>
                  <Ionicons name={task.icon as any} size={22} color="#2f5d34" />
                </View>
                <View className="flex-1">
                  <Text className="font-extrabold text-gray-800 text-base mb-0.5">{task.title}</Text>
                  <Text className="text-xs text-gray-500 font-medium">{task.desc}</Text>
                </View>
                <View className="bg-gray-50 p-2 rounded-full mr-1">
                  <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
          {/* UPCOMING REMINDERS - PREMIUM LOOK */}
          <View className="flex-row justify-between items-center mb-5 ml-1">
            <View>
              <Text className="text-xl font-black text-gray-800 tracking-tight">Schedule</Text>
              <Text className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Events & Reminders</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/reminders")}
              className="bg-[#2f5d34]/10 px-4 py-2 rounded-2xl border border-[#2f5d34]/10"
            >
              <Text className="text-[#2f5d34] font-black text-[10px] uppercase tracking-widest">Open Calendar</Text>
            </TouchableOpacity>
          </View>

          <View className="bg-[#1a361d] p-7 rounded-[48px] shadow-2xl mb-12 shadow-emerald-900/40 relative overflow-hidden">
            {/* Abstract background blobs for premium feel */}
            <View className="absolute -top-10 -right-10 w-40 h-40 bg-[#418249]/20 rounded-full blur-3xl" />
            <View className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl" />

            {upcomingReminders.length > 0 ? (
              upcomingReminders.map((rem: any, idx: number) => {
                const colors: any = {
                  Birthday: { icon: "gift", color: "#ec4899", bg: "bg-pink-400/20" },
                  Meeting: { icon: "people", color: "#3b82f6", bg: "bg-blue-400/20" },
                  Bill: { icon: "receipt", color: "#ef4444", bg: "bg-red-400/20" },
                  Task: { icon: "checkbox", color: "#10b981", bg: "bg-emerald-400/20" },
                  Goal: { icon: "trophy", color: "#f59e0b", bg: "bg-amber-400/20" },
                };
                const style = colors[rem.type] || { icon: "notifications", color: "#a5d2ac", bg: "bg-white/10" };

                return (
                  <TouchableOpacity
                    key={rem.id}
                    onPress={() => router.push("/(tabs)/reminders")}
                    activeOpacity={0.7}
                    className={`flex-row items-center mb-5 ${idx === upcomingReminders.length - 1 ? "" : "border-b border-white/10 pb-5"}`}
                  >
                    <View className={`${style.bg} w-14 h-14 rounded-[22px] items-center justify-center mr-5 shadow-sm`}>
                      <Ionicons name={style.icon} size={26} color={style.color} />
                    </View>
                    <View className="flex-1">
                      <Text className="font-black text-white text-base leading-tight">{rem.title}</Text>
                      <View className="flex-row items-center mt-1">
                        <Ionicons name="time-outline" size={12} color="#a5d2ac" className="mr-1.5" />
                        <Text className="text-[10px] text-[#a5d2ac] font-black uppercase tracking-widest">
                          {new Date(rem.date).toLocaleDateString("en-IN", { month: 'short', day: 'numeric' })} • {rem.time}
                        </Text>
                      </View>
                    </View>
                    <View className="bg-white/10 p-2 rounded-full">
                      <Ionicons name="chevron-forward" size={14} color="#fff" />
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View className="items-center py-6">
                <View className="bg-white/10 w-16 h-16 rounded-full items-center justify-center mb-4">
                  <Ionicons name="calendar-outline" size={32} color="#a5d2ac" />
                </View>
                <Text className="text-[#a5d2ac] font-black text-[10px] text-center uppercase tracking-[4px]">Clear Schedule</Text>
              </View>
            )}
          </View>

        </View>
      </ScrollView>

      {/* TRANSACTION DETAILS BOTTOM SHEET */}
      <Modal
        visible={showDetailSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailSheet(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowDetailSheet(false)}
          className="flex-1 bg-black/60 justify-end"
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            className="bg-white rounded-t-[50px] overflow-hidden"
            style={{ height: '75%' }}
          >
            <View
              style={{ backgroundColor: getCategoryStyles(selectedTransaction?.category).color }}
              className="px-8 pt-10 pb-20 items-center relative"
            >
              <View className="bg-white/20 p-6 rounded-[35px] mb-4">
                <Ionicons name={getCategoryStyles(selectedTransaction?.category).icon as any} size={44} color="white" />
              </View>
              <Text className="text-white/70 font-black uppercase tracking-[4px] text-[10px] mb-1">
                {selectedTransaction?.category || "Expense"}
              </Text>
              <Text className="text-white text-3xl font-black text-center" numberOfLines={1}>
                {selectedTransaction?.name || "Transaction"}
              </Text>

              <TouchableOpacity
                onPress={() => setShowDetailSheet(false)}
                className="absolute top-8 right-8 bg-black/10 p-2 rounded-full"
              >
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            <View className="flex-1 bg-white -mt-12 rounded-t-[50px] px-8 pt-10">
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <View className="items-center mb-8">
                  <Text className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mb-2">Transaction Value</Text>
                  <View className="flex-row items-baseline">
                    <Text className="text-gray-400 text-2xl font-black mr-1">₹</Text>
                    <Text className="text-emerald-900 text-5xl font-black tracking-tight">
                      {selectedTransaction?.amount?.toLocaleString()}
                    </Text>
                  </View>
                </View>

                <View className="flex-row flex-wrap justify-between gap-y-4 mb-8">
                  <View className="w-[48%] bg-gray-50 p-4 rounded-[28px] border border-gray-100">
                    <Ionicons name="card-outline" size={18} color="#2f5d34" className="mb-2" />
                    <Text className="text-gray-400 font-black uppercase text-[8px] tracking-widest mb-1">Payment</Text>
                    <Text className="text-gray-800 font-black text-xs">{selectedTransaction?.paymentMethod || "Direct"}</Text>
                  </View>

                  <View className="w-[48%] bg-gray-50 p-4 rounded-[28px] border border-gray-100">
                    <Ionicons name="location-outline" size={18} color="#2f5d34" className="mb-2" />
                    <Text className="text-gray-400 font-black uppercase text-[8px] tracking-widest mb-1">Location</Text>
                    <Text className="text-gray-800 font-black text-xs" numberOfLines={1}>{selectedTransaction?.location || "Not shared"}</Text>
                  </View>

                  <View className="w-[48%] bg-gray-50 p-4 rounded-[28px] border border-gray-100">
                    <Ionicons name="calendar-outline" size={18} color="#2f5d34" className="mb-2" />
                    <Text className="text-gray-400 font-black uppercase text-[8px] tracking-widest mb-1">Created</Text>
                    <Text className="text-gray-800 font-black text-xs">{selectedTransaction?.createdAt ? formatDate(selectedTransaction.createdAt).split(' ')[0] : "Recently"}</Text>
                  </View>

                  <View className="w-[48%] bg-gray-50 p-4 rounded-[28px] border border-gray-100">
                    <Ionicons name="time-outline" size={18} color="#2f5d34" className="mb-2" />
                    <Text className="text-gray-400 font-black uppercase text-[8px] tracking-widest mb-1">Time</Text>
                    <Text className="text-gray-800 font-black text-xs">{selectedTransaction?.createdAt ? formatDate(selectedTransaction.createdAt).split(' ')[1] : "--:--"}</Text>
                  </View>
                </View>

                {selectedTransaction?.notes && (
                  <View className="mb-8">
                    <Text className="text-gray-900 font-black text-base mb-3 ml-1">Notes</Text>
                    <View className="bg-emerald-50/30 p-5 rounded-[30px] border border-emerald-100/50">
                      <Text className="text-emerald-900/70 font-medium leading-relaxed italic">
                        "{selectedTransaction.notes}"
                      </Text>
                    </View>
                  </View>
                )}

                {selectedTransaction?.receipt && (
                  <View className="mb-6">
                    <Text className="text-gray-900 font-black text-base mb-3 ml-1">Receipt Attachment</Text>
                    <Image
                      source={{ uri: selectedTransaction.receipt }}
                      className="w-full h-64 rounded-[40px] border-4 border-gray-50 bg-gray-100"
                      resizeMode="cover"
                    />
                  </View>
                )}

                <TouchableOpacity
                  onPress={() => {
                    setShowDetailSheet(false);
                    router.push("/(tabs)/expensetrack");
                  }}
                  className="bg-[#2f5d34] py-5 rounded-[24px] items-center mt-4 shadow-lg shadow-emerald-900/20"
                  style={{ marginBottom: Math.max(0, insets.bottom) }}
                >
                  <Text className="text-white font-black uppercase tracking-widest text-xs">Manage in Tracker</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── NOTIFICATION POPUP ── */}
      <Modal visible={showNotificationPopup} transparent animationType="fade" statusBarTranslucent>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-start", alignItems: "flex-end", paddingHorizontal: 20, paddingTop: 100 }}
          onPress={() => setShowNotificationPopup(false)}
          activeOpacity={1}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{ backgroundColor: "white", width: 300, borderRadius: 24, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: "900", color: "#111827" }}>Notifications</Text>
              {upcomingReminders.length > 0 && (
                <View style={{ backgroundColor: "#fef2f2", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }}>
                  <Text style={{ fontSize: 10, fontWeight: "900", color: "#ef4444" }}>{reminders.length} UPCOMING</Text>
                </View>
              )}
            </View>

            {upcomingReminders.length > 0 ? (
              <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                {upcomingReminders.map((r: any) => (
                  <View key={r.id} style={{ marginBottom: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", paddingBottom: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: "800", color: "#374151" }} numberOfLines={1}>{r.title}</Text>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                      <Text style={{ fontSize: 10, fontWeight: "700", color: "#2f5d34", textTransform: "uppercase" }}>{r.type || "Event"}</Text>
                      <Text style={{ fontSize: 10, fontWeight: "700", color: "#9ca3af" }}>{r.date} • {r.time}</Text>
                    </View>
                  </View>
                ))}
                {reminders.length > upcomingReminders.length && (
                  <Text style={{ textAlign: "center", fontSize: 11, color: "#6b7280", fontWeight: "700", marginTop: 8 }}>+{reminders.length - upcomingReminders.length} more reminders</Text>
                )}
              </ScrollView>
            ) : (
              <View style={{ paddingVertical: 20, alignItems: "center" }}>
                <Ionicons name="checkmark-done-circle" size={40} color="#e5e7eb" />
                <Text style={{ fontSize: 12, color: "#9ca3af", fontWeight: "700", marginTop: 8, textAlign: "center" }}>You're all caught up!</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={() => { setShowNotificationPopup(false); router.push("/(tabs)/reminders"); }}
              style={{ backgroundColor: "#2f5d34", paddingVertical: 12, borderRadius: 16, alignItems: "center", marginTop: 16 }}
            >
              <Text style={{ color: "white", fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 }}>Manage Reminders</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}