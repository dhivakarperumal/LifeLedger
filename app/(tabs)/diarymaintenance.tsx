import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import * as AuthSession from "expo-auth-session";
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  Timestamp,
  updateDoc,
  where
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { useNavigation } from "@react-navigation/native";
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import FilterSheet, { applyFilters, defaultFilterState, FilterState } from "../../components/FilterSheet";
import { getOrCreateFolder, GOOGLE_DRIVE_FOLDER_NAME, uploadMediaToDrive } from "../../components/GoogleDriveHelper";
import { auth, db } from "../../firebase";
import { useData } from "../../context/DataContext";

WebBrowser.maybeCompleteAuthSession();

const googleDiscovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

export default function DiaryMaintenance() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { diaries: diaryList, isInitialLoadDone } = useData();
  const [uid] = useState<string | null>(auth.currentUser?.uid || null);

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

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mood, setMood] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [voiceNotes, setVoiceNotes] = useState<string[]>([]);

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);

  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingItem, setViewingItem] = useState<any>(null);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const TAG_OPTIONS = ["Travel", "Family", "Work", "Personal", "Health", "Important"];

  const [searchQuery, setSearchQuery] = useState("");
  const [filteredDiaryList, setFilteredDiaryList] = useState<any[]>([]);

  const DIARY_FILTER_GROUPS = [
    { key: "mood", label: "Mood", options: ["Happy", "Relaxed", "Sad", "Angry", "Excited", "Thoughtful"], multi: true },
    { key: "tags", label: "Tags", options: ["Travel", "Family", "Work", "Personal", "Health", "Important"], multi: true },
  ];
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterState, setFilterState] = useState<FilterState>(defaultFilterState(DIARY_FILTER_GROUPS));

  const [loading, setLoading] = useState(false);

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

  const diaryRef = collection(db, "diaries");

  // ─── Google Drive ────────────────────────────────────────────────
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const userEmail = auth.currentUser?.email || "unknown";

  const [driveRequest, driveResponse, drivePromptAsync] = AuthSession.useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "527504049187-5l8nb8rr27ger8jsd5d39086qm65k2oi.apps.googleusercontent.com",
      scopes: ["https://www.googleapis.com/auth/drive.file", "profile", "email"],
      redirectUri: AuthSession.makeRedirectUri({ scheme: "myexpensiveapp", path: "diaries" }),
      responseType: AuthSession.ResponseType.Token,
      usePKCE: false,
    },
    googleDiscovery
  );

  useEffect(() => {
    if (driveResponse?.type === "success") {
      setGoogleAccessToken(driveResponse.authentication?.accessToken || null);
      showToast("Connected to Google Drive!", "success");
    }
  }, [driveResponse]);

  const [useDriveSync, setUseDriveSync] = useState(true);

  // Data is synced automatically via DataProvider

  useEffect(() => {
    let result = applyFilters(diaryList, filterState, "createdAt");

    // Mood filter
    const moodFilter = filterState.chips["mood"] || [];
    if (moodFilter.length > 0) {
      result = result.filter(item => moodFilter.includes(item.mood));
    }

    // Tags filter
    const tagsFilter = filterState.chips["tags"] || [];
    if (tagsFilter.length > 0) {
      result = result.filter(item =>
        (item.tags || []).some((t: string) => tagsFilter.includes(t))
      );
    }

    // Search
    if (searchQuery.trim() !== "") {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(
        item =>
          item.title?.toLowerCase().includes(lowerQuery) ||
          item.description?.toLowerCase().includes(lowerQuery) ||
          item.mood?.toLowerCase().includes(lowerQuery)
      );
    }

    setFilteredDiaryList(result);
  }, [searchQuery, diaryList, filterState]);

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.7,
      base64: true
    });

    if (!result.canceled && result.assets) {
      const newImages = result.assets.map(asset => `data:image/jpeg;base64,${asset.base64}`);
      setImages([...images, ...newImages]);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const toggleTag = (tag: string) => {
    if (tags.includes(tag)) {
      setTags(tags.filter(t => t !== tag));
    } else {
      setTags([...tags, tag]);
    }
  };

  // AUDIO RECORDING
  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status === 'granted') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.LOW_QUALITY
        );
        setRecording(recording);
        setIsRecording(true);
      } else {
        Alert.alert("Permission", "Microphone access required.");
      }
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert("Error", "Could not start audio recording.");
    }
  }

  async function stopRecording() {
    if (recording) {
      try {
        setIsRecording(false);
        setIsProcessingVoice(true);
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        if (uri) {
          const info = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64
          });
          const newNote = `data:audio/m4a;base64,${info}`;
          setVoiceNotes(prev => [...prev, newNote]);
        }
        setRecording(null);
      } catch (e) {
        console.error("Stop recording error", e);
      } finally {
        setIsProcessingVoice(false);
      }
    }
  }

  async function playSound(uri?: string | null) {
    const noteToPlay = uri;
    if (noteToPlay) {
      try {
        if (sound) {
          await sound.unloadAsync();
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          staysActiveInBackground: false,
        });

        let playUri = noteToPlay;

        if (noteToPlay.startsWith("data:audio")) {
          const base64Data = noteToPlay.split("base64,")[1];
          const tempFile = FileSystem.cacheDirectory + "temp_playback.m4a";
          await FileSystem.writeAsStringAsync(tempFile, base64Data, {
            encoding: FileSystem.EncodingType.Base64
          });
          playUri = tempFile;
        }

        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: playUri },
          { shouldPlay: true }
        );
        setSound(newSound);
      } catch (err) {
        console.error("Play sound error", err);
      }
    }
  }

  const onChangeDate = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const addDiary = async () => {
    if (!title || !description) {
      Alert.alert("Error", "Please enter a title and description.");
      return;
    }

    if (isRecording || isProcessingVoice) {
      Alert.alert("Wait", "Please wait for voice recording to finish processing.");
      return;
    }

    setLoading(true);
    try {
      let finalImages = [...images];

      // If Drive Sync is active and token exists, upload images to Drive
      if (useDriveSync && googleAccessToken) {
        const folderId = await getOrCreateFolder(googleAccessToken, GOOGLE_DRIVE_FOLDER_NAME(userEmail));
        if (folderId) {
          const uploadedImages = await Promise.all(images.map(async (img, i) => {
            // Very basic check: if it's already a full drive URL, skip
            if (img.startsWith("https://drive.google.com")) return img;

            const name = `Diary_${Date.now()}_${i}.jpg`;
            const driveId = await uploadMediaToDrive(googleAccessToken, folderId, img, name, "image/jpeg");

            if (driveId) {
              return `https://drive.google.com/uc?id=${driveId}`;
            }
            return img;
          }));
          finalImages = uploadedImages;
        }
      }

      if (editingId) {
        await updateDoc(doc(db, "diaries", editingId), {
          title,
          description,
          mood,
          images: finalImages,
          tags,
          voiceNotes,
          createdAt: Timestamp.fromDate(date),
          driveSynced: !!googleAccessToken && useDriveSync,
        });
        showToast("Diary updated successfully!", "success");
      } else {
        await addDoc(diaryRef, {
          title,
          description,
          mood,
          images: finalImages,
          tags,
          voiceNotes,
          userId: uid,
          createdAt: Timestamp.fromDate(date),
          driveSynced: !!googleAccessToken && useDriveSync,
        });
        showToast("Memory saved successfully!", "success");
      }

      setTitle("");
      setDescription("");
      setMood("");
      setImages([]);
      setTags([]);
      setVoiceNotes([]);
      setDate(new Date());
      setEditingId(null);
      // Data is synced automatically
    } catch (e: any) {
      console.error("ADD DIARY ERROR:", e);
      showToast("Failed to save entry.", "error");
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setMood("");
    setImages([]);
    setTags([]);
    setVoiceNotes([]);
    setDate(new Date());
    setShowSheet(true);
  };

  const openEditModal = (item: any) => {
    setEditingId(item.id);
    setTitle(item.title);
    setDescription(item.description);
    setMood(item.mood || "");
    setImages(item.images || (item.image ? [item.image] : []));
    setTags(item.tags || []);
    setVoiceNotes(item.voiceNotes || (item.voiceNote ? [item.voiceNote] : []));
    setDate(item.createdAt ? item.createdAt.toDate() : new Date());
    setShowSheet(true);
  };

  const confirmDelete = (id: string) => {
    setItemToDelete(id);
    setDeleteModalVisible(true);
  };

  const deleteDiaryEntry = async () => {
    if (!itemToDelete) return;
    try {
      setLoading(true);
      await deleteDoc(doc(db, "diaries", itemToDelete));
      setItemToDelete(null);
      showToast("Diary entry deleted successfully!", "success");
      setDeleteModalVisible(false);
      // Data is synced automatically
    } catch (error) {
      showToast("Failed to delete.", "error");
      setDeleteModalVisible(false);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Just now";
    try {
      const date = timestamp.toDate();
      const options: any = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
      return date.toLocaleDateString("en-IN", options);
    } catch {
      return "";
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: "#f9fafb" }}>

      {/* DIARY LIST */}
      <View className="flex-1 p-0 px-4 pb-0">

        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 10 }}>
          <View style={{
            flex: 1, flexDirection: "row", alignItems: "center",
            backgroundColor: "white",
            borderRadius: 18,
            paddingHorizontal: 16, paddingVertical: 14,
            borderWidth: 1.5, borderColor: "#f0f0f0",
            shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
            minHeight: 56,
          }}>
            <View style={{ backgroundColor: "#f0fdf4", borderRadius: 10, padding: 6, marginRight: 10 }}>
              <Ionicons name="search" size={18} color="#2f5d34" />
            </View>
            <TextInput
              placeholder="Search diary entries..."
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
          chipGroups={DIARY_FILTER_GROUPS}
          activeFilters={filterState}
        />

        {filteredDiaryList.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-gray-500 text-xl font-semibold mb-2">No Entries Found</Text>
            <Text className="text-gray-400">Tap the + button to add your first memory!</Text>
          </View>
        ) : (
          <FlatList
            data={filteredDiaryList}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={{ justifyContent: "space-between" }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100, paddingTop: 4 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  setViewingItem(item);
                  setShowViewModal(true);
                }}
                className="bg-white p-4 rounded-[28px] mb-4 shadow-sm border border-gray-100 w-[48%] relative overflow-hidden"
              >
                {item.images && item.images.length > 0 ? (
                  <View className="relative">
                    <Image
                      source={{ uri: item.images[0] }}
                      className="w-full h-32 rounded-2xl mb-3"
                      resizeMode="cover"
                    />
                    {item.images.length > 1 && (
                      <View className="absolute bottom-5 right-2 bg-black/60 px-2 py-0.5 rounded-md">
                        <Text className="text-[8px] text-white font-bold">+{item.images.length - 1} More</Text>
                      </View>
                    )}
                  </View>
                ) : item.image ? (
                  <Image
                    source={{ uri: item.image }}
                    className="w-full h-32 rounded-2xl mb-3"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-full h-32 bg-gray-50 rounded-2xl items-center justify-center mb-3">
                    <Ionicons name="book-outline" size={32} color="#cbd5e1" />
                  </View>
                )}

                <View className="flex-row justify-between items-start mb-1">
                  <Text className="font-extrabold text-sm text-gray-800 flex-1 mr-1 leading-tight" numberOfLines={2}>
                    {item.title}
                  </Text>
                  <TouchableOpacity onPress={() => confirmDelete(item.id)} className="p-0.5">
                    <Ionicons name="trash-outline" size={14} color="#ef4444" />
                  </TouchableOpacity>
                </View>

                {item.mood ? (
                  <View className="bg-emerald-50 self-start px-2 py-0.5 rounded-full mb-2">
                    <Text className="text-[8px] font-bold text-emerald-700 uppercase">{item.mood}</Text>
                  </View>
                ) : null}

                {item.tags && item.tags.length > 0 && (
                  <View className="flex-row flex-wrap mt-2">
                    {item.tags.slice(0, 2).map((t: string, idx: number) => (
                      <View key={`${item.id}-tag-${idx}`} className="bg-blue-50 px-2 py-0.5 rounded-md mr-1 mb-1">
                        <Text className="text-[7px] text-blue-600 font-bold uppercase">{t}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View className="mt-2 border-t border-gray-50 pt-2 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-1">
                    {(item.voiceNotes?.length > 0 || item.voiceNote) && (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          const note = item.voiceNotes ? item.voiceNotes[0] : item.voiceNote;
                          playSound(note);
                        }}
                        className="bg-emerald-100 p-1.5 rounded-full"
                      >
                        <Ionicons name="play" size={12} color="#2f5d34" />
                      </TouchableOpacity>
                    )}
                    {(item.voiceNotes?.length > 0 || item.voiceNote) && (
                      <View className="flex-row items-center">
                        <Ionicons name="mic" size={10} color="#2f5d34" />
                        {item.voiceNotes?.length > 1 && (
                          <Text className="text-[8px] font-bold text-[#2f5d34] ml-0.5">
                            {item.voiceNotes.length}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                  <Text className="text-[9px] text-gray-400 font-semibold italic">
                    {formatDate(item.createdAt).split(',')[0]}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {/* FLOAT BUTTON */}
      <TouchableOpacity
        onPress={openAddModal}
        style={{ position: "absolute", bottom: 24, right: 24, width: 55, height: 55, borderRadius: 28, backgroundColor: "#2f5d34", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4.65, elevation: 8 }}
      >
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>

      {/* BOTTOM SHEET MODAL */}
      <Modal visible={showSheet} transparent animationType="slide" statusBarTranslucent>
        <KeyboardAvoidingView
          behavior="padding"
          className="flex-1"
        >
          <View className="flex-1 justify-end bg-black/50">
            <View style={{ backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '85%', padding: 24, paddingBottom: Math.max(24, insets.bottom + 10), shadowColor: "#000", shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 }}>
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-2xl font-black text-gray-800">
                  {editingId ? "Edit Diary Entry" : "New Diary Entry"}
                </Text>
                <TouchableOpacity onPress={() => setShowSheet(false)} className="bg-gray-100 p-2 rounded-full">
                  <Ionicons name="close" size={24} color="#374151" />
                </TouchableOpacity>
              </View>

              {/* Google Drive Status */}
              <View style={{ backgroundColor: "#f8fafc", borderRadius: 24, padding: 18, marginBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#f0f0f0' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ backgroundColor: googleAccessToken ? '#f0fdf4' : '#fef2f2', padding: 10, borderRadius: 14 }}>
                    <Ionicons name="logo-google" size={24} color={googleAccessToken ? '#2f5d34' : '#ef4444'} />
                  </View>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#1f2937' }}>Cloud Media Sync</Text>
                    <Text style={{ fontSize: 12, color: '#9ca3af', fontWeight: '600' }}>
                      {googleAccessToken ? "Vault Connected" : "Local Storage Only"}
                    </Text>
                  </View>
                </View>

                {googleAccessToken ? (
                  <TouchableOpacity
                    onPress={() => setUseDriveSync(!useDriveSync)}
                    style={{ backgroundColor: useDriveSync ? '#2f5d34' : '#e5e7eb', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16 }}
                  >
                    <Text style={{ color: useDriveSync ? 'white' : '#6b7280', fontSize: 12, fontWeight: '800' }}>
                      {useDriveSync ? "ON" : "OFF"}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => drivePromptAsync()}
                    style={{ backgroundColor: '#2f5d34', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16 }}
                  >
                    <Text style={{ color: 'white', fontSize: 12, fontWeight: '800' }}>CONNECT</Text>
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 100 }}
              >
                <Text className="text-gray-400 font-black uppercase tracking-widest text-[10px] mb-2 ml-1">Memory Title</Text>
                <TextInput
                  placeholder="E.g. A beautiful day at the beach, My first paycheck"
                  value={title}
                  onChangeText={setTitle}
                  style={{ width: "100%", backgroundColor: "#f9fafb", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16, marginBottom: 20, fontSize: 16, fontWeight: "700", color: "#111827" }}
                  placeholderTextColor="#9ca3af"
                />

                <Text className="text-gray-400 font-black uppercase tracking-widest text-[10px] mb-2 ml-1">Date</Text>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  style={{ flexDirection: "row", alignItems: "center", width: "100%", backgroundColor: "#f9fafb", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16, marginBottom: 20 }}
                >
                  <Ionicons name="calendar-outline" size={20} color="#2f5d34" />
                  <Text style={{ fontSize: 16, color: "#111827", fontWeight: "700", marginLeft: 12 }}>
                    {date.toLocaleDateString("en-IN", { year: 'numeric', month: 'short', day: 'numeric' })}
                  </Text>
                </TouchableOpacity>

                {showDatePicker && (
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display="default"
                    onChange={onChangeDate}
                    maximumDate={new Date()}
                  />
                )}

                <Text className="text-gray-400 font-black uppercase tracking-widest text-[10px] mb-2 ml-1">Status / Mood</Text>
                <View style={{ width: "100%", backgroundColor: "#f9fafb", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 16, marginBottom: 20, overflow: "hidden" }}>
                  <Picker
                    selectedValue={mood}
                    onValueChange={(itemValue) => setMood(itemValue)}
                    dropdownIconColor="#111827"
                    style={{ color: "#75777cff" }}
                  >
                    <Picker.Item label="How are you feeling?" value="" color="#9ca3af" />
                    <Picker.Item label="😊 Happy" value="Happy" color="#111827" />
                    <Picker.Item label="😌 Relaxed" value="Relaxed" color="#111827" />
                    <Picker.Item label="😢 Sad" value="Sad" color="#111827" />
                    <Picker.Item label="😡 Angry" value="Angry" color="#111827" />
                    <Picker.Item label="🤩 Excited" value="Excited" color="#111827" />
                    <Picker.Item label="🤔 Thoughtful" value="Thoughtful" color="#111827" />
                  </Picker>
                </View>

                <Text className="text-gray-400 font-black uppercase tracking-widest text-[10px] mb-2 ml-1">Tags</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                  {TAG_OPTIONS.map((tag, idx) => (
                    <TouchableOpacity
                      key={`tag-opt-${idx}`}
                      onPress={() => toggleTag(tag)}
                      style={{ marginRight: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, backgroundColor: tags.includes(tag) ? "#2f5d34" : "white", borderColor: tags.includes(tag) ? "#2f5d34" : "#e5e7eb" }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "700", color: tags.includes(tag) ? "white" : "#4b5563" }}>
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text className="text-gray-400 font-black uppercase tracking-widest text-[10px] mb-2 ml-1">Write your heart out</Text>
                <TextInput
                  placeholder="How was your day? What made it special?"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  textAlignVertical="top"
                  style={{ width: "100%", backgroundColor: "#f9fafb", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16, marginBottom: 20, fontSize: 16, color: "#111827", minHeight: 160, fontWeight: "500" }}
                  placeholderTextColor="#9ca3af"
                />

                {/* VOICE NOTES LIST */}
                <Text className="text-gray-400 font-black uppercase tracking-widest text-[10px] mb-2 ml-1">Voice Notes</Text>
                <View style={{ marginBottom: 20 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#f9fafb", padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#f0f0f0", marginBottom: 12 }}>
                    <TouchableOpacity
                      onPress={isRecording ? stopRecording : startRecording}
                      style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: isRecording ? "#ef4444" : "#2f5d34" }}
                    >
                      <Ionicons name={isRecording ? "stop" : "mic"} size={24} color="white" />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 16 }}>
                      {isRecording ? (
                        <Text style={{ color: "#ef4444", fontWeight: "700" }}>Recording...</Text>
                      ) : isProcessingVoice ? (
                        <ActivityIndicator size="small" color="#2f5d34" />
                      ) : (
                        <Text style={{ color: "#9ca3af", fontSize: 12, fontWeight: "700" }}>Tap mic to record audio</Text>
                      )}
                    </View>
                  </View>

                  {voiceNotes.map((note, index) => (
                    <View key={`voice-${index}`} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#f0fdf4", padding: 12, borderRadius: 16, marginBottom: 8, borderWidth: 1, borderColor: "#dcfce7" }}>
                      <TouchableOpacity
                        onPress={() => playSound(note)}
                        style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#2f5d34", alignItems: "center", justifyContent: "center", marginRight: 12 }}
                      >
                        <Ionicons name="play" size={16} color="white" />
                      </TouchableOpacity>
                      <Text style={{ flex: 1, color: "#2f5d34", fontWeight: "700", fontSize: 13 }}>Voice Note #{index + 1}</Text>
                      <TouchableOpacity onPress={() => setVoiceNotes(prev => prev.filter((_, i) => i !== index))}>
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                {/* IMAGES */}
                <Text className="text-gray-400 font-black uppercase tracking-widest text-[10px] mb-2 ml-1">Photos</Text>
                <TouchableOpacity
                  onPress={pickImages}
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", width: "100%", backgroundColor: "#f9fafb", paddingVertical: 20, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderStyle: "dashed", borderColor: "#d1d5db" }}
                >
                  <Ionicons name="images-outline" size={24} color="#6b7280" style={{ marginRight: 8 }} />
                  <Text style={{ color: "#6b7280", fontWeight: "700" }}>Attach Photos</Text>
                </TouchableOpacity>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
                  {images.map((img, idx) => (
                    <View key={`img-prev-${idx}`} style={{ marginRight: 16, position: "relative" }}>
                      <Image
                        source={{ uri: img }}
                        style={{ width: 120, height: 120, borderRadius: 20 }}
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        style={{ position: "absolute", top: -8, right: -8, backgroundColor: "#ef4444", padding: 6, borderRadius: 14 }}
                        onPress={() => removeImage(idx)}
                      >
                        <Ionicons name="close" size={12} color="white" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  onPress={addDiary}
                  activeOpacity={0.8}
                  disabled={loading}
                  style={{ width: "100%", backgroundColor: "#2f5d34", paddingVertical: 20, borderRadius: 24, alignItems: "center", marginBottom: 24, opacity: loading ? 0.7 : 1, elevation: 4, shadowColor: "#2f5d34", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 }}
                >
                  {loading ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text style={{ color: "white", fontSize: 18, fontWeight: "900", textTransform: "uppercase", letterSpacing: 2 }}>
                      {editingId ? "Update Entry" : "Save Memory"}
                    </Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* VIEW MODAL */}
      <Modal visible={showViewModal} transparent animationType="slide">
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-white rounded-t-[50px] h-[92%] shadow-2xl relative overflow-hidden">

            {/* Header / Top Background */}
            <View className="absolute top-0 left-0 right-0 h-48 bg-[#2f5d34]" />

            <View className="flex-1">
              <View className="flex-row justify-between items-center px-8 pt-8 pb-4 z-10">
                <View>
                  <Text className="text-white/60 text-[10px] font-black uppercase tracking-[3px] mb-1">Memory Entry</Text>
                  <Text className="text-white text-2xl font-black">View Details</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowViewModal(false)}
                  className="bg-white/20 p-3 rounded-2xl"
                  style={{ backdropFilter: 'blur(10px)' }}
                >
                  <Ionicons name="close" size={24} color="white" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 20, paddingBottom: 100 }}
              >
                {/* Title and Date Card */}
                <View className="bg-white rounded-[32px] p-6 shadow-xl shadow-black/5 mb-6 border border-gray-50">
                  <Text className="text-3xl font-black text-gray-900 leading-tight mb-3">
                    {viewingItem?.title}
                  </Text>
                  <View className="flex-row items-center">
                    <View className="bg-gray-100 p-2 rounded-xl mr-3">
                      <Ionicons name="calendar" size={16} color="#2f5d34" />
                    </View>
                    <View>
                      <Text className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Recorded Date</Text>
                      <Text className="text-gray-700 font-bold">{formatDate(viewingItem?.createdAt)}</Text>
                    </View>
                    {viewingItem?.mood && (
                      <View className="ml-auto bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100">
                        <Text className="text-emerald-700 text-xs font-black uppercase">{viewingItem?.mood}</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Images Section */}
                {viewingItem?.images && viewingItem.images.length > 0 && (
                  <View className="mb-8">
                    <Text className="text-gray-900 font-black text-lg mb-4 ml-2">Captured Moments</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 px-4">
                      {viewingItem.images.map((img: string, idx: number) => (
                        <View key={idx} className="mr-4 shadow-lg shadow-black/10">
                          <Image
                            source={{ uri: img }}
                            className="w-72 h-80 rounded-[40px] border-4 border-white"
                            resizeMode="cover"
                          />
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Description Card */}
                <View className="mb-8">
                  <Text className="text-gray-900 font-black text-lg mb-4 ml-2">The Story</Text>
                  <View className="bg-gray-50/50 p-8 rounded-[40px] border border-dashed border-gray-200">
                    <Ionicons name="reader-outline" size={32} color="#f0f0f0" style={{ position: 'absolute', top: 20, left: 20 }} />
                    <Text className="text-gray-700 text-lg leading-[28px] font-medium italic">
                      {viewingItem?.description}
                    </Text>
                  </View>
                </View>

                {/* Voice Note Section */}
                {(viewingItem?.voiceNotes?.length > 0 || viewingItem?.voiceNote) && (
                  <View className="mb-10">
                    <Text className="text-gray-900 font-black text-lg mb-4 ml-2">Voice Recordings</Text>

                    {/* Backward compat for single voiceNote */}
                    {viewingItem.voiceNote && !viewingItem.voiceNotes && (
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => playSound(viewingItem.voiceNote)}
                        className="bg-[#2f5d34] p-6 rounded-[35px] flex-row items-center shadow-2xl shadow-[#2f5d34]/40 mb-3"
                      >
                        <View className="bg-white/20 p-4 rounded-full mr-5 items-center justify-center">
                          <Ionicons name="play" size={28} color="white" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-white font-black text-lg">Listen to Note</Text>
                          <Text className="text-white/60 text-xs font-bold uppercase tracking-widest mt-0.5">Press to replay voice</Text>
                        </View>
                      </TouchableOpacity>
                    )}

                    {/* Multiple notes mapping */}
                    {viewingItem.voiceNotes?.map((note: string, vIdx: number) => (
                      <TouchableOpacity
                        key={`v-view-${vIdx}`}
                        activeOpacity={0.9}
                        onPress={() => playSound(note)}
                        className="bg-[#2f5d34] p-5 rounded-[30px] flex-row items-center shadow-lg shadow-black/10 mb-3"
                      >
                        <View className="bg-white/20 p-3 rounded-full mr-4 items-center justify-center">
                          <Ionicons name="play" size={22} color="white" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-white font-black text-base">Voice Note #{vIdx + 1}</Text>
                          <Text className="text-white/50 text-[10px] uppercase font-bold tracking-widest">Recorded Memory</Text>
                        </View>
                        <View className="flex-row gap-0.5">
                          {[1, 2, 3].map(v => (
                            <View key={v} className="bg-white/20 w-1 h-6 rounded-full" />
                          ))}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Actions Section */}
                <View className="flex-row gap-4 mt-4">
                  <TouchableOpacity
                    onPress={() => {
                      setShowViewModal(false);
                      openEditModal(viewingItem);
                    }}
                    className="flex-1 bg-gray-900 h-20 rounded-[30px] items-center flex-row justify-center shadow-xl shadow-black/20"
                  >
                    <Ionicons name="create" size={20} color="white" />
                    <Text className="text-white font-black uppercase tracking-widest text-sm ml-3">Edit Entry</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setShowViewModal(false);
                      confirmDelete(viewingItem?.id);
                    }}
                    className="bg-red-50 w-20 h-20 rounded-[30px] items-center justify-center border border-red-100"
                  >
                    <Ionicons name="trash" size={24} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal visible={deleteModalVisible} transparent animationType="fade">
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View className="bg-white w-full rounded-[32px] p-6 items-center shadow-2xl">
            <View className="w-16 h-16 rounded-full bg-red-50 items-center justify-center mb-4">
              <Ionicons name="trash" size={28} color="#ef4444" />
            </View>
            <Text className="text-2xl font-black text-gray-900 mb-2">Delete Entry?</Text>
            <Text className="text-gray-500 text-center mb-8 px-4 font-medium leading-5">
              Are you sure you want to delete this diary entry? This action cannot be undone.
            </Text>
            <View className="flex-row w-full gap-3">
              <TouchableOpacity
                onPress={() => setDeleteModalVisible(false)}
                className="flex-1 py-4 rounded-2xl bg-gray-100 items-center"
              >
                <Text className="text-gray-700 font-bold text-lg">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={deleteDiaryEntry}
                disabled={loading}
                className="flex-1 py-4 rounded-2xl bg-red-500 items-center shadow-lg shadow-red-500/30"
              >
                {loading ? <ActivityIndicator color="white" size="small" /> : <Text className="text-white font-bold text-lg">Delete</Text>}
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