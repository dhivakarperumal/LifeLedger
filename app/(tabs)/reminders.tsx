import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    serverTimestamp,
    updateDoc,
    where
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { SafeAreaView } from "react-native-safe-area-context";
import FilterSheet, { defaultFilterState, FilterState } from "../../components/FilterSheet";
import { auth, db } from "../../firebase";

// Configure notifications
if (Constants.appOwnership !== "expo") {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
}

interface Reminder {
    id: string;
    title: string;
    type: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:mm
    description: string;
    repeat: string;
    reminderSent: boolean;
    userId: string;
}

const EVENT_TYPES = [
    { label: "Birthday", icon: "gift", color: "#ec4899", bg: "bg-pink-100" },
    { label: "Meeting", icon: "people", color: "#3b82f6", bg: "bg-blue-100" },
    { label: "Bill", icon: "receipt", color: "#ef4444", bg: "bg-red-100" },
    { label: "Task", icon: "checkbox", color: "#10b981", bg: "bg-emerald-100" },
    { label: "Goal", icon: "trophy", color: "#f59e0b", bg: "bg-amber-100" },
    { label: "Other", icon: "notifications", color: "#6366f1", bg: "bg-indigo-100" },
];

const REPEAT_OPTIONS = ["None", "Daily", "Weekly", "Yearly"];

export default function RemindersScreen() {
    const router = useRouter();
    const uid = auth.currentUser?.uid;
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Quick View Tabs
    type QuickView = "selected" | "today" | "upcoming" | "completed";
    const [quickView, setQuickView] = useState<QuickView>("selected");

    // Advanced Filter Sheet
    const REMINDER_FILTER_GROUPS = [
        { key: "type", label: "Event Type", options: ["Birthday", "Meeting", "Bill", "Task", "Goal", "Other"], multi: true },
    ];
    const [filterVisible, setFilterVisible] = useState(false);
    const [filterState, setFilterState] = useState<FilterState>(defaultFilterState(REMINDER_FILTER_GROUPS));

    // Form states
    const [title, setTitle] = useState("");
    const [type, setType] = useState("Meeting");
    const [description, setDescription] = useState("");
    const [date, setDate] = useState(new Date());
    const [time, setTime] = useState(new Date());
    const [repeat, setRepeat] = useState("None");
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    const [loading, setLoading] = useState(false);

    // ── Toast ──────────────────────────────────────────────────────────
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

    useEffect(() => {
        if (!uid) return;

        const isExpoGo = Constants.appOwnership === "expo";
        if (!isExpoGo) {
            const requestPermissions = async () => {
                try {
                    const { status: existingStatus } = await Notifications.getPermissionsAsync();
                    let finalStatus = existingStatus;
                    if (existingStatus !== 'granted') {
                        const { status } = await Notifications.requestPermissionsAsync();
                        finalStatus = status;
                    }
                    if (finalStatus !== 'granted' && Platform.OS !== 'web') {
                        Alert.alert('Permission Needed', 'Please enable notifications in settings to receive reminders.');
                    }
                } catch (e) { }
            };
            requestPermissions();
        }

        setLoading(true);
        const q = query(collection(db, "reminders"), where("userId", "==", uid));
        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const list = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...(doc.data() as any),
                })) as Reminder[];
                setReminders(list);
                setLoading(false);
            },
            (error) => {
                setLoading(false);
                const isOffline = error?.code === "unavailable" || error?.message?.includes("unavailable");
                if (!isOffline) {
                    console.error("Reminders snapshot error:", error);
                    showToast("Failed to sync reminders", "error");
                }
            }
        );

        return () => unsubscribe();
    }, [uid]);

    const scheduleNotification = async (title: string, date: Date, time: Date, repeat: string) => {
        if (Constants.appOwnership === "expo") return;

        try {
            let trigger: any;
            const { status } = await Notifications.getPermissionsAsync();
            if (status !== 'granted') return;

            if (repeat === "Daily") {
                trigger = { hour: time.getHours(), minute: time.getMinutes(), repeats: true };
            } else if (repeat === "Weekly") {
                trigger = { weekday: date.getDay() + 1, hour: time.getHours(), minute: time.getMinutes(), repeats: true };
            } else if (repeat === "Yearly") {
                trigger = { month: date.getMonth(), day: date.getDate(), hour: time.getHours(), minute: time.getMinutes(), repeats: true };
            } else {
                const triggerDate = new Date(date);
                triggerDate.setHours(time.getHours(), time.getMinutes(), 0, 0);
                if (triggerDate.getTime() > Date.now()) {
                    trigger = triggerDate;
                } else {
                    return;
                }
            }

            await Notifications.scheduleNotificationAsync({
                content: {
                    title: "Reminder: " + title,
                    body: `Your scheduled event is starting!`,
                    sound: true,
                    priority: Notifications.AndroidNotificationPriority.HIGH,
                },
                trigger,
            });
        } catch (error) {
            console.log("Local notification schedule info:", error);
        }
    };

    const handleSave = async () => {
        if (!title.trim()) {
            showToast("Please enter a title", "error");
            return;
        }

        const reminderData = {
            title,
            type,
            description,
            date: date.toISOString().split("T")[0],
            time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
            repeat,
            userId: uid,
            updatedAt: serverTimestamp(),
            reminderSent: false,
        };

        try {
            setLoading(true);
            if (editingId) {
                await updateDoc(doc(db, "reminders", editingId), reminderData);
                showToast("Reminder updated successfully!", "success");
            } else {
                await addDoc(collection(db, "reminders"), {
                    ...reminderData,
                    createdAt: serverTimestamp(),
                });
                showToast("Reminder created successfully!", "success");
            }

            await scheduleNotification(title, date, time, repeat);
            resetForm();
            setShowModal(false);
        } catch (e) {
            console.error(e);
            showToast("Failed to save reminder", "error");
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setTitle("");
        setType("Meeting");
        setDescription("");
        setDate(new Date());
        setTime(new Date());
        setRepeat("None");
        setEditingId(null);
    };

    const openEdit = (item: Reminder) => {
        setTitle(item.title);
        setType(item.type);
        setDescription(item.description);
        setDate(new Date(item.date));
        const [hours, minutes] = item.time.split(":").map(Number);
        const timeDate = new Date();
        timeDate.setHours(hours, minutes);
        setTime(timeDate);
        setRepeat(item.repeat || "None");
        setEditingId(item.id);
        setShowModal(true);
    };

    const handleDelete = (id: string) => {
        Alert.alert("Delete", "Are you sure you want to delete this reminder?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete", style: "destructive", onPress: async () => {
                    try {
                        setLoading(true);
                        await deleteDoc(doc(db, "reminders", id));
                        showToast("Reminder deleted", "success");
                    } catch (e) {
                        showToast("Failed to delete", "error");
                    } finally {
                        setLoading(false);
                    }
                }
            },
        ]);
    };

    const getRemindersForDate = (dateStr: string) => {
        return reminders.filter((r) => r.date === dateStr);
    };

    const getDisplayedReminders = (): Reminder[] => {
        const today = new Date().toISOString().split("T")[0];
        let base: Reminder[];

        if (quickView === "today") base = reminders.filter(r => r.date === today);
        else if (quickView === "upcoming") base = reminders.filter(r => r.date > today);
        else if (quickView === "completed") base = reminders.filter(r => r.date < today);
        else base = getRemindersForDate(selectedDate);

        const typeFilter = filterState.chips["type"] || [];
        if (typeFilter.length > 0) {
            base = base.filter(r => typeFilter.includes(r.type));
        }
        return base;
    };

    const displayedReminders = getDisplayedReminders();
    const markedDates = reminders.reduce((acc: any, curr) => {
        acc[curr.date] = { marked: true, dotColor: "#2f5d34" };
        return acc;
    }, {});
    markedDates[selectedDate] = { ...markedDates[selectedDate], selected: true, selectedColor: "#2f5d34" };

    return (
        <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: "#111827" }}>
            <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>
                {/* DARK HEADER */}
                <View style={{ backgroundColor: "#111827", paddingHorizontal: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
                            <Ionicons name="arrow-back-circle-outline" size={34} color="white" />
                        </TouchableOpacity>
                        <View>
                            <Text style={{ fontSize: 18, fontWeight: "900", color: "white" }}>Calendar</Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={() => setFilterVisible(true)}
                        style={{ width: 44, height: 44, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}
                    >
                        <Ionicons name="options-outline" size={22} color="white" />
                    </TouchableOpacity>
                </View>

                <Calendar
                    current={selectedDate}
                    onDayPress={(day: any) => setSelectedDate(day.dateString)}
                    markedDates={markedDates}
                    theme={{
                        backgroundColor: "#f9fafb",
                        calendarBackground: "#f9fafb",
                        textSectionTitleColor: "#b6c1cd",
                        selectedDayBackgroundColor: "#2f5d34",
                        selectedDayTextColor: "#ffffff",
                        todayTextColor: "#2f5d34",
                        dayTextColor: "#2d4150",
                        textDisabledColor: "#d9e1e8",
                        dotColor: "#2f5d34",
                        selectedDotColor: "#ffffff",
                        arrowColor: "#2f5d34",
                        monthTextColor: "#1f2937",
                        indicatorColor: "#2f5d34",
                        textDayFontWeight: "600",
                        textMonthFontWeight: "800",
                        textDayHeaderFontWeight: "700",
                        textDayFontSize: 14,
                        textMonthFontSize: 16,
                        textDayHeaderFontSize: 12,
                    }}
                    enableSwipeMonths={true}
                />

                {loading && (
                    <View style={{ padding: 10, alignItems: "center" }}>
                        <ActivityIndicator size="small" color="#2f5d34" />
                    </View>
                )}

                <View style={{ flex: 1, backgroundColor: "white", borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: 10, paddingHorizontal: 20, paddingTop: 20 }}>
                    <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
                        {(["selected", "today", "upcoming", "completed"] as QuickView[]).map((tab) => (
                            <TouchableOpacity
                                key={tab}
                                onPress={() => setQuickView(tab)}
                                style={{
                                    paddingHorizontal: 12, paddingVertical: 8,
                                    borderRadius: 12,
                                    backgroundColor: quickView === tab ? "#2f5d34" : "#f3f4f6"
                                }}
                            >
                                <Text style={{ fontSize: 10, fontWeight: "800", textTransform: "uppercase", color: quickView === tab ? "white" : "#6b7280" }}>{tab}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                        {displayedReminders.length === 0 ? (
                            <View style={{ alignItems: "center", marginTop: 40 }}>
                                <Ionicons name="notifications-off-outline" size={48} color="#d1d5db" />
                                <Text style={{ color: "#9ca3af", fontWeight: "700", marginTop: 12 }}>No reminders found</Text>
                            </View>
                        ) : (
                            displayedReminders.map((item) => {
                                const typeInfo = EVENT_TYPES.find(t => t.label === item.type) || EVENT_TYPES[5];
                                return (
                                    <View key={item.id} style={{ backgroundColor: "#f9fafb", borderRadius: 20, padding: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#f1f5f9" }}>
                                        <View style={[{ width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 16 }, { backgroundColor: typeInfo.color + "20" }]}>
                                            <Ionicons name={typeInfo.icon as any} size={22} color={typeInfo.color} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 16, fontWeight: "900", color: "#1f2937" }}>{item.title}</Text>
                                            <Text style={{ fontSize: 12, color: "#6b7280", fontWeight: "600" }}>{item.time} • {item.repeat}</Text>
                                        </View>
                                        <View style={{ flexDirection: "row", gap: 8 }}>
                                            <TouchableOpacity onPress={() => openEdit(item)} style={{ padding: 8, backgroundColor: "#f0fdf4", borderRadius: 10 }}>
                                                <Ionicons name="create-outline" size={18} color="#2f5d34" />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ padding: 8, backgroundColor: "#fef2f2", borderRadius: 10 }}>
                                                <Ionicons name="trash-outline" size={18} color="#ef4444" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })
                        )}
                    </ScrollView>
                </View>

                <TouchableOpacity
                    onPress={() => { resetForm(); setShowModal(true); }}
                    style={{ position: "absolute", bottom: 30, right: 20, width: 55, height: 55, borderRadius: 30, backgroundColor: "#2f5d34", alignItems: "center", justifyContent: "center", elevation: 8, shadowColor: "#2f5d34", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 }}
                >
                    <Ionicons name="add" size={32} color="white" />
                </TouchableOpacity>

                <FilterSheet visible={filterVisible} onClose={() => setFilterVisible(false)} onApply={setFilterState} chipGroups={REMINDER_FILTER_GROUPS} activeFilters={filterState} />

                <Modal visible={showModal} transparent animationType="slide">
                    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
                        <View style={{ backgroundColor: "white", borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: "90%" }}>
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                                    <View>
                                        <Text style={{ fontSize: 22, fontWeight: "900", color: "#1f2937" }}>{editingId ? "Edit Reminder" : "New Reminder"}</Text>
                                        <Text style={{ fontSize: 10, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1.5 }}>Fill in the details</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setShowModal(false)} style={{ backgroundColor: "#f3f4f6", padding: 8, borderRadius: 12 }}>
                                        <Ionicons name="close" size={24} color="#374151" />
                                    </TouchableOpacity>
                                </View>

                                <Text style={{ fontSize: 10, fontWeight: "800", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>What's the event?</Text>
                                <TextInput
                                    placeholder="Reminder Title"
                                    value={title}
                                    onChangeText={setTitle}
                                    style={{ backgroundColor: "#f9fafb", borderRadius: 16, padding: 16, fontSize: 16, fontWeight: "700", color: "#1f2937", borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 20 }}
                                    placeholderTextColor="#9ca3af"
                                />

                                <Text style={{ fontSize: 10, fontWeight: "800", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>Type</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                                    {EVENT_TYPES.map((t) => (
                                        <TouchableOpacity
                                            key={t.label}
                                            onPress={() => setType(t.label)}
                                            style={{
                                                paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginRight: 10,
                                                backgroundColor: type === t.label ? t.color : "#f3f4f6",
                                                flexDirection: "row", alignItems: "center",
                                                borderWidth: 1.5, borderColor: type === t.label ? t.color : "transparent"
                                            }}
                                        >
                                            <Ionicons name={t.icon as any} size={16} color={type === t.label ? "white" : t.color} style={{ marginRight: 6 }} />
                                            <Text style={{ fontSize: 12, fontWeight: "800", color: type === t.label ? "white" : "#374151" }}>{t.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>

                                <View style={{ flexDirection: "row", gap: 15, marginBottom: 20 }}>
                                    <TouchableOpacity onPress={() => setShowDatePicker(true)} style={{ flex: 1, backgroundColor: "#f9fafb", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#e5e7eb" }}>
                                        <Text style={{ fontSize: 10, fontWeight: "800", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>Date</Text>
                                        <Text style={{ fontSize: 14, fontWeight: "700", color: "#1f2937" }}>{date.toLocaleDateString()}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setShowTimePicker(true)} style={{ flex: 1, backgroundColor: "#f9fafb", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#e5e7eb" }}>
                                        <Text style={{ fontSize: 10, fontWeight: "800", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>Time</Text>
                                        <Text style={{ fontSize: 14, fontWeight: "700", color: "#1f2937" }}>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                    </TouchableOpacity>
                                </View>

                                {showDatePicker && (
                                    <DateTimePicker
                                        value={date}
                                        mode="date"
                                        display="default"
                                        onChange={(_, d) => { setShowDatePicker(false); if (d) setDate(d); }}
                                    />
                                )}
                                {showTimePicker && (
                                    <DateTimePicker
                                        value={time}
                                        mode="time"
                                        display="default"
                                        onChange={(_, d) => { setShowTimePicker(false); if (d) setTime(d); }}
                                    />
                                )}

                                <Text style={{ fontSize: 10, fontWeight: "800", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>Repeat</Text>
                                <View style={{ backgroundColor: "#f9fafb", borderRadius: 16, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 20 }}>
                                    <Picker
                                        selectedValue={repeat}
                                        onValueChange={setRepeat}
                                        style={{ height: 50 }}
                                    >
                                        {REPEAT_OPTIONS.map(opt => <Picker.Item key={opt} label={opt} value={opt} />)}
                                    </Picker>
                                </View>

                                <Text style={{ fontSize: 10, fontWeight: "800", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>Extra Notes</Text>
                                <TextInput
                                    placeholder="Add description..."
                                    value={description}
                                    onChangeText={setDescription}
                                    multiline
                                    style={{ backgroundColor: "#f9fafb", borderRadius: 16, padding: 16, fontSize: 14, fontWeight: "600", color: "#1f2937", borderWidth: 1, borderColor: "#e5e7eb", minHeight: 100, marginBottom: 24 }}
                                    textAlignVertical="top"
                                    placeholderTextColor="#9ca3af"
                                />

                                <TouchableOpacity
                                    onPress={handleSave}
                                    style={{ backgroundColor: "#2f5d34", borderRadius: 20, paddingVertical: 18, alignItems: "center", opacity: loading ? 0.7 : 1 }}
                                    disabled={loading}
                                >
                                    <Text style={{ color: "white", fontWeight: "900", fontSize: 16, textTransform: "uppercase", letterSpacing: 2 }}>{editingId ? "Update Reminder" : "Set Reminder"}</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>
            </View>

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
                    <Ionicons
                        name={toast.type === "success" ? "checkmark-circle" : toast.type === "error" ? "alert-circle" : "information-circle"}
                        size={24}
                        color="white"
                    />
                    <Text style={{ color: "white", fontWeight: "800", fontSize: 13, flex: 1 }}>{toast.message}</Text>
                </Animated.View>
            )}
        </SafeAreaView>
    );
}
