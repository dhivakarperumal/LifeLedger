import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "firebase/firestore";
import FilterSheet, { applyFilters, defaultFilterState } from "../../components/FilterSheet";
import { auth, db } from "../../firebase";

export default function Income() {
  const [uid, setUid] = useState(auth.currentUser?.uid || null);
  const [authLoaded, setAuthLoaded] = useState(false);

  const router = useRouter();

  const [workName, setWorkName] = useState("");
  const [amount, setAmount] = useState("");
  const [slip, setSlip] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [incomeList, setIncomeList] = useState([]);
  const [filteredIncomeList, setFilteredIncomeList] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [documentName, setDocumentName] = useState(null);
  const [documentType, setDocumentType] = useState(null);

  const [filterVisible, setFilterVisible] = useState(false);
  const [filterState, setFilterState] = useState(defaultFilterState([]));

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [loading, setLoading] = useState(false);

  // ─── Toast ────────────────────────────────────────────────────────
  const [toast, setToast] = useState(null);
  const toastAnim = useRef(new Animated.Value(-100)).current;

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    Animated.sequence([
      Animated.spring(toastAnim, { toValue: 60, useNativeDriver: true, bounciness: 12 }),
      Animated.delay(2500),
      Animated.timing(toastAnim, { toValue: -100, duration: 400, useNativeDriver: true }),
    ]).start(() => setToast(null));
  };

  const incomeRef = collection(db, "income");

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUid(user.uid);
        setAuthLoaded(true);
      } else {
        setUid(null);
        setAuthLoaded(true);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (authLoaded && uid) {
      fetchIncome();
    }
  }, [uid, authLoaded]);

  const fetchIncome = async () => {
    if (!uid) {
      console.log("[Income] Skipping fetch - No UID available.");
      return;
    }
    
    console.log("[Income] Fetching income for UID:", uid);
    
    try {
      setLoading(true);
      const q = query(incomeRef, where("userId", "==", uid));
      const snapshot = await getDocs(q);

      console.log(`[Income] Fetch successful. Found ${snapshot.docs.length} records.`);

      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      list.sort((a, b) => {
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return b.createdAt.toMillis() - a.createdAt.toMillis();
      });

      setIncomeList(list);
      setFilteredIncomeList(list);
    } catch (e) {
      console.error("FETCH INCOME ERROR:", e.message || e);
      if (e.code === 'permission-denied') {
        console.warn("[Income] Access denied. Check Firestore security rules for 'income' collection.");
      }
      showToast("Failed to load income data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let result = applyFilters(incomeList, filterState, "createdAt");

    if (searchQuery.trim() !== "") {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(
        item =>
          item.workName?.toLowerCase().includes(lowerQuery) ||
          item.amount?.toString().includes(lowerQuery)
      );
    }
    setFilteredIncomeList(result);
  }, [searchQuery, incomeList, filterState]);

  const pickDocument = async () => {
    try {
      Alert.alert(
        "Upload Payment Slip",
        "Choose a file type",
        [
          {
            text: "Image (Gallery)",
            onPress: async () => {
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                quality: 0.7,
                base64: true,
              });
              if (!result.canceled) {
                setSlip(`data:image/jpeg;base64,${result.assets[0].base64}`);
                setDocumentName(result.assets[0].fileName || "slip_image.jpg");
                setDocumentType("image");
              }
            }
          },
          {
            text: "Document (PDF)",
            onPress: async () => {
              const result = await DocumentPicker.getDocumentAsync({
                type: ["application/pdf"],
                copyToCacheDirectory: true
              });
              if (!result.canceled) {
                setSlip(result.assets[0].uri);
                setDocumentName(result.assets[0].name);
                setDocumentType("document");
              }
            }
          },
          { text: "Cancel", style: "cancel" }
        ]
      );
    } catch (e) {
      console.error("PICK DOC ERROR", e);
    }
  };

  const addIncome = async () => {
    if (!workName || !amount) {
      showToast("Please fill in all required fields", "error");
      return;
    }

    try {
      setLoading(true);
      const incomeAmount = Number(amount);
      if (isNaN(incomeAmount) || incomeAmount <= 0) {
        showToast("Enter a valid amount", "error");
        setLoading(false);
        return;
      }

      if (editingId) {
        await updateDoc(doc(db, "income", editingId), {
          workName,
          amount: incomeAmount,
          slip,
          documentName,
          documentType,
          userId: uid,
        });
        showToast("Income updated successfully!", "success");
      } else {
        await addDoc(incomeRef, {
          workName,
          amount: incomeAmount,
          remainingAmount: incomeAmount,
          slip,
          documentName,
          documentType,
          userId: uid,
          createdAt: serverTimestamp(),
        });
        showToast("Income added successfully!", "success");
      }

      setWorkName("");
      setAmount("");
      setSlip(null);
      setDocumentName(null);
      setDocumentType(null);
      setEditingId(null);
      setShowModal(false);
      fetchIncome();
    } catch (e) {
      console.error("ADD INCOME ERROR", e);
      showToast("Failed to save income", "error");
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setWorkName(item.workName);
    setAmount(item.amount?.toString() || "");
    setSlip(item.slip || null);
    setDocumentName(item.documentName || null);
    setDocumentType(item.documentType || null);
    setShowModal(true);
  };

  const confirmDelete = (id) => {
    setItemToDelete(id);
    setDeleteModalVisible(true);
  };

  const deleteIncome = async () => {
    if (!itemToDelete) return;
    setDeleteModalVisible(false);
    try {
      setLoading(true);
      await deleteDoc(doc(db, "income", itemToDelete));
      setItemToDelete(null);
      showToast("Income deleted successfully!", "success");
      fetchIncome();
    } catch (e) {
      console.error("DELETE INCOME ERROR", e);
      showToast("Failed to delete income", "error");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";

    try {
      const date = timestamp?.toDate ? timestamp.toDate() : (timestamp instanceof Date ? timestamp : new Date(timestamp));
      if (isNaN(date.getTime())) return "";

      return (
        date.toLocaleDateString("en-IN") +
        " • " +
        date.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    } catch (e) {
      return "";
    }
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: "#111827" }}>

      {/* HEADER */}
      <View className="bg-gray-900 px-4 py-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back-circle-outline" size={34} color="white" />
        </TouchableOpacity>

        <Text className="text-white text-xl font-bold">
          Monthly Income
        </Text>
      </View>

      {/* CONTENT */}
      <View className="flex-1 bg-gray-100">

        <View className="flex-row items-center mx-4 mt-4 mb-2 gap-2">
          <View className="bg-white flex-1 px-4 py-2.5 rounded-xl shadow flex-row items-center border border-gray-100">
            <Ionicons name="search" size={20} color="#111827" className="mr-2" />
            <TextInput
              placeholder="Search by work name or amount..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="flex-1 ml-2 text-[#111827] font-bold"
              placeholderTextColor="#9ca3af"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={20} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={() => setFilterVisible(true)}
            className={`w-14 h-14 rounded-xl items-center justify-center shadow ${filterState.datePreset !== 'all' ? 'bg-[#2f5d34]' : 'bg-white border border-gray-100'}`}
          >
            <Ionicons name="options-outline" size={22} color={filterState.datePreset !== 'all' ? 'white' : '#374151'} />
          </TouchableOpacity>
        </View>

        <FilterSheet
          visible={filterVisible}
          onClose={() => setFilterVisible(false)}
          onApply={(s) => setFilterState(s)}
          activeFilters={filterState}
        />

        {loading && (
          <View className="py-2 items-center">
            <ActivityIndicator size="large" color="#2f5d34" />
          </View>
        )}

        <FlatList
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          data={filteredIncomeList}
          keyExtractor={(item) => item.id}
          keyboardDismissMode="on-drag"
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          ListEmptyComponent={
            <Text className="text-center text-gray-500 mt-10">
              No income entries found
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => openEditModal(item)}
              activeOpacity={0.88}
              style={{
                width: "48%", marginBottom: 16, borderRadius: 24,
                backgroundColor: "white", padding: 16,
                borderWidth: 1, borderColor: "#f0f0f0",
                elevation: 2, shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <View style={{ backgroundColor: "#f0fdf4", padding: 8, borderRadius: 12 }}>
                  <Ionicons name="card" size={18} color="#2f5d34" />
                </View>
                <TouchableOpacity
                  onPress={() => confirmDelete(item.id)}
                  style={{ backgroundColor: "#fef2f2", padding: 8, borderRadius: 10 }}
                >
                  <Ionicons name="trash" size={14} color="#ef4444" />
                </TouchableOpacity>
              </View>

              <View style={{ marginBottom: 8 }}>
                <Text style={{ color: "#9ca3af", fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>
                  Income Source
                </Text>
                <Text style={{ color: "#1f2937", fontWeight: "800", fontSize: 13 }} numberOfLines={2}>
                  {item.workName}
                </Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: "auto" }}>
                <Text style={{ color: "#2f5d34", fontWeight: "900", fontSize: 18 }}>
                  ₹{item.amount}
                </Text>
                <Ionicons name="chevron-forward" size={12} color="#9ca3af" />
              </View>

              <View style={{ marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f9fafb", flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="time-outline" size={10} color="#9ca3af" style={{ marginRight: 4 }} />
                <Text style={{ color: "#9ca3af", fontSize: 9, fontWeight: "600" }}>
                  {item.createdAt ? formatDate(item.createdAt).split(' • ')[0] : "Recently"}
                </Text>
              </View>

              {item.slip && (
                <View style={{ marginTop: 12, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#f3f4f6" }}>
                  {item.documentType === "document" ? (
                    <View style={{ backgroundColor: "#111827", height: 60, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="document-text" size={24} color="#4ade80" />
                      <Text style={{ color: "white", fontSize: 8, fontWeight: "700", marginTop: 2 }} numberOfLines={1}>{item.documentName}</Text>
                    </View>
                  ) : (
                    <Image source={{ uri: item.slip }} style={{ width: "100%", height: 60 }} resizeMode="cover" />
                  )}
                </View>
              )}
            </TouchableOpacity>
          )}
        />

      </View>

      {/* FLOAT BUTTON */}
      <TouchableOpacity
        onPress={() => {
          setEditingId(null);
          setWorkName("");
          setAmount("");
          setSlip(null);
          setDocumentName(null);
          setDocumentType(null);
          setShowModal(true);
        }}
        style={{
          position: "absolute", bottom: 70, right: 24, width: 55, height: 55, borderRadius: 28,
          backgroundColor: "#2f5d34", alignItems: "center", justifyContent: "center",
          elevation: 12, shadowColor: "#2f5d34", shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.4, shadowRadius: 16, zIndex: 99
        }}
      >
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>

      {/* MODAL */}
      <Modal visible={showModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior="padding"
          style={{ flex: 1 }}
        >
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: "white", maxHeight: "92%", borderTopLeftRadius: 40, borderTopRightRadius: 40, paddingTop: 24, paddingHorizontal: 24, paddingBottom: 36 }}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 60 }}>

                {/* Header */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
                  <Text style={{ fontSize: 22, fontWeight: "900", color: "#111827" }}>{editingId ? "Edit Income" : "New Income Entry"}</Text>
                  <TouchableOpacity onPress={() => setShowModal(false)} style={{ backgroundColor: "#f1f5f9", padding: 9, borderRadius: 14 }}>
                    <Ionicons name="close" size={22} color="#374151" />
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <Text style={{ color: "#9ca3af", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
                    Upload Payment Proof
                  </Text>
                  <TouchableOpacity onPress={pickDocument} style={{ backgroundColor: "#f0fdf4", padding: 8, borderRadius: 12, marginBottom: 8 }}>
                    <Ionicons name="attach" size={18} color="#2f5d34" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={() => slip ? null : pickDocument()}
                  style={{ width: "100%", height: 180, borderRadius: 24, overflow: "hidden", borderWidth: 2, borderStyle: slip ? "solid" : "dashed", borderColor: slip ? "#e5e7eb" : "#d1d5db", backgroundColor: "#f8fafc", marginBottom: 20 }}
                >
                  {slip ? (
                    <View style={{ flex: 1 }}>
                      {documentType === "document" ? (
                        <View style={{ flex: 1, backgroundColor: "#111827", alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name="document-text" size={52} color="#4ade80" />
                          <Text style={{ color: "white", fontWeight: "700", marginTop: 8 }}>{documentName}</Text>
                        </View>
                      ) : (
                        <Image source={{ uri: slip }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                      )}
                      <TouchableOpacity
                        onPress={() => { setSlip(null); setDocumentName(null); setDocumentType(null); }}
                        style={{ position: "absolute", top: 12, right: 12, backgroundColor: "rgba(239,68,68,0.9)", borderRadius: 12, padding: 8 }}
                      >
                        <Ionicons name="trash" size={18} color="white" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="attach-outline" size={50} color="#cbd5e1" />
                      <Text style={{ color: "#9ca3af", fontWeight: "700", marginTop: 10, fontSize: 14 }}>Tap to add Proof</Text>
                      <Text style={{ fontSize: 10, color: '#2f5d34', fontWeight: 'bold', marginTop: 4 }}>Image or Receipt PDF</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Amount Pad */}
                <Text
                  style={{
                    color: "#9ca3af",
                    fontSize: 10,
                    fontWeight: "800",
                    textTransform: "uppercase",
                    letterSpacing: 1.5,
                    marginBottom: 6
                  }}
                >
                  Transaction Details
                </Text>

                <TextInput
                  placeholder="Enter Amount (₹)"
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                  style={{
                    backgroundColor: "#f8fafc",
                    borderRadius: 18,
                    padding: 16,
                    fontSize: 16,
                    fontWeight: "700",
                    color: "#111827",
                    borderWidth: 1.5,
                    borderColor: "#f0f0f0",
                    marginBottom: 20
                  }}
                  placeholderTextColor="#9ca3af"
                />

                {/* Work Name */}
                <Text style={{ color: "#9ca3af", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Income Source / Work Name</Text>
                <TextInput
                  placeholder="E.g. Freelance project, Monthly Salary, Bonus"
                  value={workName}
                  onChangeText={setWorkName}
                  style={{ backgroundColor: "#f8fafc", borderRadius: 18, padding: 16, fontSize: 14, fontWeight: "700", color: "#111827", borderWidth: 1.5, borderColor: "#f0f0f0", marginBottom: 24 }}
                  placeholderTextColor="#9ca3af"
                />

                {/* Action Button */}
                <TouchableOpacity
                  onPress={addIncome}
                  style={{ backgroundColor: "#2f5d34", borderRadius: 20, paddingVertical: 18, alignItems: "center", shadowColor: "#2f5d34", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 }}
                >
                  <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.5 }}>{editingId ? "Update Entry" : "Confirm Income"}</Text>
                </TouchableOpacity>

              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal visible={deleteModalVisible} transparent animationType="fade">
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View className="bg-white w-full rounded-[32px] p-6 items-center shadow-2xl">
            <View className="w-16 h-16 rounded-full bg-red-50 items-center justify-center mb-4">
              <Ionicons name="trash" size={28} color="#ef4444" />
            </View>
            <Text className="text-2xl font-black text-gray-900 mb-2">Delete Income?</Text>
            <Text className="text-gray-500 text-center mb-8 px-4 font-medium leading-5">
              Are you sure you want to delete this record? This action cannot be undone.
            </Text>
            <View className="flex-row w-full gap-3">
              <TouchableOpacity
                onPress={() => setDeleteModalVisible(false)}
                className="flex-1 py-4 rounded-2xl bg-gray-100 items-center"
              >
                <Text className="text-gray-700 font-bold text-lg">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={deleteIncome}
                className="flex-1 py-4 rounded-2xl bg-red-500 items-center shadow-lg shadow-red-500/30"
              >
                <Text className="text-white font-bold text-lg">Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Toast Notification ── */}
      {toast && (
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            left: 20,
            right: 20,
            zIndex: 9999,
            transform: [{ translateY: toastAnim }],
            backgroundColor: toast.type === "success" ? "#2f5d34" : toast.type === "error" ? "#ef4444" : "#3b82f6",
            paddingVertical: 14,
            paddingHorizontal: 20,
            borderRadius: 20,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.2,
            shadowRadius: 12,
            elevation: 10,
          }}
        >
          <View style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, padding: 4 }}>
            <Ionicons
              name={toast.type === "success" ? "checkmark-circle" : toast.type === "error" ? "alert-circle" : "information-circle"}
              size={20}
              color="white"
            />
          </View>
          <Text style={{ color: "white", fontWeight: "800", fontSize: 14, flex: 1 }}>{toast.message}</Text>
        </Animated.View>
      )}

    </SafeAreaView>
  );
}