import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import FilterSheet, { applyFilters, defaultFilterState, FilterState } from "../../components/FilterSheet";

import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where
} from "firebase/firestore";

export default function ExpenseTrack() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const { 
    expenses: expenseList, 
    transfers: transferList, 
    isInitialLoadDone 
  } = useData();

  const { user } = useAuth() as any;
  const uid = user?.uid;

  const [showSheet, setShowSheet] = useState(false);
  useEffect(() => {
    navigation.getParent()?.setOptions({
      tabBarStyle: (showSheet) ? { display: 'none' } : {
        backgroundColor: "#111827",
        borderTopWidth: 0,
        paddingTop: 6,
        paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
        height: 60 + insets.bottom,
      }
    });
  }, [showSheet, navigation, insets.bottom]);

  const [selectedTransfer, setSelectedTransfer] = useState<any>(null);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  const [category, setCategory] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filteredExpenseList, setFilteredExpenseList] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingItem, setViewingItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);

  // ─── Toast ────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const toastAnim = useRef(new Animated.Value(-100)).current;

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    Animated.sequence([
      Animated.spring(toastAnim, { toValue: 60, useNativeDriver: true, bounciness: 12 }),
      Animated.delay(2500),
      Animated.timing(toastAnim, { toValue: -100, duration: 400, useNativeDriver: true }),
    ]).start(() => setToast(null));
  };

  const EXPENSE_FILTER_GROUPS = [
    { key: "category", label: "Category", options: ["Food", "Travel", "Shopping", "Bills", "Health", "Fun", "UPI"], multi: true },
    { key: "payment", label: "Payment Method", options: ["Cash", "UPI", "Credit Card", "Debit Card", "Net Banking"], multi: true },
  ];
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterState, setFilterState] = useState<FilterState>(defaultFilterState(EXPENSE_FILTER_GROUPS));

  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [documentName, setDocumentName] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState<string | null>(null);

  const PRESET_CATEGORIES = [
    { name: "Food", icon: "fast-food", color: "#f97316", bg: "bg-orange-100" },
    { name: "Travel", icon: "car", color: "#3b82f6", bg: "bg-blue-100" },
    { name: "Shopping", icon: "cart", color: "#a855f7", bg: "bg-purple-100" },
    { name: "Bills", icon: "receipt", color: "#ef4444", bg: "bg-red-100" },
    { name: "Health", icon: "heart", color: "#ec4899", bg: "bg-pink-100" },
    { name: "Fun", icon: "game-controller", color: "#6366f1", bg: "bg-indigo-100" },
    { name: "UPI", icon: "qr-code", color: "#10b981", bg: "bg-emerald-100" },
  ];

  // UPI Scanner States
  const [showScanner, setShowScanner] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scannedUPI, setScannedUPI] = useState<string | null>(null);
  const [scannedName, setScannedName] = useState("");
  const [showUPIDetails, setShowUPIDetails] = useState(false);

  const expenseRef = collection(db, "expenses");
  const transferRef = collection(db, "transfers");

  useEffect(() => {
    let result = applyFilters(expenseList, filterState, "createdAt");

    const catFilter = filterState.chips["category"] || [];
    if (catFilter.length > 0) {
      result = result.filter(item =>
        catFilter.some(c => item.category?.toLowerCase().includes(c.toLowerCase()))
      );
    }

    const payFilter = filterState.chips["payment"] || [];
    if (payFilter.length > 0) {
      result = result.filter(item =>
        payFilter.some(p => item.paymentMethod?.toLowerCase().includes(p.toLowerCase()))
      );
    }

    if (searchQuery.trim() !== "") {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(
        item =>
          item.category?.toLowerCase().includes(lowerQuery) ||
          item.name?.toLowerCase().includes(lowerQuery)
      );
    }

    setFilteredExpenseList(result);
  }, [searchQuery, expenseList, filterState]);

  const pickDocument = async () => {
    try {
      Alert.alert(
        "Upload Receipt",
        "Choose a file type",
        [
          {
            text: "Image (Photo Library)",
            onPress: async () => {
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                quality: 0.7,
                base64: true
              });
              if (!result.canceled) {
                setReceipt(`data:image/jpeg;base64,${result.assets[0].base64}`);
                setDocumentName("receipt_image.jpg");
                setDocumentType("image");
              }
            }
          },
          {
            text: "Document (PDF/Docs)",
            onPress: async () => {
              const result = await DocumentPicker.getDocumentAsync({
                type: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
                copyToCacheDirectory: true
              });
              if (!result.canceled) {
                setReceipt(result.assets[0].uri);
                setDocumentName(result.assets[0].name);
                setDocumentType("document");
              }
            }
          },
          { text: "Cancel", style: "cancel" }
        ]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to pick file");
    }
  };

  const addExpense = async () => {
    if (!selectedTransfer) {
      showToast("Select transfer source", "error");
      return;
    }
    if (!category?.trim()) {
      showToast("Please enter a valid category", "error");
      return;
    }

    setLoading(true);
    try {
      const expenseAmount = Number(amount);
      if (isNaN(expenseAmount) || expenseAmount <= 0) {
        setLoading(false);
        showToast("Enter a valid positive amount", "error");
        return;
      }

      const remaining = selectedTransfer.remainingAmount ?? selectedTransfer.amount ?? 0;
      if (expenseAmount > remaining) {
        setLoading(false);
        showToast(`Not enough balance (₹${remaining} left)`, "error");
        return;
      }

      if (editingId) {
        await updateDoc(doc(db, "expenses", editingId), {
          name,
          category,
          paymentMethod,
          notes,
          location,
          receipt,
        });
        showToast("Expense updated successfully", "success");
      } else {
        await addDoc(expenseRef, {
          name,
          amount: expenseAmount,
          category,
          paymentMethod,
          notes,
          location,
          receipt,
          documentName,
          documentType,
          transferId: selectedTransfer.id,
          userId: uid,
          createdAt: serverTimestamp(),
          expenseDate: date instanceof Date && !isNaN(date.getTime()) ? Timestamp.fromDate(date) : serverTimestamp()
        });

        const transferDoc = doc(db, "transfers", selectedTransfer.id);
        await updateDoc(transferDoc, {
          remainingAmount: remaining - expenseAmount
        });
        showToast("Expense added successfully", "success");
      }

      setName("");
      setAmount("");
      setCategory("");
      setPaymentMethod("");
      setNotes("");
      setLocation("");
      setReceipt(null);
      setEditingId(null);
      setShowSheet(false);
    } catch (e) {
      console.error("ADD EXPENSE ERROR", e);
      Alert.alert("Error", "Failed to save transaction");
    } finally {
      setLoading(false);
    }
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;

    try {
      if (data.startsWith("upi://pay")) {
        setScanned(true);
        const url = new URL(data);
        const params = url.searchParams;
        const pa = params.get("pa") || "";
        const pn = params.get("pn") || "";
        const am = params.get("am") || "";

        setScannedUPI(pa);
        setScannedName(pn || pa);
        setAmount(am);

        setShowScanner(false);
        setShowUPIDetails(true);
      } else {
        setScanned(true);
        Alert.alert("Invalid QR", "This QR code is not a valid UPI payment code.", [{ text: "OK", onPress: () => setScanned(false) }]);
      }
    } catch (error) {
      console.error(error);
      setScanned(true);
      Alert.alert("Error", "Failed to parse QR code.", [{ text: "OK", onPress: () => setScanned(false) }]);
    }
  };

  const confirmAndPay = async () => {
    if (!amount || isNaN(Number(amount))) {
      Alert.alert("Invalid Amount", "Please enter a valid amount to pay.");
      return;
    }

    if (!scannedUPI) return;

    const upiUrl = `upi://pay?pa=${scannedUPI}&pn=${encodeURIComponent(scannedName)}&am=${amount}&cu=INR`;

    try {
      const supported = await Linking.canOpenURL(upiUrl);
      if (supported) {
        await Linking.openURL(upiUrl);
        setName(scannedName);
        setPaymentMethod("UPI");
        setCategory("UPI Payment");
        setShowUPIDetails(false);
        setShowSheet(true);
        Alert.alert("Payment Initiated", "Check your UPI app to complete payment. Don't forget to 'Save Expense' here!");
      } else {
        Alert.alert("Error", "No UPI apps found on this device.");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to open UPI app.");
    }
  };

  const startScanning = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert("Permission Required", "Camera permission is needed to scan QR codes.");
        return;
      }
    }
    setScanned(false);
    setShowScanner(true);
  };

  const openAddModal = () => {
    setEditingId(null);
    setName("");
    setAmount("");
    setCategory("");
    setPaymentMethod("");
    setNotes("");
    setLocation("");
    setReceipt(null);
    setDocumentName(null);
    setDocumentType(null);
    setDate(new Date());
    setSelectedTransfer(null);
    setShowSheet(true);
  };

  const openEditModal = (item: any) => {
    setEditingId(item.id);
    setName(item.name || "");
    setAmount(item.amount?.toString() || "");
    setCategory(item.category || "");
    setPaymentMethod(item.paymentMethod || "");
    setNotes(item.notes || "");
    setLocation(item.location || "");
    setReceipt(item.receipt || null);
    setDocumentName(item.documentName || null);
    setDocumentType(item.documentType || (item.receipt ? "image" : null));
    setDate(item.expenseDate ? item.expenseDate.toDate() : (item.createdAt ? item.createdAt.toDate() : new Date()));
    const transfer = transferList.find((t: any) => t.id === item.transferId);
    setSelectedTransfer(transfer || null);
    setShowSheet(true);
  };

  const openViewModal = (item: any) => {
    setViewingItem(item);
    setShowViewModal(true);
  };

  const confirmDelete = (item: any) => {
    setItemToDelete(item);
    setDeleteModalVisible(true);
  };

  const deleteExpense = async () => {
    if (!itemToDelete) return;
    try {
      setLoading(true);
      await deleteDoc(doc(db, "expenses", itemToDelete.id));
      setItemToDelete(null);
      showToast("Expense deleted successfully", "success");
      setDeleteModalVisible(false);
    } catch (e) {
      showToast("Failed to delete", "error");
      setDeleteModalVisible(false);
    } finally {
      setLoading(false);
    }
  };

  const formatDateFull = (timestamp: any) => {
    if (!timestamp) return "";
    try {
      const d = timestamp?.toDate ? timestamp.toDate() : (timestamp instanceof Date ? timestamp : new Date(timestamp));
      if (isNaN(d.getTime())) return "Recently";
      return (
        d.toLocaleDateString("en-IN", { day: 'numeric', month: 'short' }) +
        " \u2022 " +
        d.toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })
      );
    } catch (e) {
      return "Recently";
    }
  };

  const formatDateShort = (timestamp: any) => {
    if (!timestamp) return "";
    try {
      const d = timestamp?.toDate ? timestamp.toDate() : (timestamp instanceof Date ? timestamp : new Date(timestamp));
      if (isNaN(d.getTime())) return "Recently";
      return d.toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return "Recently";
    }
  };

  const formatTimeShort = (dateObj: Date) => {
    try {
      if (!dateObj || isNaN(dateObj.getTime())) return "--:--";
      return dateObj.toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return "--:--";
    }
  };

  const getCategoryStyles = (cat: string) => {
    const categoryName = cat?.toLowerCase() || "";
    if (categoryName.includes("food") || categoryName.includes("eat") || categoryName.includes("drink"))
      return { icon: "fast-food", bg: "bg-orange-100", color: "#f97316" };
    if (categoryName.includes("travel") || categoryName.includes("cab") || categoryName.includes("petrol") || categoryName.includes("fuel"))
      return { icon: "car", bg: "bg-blue-100", color: "#3b82f6" };
    if (categoryName.includes("shop") || categoryName.includes("buy") || categoryName.includes("cloth"))
      return { icon: "cart", bg: "bg-purple-100", color: "#a855f7" };
    if (categoryName.includes("bill") || categoryName.includes("rent") || categoryName.includes("emi"))
      return { icon: "receipt", bg: "bg-red-100", color: "#ef4444" };
    if (categoryName.includes("health") || categoryName.includes("med") || categoryName.includes("doctor"))
      return { icon: "heart", bg: "bg-pink-100", color: "#ec4899" };
    if (categoryName.includes("play") || categoryName.includes("movie") || categoryName.includes("game") || categoryName.includes("fun"))
      return { icon: "game-controller", bg: "bg-indigo-100", color: "#6366f1" };
    if (categoryName.includes("upi"))
      return { icon: "qr-code", bg: "bg-emerald-100", color: "#10b981" };

    return { icon: "wallet", bg: "bg-gray-100", color: "#6b7280" };
  };

  return (
    <SafeAreaView edges={[]} className="flex-1 ">
      <View className="flex-1 bg-gray-100 p-0 mt-5 px-4">
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
          <View style={{
            flex: 1, flexDirection: "row", alignItems: "center",
            backgroundColor: "white",
            borderRadius: 18,
            paddingHorizontal: 16, paddingVertical: 14,
            borderWidth: 1.5, borderColor: "#f0f0f0",
            shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
            minHeight: 56, marginRight: 10,
          }}>
            <View style={{ backgroundColor: "#f0fdf4", borderRadius: 10, padding: 6, marginRight: 10 }}>
              <Ionicons name="search" size={18} color="#2f5d34" />
            </View>
            <TextInput
              placeholder="Search by category or name..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{ flex: 1, fontSize: 14, fontWeight: "600", color: "#111827", paddingVertical: 0 }}
              placeholderTextColor="#9ca3af"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")} style={{ padding: 2 }}>
                <Ionicons name="close-circle" size={20} color="#d1d5db" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={() => setFilterVisible(true)}
            style={{
              width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center",
              backgroundColor: (filterState.datePreset !== "all" || Object.values(filterState.chips).some(a => a.length > 0)) ? "#2f5d34" : "white",
              borderWidth: 1.5, borderColor: (filterState.datePreset !== "all" || Object.values(filterState.chips).some(a => a.length > 0)) ? "#2f5d34" : "#f0f0f0",
              shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
            }}
          >
            <Ionicons name="options-outline" size={22} color={(filterState.datePreset !== "all" || Object.values(filterState.chips).some(a => a.length > 0)) ? "white" : "#374151"} />
          </TouchableOpacity>
        </View>

        <FilterSheet
          visible={filterVisible}
          onClose={() => setFilterVisible(false)}
          onApply={(s) => setFilterState(s)}
          chipGroups={EXPENSE_FILTER_GROUPS}
          activeFilters={filterState}
        />

        {(!isInitialLoadDone || loading) && (
          <View style={{ paddingVertical: 10 }}>
            <ActivityIndicator size="large" color="#2f5d34" />
          </View>
        )}

        <FlatList
          data={filteredExpenseList}
          keyExtractor={(item) => item.id}
          keyboardDismissMode="on-drag"
          numColumns={2}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={{ justifyContent: "space-between", paddingHorizontal: 0 }}
          contentContainerStyle={{ paddingBottom: 120, paddingTop: 4 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 60 }}>
              <Ionicons name="receipt-outline" size={56} color="#e5e7eb" />
              <Text style={{ color: "#9ca3af", fontWeight: "700", marginTop: 16, fontSize: 15 }}>No expenses yet</Text>
              <Text style={{ color: "#d1d5db", fontSize: 12, marginTop: 4 }}>Tap + to add your first expense</Text>
            </View>
          }
          renderItem={({ item }) => {
            const catStyle = getCategoryStyles(item.category);
            return (
              <TouchableOpacity
                onPress={() => openViewModal(item)}
                activeOpacity={0.88}
                style={{
                  width: "48.5%",
                  marginBottom: 14,
                  borderRadius: 22,
                  backgroundColor: "white",
                  padding: 14,
                  borderWidth: 1,
                  borderColor: "#f0f0f0",
                  elevation: 2,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.07,
                  shadowRadius: 8,
                  minHeight: 150,
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <View style={{ backgroundColor: catStyle.bg, padding: 8, borderRadius: 12 }}>
                    <Ionicons name={catStyle.icon as any} size={18} color={catStyle.color} />
                  </View>
                  <TouchableOpacity
                    onPress={() => confirmDelete(item)}
                    style={{ backgroundColor: "#fef2f2", padding: 7, borderRadius: 10 }}
                  >
                    <Ionicons name="trash" size={13} color="#ef4444" />
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1, marginBottom: 8 }}>
                  <Text style={{ color: "#9ca3af", fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }} numberOfLines={1}>
                    {item.category || "General"}
                  </Text>
                  <Text style={{ color: "#1f2937", fontWeight: "800", fontSize: 13, lineHeight: 17 }} numberOfLines={2}>
                    {item.name || "Payment"}
                  </Text>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={{ color: "#ef4444", fontWeight: "900", fontSize: 17 }}>
                    \u20B9{Number(item.amount).toLocaleString("en-IN")}
                  </Text>
                  {item.paymentMethod ? (
                    <View style={{ backgroundColor: "#f0fdf4", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8 }}>
                      <Text style={{ color: "#2f5d34", fontSize: 8, fontWeight: "800" }}>{item.paymentMethod}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={{ paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f3f4f6", flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name="time-outline" size={10} color="#9ca3af" style={{ marginRight: 4 }} />
                  <Text style={{ color: "#9ca3af", fontSize: 9, fontWeight: "600", flex: 1 }} numberOfLines={1}>
                    {formatDateFull(item.expenseDate || item.createdAt)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <TouchableOpacity
        onPress={startScanning}
        style={{
          position: "absolute",
          bottom: 90,
          right: 20,
          width: 55,
          height: 55,
          borderRadius: 30,
          backgroundColor: "#1e40af",
          justifyContent: "center",
          alignItems: "center",
          elevation: 6
        }}
      >
        <Ionicons name="qr-code" size={28} color="white" />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={openAddModal}
        style={{
          position: "absolute", bottom: 23, right: 20, width: 55, height: 55, borderRadius: 33,
          backgroundColor: "#2f5d34", alignItems: "center", justifyContent: "center",
          elevation: 12, shadowColor: "#2f5d34", shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.4, shadowRadius: 16, zIndex: 99
        }}
      >
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>

      <Modal visible={showSheet} transparent animationType="slide" statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: 'flex-end' }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: '100%', maxHeight: '92%' }}
          >
            <View style={{ backgroundColor: "white", borderTopLeftRadius: 40, borderTopRightRadius: 40, height: '100%', paddingTop: 24, paddingHorizontal: 24, paddingBottom: Math.max(24, insets.bottom + 10), shadowColor: "#000", shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20, overflow: 'hidden' }}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
                  <Text style={{ fontSize: 22, fontWeight: "900", color: "#111827" }}>{editingId ? "Edit Transaction" : "New Expense"}</Text>
                  <TouchableOpacity onPress={() => setShowSheet(false)} style={{ backgroundColor: "#f1f5f9", padding: 9, borderRadius: 14 }}>
                    <Ionicons name="close" size={22} color="#374151" />
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <Text style={{ color: "#9ca3af", fontSize: 10, fontWeight: "500", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
                    Receipt Attachment
                  </Text>
                  <TouchableOpacity onPress={pickDocument} style={{ backgroundColor: "#f0fdf4", padding: 8, borderRadius: 12, marginBottom: 8 }}>
                    <Ionicons name="cloud-upload" size={18} color="#2f5d34" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={() => receipt ? null : pickDocument()}
                  style={{ width: "100%", height: 210, borderRadius: 24, overflow: "hidden", borderWidth: 2, borderStyle: receipt ? "solid" : "dashed", borderColor: receipt ? "#e5e7eb" : "#d1d5db", backgroundColor: "#f8fafc", marginBottom: 24 }}
                >
                  {receipt ? (
                    <View style={{ flex: 1 }}>
                      {documentType === "image" ? (
                        <Image source={{ uri: receipt }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                      ) : (
                        <View style={{ flex: 1, backgroundColor: "#111827", alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name="document-text" size={52} color="#4ade80" />
                          <Text style={{ color: "white", fontWeight: "700", marginTop: 8 }}>{documentName}</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        onPress={() => { setReceipt(null); setDocumentName(null); setDocumentType(null); }}
                        style={{ position: "absolute", top: 12, right: 12, backgroundColor: "rgba(239,68,68,0.9)", borderRadius: 12, padding: 8 }}
                      >
                        <Ionicons name="trash" size={18} color="white" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="cloud-upload-outline" size={50} color="#cbd5e1" />
                      <Text style={{ color: "#9ca3af", fontWeight: "700", marginTop: 10, fontSize: 14 }}>Tap to add Receipt</Text>
                      <Text style={{ fontSize: 10, color: '#2f5d34', fontWeight: 'bold', marginTop: 4 }}>Image or PDF supported</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <View style={{ flexDirection: "row", marginBottom: 24 }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ color: "#9ca3af", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Source</Text>
                    <View style={{ backgroundColor: "#f8fafc", borderRadius: 18, borderWidth: 1.5, borderColor: "#f0f0f0", overflow: "hidden" }}>
                      <Picker
                        selectedValue={selectedTransfer?.id || ""}
                        onValueChange={(v) => setSelectedTransfer(transferList.find((i: any) => i.id === v) || null)}
                        style={{ color: "#111827", height: 50, width: "100%" }}
                      >
                        <Picker.Item label="Select" value="" color="#9ca3af" />
                        {transferList.map((t: any) => <Picker.Item key={t.id} label={`${t.name} - \u20B9${t.remainingAmount ?? t.amount}`} value={t.id} />)}
                      </Picker>
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#9ca3af", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Mode</Text>
                    <View style={{ backgroundColor: "#f8fafc", borderRadius: 18, borderWidth: 1.5, borderColor: "#f0f0f0", overflow: "hidden" }}>
                      <Picker
                        selectedValue={paymentMethod}
                        onValueChange={setPaymentMethod}
                        style={{ color: "#111827", height: 50, width: "100%" }}
                      >
                        <Picker.Item label="Select" value="" color="#9ca3af" />
                        <Picker.Item label="Cash" value="Cash" />
                        <Picker.Item label="UPI" value="UPI" />
                        <Picker.Item label="Card" value="Credit Card" />
                      </Picker>
                    </View>
                  </View>
                </View>

                <Text style={{ color: "#9ca3af", fontSize: 11, fontWeight: "800", textTransform: "uppercase", marginBottom: 8 }}>Total Amount</Text>
                <TextInput
                  placeholder="Enter Amount (\u20B9)"
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                  style={{ backgroundColor: "#f8fafc", borderRadius: 18, padding: 16, fontSize: 15, fontWeight: "700", color: "#111827", borderWidth: 1.5, borderColor: "#f0f0f0", marginBottom: 20 }}
                  placeholderTextColor="#9ca3af"
                />

                <Text style={{ color: "#9ca3af", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12, marginTop: 11 }}>Categorization</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
                  {PRESET_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.name}
                      onPress={() => setCategory(cat.name)}
                      style={{ marginRight: 10, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 16, backgroundColor: category === cat.name ? "#2f5d34" : "#f8fafc", flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: category === cat.name ? "#2f5d34" : "#f0f0f0" }}
                    >
                      <View style={{ padding: 6, borderRadius: 10, backgroundColor: category === cat.name ? "rgba(255,255,255,0.2)" : cat.bg, marginRight: 8 }}>
                        <Ionicons name={cat.icon as any} size={14} color={category === cat.name ? "white" : cat.color} />
                      </View>
                      <Text style={{ fontWeight: "800", color: category === cat.name ? "white" : "#111827", fontSize: 13 }}>{cat.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={{ color: "#9ca3af", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>What was this for?</Text>
                <TextInput
                  placeholder="E.g. Dinner, Fuel, Grocery"
                  value={name}
                  onChangeText={setName}
                  style={{ backgroundColor: "#f8fafc", borderRadius: 18, padding: 16, fontSize: 15, fontWeight: "700", color: "#111827", borderWidth: 1.5, borderColor: "#f0f0f0", marginBottom: 20 }}
                  placeholderTextColor="#9ca3af"
                />

                <Text style={{ color: "#9ca3af", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Transaction Time</Text>
                <View style={{ flexDirection: "row", marginBottom: 20 }}>
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(true)}
                    style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", borderWidth: 1.5, borderColor: "#f0f0f0", borderRadius: 18, padding: 16, marginRight: 10 }}
                  >
                    <Ionicons name="calendar-outline" size={16} color="#2f5d34" style={{ marginRight: 8 }} />
                    <Text style={{ color: "#374151", fontWeight: "700", fontSize: 13 }}>{formatDateShort(date)}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setShowTimePicker(true)}
                    style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", borderWidth: 1.5, borderColor: "#f0f0f0", borderRadius: 18, padding: 16 }}
                  >
                    <Ionicons name="time-outline" size={16} color="#2f5d34" style={{ marginRight: 8 }} />
                    <Text style={{ color: "#374151", fontWeight: "700", fontSize: 13 }}>{formatTimeShort(date)}</Text>
                  </TouchableOpacity>
                </View>

                <Text style={{ color: "#9ca3af", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Location / Shop</Text>
                <TextInput
                  placeholder="Where did you spend?"
                  value={location}
                  onChangeText={setLocation}
                  style={{ backgroundColor: "#f8fafc", borderWidth: 1.5, borderColor: "#f0f0f0", borderRadius: 18, paddingHorizontal: 16, paddingVertical: 16, fontSize: 13, fontWeight: "700", color: "#111827", marginBottom: 12 }}
                  placeholderTextColor="#9ca3af"
                />

                <Text style={{ color: "#9ca3af", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Optional Notes</Text>
                <TextInput
                  placeholder="Add extra details here..."
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  style={{ backgroundColor: "#f8fafc", borderRadius: 20, padding: 16, fontSize: 14, fontWeight: "600", color: "#111827", borderWidth: 1.5, borderColor: "#f0f0f0", minHeight: 80, marginBottom: 24 }}
                  textAlignVertical="top"
                  placeholderTextColor="#9ca3af"
                />

                <TouchableOpacity
                  onPress={addExpense}
                  disabled={loading}
                  style={{ backgroundColor: loading ? "#9ca3af" : "#2f5d34", borderRadius: 20, paddingVertical: 18, alignItems: "center", shadowColor: loading ? "#9ca3af" : "#2f5d34", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 }}
                >
                  {loading ? <ActivityIndicator color="white" /> : <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.5 }}>{editingId ? "Update Detail" : "Confirm Expense"}</Text>}
                </TouchableOpacity>

                {showDatePicker && (
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display="default"
                    onChange={(_, d) => { setShowDatePicker(false); if (d) { const newDate = new Date(date); newDate.setFullYear(d.getFullYear(), d.getMonth(), d.getDate()); setDate(newDate); } }}
                    maximumDate={new Date()}
                  />
                )}

                {showTimePicker && (
                  <DateTimePicker
                    value={date}
                    mode="time"
                    display="default"
                    onChange={(_, d) => { setShowTimePicker(false); if (d) { const newDate = new Date(date); newDate.setHours(d.getHours(), d.getMinutes()); setDate(newDate); } }}
                  />
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={showScanner} animationType="fade">
        <SafeAreaView className="flex-1 bg-black">
          <View className="flex-1">
            <CameraView
              style={StyleSheet.absoluteFillObject}
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            />
            <View style={styles.overlay}>
              <View style={styles.unfocusedContainer}></View>
              <View style={styles.middleContainer}>
                <View style={styles.unfocusedContainer}></View>
                <View style={styles.focusedContainer}>
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />
                </View>
                <View style={styles.unfocusedContainer}></View>
              </View>
              <View style={styles.unfocusedContainer}></View>
            </View>
            <TouchableOpacity onPress={() => setShowScanner(false)} className="absolute top-10 right-6 bg-white/20 p-2 rounded-full">
              <Ionicons name="close" size={30} color="white" />
            </TouchableOpacity>
            <View className="absolute bottom-20 left-0 right-0 items-center">
              <Text className="text-white text-lg font-bold bg-black/60 px-4 py-2 rounded-full">Scan UPI QR Code to Pay</Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal visible={showUPIDetails} transparent animationType="slide" statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: 'flex-end' }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: '100%', maxHeight: '92%' }}
          >
            <View style={{ backgroundColor: "white", borderTopLeftRadius: 40, borderTopRightRadius: 40, height: '100%', padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20, overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Text style={{ fontSize: 24, fontWeight: '900', color: '#1f2937' }}>Payment Details</Text>
                <TouchableOpacity onPress={() => setShowUPIDetails(false)} style={{ backgroundColor: '#f3f4f6', padding: 8, borderRadius: 20 }}>
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>
              <View style={{ alignItems: 'center', marginBottom: 32, backgroundColor: '#eff6ff', padding: 24, borderRadius: 32 }}>
                <View style={{ backgroundColor: '#2563eb', padding: 20, borderRadius: 30, marginBottom: 16 }}>
                  <Ionicons name="person" size={40} color="white" />
                </View>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#1f2937', marginBottom: 4 }}>{scannedName}</Text>
                <View style={{ backgroundColor: '#dbeafe', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 }}>
                  <Text style={{ color: '#1d4ed8', fontWeight: '800', fontSize: 12 }}>{scannedUPI}</Text>
                </View>
              </View>
              <Text style={{ color: '#9ca3af', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2, fontSize: 10, marginBottom: 12, marginLeft: 8 }}>Enter Amount</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 24, paddingHorizontal: 24, paddingVertical: 8, marginBottom: 32, borderWidth: 2, borderColor: '#dbeafe' }}>
                <Text style={{ fontSize: 32, fontWeight: '900', color: '#2563eb', marginRight: 12 }}></Text>
                <TextInput
                  style={{ flex: 1, fontSize: 32, fontWeight: '900', color: '#1f2937' }}
                  keyboardType="numeric"
                  placeholder="0"
                  value={amount}
                  onChangeText={setAmount}
                  placeholderTextColor="#d1d5db"
                  autoFocus
                />
              </View>
              <TouchableOpacity
                onPress={confirmAndPay}
                activeOpacity={0.8}
                style={{ backgroundColor: '#1d4ed8', padding: 24, borderRadius: 28, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#1d4ed8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 }}
              >
                <Ionicons name="paper-plane" size={24} color="white" />
                <Text style={{ color: 'white', fontWeight: '900', fontSize: 18, marginLeft: 12, textTransform: 'uppercase', letterSpacing: 2 }}>Confirm & Pay</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={showViewModal} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setShowViewModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: 'white', borderTopLeftRadius: 50, borderTopRightRadius: 50, height: '90%', overflow: 'hidden', shadowColor: "#000", shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 }}>
            <View style={{ backgroundColor: getCategoryStyles(viewingItem?.category).color, paddingHorizontal: 32, paddingTop: 40, paddingBottom: 80, alignItems: 'center' }}>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 24, borderRadius: 35, marginBottom: 16 }}>
                <Ionicons name={getCategoryStyles(viewingItem?.category).icon as any} size={48} color="white" />
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 4, fontSize: 10, marginBottom: 4 }}>{viewingItem?.category || "General Expense"}</Text>
              <Text style={{ color: 'white', fontSize: 28, fontWeight: '900', textAlign: 'center' }} numberOfLines={1}>{viewingItem?.name || "Payment"}</Text>
              <TouchableOpacity onPress={() => setShowViewModal(false)} style={{ position: 'absolute', top: 32, right: 32, backgroundColor: 'rgba(0,0,0,0.1)', padding: 8, borderRadius: 20 }}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, backgroundColor: 'white', marginTop: -48, borderTopLeftRadius: 50, borderTopRightRadius: 50, paddingHorizontal: 32, paddingTop: 40 }}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ alignItems: 'center', marginBottom: 40 }}>
                  <Text style={{ color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, fontSize: 10, marginBottom: 8 }}>Total Amount</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    <Text style={{ color: '#9ca3af', fontSize: 24, fontWeight: '900', marginRight: 4 }}>\u20B9</Text>
                    <Text style={{ color: '#111827', fontSize: 60, fontWeight: '900', letterSpacing: -1 }}>{viewingItem?.amount}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 40 }}>
                  <View style={{ width: '48%', backgroundColor: '#f9fafb', padding: 20, borderRadius: 30, borderWidth: 1, borderColor: '#f3f4f6', marginBottom: 16 }}>
                    <Ionicons name="wallet-outline" size={20} color="#2f5d34" style={{ marginBottom: 8 }} />
                    <Text style={{ color: '#9ca3af', fontWeight: '900', textTransform: 'uppercase', fontSize: 8, letterSpacing: 2, marginBottom: 4 }}>Method</Text>
                    <Text style={{ color: '#1f2937', fontWeight: '900', fontSize: 14 }}>{viewingItem?.paymentMethod || "Cash"}</Text>
                  </View>
                  <View style={{ width: '48%', backgroundColor: '#f9fafb', padding: 20, borderRadius: 30, borderWidth: 1, borderColor: '#f3f4f6', marginBottom: 16 }}>
                    <Ionicons name="location-outline" size={20} color="#2f5d34" style={{ marginBottom: 8 }} />
                    <Text style={{ color: '#9ca3af', fontWeight: '900', textTransform: 'uppercase', fontSize: 8, letterSpacing: 2, marginBottom: 4 }}>Location</Text>
                    <Text style={{ color: '#1f2937', fontWeight: '900', fontSize: 14 }} numberOfLines={1}>{viewingItem?.location || "Not set"}</Text>
                  </View>
                  <View style={{ width: '48%', backgroundColor: '#f9fafb', padding: 20, borderRadius: 30, borderWidth: 1, borderColor: '#f3f4f6', marginBottom: 16 }}>
                    <Ionicons name="calendar-outline" size={20} color="#2f5d34" style={{ marginBottom: 8 }} />
                    <Text style={{ color: '#9ca3af', fontWeight: '900', textTransform: 'uppercase', fontSize: 8, letterSpacing: 2, marginBottom: 4 }}>Date</Text>
                    <Text style={{ color: '#1f2937', fontWeight: '900', fontSize: 14 }}>{viewingItem?.expenseDate ? formatDateShort(viewingItem.expenseDate) : "Today"}</Text>
                  </View>
                  <View style={{ width: '48%', backgroundColor: '#f9fafb', padding: 20, borderRadius: 30, borderWidth: 1, borderColor: '#f3f4f6', marginBottom: 16 }}>
                    <Ionicons name="time-outline" size={20} color="#2f5d34" style={{ marginBottom: 8 }} />
                    <Text style={{ color: '#9ca3af', fontWeight: '900', textTransform: 'uppercase', fontSize: 8, letterSpacing: 2, marginBottom: 4 }}>Time</Text>
                    <Text style={{ color: '#1f2937', fontWeight: '900', fontSize: 14 }}>{viewingItem?.expenseDate ? formatTimeShort(viewingItem.expenseDate.toDate()) : "--:--"}</Text>
                  </View>
                </View>
                {viewingItem?.notes && (
                  <View style={{ marginBottom: 40 }}>
                    <Text style={{ color: '#111827', fontWeight: '900', fontSize: 18, marginBottom: 16 }}>Notes</Text>
                    <View style={{ backgroundColor: '#f9fafb', padding: 24, borderRadius: 35, borderWidth: 1, borderStyle: 'dashed', borderColor: '#e5e7eb' }}>
                      <Text style={{ color: '#4b5563', fontWeight: '500', lineHeight: 24 }}>{viewingItem.notes}</Text>
                    </View>
                  </View>
                )}
                {viewingItem?.receipt && (
                  <View style={{ marginBottom: 40 }}>
                    <Text style={{ color: '#111827', fontWeight: '900', fontSize: 18, marginBottom: 16 }}>Receipt Attachment</Text>
                    <Image source={{ uri: viewingItem.receipt }} style={{ width: '100%', height: 320, borderRadius: 40, borderWidth: 4, borderColor: '#f9fafb' }} resizeMode="cover" />
                  </View>
                )}
                <View style={{ flexDirection: 'row', marginBottom: 60 }}>
                  <TouchableOpacity onPress={() => { setShowViewModal(false); openEditModal(viewingItem); }} style={{ flex: 1, backgroundColor: '#111827', height: 80, borderRadius: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginRight: 16, elevation: 8 }}>
                    <Ionicons name="create-outline" size={20} color="white" />
                    <Text style={{ color: 'white', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, fontSize: 14, marginLeft: 12 }}>Edit Detail</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setShowViewModal(false); confirmDelete(viewingItem); }} style={{ backgroundColor: '#fef2f2', width: 80, height: 80, borderRadius: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fee2e2' }}>
                    <Ionicons name="trash-outline" size={24} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={deleteModalVisible} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: "white", width: "100%", borderRadius: 32, padding: 24, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#fef2f2", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Ionicons name="trash" size={32} color="#ef4444" />
            </View>
            <Text style={{ fontSize: 24, fontWeight: '900', color: '#111827', marginBottom: 8 }}>Delete Expense?</Text>
            <Text style={{ color: "#6b7280", textAlign: "center", marginBottom: 32, paddingHorizontal: 16, fontWeight: "500", lineHeight: 20 }}>Are you sure you want to delete this expense? This action cannot be undone.</Text>
            <View style={{ flexDirection: "row", width: "100%" }}>
              <TouchableOpacity onPress={() => setDeleteModalVisible(false)} style={{ flex: 1, paddingVertical: 16, borderRadius: 18, backgroundColor: "#f3f4f6", alignItems: "center", marginRight: 12 }}>
                <Text style={{ color: "#4b5563", fontWeight: "800", fontSize: 18 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={deleteExpense} disabled={loading} style={{ flex: 1, paddingVertical: 16, borderRadius: 18, backgroundColor: "#ef4444", alignItems: "center" }}>
                {loading ? <ActivityIndicator color="white" size="small" /> : <Text style={{ color: "white", fontWeight: "800", fontSize: 18 }}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {toast && (
        <Animated.View style={{ position: "absolute", top: 0, left: 20, right: 20, zIndex: 9999, transform: [{ translateY: toastAnim }], backgroundColor: toast.type === "success" ? "#2f5d34" : (toast.type === "error" ? "#ef4444" : "#3b82f6"), paddingVertical: 14, paddingHorizontal: 20, borderRadius: 20, flexDirection: "row", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 10 }}>
          <View style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, padding: 4, marginRight: 12 }}>
            <Ionicons name={toast.type === "success" ? "checkmark-circle" : (toast.type === "error" ? "alert-circle" : "information-circle")} size={20} color="white" />
          </View>
          <Text style={{ color: "white", fontWeight: "800", fontSize: 14, flex: 1 }}>{toast.message}</Text>
        </Animated.View>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  unfocusedContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  middleContainer: {
    flexDirection: 'row',
    height: 250,
  },
  focusedContainer: {
    width: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#4ade80',
    borderWidth: 4,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderBottomWidth: 0,
    borderRightWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
  },
});