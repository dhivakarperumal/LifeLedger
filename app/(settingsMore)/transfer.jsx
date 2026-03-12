import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
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

import { auth, db } from "../../firebase";

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
import FilterSheet, { applyFilters, defaultFilterState } from "../../components/FilterSheet";

export default function TransferScreen() {

    const router = useRouter();
    const [uid, setUid] = useState(auth.currentUser?.uid);
    const [authLoaded, setAuthLoaded] = useState(false);

    const [showSheet, setShowSheet] = useState(false);



    const [amount, setAmount] = useState("");
    const [name, setName] = useState("");

    const [incomeList, setIncomeList] = useState([]);
    const [selectedIncome, setSelectedIncome] = useState(null);

    const [transferList, setTransferList] = useState([]);
    const [filteredTransferList, setFilteredTransferList] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterVisible, setFilterVisible] = useState(false);
    const [filterState, setFilterState] = useState(defaultFilterState([]));

    const incomeRef = collection(db, "income");
    const transferRef = collection(db, "transfers");

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
            fetchTransfers();
        }
    }, [uid, authLoaded]);

    const totalIncome = incomeList.reduce((sum, it) => {
        const val = Number(it.remainingAmount ?? it.amount ?? 0);
        return sum + (isNaN(val) ? 0 : val);
    }, 0);

    const totalTransferred = transferList.reduce((sum, it) => {
        const val = Number(it.amount ?? 0);
        return sum + (isNaN(val) ? 0 : val);
    }, 0);

    const fetchIncome = async () => {
        if (!uid) return;
        try {
            const q = query(incomeRef, where("userId", "==", uid));
            const snap = await getDocs(q);

            const list = snap.docs.map((d) => ({
                id: d.id,
                ...d.data()
            }));

            setIncomeList(list);
        } catch (e) {
            console.error("FETCH INCOME ERR", e);
        }
    };

    const fetchTransfers = async () => {
        if (!uid) return;

        const q = query(transferRef, where("userId", "==", uid));

        const snap = await getDocs(q);

        const list = snap.docs.map((d) => ({
            id: d.id,
            ...d.data()
        }));

        setTransferList(list);
        setFilteredTransferList(list);
    };

    useEffect(() => {
        let result = applyFilters(transferList, filterState, "createdAt");

        if (searchQuery.trim() !== "") {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(
                item =>
                    item.name?.toLowerCase().includes(lowerQuery) ||
                    item.amount?.toString().includes(lowerQuery)
            );
        }
        setFilteredTransferList(result);
    }, [searchQuery, transferList, filterState]);

    const addTransfer = async () => {

        const transferAmount = Number(amount);

        if (!name || !transferAmount) {
            alert("Enter details");
            return;
        }

        if (!selectedIncome) {
            alert("Select income source");
            return;
        }

        const formatDate = (timestamp) => {
            if (!timestamp) return "";
            try {
                const date = timestamp?.toDate ? timestamp.toDate() : (timestamp instanceof Date ? timestamp : new Date(timestamp));
                if (isNaN(date.getTime())) return "";
                return date.toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric"
                });
            } catch (e) { return ""; }
        };

        const currentRemaining = selectedIncome.remainingAmount ?? selectedIncome.amount;

        if (transferAmount > currentRemaining) {
            alert("Not enough balance");
            return;
        }

        await addDoc(transferRef, {
            name,
            amount: transferAmount,
            remainingAmount: transferAmount,
            userId: uid,
            createdAt: serverTimestamp()
        });

        const incomeDoc = doc(db, "income", selectedIncome.id);
        await updateDoc(incomeDoc, {
            remainingAmount: currentRemaining - transferAmount
        });

        setAmount("");
        setName("");
        setShowSheet(false);

        fetchTransfers();
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return "";

        const date = timestamp.toDate();

        return date.toLocaleDateString("en-IN") + " " +
            date.toLocaleTimeString("en-IN");
    };

    return (
        <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: "#111827" }}>

            {/* HEADER */}
            <View className="bg-gray-900 px-4 py-4 flex-row items-center">

                <TouchableOpacity onPress={() => router.back()} className="mr-3">
                    <Ionicons name="arrow-back-circle-outline" size={32} color="white" />
                </TouchableOpacity>

                <Text className="text-white text-xl font-bold">
                    Transfers
                </Text>

            </View>


            {/* TRANSFER LIST */}
            <View className="flex-1 bg-gray-100 p-4">

                {/* SUMMARY CARDS */}
                <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
                    <View style={{ flex: 1, backgroundColor: "white", padding: 16, borderRadius: 24, borderWidth: 1, borderColor: "#f3f4f6", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10 }}>
                        <Text style={{ color: "#9ca3af", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Balance</Text>
                        <Text style={{ fontSize: 20, fontWeight: "900", color: "#2f5d34" }}>₹{totalIncome}</Text>
                    </View>

                    <View style={{ flex: 1, backgroundColor: "white", padding: 16, borderRadius: 24, borderWidth: 1, borderColor: "#f3f4f6", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10 }}>
                        <Text style={{ color: "#9ca3af", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Spent</Text>
                        <Text style={{ fontSize: 20, fontWeight: "900", color: "#ef4444" }}>₹{totalTransferred}</Text>
                    </View>
                </View>

                {/* SEARCH & FILTER */}
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 8 }}>
                    <View style={{ backgroundColor: "white", flex: 1, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#f9fafb" }}>
                        <Ionicons name="search" size={18} color="#9ca3af" style={{ marginRight: 8 }} />
                        <TextInput
                            placeholder="Search transfers..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            style={{ flex: 1, color: "#111827", fontWeight: "700", fontSize: 14 }}
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
                            width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8,
                            backgroundColor: filterState.datePreset !== 'all' ? '#2f5d34' : 'white',
                            borderWidth: 1, borderColor: filterState.datePreset !== 'all' ? '#2f5d34' : '#f9fafb'
                        }}
                    >
                        <Ionicons name="options-outline" size={20} color={filterState.datePreset !== 'all' ? 'white' : '#374151'} />
                    </TouchableOpacity>
                </View>

                <FilterSheet
                    visible={filterVisible}
                    onClose={() => setFilterVisible(false)}
                    onApply={(s) => setFilterState(s)}
                    activeFilters={filterState}
                />

                <FlatList
                    data={filteredTransferList}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    columnWrapperStyle={{ justifyContent: "space-between" }}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    ListEmptyComponent={
                        <View style={{ alignItems: "center", marginTop: 60 }}>
                            <Ionicons name="swap-horizontal-outline" size={56} color="#e5e7eb" />
                            <Text style={{ color: "#9ca3af", fontWeight: "700", marginTop: 16, fontSize: 15 }}>No transfers yet</Text>
                            <Text style={{ color: "#d1d5db", fontSize: 12, marginTop: 4 }}>Tap + to add your first transfer</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            activeOpacity={0.88}
                            style={{
                                width: "48.5%",
                                backgroundColor: "white",
                                padding: 14,
                                borderRadius: 22,
                                marginBottom: 14,
                                borderWidth: 1,
                                borderColor: "#f0f0f0",
                                elevation: 2,
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.07,
                                shadowRadius: 8,
                                minHeight: 140,
                                justifyContent: "space-between",
                            }}
                        >
                            {/* Top: Icon */}
                            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                <View style={{ backgroundColor: "#f0fdf4", padding: 8, borderRadius: 12 }}>
                                    <Ionicons name="swap-horizontal" size={18} color="#2f5d34" />
                                </View>
                                <View style={{ backgroundColor: "#fef9c3", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                                    <Text style={{ color: "#92400e", fontSize: 8, fontWeight: "800", textTransform: "uppercase" }}>Transfer</Text>
                                </View>
                            </View>

                            {/* Name */}
                            <Text style={{ color: "#1f2937", fontWeight: "800", fontSize: 13, lineHeight: 18, marginBottom: 8 }} numberOfLines={2}>
                                {item.name}
                            </Text>

                            {/* Amount */}
                            <Text style={{ color: "#2f5d34", fontWeight: "900", fontSize: 18, marginBottom: 8 }}>
                                ₹{Number(item.amount).toLocaleString("en-IN")}
                            </Text>

                            {/* Date Footer */}
                            <View style={{ paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f3f4f6", flexDirection: "row", alignItems: "center" }}>
                                <Ionicons name="time-outline" size={10} color="#9ca3af" style={{ marginRight: 4 }} />
                                <Text style={{ color: "#9ca3af", fontSize: 9, fontWeight: "600", flex: 1 }} numberOfLines={1}>
                                    {formatDate(item.createdAt)}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    )}
                />

            </View>


            {/* FLOAT BUTTON */}
            <TouchableOpacity
                onPress={() => setShowSheet(true)}
                style={{
                    position: "absolute", bottom: 70, right: 24, width: 66, height: 66, borderRadius: 33,
                    backgroundColor: "#2f5d34", alignItems: "center", justifyContent: "center",
                    elevation: 12, shadowColor: "#2f5d34", shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.4, shadowRadius: 16, zIndex: 99
                }}
            >
                <Ionicons name="add" size={36} color="white" />
            </TouchableOpacity>


            <Modal visible={showSheet} transparent animationType="slide">
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={{ flex: 1 }}
                >
                    <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
                        <View style={{ backgroundColor: "white", maxHeight: "92%", borderTopLeftRadius: 40, borderTopRightRadius: 40, paddingTop: 24, paddingHorizontal: 24, paddingBottom: 36 }}>
                            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                                {/* Header */}
                                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
                                    <Text style={{ fontSize: 22, fontWeight: "900", color: "#111827" }}>New Transfer</Text>
                                    <TouchableOpacity onPress={() => setShowSheet(false)} style={{ backgroundColor: "#f1f5f9", padding: 9, borderRadius: 14 }}>
                                        <Ionicons name="close" size={22} color="#374151" />
                                    </TouchableOpacity>
                                </View>

                                {/* Amount Pad */}
                                <Text style={{ color: "#9ca3af", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Transaction Details</Text>
                                <View style={{ backgroundColor: "#f8fafc", borderRadius: 24, padding: 24, alignItems: "center", borderWidth: 1.5, borderColor: "#f0f0f0", marginBottom: 24 }}>
                                    <Text style={{ color: "#9ca3af", fontSize: 11, fontWeight: "800", textTransform: "uppercase", marginBottom: 8 }}>Amount to Transfer</Text>
                                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                                        <Text style={{ fontSize: 32, fontWeight: "900", color: "#2f5d34", marginRight: 8 }}>₹</Text>
                                        <TextInput
                                            placeholder="0.00"
                                            keyboardType="numeric"
                                            value={amount}
                                            onChangeText={setAmount}
                                            style={{ fontSize: 42, fontWeight: "900", color: "#111827", textAlign: "center", minWidth: 150 }}
                                            placeholderTextColor="#9ca3af"
                                        />
                                    </View>
                                </View>

                                {/* Select Income */}
                                <Text style={{ color: "#9ca3af", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Income Source</Text>
                                <View style={{ backgroundColor: "#f8fafc", borderRadius: 18, borderWidth: 1.5, borderColor: "#f0f0f0", overflow: "hidden", marginBottom: 24 }}>
                                    <Picker
                                        selectedValue={selectedIncome?.id}
                                        onValueChange={(value) => {
                                            const income = incomeList.find((i) => i.id === value);
                                            setSelectedIncome(income);
                                        }}
                                        style={{ color: "#111827", height: 50 }}
                                    >
                                        <Picker.Item label="Select Income Source" value={null} color="#9ca3af" />
                                        {incomeList.map((item) => (
                                            <Picker.Item
                                                key={item.id}
                                                label={`${item.workName} - ₹${item.remainingAmount ?? item.amount}`}
                                                value={item.id}
                                                color="#111827"
                                            />
                                        ))}
                                    </Picker>
                                </View>

                                {/* Transfer Name */}
                                <Text style={{ color: "#9ca3af", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Purpose of Transfer</Text>
                                <TextInput
                                    placeholder="E.g. Monthly Savings, Rent Fund, Trip Savings"
                                    placeholderTextColor="#9ca3af"
                                    value={name}
                                    onChangeText={setName}
                                    style={{ backgroundColor: "#f8fafc", borderRadius: 18, padding: 16, fontSize: 15, fontWeight: "700", color: "#111827", borderWidth: 1.5, borderColor: "#f0f0f0", marginBottom: 32 }}
                                />

                                {/* Action Button */}
                                <TouchableOpacity
                                    onPress={addTransfer}
                                    style={{ backgroundColor: "#2f5d34", borderRadius: 20, paddingVertical: 18, alignItems: "center", shadowColor: "#2f5d34", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 }}
                                >
                                    <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.5 }}>Confirm Transfer</Text>
                                </TouchableOpacity>

                            </ScrollView>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}