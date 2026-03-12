import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    Modal
} from "react-native";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";

import { auth, db } from "../../firebase";

import {
    addDoc,
    collection,
    doc,
    updateDoc,
    serverTimestamp,
    getDocs,
    query,
    where
} from "firebase/firestore";

export default function TransferScreen() {

    const router = useRouter();
    const uid = auth.currentUser?.uid;

    const [showSheet, setShowSheet] = useState(false);



    const [amount, setAmount] = useState("");
    const [name, setName] = useState("");

    const [incomeList, setIncomeList] = useState([]);
    const [selectedIncome, setSelectedIncome] = useState(null);

    const [transferList, setTransferList] = useState([]);

    const incomeRef = collection(db, "income");
    const transferRef = collection(db, "transfers");

    useEffect(() => {
        fetchIncome();
        fetchTransfers();
    }, []);

    const totalIncome = incomeList.reduce((sum, it) => {
        const val = Number(it.remainingAmount ?? it.amount ?? 0);
        return sum + (isNaN(val) ? 0 : val);
    }, 0);

    const totalTransferred = transferList.reduce((sum, it) => {
        const val = Number(it.amount ?? 0);
        return sum + (isNaN(val) ? 0 : val);
    }, 0);

    const fetchIncome = async () => {

        const snap = await getDocs(incomeRef);

        const list = snap.docs.map((d) => ({
            id: d.id,
            ...d.data()
        }));

        setIncomeList(list);
    };

    const fetchTransfers = async () => {

        const q = query(transferRef, where("userId", "==", uid));

        const snap = await getDocs(q);

        const list = snap.docs.map((d) => ({
            id: d.id,
            ...d.data()
        }));

        setTransferList(list);
    };

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

            const date = timestamp.toDate();

            return date.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric"
            });
        };

        if (transferAmount > selectedIncome.remainingAmount) {
            alert("Not enough balance");
            return;
        }

        await addDoc(transferRef, {
            name,
            amount: transferAmount,
      remainingAmount: transferAmount,
        });

        const incomeDoc = doc(db, "income", selectedIncome.id);

        await updateDoc(incomeDoc, {
            remainingAmount: selectedIncome.remainingAmount - transferAmount
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
                    <View style={{ flex: 1, backgroundColor: "#fff", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#e5e7eb" }}>
                        <Text style={{ color: "#6b7280", fontSize: 12 }}>Total Income</Text>
                        <Text style={{ fontSize: 18, fontWeight: "700", color: "#16a34a" }}>₹{totalIncome}</Text>
                    </View>

                    <View style={{ flex: 1, backgroundColor: "#fff", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#e5e7eb" }}>
                        <Text style={{ color: "#6b7280", fontSize: 12 }}>Total Transferred</Text>
                        <Text style={{ fontSize: 18, fontWeight: "700", color: "#ef4444" }}>₹{totalTransferred}</Text>
                    </View>
                </View>

                <FlatList
                    data={transferList}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <View className="bg-white p-4 rounded-xl mb-3 shadow">

                            <Text className="font-bold text-lg">
                                {item.name}
                            </Text>

                            <Text className="text-green-600">
                                ₹{item.amount}
                            </Text>

                            <Text className="text-gray-500 text-xs mt-1">
                                {formatDate(item.createdAt)}
                            </Text>

                        </View>
                    )}
                />

            </View>


            {/* FLOAT BUTTON */}
            <TouchableOpacity
                onPress={() => setShowSheet(true)}
                style={{
                    position: "absolute",
                    bottom: 90,
                    right: 20,
                    width: 60,
                    height: 60,
                    borderRadius: 30,
                    backgroundColor: "#2f5d34",
                    justifyContent: "center",
                    alignItems: "center"
                }}
            >
                <Ionicons name="add" size={30} color="white" />
            </TouchableOpacity>


            {/* BOTTOM SHEET */}
            <Modal visible={showSheet} transparent animationType="slide">

                <View className="flex-1 justify-end bg-black/40">

                    <View className="bg-white p-6 rounded-t-3xl">

                        {/* HEADER */}
                        <View className="flex-row justify-between items-center mb-4">

                            <Text className="text-xl font-bold">
                                Add Transfer
                            </Text>

                            <TouchableOpacity onPress={() => setShowSheet(false)}>
                                <Ionicons name="close-circle" size={26} color="#374151" />
                            </TouchableOpacity>

                        </View>


                        {/* SELECT INCOME */}
                        {/* INCOME SOURCE LABEL */}
                        <Text className="text-gray-700 font-semibold mb-1">
                            Income Source
                        </Text>

                        <View className="w-full bg-[#dfe7c7] rounded-lg px-3 py-1 mb-4">

                            <Picker
                                selectedValue={selectedIncome?.id}
                                onValueChange={(value) => {
                                    const income = incomeList.find((i) => i.id === value);
                                    setSelectedIncome(income);
                                }}
                            >

                                <Picker.Item label="Select Income Source" value={null} />

                                {incomeList.map((item) => (
                                    <Picker.Item
                                        key={item.id}
                                        label={`${item.workName} - ₹${item.remainingAmount ?? item.amount} (${formatDate(item.createdAt)})`}
                                        value={item.id}
                                    />
                                ))}

                            </Picker>

                        </View>


                        {/* TRANSFER NAME LABEL */}
                        <Text className="text-gray-700 font-semibold mb-1">
                            Transfer Name
                        </Text>

                        <TextInput
                            placeholder="Enter transfer name"
                            value={name}
                            onChangeText={setName}
                            className="w-full bg-[#dfe7c7] rounded-lg px-3 py-4 mb-4"
                        />


                        {/* AMOUNT LABEL */}
                        <Text className="text-gray-700 font-semibold mb-1">
                            Amount
                        </Text>

                        <TextInput
                            placeholder="Enter amount"
                            keyboardType="numeric"
                            value={amount}
                            onChangeText={setAmount}
                            className="w-full bg-[#dfe7c7] rounded-lg px-3 py-4 mb-4"
                        />

                        <TouchableOpacity
                            onPress={addTransfer}
                            className="bg-green-700 p-4 rounded-xl mt-4"
                        >
                            <Text className="text-white text-center font-bold">
                                Save Transfer
                            </Text>
                        </TouchableOpacity>

                    </View>

                </View>

            </Modal>
        </SafeAreaView>
    );
}