import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    FlatList,
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
import { auth, db } from "../../firebase";
import { useData } from "../../context/DataContext";

import FilterSheet, {
    applyFilters,
    defaultFilterState
} from "../../components/FilterSheet";

export default function TransferScreen() {
    const router = useRouter();
    const { transfers: transferList, income: incomeList, isInitialLoadDone } = useData();
    const [uid] = useState(auth.currentUser?.uid || null);

    const [showSheet, setShowSheet] = useState(false);
    const [amount, setAmount] = useState("");
    const [name, setName] = useState("");
    const [selectedIncome, setSelectedIncome] = useState(null);

    const [filteredTransferList, setFilteredTransferList] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterVisible, setFilterVisible] = useState(false);
    const [filterState, setFilterState] = useState(defaultFilterState());
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);

    // ── Toast ──────────────────────────────────────────────────────────
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

    const transferRef = collection(db, "transfers");

    useEffect(() => {
        let result = applyFilters(transferList, filterState, "createdAt");
        if (searchQuery.trim() !== "") {
            const lower = searchQuery.toLowerCase();
            result = result.filter(item => 
                item.name?.toLowerCase().includes(lower) ||
                item.amount?.toString().includes(lower)
            );
        }
        setFilteredTransferList(result);
    }, [searchQuery, transferList, filterState]);

    const totalIncome = incomeList.reduce((sum, it) => {
        const val = Number(it.remainingAmount ?? it.amount ?? 0);
        return sum + (isNaN(val) ? 0 : val);
    }, 0);

    const totalTransferred = transferList.reduce((sum, it) => {
        const val = Number(it.amount ?? 0);
        return sum + (isNaN(val) ? 0 : val);
    }, 0);

    const handleSave = async () => {
        const transferAmount = Number(amount);
        if (!name || !transferAmount) {
            showToast("Please fill in all required fields", "error");
            return;
        }

        try {
            setLoading(true);
            if (editingId) {
                await updateDoc(doc(db, "transfers", editingId), {
                    name,
                    amount: transferAmount,
                    remainingAmount: transferAmount,
                });
                showToast("Transfer updated successfully!", "success");
            } else {
                if (!selectedIncome) {
                    showToast("Please select an income source", "error");
                    setLoading(false);
                    return;
                }
                if (transferAmount > (selectedIncome.remainingAmount ?? selectedIncome.amount ?? 0)) {
                    showToast("Not enough balance in selected source", "error");
                    setLoading(false);
                    return;
                }

                await addDoc(transferRef, {
                    name,
                    amount: transferAmount,
                    remainingAmount: transferAmount,
                    userId: uid,
                    incomeId: selectedIncome.id,
                    createdAt: serverTimestamp(),
                });

                const incomeDoc = doc(db, "income", selectedIncome.id);
                const currentRemaining = Number(selectedIncome.remainingAmount ?? selectedIncome.amount ?? 0);
                await updateDoc(incomeDoc, {
                    remainingAmount: currentRemaining - transferAmount,
                });
                showToast("Transfer added successfully!", "success");
            }

            setAmount("");
            setName("");
            setSelectedIncome(null);
            setEditingId(null);
            setShowSheet(false);
        } catch (e) {
            showToast("Failed to save transfer", "error");
        } finally {
            setLoading(false);
        }
    };

    const confirmDelete = (item) => {
        setItemToDelete(item);
        setDeleteModalVisible(true);
    };

    const deleteTransfer = async () => {
        if (!itemToDelete) return;
        try {
            setLoading(true);

            if (itemToDelete.incomeId) {
                try {
                    const incomeRefDoc = doc(db, "income", itemToDelete.incomeId);
                    const snap = await getDocs(query(collection(db, "income"), where("__name__", "==", itemToDelete.incomeId)));
                    if (!snap.empty) {
                        const incomeData = snap.docs[0].data();
                        const currentRem = Number(incomeData.remainingAmount ?? incomeData.amount ?? 0);
                        await updateDoc(incomeRefDoc, {
                            remainingAmount: currentRem + (itemToDelete.amount ?? 0)
                        });
                    }
                } catch (err) {
                    console.log("Refund failed, but deleting transfer anyway:", err);
                }
            }

            await deleteDoc(doc(db, "transfers", itemToDelete.id));
            showToast("Transfer deleted and amount refunded", "success");
            setDeleteModalVisible(false);
        } catch (e) {
            console.error("DELETE ERROR:", e);
            showToast("Failed to delete", "error");
            setDeleteModalVisible(false);
        } finally {
            setLoading(false);
            setItemToDelete(null);
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return "";
        try {
            const date = timestamp?.toDate ? timestamp.toDate() : (timestamp instanceof Date ? timestamp : new Date(timestamp));
            if (isNaN(date.getTime())) return "";
            return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
        } catch {
            return "";
        }
    };

    const openSheet = () => {
        setEditingId(null);
        setName("");
        setAmount("");
        setSelectedIncome(null);
        setShowSheet(true);
    };

    const openEdit = (item) => {
        setEditingId(item.id);
        setName(item.name);
        setAmount(item.amount.toString());
        setSelectedIncome(null);
        setShowSheet(true);
    };

    return (
        <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: "#111827" }}>

            {/* ── HEADER ─────────────────────────────────────────────── */}
            <View style={{ backgroundColor: "#111827", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
                    <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
                        <Ionicons name="arrow-back-circle-outline" size={34} color="white" />
                    </TouchableOpacity>
                    <View>
                        <Text style={{ color: "white", fontSize: 22, fontWeight: "900" }}>Transfers</Text>
                        <Text style={{ color: "#9ca3af", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.5 }}>Manage your fund allocations</Text>
                    </View>
                </View>

                {/* ── SUMMARY BANNER ─────────────────────────────────── */}
                <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
                    <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                            <View style={{ backgroundColor: "#f0fdf4", padding: 6, borderRadius: 10, marginRight: 8 }}>
                                <Ionicons name="trending-up" size={14} color="#2f5d34" />
                            </View>
                            <Text style={{ color: "#9ca3af", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>Available</Text>
                        </View>
                        <Text style={{ color: "#4ade80", fontSize: 22, fontWeight: "900" }}>₹{totalIncome.toLocaleString("en-IN")}</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                            <View style={{ backgroundColor: "#fef2f2", padding: 6, borderRadius: 10, marginRight: 8 }}>
                                <Ionicons name="swap-horizontal" size={14} color="#ef4444" />
                            </View>
                            <Text style={{ color: "#9ca3af", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>Transferred</Text>
                        </View>
                        <Text style={{ color: "#f87171", fontSize: 22, fontWeight: "900" }}>₹{totalTransferred.toLocaleString("en-IN")}</Text>
                    </View>
                </View>

                {/* ── SEARCH & FILTER ────────────────────────────────── */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, paddingHorizontal: 16, height: 50, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
                        <Ionicons name="search-outline" size={18} color="#9ca3af" style={{ marginRight: 10 }} />
                        <TextInput
                            placeholder="Search transfers..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            style={{ flex: 1, color: "white", fontSize: 14, fontWeight: "600" }}
                            placeholderTextColor="#9ca3af"
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery("")}>
                                <Ionicons name="close-circle" size={18} color="#9ca3af" />
                            </TouchableOpacity>
                        )}
                    </View>
                    <TouchableOpacity
                        onPress={() => setFilterVisible(true)}
                        style={{
                            width: 50, height: 50, borderRadius: 16, alignItems: "center", justifyContent: "center",
                            backgroundColor: (filterState.datePreset !== "all") ? "#2f5d34" : "rgba(255,255,255,0.06)",
                            borderWidth: 1, borderColor: "rgba(255,255,255,0.1)"
                        }}
                    >
                        <Ionicons name="filter-outline" size={20} color="white" />
                    </TouchableOpacity>
                </View>
            </View>

            <FilterSheet
                visible={filterVisible}
                onClose={() => setFilterVisible(false)}
                onApply={(s) => setFilterState(s)}
                activeFilters={filterState}
            />

            <View style={{ flex: 1, backgroundColor: "#f9fafb", borderTopLeftRadius: 32, borderTopRightRadius: 32 }}>
                {(!isInitialLoadDone || loading) && (
                    <View style={{ padding: 20 }}>
                        <ActivityIndicator size="large" color="#2f5d34" />
                    </View>
                )}
                <FlatList
                    data={filteredTransferList}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    columnWrapperStyle={{ justifyContent: "space-between" }}
                    contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={{ alignItems: "center", justifyContent: "center", paddingTop: 80 }}>
                            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: "#f0fdf4", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                                <Ionicons name="swap-horizontal-outline" size={36} color="#2f5d34" />
                            </View>
                            <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900", marginBottom: 6 }}>No Transfers Yet</Text>
                            <Text style={{ color: "#9ca3af", fontSize: 13, fontWeight: "600", textAlign: "center", paddingHorizontal: 40 }}>Tap the + button to allocate funds from your income</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            activeOpacity={0.88}
                            style={{
                                width: "48%",
                                marginBottom: 16,
                                borderRadius: 24,
                                backgroundColor: "white",
                                padding: 16,
                                borderWidth: 1,
                                borderColor: "#f0f0f0",
                                elevation: 2,
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.08,
                                shadowRadius: 8,
                            }}
                        >
                            {/* Icon + Actions */}
                            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                <View style={{ backgroundColor: "#f0fdf4", padding: 8, borderRadius: 12 }}>
                                    <Ionicons name="swap-horizontal" size={18} color="#2f5d34" />
                                </View>
                                <View style={{ flexDirection: "row", gap: 8 }}>
                                    <TouchableOpacity onPress={() => openEdit(item)} style={{ backgroundColor: "#f0fdf4", padding: 6, borderRadius: 8 }}>
                                        <Ionicons name="pencil" size={14} color="#2f5d34" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => confirmDelete(item)} style={{ backgroundColor: "#fef2f2", padding: 6, borderRadius: 8 }}>
                                        <Ionicons name="trash" size={14} color="#ef4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Name */}
                            <View style={{ marginBottom: 8 }}>
                                <Text style={{ color: "#9ca3af", fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>Fund Name</Text>
                                <Text style={{ color: "#1f2937", fontWeight: "800", fontSize: 13, marginTop: 2 }} numberOfLines={2}>{item.name}</Text>
                            </View>

                            {/* Amount */}
                            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: "auto" }}>
                                <Text style={{ color: "#2f5d34", fontWeight: "900", fontSize: 18 }}>₹{item.amount?.toLocaleString("en-IN")}</Text>
                            </View>

                            {/* Remaining */}
                            {item.remainingAmount !== undefined && item.remainingAmount !== item.amount && (
                                <View style={{ marginTop: 6, backgroundColor: "#f0fdf4", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                                    <Text style={{ color: "#2f5d34", fontSize: 9, fontWeight: "800" }}>Remaining: ₹{item.remainingAmount?.toLocaleString("en-IN")}</Text>
                                </View>
                            )}

                            {/* Date */}
                            <View style={{ marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f9fafb", flexDirection: "row", alignItems: "center" }}>
                                <Ionicons name="time-outline" size={10} color="#9ca3af" style={{ marginRight: 4 }} />
                                <Text style={{ color: "#9ca3af", fontSize: 9, fontWeight: "600" }}>
                                    {item.createdAt ? formatDate(item.createdAt) : "Recently"}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    )}
                />
            </View>

            {/* ── FAB ────────────────────────────────────────────────── */}
            <TouchableOpacity
                onPress={openSheet}
                style={{
                    position: "absolute",
                    bottom: 50,
                    right: 24,
                    width: 55,
                    height: 55,
                    borderRadius: 30,
                    backgroundColor: "#2f5d34",
                    alignItems: "center",
                    justifyContent: "center",
                    elevation: 12,
                    shadowColor: "#2f5d34",
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.4,
                    shadowRadius: 16,
                    zIndex: 99,
                }}
            >
                <Ionicons name="add" size={32} color="white" />
            </TouchableOpacity>

            {/* ── BOTTOM SHEET ───────────────────────────────────────── */}
            <Modal visible={showSheet} transparent animationType="slide">
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={{ flex: 1 }}
                >
                    <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
                        <View style={{
                            backgroundColor: "white",
                            maxHeight: "90%",
                            borderTopLeftRadius: 40,
                            borderTopRightRadius: 40,
                            paddingTop: 24,
                            paddingHorizontal: 24,
                            paddingBottom: 36,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: -8 },
                            shadowOpacity: 0.15,
                            shadowRadius: 24,
                            elevation: 24,
                        }}>
                            {/* Drag handle */}
                            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: "#e5e7eb", alignSelf: "center", marginBottom: 20 }} />

                            {/* Sheet Header */}
                            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                                <View>
                                    <Text style={{ fontSize: 24, fontWeight: "900", color: "#111827" }}>{editingId ? "Edit Transfer" : "New Transfer"}</Text>
                                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1.5, marginTop: 2 }}>Allocate your funds</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => setShowSheet(false)}
                                    style={{ backgroundColor: "#f1f5f9", padding: 10, borderRadius: 16 }}
                                >
                                    <Ionicons name="close" size={22} color="#374151" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 60 }}>

                                {/* Income Source picker (Only for new transfers) */}
                                {!editingId && (
                                    <>
                                        <Text style={{ color: "#9ca3af", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
                                            Income Source
                                        </Text>
                                        <View style={{
                                            backgroundColor: "#f8fafc",
                                            borderRadius: 18,
                                            borderWidth: 1.5,
                                            borderColor: "#f0f0f0",
                                            marginBottom: 20,
                                            overflow: "hidden",
                                        }}>
                                            <Picker
                                                selectedValue={selectedIncome?.id ?? null}
                                                onValueChange={(value) => {
                                                    const income = incomeList.find((i) => i.id === value);
                                                    setSelectedIncome(income || null);
                                                }}
                                                style={{ color: "#111827" }}
                                                dropdownIconColor="#111827"
                                            >
                                                <Picker.Item label="Select income source..." value={null} color="#9ca3af" />
                                                {incomeList.map((item) => (
                                                    <Picker.Item
                                                        key={item.id}
                                                        label={`${item.workName}  •  ₹${(item.remainingAmount ?? item.amount ?? 0).toLocaleString("en-IN")} available`}
                                                        value={item.id}
                                                        color="#111827"
                                                    />
                                                ))}
                                            </Picker>
                                        </View>

                                        {/* Balance chip */}
                                        {selectedIncome && (
                                            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#f0fdf4", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 20, borderWidth: 1, borderColor: "#dcfce7" }}>
                                                <Ionicons name="wallet-outline" size={16} color="#2f5d34" style={{ marginRight: 8 }} />
                                                <Text style={{ color: "#2f5d34", fontWeight: "800", fontSize: 13 }}>
                                                    Available: ₹{(selectedIncome.remainingAmount ?? selectedIncome.amount ?? 0).toLocaleString("en-IN")}
                                                </Text>
                                            </View>
                                        )}
                                    </>
                                )}

                                {/* Amount input */}
                                <Text style={{ color: "#9ca3af", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>
                                    Transfer Amount
                                </Text>
                                <TextInput
                                    placeholder="Enter amount (₹)"
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
                                        marginBottom: 20,
                                    }}
                                    placeholderTextColor="#9ca3af"
                                />

                                {/* Transfer Name */}
                                <Text style={{ color: "#9ca3af", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
                                    Transfer / Fund Name
                                </Text>
                                <TextInput
                                    placeholder="E.g. Monthly Budget, Travel Fund, Emergency"
                                    value={name}
                                    onChangeText={setName}
                                    style={{
                                        backgroundColor: "#f8fafc",
                                        borderRadius: 18,
                                        padding: 16,
                                        fontSize: 14,
                                        fontWeight: "700",
                                        color: "#111827",
                                        borderWidth: 1.5,
                                        borderColor: "#f0f0f0",
                                        marginBottom: 28,
                                    }}
                                    placeholderTextColor="gray"
                                />

                                {/* Submit button */}
                                <TouchableOpacity
                                    onPress={handleSave}
                                    activeOpacity={0.85}
                                    disabled={loading}
                                    style={{
                                        backgroundColor: loading ? "#9ca3af" : "#2f5d34",
                                        borderRadius: 24,
                                        paddingVertical: 20,
                                        alignItems: "center",
                                        elevation: 6,
                                        shadowColor: loading ? "#9ca3af" : "#2f5d34",
                                        shadowOffset: { width: 0, height: 6 },
                                        shadowOpacity: 0.35,
                                        shadowRadius: 12,
                                    }}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <Text style={{ color: "white", fontWeight: "900", fontSize: 16, textTransform: "uppercase", letterSpacing: 2 }}>
                                            {editingId ? "Update Transfer" : "Confirm Transfer"}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ── DELETE MODAL ─────────────────────────────────────── */}
            <Modal visible={deleteModalVisible} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", paddingHorizontal: 20 }}>
                    <View style={{ backgroundColor: "white", width: "100%", borderRadius: 32, padding: 24, alignItems: "center" }}>
                        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#fef2f2", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                            <Ionicons name="trash" size={32} color="#ef4444" />
                        </View>
                        <Text style={{ fontSize: 22, fontWeight: "900", color: "#111827", marginBottom: 8 }}>Delete Transfer?</Text>
                        <Text style={{ color: "#6b7280", textAlign: "center", marginBottom: 32, fontWeight: "600" }}>Are you sure you want to delete this transfer fund? This action cannot be undone.</Text>
                        <View style={{ flexDirection: "row", width: "100%", gap: 12 }}>
                            <TouchableOpacity onPress={() => setDeleteModalVisible(false)} style={{ flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: "#f3f4f6", alignItems: "center" }}>
                                <Text style={{ color: "#374151", fontWeight: "800", fontSize: 16 }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={deleteTransfer} 
                                disabled={loading}
                                style={{ flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: loading ? "#fb7185" : "#ef4444", alignItems: "center" }}
                            >
                                {loading ? <ActivityIndicator color="white" size="small" /> : <Text style={{ color: "white", fontWeight: "800", fontSize: 16 }}>Delete</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── Toast ──────────────────────────────────────────────── */}
            {toast && (
                <Animated.View
                    style={{
                        position: "absolute",
                        top: 20,
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
