import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  Image
} from "react-native";
import { useState, useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";

import { auth, db } from "../../firebase";

import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  doc,
  updateDoc
} from "firebase/firestore";

export default function AddExpense() {

  const router = useRouter();
  const uid = auth.currentUser?.uid;

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

  const expenseRef = collection(db, "expenses");
  const transferRef = collection(db, "transfers");

  useEffect(() => {
    fetchTransfers();
    fetchExpenses();
  }, []);

  // FETCH TRANSFERS
  const fetchTransfers = async () => {

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
      createdAt: serverTimestamp()
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

    setShowSheet(false);

    fetchExpenses();
    fetchTransfers();
  };

  const formatDate = (timestamp) => {

    if (!timestamp) return "";

    const date = timestamp.toDate();

    return (
      date.toLocaleDateString("en-IN") +
      " " +
      date.toLocaleTimeString("en-IN")
    );
  };

  return (
    <SafeAreaView edges={["top","bottom"]} style={{flex:1,backgroundColor:"#111827"}}>

      {/* HEADER */}
      <View className="bg-gray-900 px-4 py-4 flex-row items-center">

        <TouchableOpacity onPress={()=>router.back()} className="mr-3">
          <Ionicons name="arrow-back-circle-outline" size={32} color="white"/>
        </TouchableOpacity>

        <Text className="text-white text-xl font-bold">
          My Expenses
        </Text>

      </View>

      {/* EXPENSE LIST */}
      <View className="flex-1 bg-gray-100 p-4">

        <FlatList
          data={expenseList}
          keyExtractor={(item)=>item.id}
          renderItem={({item}) => (

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
                {formatDate(item.createdAt)}
              </Text>

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

        <View className="flex-1 justify-end bg-black/40">

          <View className="bg-white p-6 rounded-t-3xl">

            <View className="flex-row justify-between items-center mb-4">

              <Text className="text-xl font-bold">
                Add Expense
              </Text>

              <TouchableOpacity onPress={()=>setShowSheet(false)}>
                <Ionicons name="close-circle" size={26} color="#374151"/>
              </TouchableOpacity>

            </View>

            {/* TRANSFER SOURCE */}
            <Text className="text-gray-700 font-semibold mb-1">
              Transfer Source
            </Text>

            <View className="w-full bg-[#dfe7c7] rounded-lg mb-4">

              <Picker
                selectedValue={selectedTransfer?.id}
                onValueChange={(value)=>{
                  const transfer = transferList.find(i=>i.id===value);
                  setSelectedTransfer(transfer);
                }}
              >

                <Picker.Item label="Select Transfer Source" value={null}/>

                {transferList.map((item)=>(
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

            {/* CATEGORY */}
            <Text className="text-gray-700 font-semibold mb-1">
              Category
            </Text>

            <TextInput
              placeholder="Food / Travel / Shopping"
              value={category}
              onChangeText={setCategory}
              className="w-full bg-[#dfe7c7] rounded-lg px-3 py-4 mb-4"
            />

            {/* PAYMENT METHOD */}
            <Text className="text-gray-700 font-semibold mb-1">
              Payment Method
            </Text>

            <TextInput
              placeholder="Cash / UPI / Card"
              value={paymentMethod}
              onChangeText={setPaymentMethod}
              className="w-full bg-[#dfe7c7] rounded-lg px-3 py-4 mb-4"
            />

            {/* NOTES */}
            <Text className="text-gray-700 font-semibold mb-1">
              Notes
            </Text>

            <TextInput
              placeholder="Add notes"
              value={notes}
              onChangeText={setNotes}
              multiline
              className="w-full bg-[#dfe7c7] rounded-lg px-3 py-4 mb-4"
            />

            {/* LOCATION */}
            <Text className="text-gray-700 font-semibold mb-1">
              Location
            </Text>

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
              <Text className="font-semibold">
                Upload Receipt Image
              </Text>
            </TouchableOpacity>

            {receipt && (
              <Image
                source={{uri:receipt}}
                style={{width:"100%",height:120,borderRadius:10,marginBottom:10}}
              />
            )}

            {/* SAVE */}
            <TouchableOpacity
              onPress={addExpense}
              className="p-5 rounded-xl"
              style={{backgroundColor:"#2f5d34"}}
            >
              <Text className="text-white text-center font-bold">
                Save Expense
              </Text>
            </TouchableOpacity>

          </View>

        </View>

      </Modal>

    </SafeAreaView>
  );
}