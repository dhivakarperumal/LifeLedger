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
    doc,
    getDocs,
    query,
    serverTimestamp,
    updateDoc,
    where
} from "firebase/firestore";
import { auth, db } from "../../firebase";

import FilterSheet, {
    applyFilters,
    defaultFilterState
} from "../../components/FilterSheet";

export default function TransferScreen() {
    const router = useRouter();
    const uid = auth.currentUser?.uid;

    const [showSheet, setShowSheet] = useState(false);
    const [amount, setAmount] = useState("");
    const [name, setName] = useState("");
    const [incomeList, setIncomeList] = useState([]);
    const [selectedIncome, setSelectedIncome] = useState(null);
    const [transferList, setTransferList] = useState([]);

    const [filteredTransferList, setFilteredTransferList] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterVisible, setFilterVisible] = useState(false);
    const [filterState, setFilterState] = useState(defaultFilterState());
    const [loading, setLoading] = useState(false);

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

    const incomeRef = collection(db, "income");
    const transferRef = collection(db, "transfers");

    useEffect(() => {
        fetchIncome();
        fetchTransfers();
    }, []);

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

    const fetchIncome = async () => {
        try {
            setLoading(true);
            const snap = await getDocs(incomeRef);
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setIncomeList(list);
        } catch (e) {
            showToast("Failed to load income", "error");
        } finally {
            setLoading(false);
        }
    };

    const fetchTransfers = async () => {
        if (!uid) return;
        try {
            setLoading(true);
            const q = query(transferRef, where("userId", "==", uid));
            const snap = await getDocs(q);
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            list.sort((a, b) => {
                if (!a.createdAt) return 1;
                if (!b.createdAt) return -1;
                return b.createdAt.toMillis() - a.createdAt.toMillis();
            });
            setTransferList(list);
            setFilteredTransferList(list);
        } catch (e) {
            showToast("Failed to load transfers", "error");
        } finally {
            setLoading(false);
        }
    };

    const addTransfer = async () => {
        const transferAmount = Number(amount);
        if (!name || !transferAmount) {
            showToast("Please fill in all required fields", "error");
            return;
        }
        if (!selectedIncome) {
            showToast("Please select an income source", "error");
            return;
        }
        if (transferAmount > (selectedIncome.remainingAmount ?? selectedIncome.amount ?? 0)) {
            showToast("Not enough balance in selected source", "error");
            return;
        }

        try {
            setLoading(true);
            await addDoc(transferRef, {
                name,
                amount: transferAmount,
                remainingAmount: transferAmount,
                userId: uid,
                createdAt: serverTimestamp(),
            });

            const incomeDoc = doc(db, "income", selectedIncome.id);
            await updateDoc(incomeDoc, {
                remainingAmount: (selectedIncome.remainingAmount ?? selectedIncome.amount ?? 0) - transferAmount,
            });

            setAmount("");
            setName("");
            setSelectedIncome(null);
            setShowSheet(false);
            showToast("Transfer added successfully!", "success");
            fetchTransfers();
            fetchIncome();
        } catch (e) {
            showToast("Failed to add transfer", "error");
        } finally {
            setLoading(false);
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
        setName("");
        setAmount("");
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
                {loading && (
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
                            {/* Icon + badge */}
                            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                <View style={{ backgroundColor: "#f0fdf4", padding: 8, borderRadius: 12 }}>
                                    <Ionicons name="swap-horizontal" size={18} color="#2f5d34" />
                                </View>
                                <View style={{ backgroundColor: "#fef3c7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                                    <Text style={{ color: "#d97706", fontSize: 8, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 }}>Transfer</Text>
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
                                <Ionicons name="chevron-forward" size={12} color="#9ca3af" />
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
                    bottom: 70,
                    right: 24,
                    width: 66,
                    height: 66,
                    borderRadius: 33,
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
                <Ionicons name="add" size={36} color="white" />
            </TouchableOpacity>

            {/* ── BOTTOM SHEET ───────────────────────────────────────── */}
            <Modal visible={showSheet} transparent animationType="slide">
                <KeyboardAvoidingView
                    behavior="padding"
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
                                    <Text style={{ fontSize: 24, fontWeight: "900", color: "#111827" }}>New Transfer</Text>
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

                                {/* Income Source picker */}
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
                                        dropdownIconColor="#111827"
                                        style={{ color: "#111827" }}
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

                                {/* Amount input */}
                                <Text style={{ color: "#9ca3af", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>
                                    Transfer Amount
                                </Text>
                                <View style={{
                                    backgroundColor: "#f8fafc",
                                    borderRadius: 18,
                                    paddingVertical: 12,
                                    paddingHorizontal: 18,
                                    alignItems: "center",
                                    borderWidth: 1.5,
                                    borderColor: "#f0f0f0",
                                    marginBottom: 20,
                                    flexDirection: "row",
                                    justifyContent: "center",
                                }}>
                                    <Text style={{ fontSize: 22, fontWeight: "900", color: "#2f5d34", marginRight: 6 }}>₹</Text>
                                    <TextInput
                                        placeholder="0.00"
                                        keyboardType="numeric"
                                        value={amount}
                                        onChangeText={setAmount}
                                        style={{ fontSize: 28, fontWeight: "900", color: "#111827", textAlign: "center", paddingVertical: 2, flex: 1 }}
                                        placeholderTextColor="#9ca3af"
                                    />
                                </View>

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
                                        fontSize: 16,
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
                                    onPress={addTransfer}
                                    activeOpacity={0.85}
                                    style={{
                                        backgroundColor: "#2f5d34",
                                        borderRadius: 24,
                                        paddingVertical: 20,
                                        alignItems: "center",
                                        elevation: 6,
                                        shadowColor: "#2f5d34",
                                        shadowOffset: { width: 0, height: 6 },
                                        shadowOpacity: 0.35,
                                        shadowRadius: 12,
                                    }}
                                >
                                    <Text style={{ color: "white", fontWeight: "900", fontSize: 16, textTransform: "uppercase", letterSpacing: 2 }}>
                                        Confirm Transfer
                                    </Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ── Toast ──────────────────────────────────────────────── */}
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