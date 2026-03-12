import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as AuthSession from "expo-auth-session";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import * as Sharing from "expo-sharing";
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
  where,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import FilterSheet, {
  applyFilters,
  defaultFilterState,
  FilterState,
} from "../../components/FilterSheet";
import { getOrCreateFolder, GOOGLE_DRIVE_FOLDER_NAME, uploadMediaToDrive } from "../../components/GoogleDriveHelper";
import { auth, db } from "../../firebase";

WebBrowser.maybeCompleteAuthSession();

const googleDiscovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

const { width: SCREEN_W } = Dimensions.get("window");

type MediaItem = { uri: string; type: "image" | "video" };

export default function Memories() {
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid || null);
  const [authLoaded, setAuthLoaded] = useState(false);

  // ─── Data states ─────────────────────────────────────────────────
  const [memories, setMemories] = useState<any[]>([]);
  const [filteredMemories, setFilteredMemories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // ─── Filter states ────────────────────────────────────────────────
  const MEMORY_FILTER_GROUPS = [
    { key: "eventType", label: "Event Type", options: ["Birthday", "Trip", "Festival", "Wedding", "Graduation", "Other"], multi: true },
    { key: "tags", label: "Tags", options: ["Family", "Friends", "Work", "Travel", "Nature", "Celebration"], multi: true },
  ];
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterState, setFilterState] = useState<FilterState>(defaultFilterState(MEMORY_FILTER_GROUPS));

  // ─── Selection mode ───────────────────────────────────────────────
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectionAnim = useRef(new Animated.Value(0)).current;

  // ─── Add/Edit modal ───────────────────────────────────────────────
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ─── Multi media ─────────────────────────────────────────────────
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);         // new upload
  const [previewIndex, setPreviewIndex] = useState(0);

  // ─── Voice Recording ──────────────────────────────────────────────
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceNotes, setVoiceNotes] = useState<string[]>([]);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  // ─── Lightbox (full screen view) ─────────────────────────────────
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxMemory, setLightboxMemory] = useState<any>(null);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);

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

  const memoriesRef = collection(db, "memories");

  // ─── Google Drive ────────────────────────────────────────────────
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const userEmail = auth.currentUser?.email || "unknown";

  const [driveRequest, driveResponse, drivePromptAsync] = AuthSession.useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "449656809142-placeholder.apps.googleusercontent.com",
      scopes: ["https://www.googleapis.com/auth/drive.file", "profile", "email"],
      redirectUri: AuthSession.makeRedirectUri({ scheme: "myexpensiveapp", path: "memories" }),
      responseType: AuthSession.ResponseType.Token,
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

  // ─── Fetch ────────────────────────────────────────────────────────
  const fetchData = async () => {
    if (!uid) return;
    try {
      setLoading(true);
      const q = query(memoriesRef, where("userId", "==", uid));
      const snap = await getDocs(q);
      const list: any[] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setMemories(list);
      setFilteredMemories(list);
    } catch (e) {
      showToast("Could not load memories.", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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
      fetchData();
    }
  }, [uid, authLoaded]);

  // ─── Search + Filter ──────────────────────────────────────────────
  useEffect(() => {
    let result = applyFilters(memories, filterState, "createdAt");
    const evFilter = filterState.chips["eventType"] || [];
    if (evFilter.length > 0) result = result.filter(item => evFilter.some(ev => item.eventType?.toLowerCase().includes(ev.toLowerCase())));
    const tagsFilter = filterState.chips["tags"] || [];
    if (tagsFilter.length > 0) result = result.filter(item => (item.tags || []).some((t: string) => tagsFilter.includes(t)));
    if (searchQuery.trim()) {
      const lower = searchQuery.toLowerCase();
      result = result.filter(m => m.title?.toLowerCase().includes(lower) || m.place?.toLowerCase().includes(lower));
    }
    setFilteredMemories(result);
  }, [searchQuery, memories, filterState]);

  // ─── Pick Media ───────────────────────────────────────────────────
  const pickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission", "Gallery access required."); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      selectionLimit: 20,
      quality: 0.5, // Reduced quality to help with Firestore size limits
      base64: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      const picked: MediaItem[] = result.assets.map((a) => ({
        uri: a.type === "video"
          ? a.uri // videos: keep uri
          : `data:image/jpeg;base64,${a.base64}`,
        type: a.type === "video" ? "video" : "image",
      }));
      setMediaItems((prev) => [...prev, ...picked]);
      setPreviewIndex(0);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission", "Camera access required."); return; }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      const a = result.assets[0];
      const picked: MediaItem = {
        uri: a.type === "video" ? a.uri : `data:image/jpeg;base64,${a.base64}`,
        type: a.type === "video" ? "video" : "image",
      };
      setMediaItems((prev) => [...prev, picked]);
      setPreviewIndex(mediaItems.length);
    }
  };

  // ─── Audio Recording ──────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission", "Microphone access required.");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.LOW_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording", err);
      Alert.alert("Error", "Could not start audio recording.");
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (uri) {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const newNote = `data:audio/m4a;base64,${base64}`;
        setVoiceNotes(prev => [...prev, newNote]);
      }
      setRecording(null);
    } catch (err) {
      console.error("Failed to stop recording", err);
    }
  };

  const playSound = async (uri?: string) => {
    const noteToPlay = uri;
    if (noteToPlay) {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });

        let playUri = noteToPlay;

        // If it's a base64 string, we need to temporarily write it to a file to play it via expo-av
        if (noteToPlay.startsWith("data:audio")) {
          const base64Data = noteToPlay.split("base64,")[1];
          const tempFile = FileSystem.cacheDirectory + "temp_playback.m4a";
          await FileSystem.writeAsStringAsync(tempFile, base64Data, { encoding: FileSystem.EncodingType.Base64 });
          playUri = tempFile;
        }

        const { sound: newSound } = await Audio.Sound.createAsync({ uri: playUri });
        setSound(newSound);
        await newSound.playAsync();
      } catch (err) {
        console.error("Play sound error", err);
      }
    }
  };

  const removeMedia = (index: number) => {
    setMediaItems((prev) => prev.filter((_, i) => i !== index));
    setPreviewIndex(0);
  };

  // ─── Save ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!title) { Alert.alert("Error", "Please enter a title."); return; }
    if (mediaItems.length === 0 && !editingId) { Alert.alert("Error", "Add at least one photo or video."); return; }

    setLoading(true);
    try {
      let finalMedia = [...mediaItems];

      // If Drive Sync is active and token exists, upload media to Drive
      if (useDriveSync && googleAccessToken) {
        const folderId = await getOrCreateFolder(googleAccessToken, GOOGLE_DRIVE_FOLDER_NAME(userEmail));
        if (folderId) {
          const uploadedMedia = await Promise.all(mediaItems.map(async (m, i) => {
            // If already on drive (has driveId), skip
            if ((m as any).driveId) return m;

            const name = `Memory_${Date.now()}_${i}.${m.type === "video" ? "mp4" : "jpg"}`;
            const mimeType = m.type === "video" ? "video/mp4" : "image/jpeg";
            const driveId = await uploadMediaToDrive(googleAccessToken, folderId, m.uri, name, mimeType);

            if (driveId) {
              return {
                ...m,
                driveId,
                driveUrl: `https://drive.google.com/uc?id=${driveId}`,
                // Keep local base64/uri for immediate preview, but mark as synced
                isSynced: true
              };
            }
            return m;
          }));
          finalMedia = uploadedMedia;
        }
      }

      const data: any = {
        title,
        place,
        userId: uid,
        createdAt: Timestamp.fromDate(date),
        image: finalMedia.find(m => m.type === "image")?.uri || finalMedia[0]?.uri || null,
        media: finalMedia,
        mediaCount: finalMedia.length,
        voiceNotes: voiceNotes,
        voiceNote: voiceNotes[0] || null,
        driveSynced: !!googleAccessToken && useDriveSync,
      };

      if (editingId) {
        await updateDoc(doc(db, "memories", editingId), data);
        showToast("Memory updated successfully!", "success");
      } else {
        await addDoc(memoriesRef, data);
        showToast("Memory saved successfully!", "success");
      }
      closeModal();
      await fetchData();
    } catch (e: any) {
      console.error("SAVE ERROR:", e);
      if (e.message?.includes("too large")) {
        showToast("Memory too large! Try fewer items.", "error");
      } else {
        showToast("Failed to save memory.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────
  const confirmDelete = (id: string) => {
    setItemToDelete(id);
    setIsDeletingSelected(false);
    setDeleteModalVisible(true);
  };

  const confirmDeleteSelected = () => {
    setIsDeletingSelected(true);
    setDeleteModalVisible(true);
  };

  const executeDelete = async () => {
    setDeleteModalVisible(false);
    try {
      if (isDeletingSelected) {
        await Promise.all([...selectedIds].map(id => deleteDoc(doc(db, "memories", id))));
        exitSelection();
        showToast(`Deleted ${selectedIds.size} memories successfully!`, "success");
      } else if (itemToDelete) {
        await deleteDoc(doc(db, "memories", itemToDelete));
        setItemToDelete(null);
        showToast("Memory deleted successfully!", "success");
      }
      fetchData();
    } catch (error) {
      showToast("Failed to delete memories.", "error");
    }
  };

  // ─── Share ────────────────────────────────────────────────────────
  const shareMedia = async (uris: string[]) => {
    try {
      const fileUris: string[] = [];
      for (let i = 0; i < uris.length; i++) {
        const uri = uris[i];
        if (uri.startsWith("data:")) {
          const base64 = uri.split("base64,")[1];
          const ext = uri.includes("video") ? "mp4" : "jpg";
          const filename = (FileSystem as any).documentDirectory + `memory_${i}.${ext}`;
          await (FileSystem as any).writeAsStringAsync(filename, base64, { encoding: (FileSystem as any).EncodingType?.Base64 || "base64" });
          fileUris.push(filename);
        } else {
          fileUris.push(uri);
        }
      }
      // Share one at a time (Sharing.shareAsync supports one file at a time on most platforms)
      for (const furi of fileUris) {
        await Sharing.shareAsync(furi, { mimeType: furi.endsWith("mp4") ? "video/mp4" : "image/jpeg", dialogTitle: "Share Memory" });
      }
    } catch (e) {
      console.log("Share error:", e);
    }
  };

  const shareSelected = async () => {
    const selected = memories.filter(m => selectedIds.has(m.id));
    const uris: string[] = [];
    selected.forEach(m => {
      if (m.media?.length) uris.push(...m.media.map((mi: MediaItem) => mi.uri));
      else if (m.image) uris.push(m.image);
    });
    await shareMedia(uris);
  };

  // ─── Selection helpers ────────────────────────────────────────────
  const enterSelection = (id: string) => {
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
    Animated.spring(selectionAnim, { toValue: 1, useNativeDriver: true }).start();
  };

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    Animated.spring(selectionAnim, { toValue: 0, useNativeDriver: true }).start();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      if (next.size === 0) exitSelection();
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredMemories.map(m => m.id)));
  };

  const isAllSelected = filteredMemories.length > 0 && filteredMemories.every(m => selectedIds.has(m.id));

  // ─── Modal open/close ─────────────────────────────────────────────
  const openEditModal = (item: any) => {
    setEditingId(item.id);
    setTitle(item.title || "");
    setPlace(item.place || "");
    setDate(item.createdAt?.toDate() || new Date());
    // restore existing media
    const existing: MediaItem[] = item.media?.length
      ? item.media
      : item.image ? [{ uri: item.image, type: "image" as const }] : [];
    setMediaItems(existing);
    setPreviewIndex(0);
    setVoiceNotes(item.voiceNotes || (item.voiceNote ? [item.voiceNote] : []));
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingId(null);
    setTitle("");
    setPlace("");
    setMediaItems([]);
    setPreviewIndex(0);
    setDate(new Date());
    setPreviewIndex(0);
    setDate(new Date());
    setVoiceNotes([]);
    setIsRecording(false);
    if (recording) recording.stopAndUnloadAsync();
  };

  const formatDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const getFirstImage = (item: any): string | null => {
    if (item.media?.length) return item.media.find((m: MediaItem) => m.type === "image")?.uri || item.media[0]?.uri;
    return item.image || null;
  };

  const getMediaCount = (item: any): number => item.mediaCount || (item.media?.length) || (item.image ? 1 : 0);

  // ─── Render card ─────────────────────────────────────────────────
  const renderCard = ({ item }: { item: any }) => {
    const isSelected = selectedIds.has(item.id);
    const thumb = getFirstImage(item);
    const count = getMediaCount(item);
    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => {
          if (selectionMode) { toggleSelect(item.id); }
          else { setLightboxMemory(item); setLightboxVisible(true); }
        }}
        onLongPress={() => { if (!selectionMode) enterSelection(item.id); }}
        style={{
          width: "48%", marginBottom: 14, borderRadius: 24,
          backgroundColor: "white",
          borderWidth: isSelected ? 2.5 : 1,
          borderColor: isSelected ? "#2f5d34" : "#f0f0f0",
          overflow: "hidden",
          elevation: isSelected ? 6 : 2,
          shadowColor: isSelected ? "#2f5d34" : "#000",
          shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8,
        }}
      >
        {/* Thumbnail */}
        <View style={{ position: "relative" }}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={{ width: "100%", height: 145 }} resizeMode="cover" />
          ) : (
            <View style={{ width: "100%", height: 145, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="image-outline" size={40} color="#cbd5e1" />
            </View>
          )}

          {/* Gradient overlay */}
          <LinearGradient colors={["transparent", "rgba(0,0,0,0.55)"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 56, justifyContent: "flex-end", padding: 8 }}>
            <Text style={{ color: "white", fontWeight: "800", fontSize: 12 }} numberOfLines={1}>{item.title}</Text>
          </LinearGradient>

          {/* Media count badge */}
          {count > 1 && (
            <View style={{ position: "absolute", top: 8, left: 8, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 10, flexDirection: "row", alignItems: "center", paddingHorizontal: 7, paddingVertical: 3 }}>
              <Ionicons name="copy-outline" size={11} color="white" />
              <Text style={{ color: "white", fontSize: 10, fontWeight: "800", marginLeft: 3 }}>{count}</Text>
            </View>
          )}

          {/* Video badge */}
          {item.media?.some((m: MediaItem) => m.type === "video") && (
            <View style={{ position: "absolute", top: 8, right: selectionMode ? 36 : 8, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 }}>
              <Ionicons name="videocam" size={12} color="white" />
            </View>
          )}

          {/* Selection checkbox */}
          {selectionMode && (
            <View style={{ position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: isSelected ? "#2f5d34" : "rgba(255,255,255,0.85)", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: isSelected ? "#2f5d34" : "#d1d5db" }}>
              {isSelected && <Ionicons name="checkmark" size={13} color="white" />}
            </View>
          )}

          {/* Share button (only when not in selection mode) */}
          {!selectionMode && (
            <TouchableOpacity
              onPress={() => {
                const uris: string[] = item.media?.length
                  ? item.media.map((m: MediaItem) => m.uri)
                  : [item.image];
                shareMedia(uris.filter(Boolean));
              }}
              style={{ position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 18, padding: 6 }}
            >
              <Ionicons name="share-social" size={14} color="white" />
            </TouchableOpacity>
          )}
        </View>

        {/* Info row */}
        <View style={{ padding: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
            <Ionicons name="location" size={11} color="#2f5d34" />
            <Text style={{ fontSize: 10, color: "#6b7280", fontWeight: "700", marginLeft: 3 }} numberOfLines={1}>{item.place || "No location"}</Text>
          </View>
          <Text style={{ fontSize: 9, color: "#9ca3af", fontWeight: "600" }}>{formatDate(item.createdAt?.toDate() || new Date())}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Lightbox ────────────────────────────────────────────────────
  const LightboxModal = () => {
    const [lbIndex, setLbIndex] = useState(0);
    if (!lightboxMemory) return null;
    const media: MediaItem[] = lightboxMemory.media?.length
      ? lightboxMemory.media
      : lightboxMemory.image ? [{ uri: lightboxMemory.image, type: "image" as const }] : [];

    return (
      <Modal visible={lightboxVisible} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.95)" }}>
          {/* Close + actions */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 52, paddingBottom: 12 }}>
            <TouchableOpacity onPress={() => setLightboxVisible(false)} style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 14, padding: 10 }}>
              <Ionicons name="close" size={22} color="white" />
            </TouchableOpacity>
            <Text style={{ color: "white", fontWeight: "900", fontSize: 16, flex: 1, textAlign: "center", marginHorizontal: 10 }} numberOfLines={1}>{lightboxMemory.title}</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  const uris = media.map(m => m.uri);
                  shareMedia(uris);
                }}
                style={{ backgroundColor: "#2f5d34", borderRadius: 14, padding: 10 }}
              >
                <Ionicons name="share-social" size={20} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setLightboxVisible(false); openEditModal(lightboxMemory); }}
                style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 14, padding: 10 }}
              >
                <Ionicons name="pencil" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Media viewer */}
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            {media.length > 0 && (
              media[lbIndex].type === "video" ? (
                <View style={{ width: SCREEN_W, height: SCREEN_W, backgroundColor: "#111", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="videocam" size={60} color="#4ade80" />
                  <Text style={{ color: "white", marginTop: 12, fontWeight: "700" }}>Video Preview</Text>
                  <TouchableOpacity
                    onPress={() => shareMedia([media[lbIndex].uri])}
                    style={{ marginTop: 16, backgroundColor: "#2f5d34", borderRadius: 16, paddingHorizontal: 24, paddingVertical: 12, flexDirection: "row", alignItems: "center" }}
                  >
                    <Ionicons name="share-social" size={18} color="white" style={{ marginRight: 8 }} />
                    <Text style={{ color: "white", fontWeight: "800" }}>Share Video</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Image source={{ uri: media[lbIndex].uri }} style={{ width: SCREEN_W, height: SCREEN_W * 1.1 }} resizeMode="contain" />
              )
            )}
          </View>

          {/* Thumbnail strip */}
          {media.length > 1 && (
            <View style={{ paddingBottom: 24 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                {media.map((m, i) => (
                  <TouchableOpacity key={i} onPress={() => setLbIndex(i)}>
                    <View style={{ width: 56, height: 56, borderRadius: 14, overflow: "hidden", borderWidth: 2, borderColor: i === lbIndex ? "#2f5d34" : "transparent" }}>
                      {m.type === "video" ? (
                        <View style={{ flex: 1, backgroundColor: "#1f2937", alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name="videocam" size={22} color="#4ade80" />
                        </View>
                      ) : (
                        <Image source={{ uri: m.uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Meta */}
          <View style={{ paddingHorizontal: 20, paddingBottom: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="location" size={13} color="#4ade80" />
                <Text style={{ color: "#9ca3af", fontSize: 12, fontWeight: "600", marginLeft: 4 }}>{lightboxMemory.place || "No location"}</Text>
              </View>
              <Text style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>{formatDate(lightboxMemory.createdAt?.toDate() || new Date())}</Text>
            </View>
            <TouchableOpacity
              onPress={() => { setLightboxVisible(false); confirmDelete(lightboxMemory.id); }}
              style={{ backgroundColor: "rgba(239,68,68,0.15)", borderRadius: 12, padding: 10 }}
            >
              <Ionicons name="trash" size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>

          {/* Voice Note Section */}
          {(lightboxMemory.voiceNotes?.length > 0 || lightboxMemory.voiceNote) && (
            <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
              <Text style={{ color: "white", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12, opacity: 0.6 }}>Voice Memories</Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {/* Single Note Compat */}
                {lightboxMemory.voiceNote && !lightboxMemory.voiceNotes && (
                  <TouchableOpacity
                    onPress={() => playSound(lightboxMemory.voiceNote)}
                    style={{ backgroundColor: "rgba(16, 185, 129, 0.2)", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "rgba(16, 185, 129, 0.3)" }}
                  >
                    <Ionicons name="play" size={16} color="#10b981" style={{ marginRight: 8 }} />
                    <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>Play Note</Text>
                  </TouchableOpacity>
                )}

                {/* Multi note mapping */}
                {lightboxMemory.voiceNotes?.map((note: string, vIdx: number) => (
                  <TouchableOpacity
                    key={`v-lb-${vIdx}`}
                    onPress={() => playSound(note)}
                    style={{ backgroundColor: "rgba(16, 185, 129, 0.2)", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "rgba(16, 185, 129, 0.3)" }}
                  >
                    <Ionicons name="play" size={16} color="#10b981" style={{ marginRight: 8 }} />
                    <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>Note #{vIdx + 1}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
    );
  };

  // ─── Selection bottom bar ─────────────────────────────────────────
  const filterActive = filterState.datePreset !== "all" || Object.values(filterState.chips).some(a => a.length > 0);

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: "#f9fafb" }}>

      {/* ── Selection action bar ── */}


      {/* ── Search + Filter bar ── */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "white", borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1.5, borderColor: "#f0f0f0", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, minHeight: 56 }}>
            <View style={{ backgroundColor: "#f0fdf4", borderRadius: 10, padding: 6, marginRight: 10 }}>
              <Ionicons name="search" size={18} color="#2f5d34" />
            </View>
            <TextInput
              placeholder="Search moments, places..."
              placeholderTextColor="gray"
              style={{ flex: 1, fontSize: 14, fontWeight: "600", color: "#1f2937", paddingVertical: 0 }}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")} style={{ padding: 2 }}>
                <Ionicons name="close-circle" size={20} color="#d1d5db" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={() => setFilterVisible(true)}
            style={{ width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: filterActive ? "#2f5d34" : "white", borderWidth: 1.5, borderColor: filterActive ? "#2f5d34" : "#f0f0f0", elevation: 3 }}
          >
            <Ionicons name="options-outline" size={22} color={filterActive ? "white" : "#374151"} />
          </TouchableOpacity>
        </View>

        <FilterSheet visible={filterVisible} onClose={() => setFilterVisible(false)} onApply={(s) => setFilterState(s)} chipGroups={MEMORY_FILTER_GROUPS} activeFilters={filterState} />
      </View>

      {/* ── Gallery grid ── */}
      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        {loading && !refreshing ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color="#2f5d34" />
          </View>
        ) : (
          <FlatList
            data={filteredMemories}
            keyExtractor={(item) => item.id}
            numColumns={2}
            showsVerticalScrollIndicator={false}
            columnWrapperStyle={{ justifyContent: "space-between" }}
            contentContainerStyle={{ paddingBottom: 120, paddingTop: 10 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#2f5d34" />}
            ListEmptyComponent={
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", marginTop: 80 }}>
                <View style={{ backgroundColor: "#f1f5f9", width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <Ionicons name="images-outline" size={40} color="#cbd5e1" />
                </View>
                <Text style={{ color: "#6b7280", fontWeight: "800", fontSize: 18 }}>No Memories Yet</Text>
                <Text style={{ color: "#9ca3af", textAlign: "center", marginTop: 4, paddingHorizontal: 32 }}>Tap + to capture your first moment</Text>
              </View>
            }
            renderItem={renderCard}
          />
        )}
      </View>

      {/* FLOAT BUTTON */}
      {!selectionMode && (
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          style={{ position: "absolute", bottom: 40, right: 24, width: 66, height: 66, borderRadius: 33, backgroundColor: "#2f5d34", alignItems: "center", justifyContent: "center", elevation: 12, shadowColor: "#2f5d34", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16 }}
        >
          <Ionicons name="add" size={36} color="white" />
        </TouchableOpacity>
      )}

      {/* MODALS */}
      <LightboxModal />

      {/* ADD/EDIT MODAL */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "white", maxHeight: "92%", borderTopLeftRadius: 40, borderTopRightRadius: 40, paddingTop: 24, paddingHorizontal: 24, paddingBottom: 36 }}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Google Drive Status */}
              <View style={{ backgroundColor: "#f8fafc", borderRadius: 20, padding: 16, marginBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#f0f0f0' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ backgroundColor: googleAccessToken ? '#f0fdf4' : '#fef2f2', padding: 8, borderRadius: 12 }}>
                    <Ionicons name="logo-google" size={20} color={googleAccessToken ? '#2f5d34' : '#ef4444'} />
                  </View>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#1f2937' }}>Google Drive Storage</Text>
                    <Text style={{ fontSize: 11, color: '#9ca3af', fontWeight: '600' }}>
                      {googleAccessToken ? "Securely connected" : "Not connected"}
                    </Text>
                  </View>
                </View>

                {googleAccessToken ? (
                  <TouchableOpacity
                    onPress={() => setUseDriveSync(!useDriveSync)}
                    style={{ backgroundColor: useDriveSync ? '#2f5d34' : '#e5e7eb', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14 }}
                  >
                    <Text style={{ color: useDriveSync ? 'white' : '#6b7280', fontSize: 11, fontWeight: '800' }}>
                      {useDriveSync ? "SYNC ON" : "SYNC OFF"}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => drivePromptAsync()}
                    style={{ backgroundColor: '#2f5d34', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14 }}
                  >
                    <Text style={{ color: 'white', fontSize: 11, fontWeight: '800' }}>CONNECT</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Header */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
                <Text style={{ fontSize: 22, fontWeight: "900", color: "#111827" }}>{editingId ? "Edit Memory" : "Capture Moments"}</Text>
                <TouchableOpacity onPress={closeModal} style={{ backgroundColor: "#f1f5f9", padding: 9, borderRadius: 14 }}>
                  <Ionicons name="close" size={22} color="#374151" />
                </TouchableOpacity>
              </View>

              {/* Media Picker + Preview */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
                <Text style={{ color: "#9ca3af", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
                  Photos & Videos ({mediaItems.length})
                </Text>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                  <TouchableOpacity onPress={takePhoto} style={{ backgroundColor: "#f0fdf4", padding: 8, borderRadius: 12 }}>
                    <Ionicons name="camera" size={18} color="#2f5d34" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={pickMedia} style={{ backgroundColor: "#f0fdf4", padding: 8, borderRadius: 12 }}>
                    <Ionicons name="images" size={18} color="#2f5d34" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Large preview */}
              <TouchableOpacity
                onPress={() => mediaItems.length ? null : pickMedia()}
                style={{ width: "100%", height: 210, borderRadius: 24, overflow: "hidden", borderWidth: 2, borderStyle: mediaItems.length ? "solid" : "dashed", borderColor: mediaItems.length ? "#e5e7eb" : "#d1d5db", backgroundColor: "#f8fafc", marginBottom: 10 }}
              >
                {mediaItems.length > 0 && mediaItems[previewIndex] ? (
                  <View style={{ flex: 1 }}>
                    {mediaItems[previewIndex].type === "video" ? (
                      <View style={{ flex: 1, backgroundColor: "#111827", alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="videocam" size={52} color="#4ade80" />
                        <Text style={{ color: "white", fontWeight: "700", marginTop: 8 }}>Video #{previewIndex + 1}</Text>
                      </View>
                    ) : (
                      <Image source={{ uri: mediaItems[previewIndex].uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                    )}
                    <TouchableOpacity
                      onPress={() => removeMedia(previewIndex)}
                      style={{ position: "absolute", top: 12, right: 12, backgroundColor: "rgba(239,68,68,0.9)", borderRadius: 12, padding: 8 }}
                    >
                      <Ionicons name="trash" size={18} color="white" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="images" size={50} color="#cbd5e1" />
                    <Text style={{ color: "#9ca3af", fontWeight: "700", marginTop: 10, fontSize: 14 }}>Tap to add Photos & Videos</Text>
                    <View style={{ flexDirection: "row", gap: 15, marginTop: 12 }}>
                      <View style={{ alignItems: 'center' }}>
                        <Ionicons name="camera-outline" size={24} color="#2f5d34" />
                        <Text style={{ fontSize: 10, color: '#2f5d34', fontWeight: 'bold' }}>Camera</Text>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Ionicons name="images-outline" size={24} color="#2f5d34" />
                        <Text style={{ fontSize: 10, color: '#2f5d34', fontWeight: 'bold' }}>Gallery</Text>
                      </View>
                    </View>
                  </View>
                )}
              </TouchableOpacity>

              {/* Thumbnail strip */}
              {mediaItems.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 8 }}>
                  {mediaItems.map((m, i) => (
                    <TouchableOpacity key={i} onPress={() => setPreviewIndex(i)} style={{ position: "relative" }}>
                      <View style={{ width: 60, height: 60, borderRadius: 14, overflow: "hidden", borderWidth: 2, borderColor: i === previewIndex ? "#2f5d34" : "transparent" }}>
                        {m.type === "video" ? (
                          <View style={{ flex: 1, backgroundColor: "#1f2937", alignItems: "center", justifyContent: "center" }}>
                            <Ionicons name="videocam" size={24} color="#4ade80" />
                          </View>
                        ) : (
                          <Image source={{ uri: m.uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => removeMedia(i)}
                        style={{ position: "absolute", top: -5, right: -5, backgroundColor: "#ef4444", borderRadius: 10, width: 18, height: 18, alignItems: "center", justifyContent: "center" }}
                      >
                        <Ionicons name="close" size={11} color="white" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                  {/* Add more button */}
                  <TouchableOpacity onPress={pickMedia} style={{ width: 60, height: 60, borderRadius: 14, backgroundColor: "#f0fdf4", borderWidth: 1.5, borderStyle: "dashed", borderColor: "#86efac", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="add" size={24} color="#2f5d34" />
                  </TouchableOpacity>
                </ScrollView>
              )}

              {/* Voice Note */}
              <Text style={{ color: "#9ca3af", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Voice Memories</Text>
              <View style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", borderWidth: 1.5, borderColor: "#f0f0f0", borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 10 }}>
                  <TouchableOpacity
                    onPress={isRecording ? stopRecording : startRecording}
                    style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: isRecording ? "#ef4444" : "#2f5d34", alignItems: "center", justifyContent: "center" }}
                  >
                    <Ionicons name={isRecording ? "stop" : "mic"} size={22} color="white" />
                  </TouchableOpacity>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    {isRecording ? (
                      <Text style={{ color: "#ef4444", fontWeight: "800", fontSize: 13 }}>Recording...</Text>
                    ) : (
                      <Text style={{ color: "#9ca3af", fontSize: 12, fontWeight: "600" }}>Tap mic to record audio</Text>
                    )}
                  </View>
                </View>

                {voiceNotes.map((note, vIdx) => (
                  <View key={`v-note-${vIdx}`} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#dcfce7", borderRadius: 16, padding: 12, marginBottom: 8 }}>
                    <TouchableOpacity onPress={() => playSound(note)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#2f5d34", alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                      <Ionicons name="play" size={16} color="white" />
                    </TouchableOpacity>
                    <Text style={{ flex: 1, color: "#2f5d34", fontWeight: "700", fontSize: 13 }}>Voice Note #{vIdx + 1}</Text>
                    <TouchableOpacity onPress={() => setVoiceNotes(prev => prev.filter((_, i) => i !== vIdx))}>
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {/* Title */}
              <Text style={{ color: "#9ca3af", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Title</Text>
              <TextInput
                placeholder="A beautiful sunset..."
                value={title}
                onChangeText={setTitle}
                style={{ backgroundColor: "#f8fafc", borderWidth: 1.5, borderColor: "#f0f0f0", borderRadius: 18, paddingHorizontal: 18, paddingVertical: 16, fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 14 }}
                placeholderTextColor="#9ca3af"
              />

              {/* Date + Place */}
              <Text style={{ color: "#9ca3af", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>When & Where</Text>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", borderWidth: 1.5, borderColor: "#f0f0f0", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 16 }}
                >
                  <Ionicons name="calendar" size={16} color="#2f5d34" style={{ marginRight: 8 }} />
                  <Text style={{ color: "#374151", fontWeight: "700", fontSize: 13 }}>{formatDate(date)}</Text>
                </TouchableOpacity>
                <TextInput
                  placeholder="Location"
                  value={place}
                  onChangeText={setPlace}
                  style={{ flex: 1, backgroundColor: "#f8fafc", borderWidth: 1.5, borderColor: "#f0f0f0", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 16, fontSize: 13, fontWeight: "700", color: "#111827" }}
                  placeholderTextColor="#9ca3af"
                />
              </View>

              {showDatePicker && (
                <DateTimePicker value={date} mode="date" display="default" onChange={(_, d) => { setShowDatePicker(false); if (d) setDate(d); }} maximumDate={new Date()} />
              )}

              {/* Action buttons */}
              <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                {editingId && (
                  <TouchableOpacity
                    onPress={() => confirmDelete(editingId)}
                    style={{ flex: 1, backgroundColor: "#fef2f2", paddingVertical: 16, borderRadius: 18, alignItems: "center", borderWidth: 1, borderColor: "#fecaca" }}
                  >
                    <Text style={{ color: "#ef4444", fontWeight: "900", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>Delete</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={loading}
                  style={{ flex: 2, backgroundColor: "#2f5d34", paddingVertical: 16, borderRadius: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, elevation: 4, shadowColor: "#2f5d34", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="white" />
                      <Text style={{ color: "white", fontWeight: "900", fontSize: 14, textTransform: "uppercase", letterSpacing: 1 }}>{editingId ? "Update" : "Save"}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal visible={deleteModalVisible} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: "white", width: "100%", borderRadius: 32, padding: 24, alignItems: "center" }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#fef2f2", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Ionicons name="trash" size={32} color="#ef4444" />
            </View>
            <Text style={{ fontSize: 24, fontWeight: "900", color: "#111827", marginBottom: 8 }}>{isDeletingSelected ? "Delete Memories?" : "Delete Memory?"}</Text>
            <Text style={{ color: "#6b7280", textAlign: "center", marginBottom: 32, paddingHorizontal: 16, fontWeight: "500", lineHeight: 20 }}>
              {isDeletingSelected
                ? `Are you sure you want to delete ${selectedIds.size} memories? This action cannot be undone.`
                : "Are you sure you want to delete this memory? This action cannot be undone."}
            </Text>
            <View style={{ flexDirection: "row", width: "100%", gap: 12 }}>
              <TouchableOpacity
                onPress={() => setDeleteModalVisible(false)}
                style={{ flex: 1, paddingVertical: 16, borderRadius: 18, backgroundColor: "#f3f4f6", alignItems: "center" }}
              >
                <Text style={{ color: "#374151", fontWeight: "800", fontSize: 18 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={executeDelete}
                style={{ flex: 1, paddingVertical: 16, borderRadius: 18, backgroundColor: "#ef4444", alignItems: "center" }}
              >
                <Text style={{ color: "white", fontWeight: "800", fontSize: 18 }}>Delete</Text>
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
