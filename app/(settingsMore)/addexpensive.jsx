import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
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
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";

import {
  addDoc,
  collection,
  deleteDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  doc,
  updateDoc
} from "firebase/firestore";
import { useData } from "../../context/DataContext";

export default function AddExpense() {
  const router = useRouter();
  const { expenses: expenseList, transfers: transferList, isInitialLoadDone } = useData();
  const { user } = useAuth();
  const uid = user?.uid;

  const [showSheet, setShowSheet] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState(null);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  const [category, setCategory] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState("");
  const [receipt, setReceipt] = useState(null);

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

  const expenseRef = collection(db, "expenses");
  const transferRef = collection(db, "transfers");

  // Data is synced automatically via DataProvider

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
      showToast("Select transfer source", "error");
      return;
    }
    if (!category?.trim()) {
      showToast("Please enter a valid category", "error");
      return;
    }
    const expenseAmount = Number(amount);
    if (isNaN(expenseAmount) || expenseAmount <= 0) {
      showToast("Enter a valid positive amount", "error");
      return;
    }

    const remaining = selectedTransfer.remainingAmount ?? selectedTransfer.amount ?? 0;
    if (expenseAmount > remaining) {
      showToast(`Not enough balance (₹${remaining} left)`, "error");
      return;
    }

    try {
      setLoading(true);
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
        createdAt: serverTimestamp()
      });

      const transferDoc = doc(db, "transfers", selectedTransfer.id);
      await updateDoc(transferDoc, {
        remainingAmount: remaining - expenseAmount
      });

      setName("");
      setAmount("");
      setCategory("");
      setPaymentMethod("");
      setNotes("");
      setLocation("");
      setReceipt(null);
      setShowSheet(false);
      showToast("Expense saved successfully!", "success");
      // Data is synced automatically
    } catch (e) {
      showToast("Failed to save expense", "error");
    } finally {
      setLoading(false);
    }
  };

  // DELETE EXPENSE
  const deleteExpense = async (id, amount, transferId) => {
    Alert.alert("Delete Expense", "Are you sure you want to delete this expense?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setLoading(true);
            await deleteDoc(doc(db, "expenses", id));
            
            // Revert transfer balance
            const transferDoc = doc(db, "transfers", transferId);
            const transfer = transferList.find(t => t.id === transferId);
            if (transfer) {
              const currentRemaining = transfer.remainingAmount ?? transfer.amount ?? 0;
              await updateDoc(transferDoc, {
                remainingAmount: currentRemaining + amount
              });
            }

            showToast("Expense deleted successfully!", "success");
            // Data is synced automatically
          } catch (e) {
            showToast("Failed to delete expense", "error");
          } finally {
            setLoading(false);
          }
        }
      }
    ]);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    return (
      date.toLocaleDateString("en-IN") + " " + date.toLocaleTimeString("en-IN")
    );
  };

  return (
    <SafeAreaView edges={["top","bottom"]} style={{flex:1,backgroundColor:"#111827"}}>
      {/* HEADER */}
      <View className="bg-gray-900 px-4 py-4 flex-row items-center">
        <TouchableOpacity onPress={()=>router.back()} className="mr-3">
          <Ionicons name="arrow-back-circle-outline" size={32} color="white"/>
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">My Expenses</Text>
      </View>

      <View className="flex-1 bg-gray-100 p-4">
        {(!isInitialLoadDone || loading) && (
          <View style={{ paddingBottom: 10 }}>
            <ActivityIndicator size="large" color="#2f5d34" />
          </View>
        )}
        <FlatList
          data={expenseList}
          keyExtractor={(item)=>item.id}
          renderItem={({item}) => (
             <View className="bg-white p-4 rounded-xl mb-3 shadow flex-row justify-between items-center">
               <View>
                 <Text className="font-bold text-lg">{item.category}</Text>
                 <Text className="text-red-600 font-bold">₹{item.amount}</Text>
                 {item.name && <Text className="text-gray-600 font-medium">{item.name}</Text>}
                 <Text className="text-gray-500 text-[10px] mt-1 italic">{formatDate(item.createdAt)}</Text>
               </View>
               <TouchableOpacity 
                 onPress={() => deleteExpense(item.id, item.amount, item.transferId)}
                 className="bg-red-50 p-3 rounded-full"
               >
                 <Ionicons name="trash-outline" size={18} color="#ef4444" />
               </TouchableOpacity>
             </View>
          )}
        />
      </View>

      {/* FLOAT BUTTON */}
      <TouchableOpacity
        onPress={()=>setShowSheet(true)}
        style={{
          position:"absolute",
          bottom:90,
          right:20,
          width:60,
          height:60,
          borderRadius:30,
          backgroundColor:"#2f5d34",
          justifyContent:"center",
          alignItems:"center"
        }}
      >
        <Ionicons name="add" size={30} color="white"/>
      </TouchableOpacity>

      {/* BOTTOM SHEET */}
      <Modal visible={showSheet} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View className="flex-1 justify-end bg-black/40">
            <View className="bg-white p-6 rounded-t-3xl max-h-[90%]">
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
                <View className="flex-row justify-between items-center mb-4">
                  <Text className="text-xl font-bold">Add Expense</Text>
                  <TouchableOpacity onPress={() => setShowSheet(false)}>
                    <Ionicons name="close-circle" size={26} color="#374151" />
                  </TouchableOpacity>
                </View>

                {/* TRANSFER SOURCE */}
                <Text className="text-gray-700 font-semibold mb-1">Transfer Source</Text>
                <View className="w-full bg-[#dfe7c7] rounded-lg mb-4">
                  <Picker
                    selectedValue={selectedTransfer?.id}
                    onValueChange={(value) => {
                      const transfer = transferList.find(i => i.id === value);
                      setSelectedTransfer(transfer);
                    }}
                  >
                    <Picker.Item label="Select Transfer Source" value={null} color="#9ca3af" />
                    {transferList.map((item) => (
                      <Picker.Item
                        key={item.id}
                        label={`${item.name} - ₹${item.remainingAmount ?? item.amount}`}
                        value={item.id}
                      />
                    ))}
                  </Picker>
                </View>

                {selectedTransfer && (
                  <Text className="text-green-600 mb-3">
                    Balance: ₹{selectedTransfer.remainingAmount ?? selectedTransfer.amount}
                  </Text>
                )}

                {/* AMOUNT */}
                <Text className="text-gray-700 font-semibold mb-1">Amount</Text>
                <TextInput
                  placeholder="Enter amount"
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                  placeholderTextColor="#9ca3af"
                  className="w-full bg-[#dfe7c7] rounded-lg px-3 py-4 mb-4"
                />

                {/* CATEGORY */}
                <Text className="text-gray-700 font-semibold mb-1">Category</Text>
                <TextInput
                  placeholder="Food / Travel / Shopping"
                  value={category}
                  onChangeText={setCategory}
                  placeholderTextColor="#9ca3af"
                  className="w-full bg-[#dfe7c7] rounded-lg px-3 py-4 mb-4"
                />

                {/* PAYMENT METHOD */}
                <Text className="text-gray-700 font-semibold mb-1">Payment Method</Text>
                <TextInput
                  placeholder="Cash / UPI / Card"
                  value={paymentMethod}
                  onChangeText={setPaymentMethod}
                  placeholderTextColor="#9ca3af"
                  className="w-full bg-[#dfe7c7] rounded-lg px-3 py-4 mb-4"
                />

                {/* NOTES */}
                <Text className="text-gray-700 font-semibold mb-1">Notes</Text>
                <TextInput
                  placeholder="Add notes"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  className="w-full bg-[#dfe7c7] rounded-lg px-3 py-4 mb-4"
                />

                {/* LOCATION */}
                <Text className="text-gray-700 font-semibold mb-1">Location</Text>
                <TextInput
                  placeholder="Enter location"
                  value={location}
                  onChangeText={setLocation}
                  className="w-full bg-[#dfe7c7] rounded-lg px-3 py-4 mb-4"
                />

                {/* RECEIPT */}
                <TouchableOpacity
                  onPress={pickImage}
                  className="p-4 rounded-xl mb-4 border border-gray-300 items-center"
                >
                  <Text className="font-semibold">Upload Receipt Image</Text>
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
                  disabled={loading}
                  className="p-5 rounded-xl flex-row justify-center items-center"
                  style={{ backgroundColor: "#2f5d34", opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text className="text-white text-center font-bold">Save Expense</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Toast Notification ── */}
      {toast && (
        <Animated.View
          style={{
            position: "absolute",
            top: 60,
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
              size={22}
              color="white"
            />
          </View>
          <Text style={{ color: "white", fontWeight: "800", fontSize: 13, flex: 1 }}>{toast.message}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}