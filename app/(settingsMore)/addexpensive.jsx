import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
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

import { auth, db } from "../../firebase";

import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where
} from "firebase/firestore";

export default function AddExpense() {

  const router = useRouter();
  const [uid, setUid] = useState(auth.currentUser?.uid);
  const [authLoaded, setAuthLoaded] = useState(false);

  const [showSheet, setShowSheet] = useState(false);

  const [transferList, setTransferList] = useState([]);
  const [selectedTransfer, setSelectedTransfer] = useState(null);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  const [category, setCategory] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState("");
  const [receipt, setReceipt] = useState(null);

  const [expenseList, setExpenseList] = useState([]);
  
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const expenseRef = collection(db, "expenses");
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
      fetchTransfers();
      fetchExpenses();
    }
  }, [uid, authLoaded]);

  // FETCH TRANSFERS
  const fetchTransfers = async () => {
    if (!uid) return;

    const q = query(transferRef, where("userId", "==", uid));

    const snap = await getDocs(q);

    const list = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    setTransferList(list);
  };

  // FETCH EXPENSES
  const fetchExpenses = async () => {
    if (!uid) return;

    const q = query(expenseRef, where("userId", "==", uid));

    const snap = await getDocs(q);

    const list = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    setExpenseList(list);
  };

  // IMAGE PICKER
  const pickImage = async () => {

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true
    });

    if (!result.canceled) {
      setReceipt(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  // ADD EXPENSE
  const addExpense = async () => {

    if (!selectedTransfer) {
      alert("Select transfer source");
      return;
    }

    if (!amount || !category) {
      alert("Enter required details");
      return;
    }

    const expenseAmount = Number(amount);
    const remaining =
      selectedTransfer.remainingAmount ??
      selectedTransfer.amount ??
      0;

    if (expenseAmount > remaining) {
      alert("Not enough balance");
      return;
    }

    // SAVE EXPENSE
    await addDoc(expenseRef, {
      name,
      amount: expenseAmount,
      category,
      paymentMethod,
      notes,
      location,
      receipt,
      transferId: selectedTransfer.id,
      userId: uid,
      createdAt: serverTimestamp(),
      expenseDate: Timestamp.fromDate(date)
    });

    // UPDATE TRANSFER BALANCE
    const transferDoc = doc(db, "transfers", selectedTransfer.id);

    await updateDoc(transferDoc, {
      remainingAmount: remaining - expenseAmount
    });

    // RESET FORM
    setName("");
    setAmount("");
    setCategory("");
    setPaymentMethod("");
    setNotes("");
    setLocation("");
    setReceipt(null);
    setDate(new Date());

    setShowSheet(false);

    fetchExpenses();
    fetchTransfers();
  };

  const formatDateFull = (timestamp) => {
    if (!timestamp) return "";
    try {
      const d = timestamp.toDate ? timestamp.toDate() : (timestamp instanceof Date ? timestamp : new Date(timestamp));
      if (isNaN(d.getTime())) return "Recently";
      return (
        d.toLocaleDateString("en-IN", { day: 'numeric', month: 'short' }) +
        " • " +
        d.toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })
      );
    } catch (e) {
      return "Recently";
    }
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: "#111827" }}>

      {/* HEADER */}
      <View className="bg-gray-900 px-4 py-4 flex-row items-center">

        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back-circle-outline" size={32} color="white" />
        </TouchableOpacity>

        <Text className="text-white text-xl font-bold">
          My Expenses
        </Text>

      </View>

      {/* EXPENSE LIST */}
      <View className="flex-1 bg-gray-100 p-4">

        <FlatList
          data={expenseList}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (

            <View className="bg-white p-4 rounded-xl mb-3 shadow">

              <Text className="font-bold text-lg">
                {item.category}
              </Text>

              <Text className="text-red-600">
                ₹{item.amount}
              </Text>

              {item.name && (
                <Text className="text-gray-600">
                  {item.name}
                </Text>
              )}

              <Text className="text-gray-500 text-xs mt-1">
                {formatDateFull(item.expenseDate || item.createdAt)}
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
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View className="flex-1 justify-end bg-black/40">

            <View className="bg-white p-6 rounded-t-3xl">

              <ScrollView showsVerticalScrollIndicator={false} className="max-h-[85%]" keyboardShouldPersistTaps="handled">

                <View className="flex-row justify-between items-center mb-4">

                  <Text className="text-xl font-bold">
                    Add Expense
                  </Text>

                  <TouchableOpacity onPress={() => setShowSheet(false)}>
                    <Ionicons name="close-circle" size={26} color="#374151" />
                  </TouchableOpacity>

                </View>

                {/* TRANSFER SOURCE */}
                <Text className="text-gray-700 font-semibold mb-1">
                  Transfer Source
                </Text>

                <View className="w-full bg-[#dfe7c7] rounded-lg mb-4">

                  <Picker
                    selectedValue={selectedTransfer?.id || ""}
                    onValueChange={(value) => {
                      const transfer = transferList.find(i => i.id === value) || null;
                      setSelectedTransfer(transfer);
                    }}
                    dropdownIconColor="#111827"
                    style={{ color: "#111827", width: "100%" }}
                  >

                    <Picker.Item label="Select Transfer Source" value="" color="#9ca3af" />

                    {transferList.map((item) => (
                      <Picker.Item
                        key={item.id}
                        label={`${item.name} - ₹${item.remainingAmount ?? item.amount}`}
                        value={item.id}
                        color="#111827"
                      />
                    ))}

                  </Picker>

                </View>

                {selectedTransfer && (
                  <Text className="text-green-600 mb-3 font-bold">
                    Balance: ₹{selectedTransfer.remainingAmount ?? selectedTransfer.amount}
                  </Text>
                )}

                {/* AMOUNT */}
                <Text className="text-gray-700 font-semibold mb-1">
                  Total Amount Spent
                </Text>

                <TextInput
                  placeholder="0.00"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                  className="w-full bg-[#dfe7c7] rounded-lg px-3 py-4 mb-4 text-[#111827] font-semibold"
                />

                {/* CATEGORY */}
                <Text className="text-gray-700 font-semibold mb-1">
                  Expense Category
                </Text>

                <TextInput
                  placeholder="E.g. Food, Travel, Shopping"
                  placeholderTextColor="#9ca3af"
                  value={category}
                  onChangeText={setCategory}
                  className="w-full bg-[#dfe7c7] rounded-lg px-3 py-4 mb-4 text-[#111827] font-semibold"
                />

                {/* PAYMENT METHOD */}
                <Text className="text-gray-700 font-semibold mb-1">
                  Payment Method
                </Text>

                <TextInput
                  placeholder="E.g. Cash, UPI, Card"
                  placeholderTextColor="#9ca3af"
                  value={paymentMethod}
                  onChangeText={setPaymentMethod}
                  className="w-full bg-[#dfe7c7] rounded-lg px-3 py-4 mb-4 text-[#111827] font-semibold"
                />

                {/* NOTES */}
                <Text className="text-gray-700 font-semibold mb-1">
                  Optional Notes
                </Text>

                <TextInput
                  placeholder="Add extra details here..."
                  placeholderTextColor="#9ca3af"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  className="w-full bg-[#dfe7c7] rounded-lg px-3 py-4 mb-4 text-[#111827] font-semibold"
                />

                <Text className="text-gray-700 font-semibold mb-1">
                  Location (City or Shop Name)
                </Text>
                <TextInput
                  placeholder="Where did you spend?"
                  placeholderTextColor="#9ca3af"
                  value={location}
                  onChangeText={setLocation}
                  className="w-full bg-[#dfe7c7] rounded-lg px-3 py-4 mb-4 text-[#111827] font-semibold"
                />

                {/* DATE & TIME LABEL ADDED */}
                <Text className="text-gray-700 font-semibold mb-1">
                  Transaction Time
                </Text>
                <View className="flex-row gap-3 mb-4">
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(true)}
                    className="flex-1 bg-[#dfe7c7] rounded-lg px-3 py-4 flex-row items-center"
                  >
                    <Ionicons name="calendar-outline" size={20} color="#2f5d34" className="mr-2" />
                    <Text className="text-[#111827] font-semibold">
                      {date.toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setShowTimePicker(true)}
                    className="flex-1 bg-[#dfe7c7] rounded-lg px-3 py-4 flex-row items-center"
                  >
                    <Ionicons name="time-outline" size={20} color="#2f5d34" className="mr-2" />
                    <Text className="text-[#111827] font-semibold">
                      {date.toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>
                </View>

                {showDatePicker && (
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                      setShowDatePicker(false);
                      if (selectedDate) {
                        const newDate = new Date(date);
                        newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                        setDate(newDate);
                      }
                    }}
                    maximumDate={new Date()}
                  />
                )}

                {showTimePicker && (
                  <DateTimePicker
                    value={date}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedTime) => {
                      setShowTimePicker(false);
                      if (selectedTime) {
                        const newDate = new Date(date);
                        newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
                        setDate(newDate);
                      }
                    }}
                  />
                )}

                {/* RECEIPT */}
                <TouchableOpacity
                  onPress={pickImage}
                  className="p-4 rounded-xl mb-4 border border-gray-300 items-center bg-white"
                >
                  <Text className="font-semibold text-gray-700">
                    Upload Receipt Image
                  </Text>
                </TouchableOpacity>

                {receipt && (
                  <Image
                    source={{ uri: receipt }}
                    style={{ width: "100%", height: 120, borderRadius: 10, marginBottom: 10 }}
                  />
                )}

                {/* SAVE */}
                <TouchableOpacity
                  onPress={addExpense}
                  className="p-5 rounded-xl mb-10"
                  style={{ backgroundColor: "#2f5d34" }}
                >
                  <Text className="text-white text-center font-bold">
                    Save Expense
                  </Text>
                </TouchableOpacity>

              </ScrollView>

            </View>

          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}