import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
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
import { useEffect, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { Calendar } from "react-native-calendars";
import { SafeAreaView } from "react-native-safe-area-context";
import FilterSheet, { defaultFilterState, FilterState } from "../../components/FilterSheet";
import { auth, db } from "../../firebase";

// Configure notifications (Unsupported in Expo Go SDK 53+ Android)
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

    useEffect(() => {
        if (!uid) return;

        // Check/Request Permissions for local notifications
        // Guard: expo-notifications remote push was removed from Expo Go SDK 53.
        // Only request permissions on real device builds, not Expo Go.
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
                } catch (e) {
                    // Silently ignore permission errors in unsupported environments
                }
            };
            requestPermissions();
        }

        const q = query(collection(db, "reminders"), where("userId", "==", uid));
        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const list = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...(doc.data() as any),
                })) as Reminder[];
                setReminders(list);
            },
            (error) => {
                // Suppress offline transport errors — data will update when reconnected
                const isOffline = error?.code === "unavailable" || error?.message?.includes("unavailable");
                if (!isOffline) console.error("Reminders snapshot error:", error);
            }
        );

        return () => unsubscribe();
    }, [uid]);

    const scheduleNotification = async (title: string, date: Date, time: Date, repeat: string) => {
        if (Constants.appOwnership === "expo") return; // Guard for Expo Go

        try {
            let trigger: any;

            // Check if we have permission first
            const { status } = await Notifications.getPermissionsAsync();
            if (status !== 'granted') return;

            if (repeat === "Daily") {
                trigger = { hour: time.getHours(), minute: time.getMinutes(), repeats: true };
            } else if (repeat === "Weekly") {
                // weekday is 1-7 in expo-notifications (Sunday is 1)
                trigger = { weekday: date.getDay() + 1, hour: time.getHours(), minute: time.getMinutes(), repeats: true };
            } else if (repeat === "Yearly") {
                trigger = { month: date.getMonth(), day: date.getDate(), hour: time.getHours(), minute: time.getMinutes(), repeats: true };
            } else {
                // One-off
                const triggerDate = new Date(date);
                triggerDate.setHours(time.getHours(), time.getMinutes(), 0, 0);

                if (triggerDate.getTime() > Date.now()) {
                    trigger = triggerDate;
                } else {
                    return; // Past date
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
            // We don't alert here as it's often a dev-only warning
        }
    };

    const handleSave = async () => {
        if (!title.trim()) {
            Alert.alert("Error", "Please enter a title");
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
            if (editingId) {
                await updateDoc(doc(db, "reminders", editingId), reminderData);
            } else {
                await addDoc(collection(db, "reminders"), {
                    ...reminderData,
                    createdAt: serverTimestamp(),
                });
            }

            await scheduleNotification(title, date, time, repeat);

            resetForm();
            setShowModal(false);
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to save reminder");
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
            { text: "Delete", style: "destructive", onPress: () => deleteDoc(doc(db, "reminders", id)) },
        ]);
    };

    const getRemindersForDate = (dateStr: string) => {
        return reminders.filter((r) => r.date === dateStr);
    };

    // Filtered reminders for the current view
    const getDisplayedReminders = (): Reminder[] => {
        const today = new Date().toISOString().split("T")[0];
        let base: Reminder[];

        if (quickView === "today") {
            base = reminders.filter(r => r.date === today);
        } else if (quickView === "upcoming") {
            base = reminders.filter(r => r.date > today);
        } else if (quickView === "completed") {
            base = reminders.filter(r => r.date < today);
        } else {
            base = getRemindersForDate(selectedDate);
        }

        // Apply event type chip filter
        const typeFilter = filterState.chips["type"] || [];
        if (typeFilter.length > 0) {
            base = base.filter(r => typeFilter.includes(r.type));
        }

        return base;
    };

    const markedDates = reminders.reduce((acc: any, curr) => {
        acc[curr.date] = {
            marked: true,
            dotColor: EVENT_TYPES.find(t => t.label === curr.type)?.color || "#2f5d34"
        };
        if (curr.date === selectedDate) {
            acc[curr.date] = {
                ...acc[curr.date],
                selected: true,
                selectedColor: "#2f5d34",
            };
        }
        return acc;
    }, {
        [selectedDate]: { selected: true, selectedColor: "#2f5d34" }
    });

    const getRemainingTime = (dateStr: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(dateStr);
        target.setHours(0, 0, 0, 0);

        const diffTime = target.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Tomorrow";
        if (diffDays === -1) return "Yesterday";
        if (diffDays > 0) return `In ${diffDays} days`;
        return `${Math.abs(diffDays)} days ago`;
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }} edges={['top']}>
            <View className="flex-1">
                {/* Header */}
                <View className="px-6 py-4 bg-white flex-row justify-between items-center shadow-sm">
                    <View>
                        <Text className="text-2xl font-black text-gray-800">Calender</Text>
                        <Text className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Events & Reminders</Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                        <TouchableOpacity
                            onPress={() => setFilterVisible(true)}
                            style={{
                                backgroundColor: (filterState.chips["type"] || []).length > 0 ? "#2f5d34" : "#f3f4f6",
                                borderRadius: 12, padding: 10
                            }}
                        >
                            <Ionicons name="options" size={20} color={(filterState.chips["type"] || []).length > 0 ? "white" : "#374151"} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setShowModal(true)}
                            className="bg-[#2f5d34] p-3 rounded-2xl shadow-lg"
                        >
                            <Ionicons name="add" size={24} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>

                <FilterSheet
                    visible={filterVisible}
                    onClose={() => setFilterVisible(false)}
                    onApply={(s) => setFilterState(s)}
                    chipGroups={REMINDER_FILTER_GROUPS}
                    activeFilters={filterState}
                />

                <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Quick View Tabs */}
                    <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingTop: 16, gap: 8, flexWrap: "wrap" }}>
                        {(["selected", "today", "upcoming", "completed"] as QuickView[]).map((v) => {
                            const labels: Record<QuickView, string> = { selected: "By Date", today: "Today", upcoming: "Upcoming", completed: "Past" };
                            const icons: Record<QuickView, string> = { selected: "calendar", today: "sunny", upcoming: "arrow-forward-circle", completed: "checkmark-circle" };
                            const active = quickView === v;
                            return (
                                <TouchableOpacity
                                    key={v}
                                    onPress={() => setQuickView(v)}
                                    style={{
                                        flexDirection: "row", alignItems: "center",
                                        paddingHorizontal: 14, paddingVertical: 9,
                                        borderRadius: 20, borderWidth: 1.5,
                                        backgroundColor: active ? "#2f5d34" : "white",
                                        borderColor: active ? "#2f5d34" : "#e5e7eb",
                                    }}
                                >
                                    <Ionicons name={icons[v] as any} size={13} color={active ? "white" : "#6b7280"} style={{ marginRight: 5 }} />
                                    <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "white" : "#374151" }}>{labels[v]}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Calendar - only shown for By Date view */}
                    {quickView === "selected" && (
                        <View className="mx-4 mt-6 bg-white rounded-[32px] overflow-hidden shadow-sm border border-gray-100">
                            <Calendar
                                onDayPress={(day: any) => setSelectedDate(day.dateString)}
                                markedDates={markedDates}
                                theme={{
                                    calendarBackground: '#ffffff',
                                    textSectionTitleColor: '#b6c1cd',
                                    selectedDayBackgroundColor: '#2f5d34',
                                    selectedDayTextColor: '#ffffff',
                                    todayTextColor: '#2f5d34',
                                    dayTextColor: '#2d4150',
                                    textDisabledColor: '#d9e1e8',
                                    dotColor: '#2f5d34',
                                    selectedDotColor: '#ffffff',
                                    arrowColor: '#2f5d34',
                                    monthTextColor: '#2f5d34',
                                    indicatorColor: '#2f5d34',
                                    textDayFontWeight: '600',
                                    textMonthFontWeight: 'bold',
                                    textDayHeaderFontWeight: '600',
                                    textDayFontSize: 14,
                                    textMonthFontSize: 16,
                                    textDayHeaderFontSize: 12
                                }}
                            />
                        </View>
                    )}

                    {/* Section Header */}
                    <View className="px-6 mt-8 flex-row justify-between items-center">
                        <Text className="text-lg font-black text-gray-800">
                            {quickView === "selected"
                                ? new Date(selectedDate).toLocaleDateString("en-IN", { month: 'long', day: 'numeric', year: 'numeric' })
                                : quickView === "today" ? "Today's Events"
                                    : quickView === "upcoming" ? "Upcoming Events"
                                        : "Past Events"}
                        </Text>
                        <View className="bg-gray-100 px-3 py-1 rounded-full">
                            <Text className="text-[10px] font-bold text-gray-500 uppercase">{getDisplayedReminders().length} Events</Text>
                        </View>
                    </View>

                    {/* Reminder List */}
                    <View className="px-4 mt-4 pb-20">
                        {getDisplayedReminders().length === 0 ? (
                            <View className="items-center justify-center py-10 bg-white rounded-[32px] border border-dashed border-gray-200">
                                <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
                                <Text className="text-gray-400 font-bold mt-2">No events scheduled</Text>
                            </View>
                        ) : (
                            getDisplayedReminders().map((item) => {
                                const typeStyle = EVENT_TYPES.find(t => t.label === item.type) || EVENT_TYPES[EVENT_TYPES.length - 1];
                                return (
                                    <TouchableOpacity
                                        key={item.id}
                                        onPress={() => openEdit(item)}
                                        className="bg-white p-5 rounded-[28px] mb-4 shadow-sm border border-gray-50 flex-row items-center"
                                    >
                                        <View className={`${typeStyle.bg} p-4 rounded-2xl mr-4`}>
                                            <Ionicons name={typeStyle.icon as any} size={24} color={typeStyle.color} />
                                        </View>
                                        <View className="flex-1">
                                            <View className="flex-row justify-between items-center mb-1">
                                                <Text className="text-gray-800 font-black text-base">{item.title}</Text>
                                                <Text className="text-[#2f5d34] font-bold text-xs">{item.time}</Text>
                                            </View>
                                            <Text className="text-gray-400 text-xs mb-2" numberOfLines={1}>{item.description || "No description"}</Text>
                                            <View className="flex-row items-center justify-between">
                                                <View className="bg-gray-50 px-2 py-0.5 rounded-md">
                                                    <Text className="text-[9px] font-bold text-gray-500 uppercase">{getRemainingTime(item.date)}</Text>
                                                </View>
                                                {item.repeat !== "None" && (
                                                    <View className="flex-row items-center">
                                                        <Ionicons name="repeat" size={12} color="#9ca3af" className="mr-1" />
                                                        <Text className="text-[9px] font-bold text-gray-400">{item.repeat}</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => handleDelete(item.id)}
                                            className="ml-3 p-2 bg-red-50 rounded-full"
                                        >
                                            <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                        </TouchableOpacity>
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </View>
                </ScrollView>

                {/* Modal */}
                <Modal visible={showModal} animationType="slide" transparent>
                    <KeyboardAvoidingView
                        behavior="padding"
                        style={{ flex: 1 }}
                    >
                        <View className="flex-1 justify-end bg-black/50">
                            <View className="bg-white rounded-t-[40px] p-6 h-[90%] shadow-2xl">
                                <View className="flex-row justify-between items-center mb-6">
                                    <Text className="text-2xl font-black text-gray-800">
                                        {editingId ? "Edit Event" : "Create Event"}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => { setShowModal(false); resetForm(); }}
                                        className="bg-gray-100 p-2 rounded-full"
                                    >
                                        <Ionicons name="close" size={24} color="#374151" />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView showsVerticalScrollIndicator={false} className="flex-1" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 60 }}>
                                    <Text className="text-gray-400 font-black uppercase tracking-widest text-[10px] mb-2 ml-2">Event Title</Text>
                                    <View className="bg-gray-50 rounded-[24px] px-6 py-1 mb-5 border border-gray-100">
                                        <TextInput
                                            placeholder="E.g. Birthday Celebration, Doctor Appointment"
                                            value={title}
                                            onChangeText={setTitle}
                                            className="text-gray-800 font-black py-4"
                                            placeholderTextColor="#9ca3af"
                                        />
                                    </View>

                                    <Text className="text-gray-400 font-black uppercase tracking-widest text-[10px] mb-2 ml-2">Event Type</Text>
                                    <View className="flex-row flex-wrap mb-5">
                                        {EVENT_TYPES.map((t) => (
                                            <TouchableOpacity
                                                key={t.label}
                                                onPress={() => setType(t.label)}
                                                className={`mr-2 mb-2 px-4 py-2.5 rounded-2xl flex-row items-center border ${type === t.label ? 'bg-[#2f5d34] border-[#2f5d34]' : 'bg-white border-gray-100'}`}
                                            >
                                                <Ionicons name={t.icon as any} size={16} color={type === t.label ? 'white' : t.color} className="mr-2" />
                                                <Text className={`font-bold text-xs ${type === t.label ? 'text-white' : 'text-gray-600'}`}>
                                                    {t.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <View className="flex-row justify-between mb-5">
                                        <View className="flex-1 mr-2">
                                            <Text className="text-gray-400 font-black uppercase tracking-widest text-[10px] mb-2 ml-2">Date</Text>
                                            <TouchableOpacity
                                                onPress={() => setShowDatePicker(true)}
                                                className="bg-gray-50 rounded-[24px] px-6 py-4 border border-gray-100 flex-row items-center"
                                            >
                                                <Ionicons name="calendar-outline" size={18} color="#2f5d34" />
                                                <Text className="text-gray-800 font-bold ml-2 text-sm">
                                                    {date.toLocaleDateString("en-IN", { day: '2-digit', month: 'short' })}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                        <View className="flex-1 ml-2">
                                            <Text className="text-gray-400 font-black uppercase tracking-widest text-[10px] mb-2 ml-2">Time</Text>
                                            <TouchableOpacity
                                                onPress={() => setShowTimePicker(true)}
                                                className="bg-gray-50 rounded-[24px] px-6 py-4 border border-gray-100 flex-row items-center"
                                            >
                                                <Ionicons name="time-outline" size={18} color="#2f5d34" />
                                                <Text className="text-gray-800 font-bold ml-2 text-sm">
                                                    {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {showDatePicker && (
                                        <DateTimePicker
                                            value={date}
                                            mode="date"
                                            onChange={(e, d) => { setShowDatePicker(false); if (d) setDate(d); }}
                                        />
                                    )}
                                    {showTimePicker && (
                                        <DateTimePicker
                                            value={time}
                                            mode="time"
                                            onChange={(e, t) => { setShowTimePicker(false); if (t) setTime(t); }}
                                        />
                                    )}

                                    <Text className="text-gray-400 font-black uppercase tracking-widest text-[10px] mb-2 ml-2">Repeat Option</Text>
                                    <View className="bg-gray-50 rounded-[24px] mb-5 border border-gray-100 overflow-hidden">
                                        <Picker
                                            selectedValue={repeat}
                                            onValueChange={(v) => setRepeat(v)}
                                        >
                                            {REPEAT_OPTIONS.map(o => <Picker.Item key={o} label={o} value={o} />)}
                                        </Picker>
                                    </View>

                                    <Text className="text-gray-400 font-black uppercase tracking-widest text-[10px] mb-2 ml-2">Optional Description</Text>
                                    <View className="bg-gray-50 rounded-[24px] px-6 py-4 mb-8 border border-gray-100">
                                        <TextInput
                                            placeholder="What's this event about? (E.g. Remember to bring a gift)"
                                            value={description}
                                            onChangeText={setDescription}
                                            multiline
                                            numberOfLines={3}
                                            className="text-gray-800 font-medium text-sm"
                                            textAlignVertical="top"
                                            placeholderTextColor="#9ca3af"
                                        />
                                    </View>

                                    <TouchableOpacity
                                        onPress={handleSave}
                                        className="bg-[#2f5d34] p-5 rounded-[28px] shadow-xl items-center mb-10"
                                    >
                                        <Text className="text-white text-lg font-black uppercase tracking-widest">
                                            {editingId ? "Update Event" : "Create Event"}
                                        </Text>
                                    </TouchableOpacity>
                                </ScrollView>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>
            </View>
        </SafeAreaView>
    );
}
