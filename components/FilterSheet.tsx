import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import {
    Modal,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DatePreset = "all" | "today" | "yesterday" | "week" | "month" | "custom";

export interface FilterChipGroup {
    key: string;          // unique key (used in FilterState)
    label: string;        // section heading
    options: string[];    // chip values
    multi?: boolean;      // allow multiple selections (default: single)
}

export interface FilterState {
    datePreset: DatePreset;
    customFrom: Date | null;
    customTo: Date | null;
    chips: Record<string, string[]>;   // key → selected option(s)
}

interface FilterSheetProps {
    visible: boolean;
    onClose: () => void;
    onApply: (state: FilterState) => void;
    chipGroups?: FilterChipGroup[];
    activeFilters: FilterState;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const defaultFilterState = (groups: FilterChipGroup[] = []): FilterState => ({
    datePreset: "all",
    customFrom: null,
    customTo: null,
    chips: Object.fromEntries(groups.map((g) => [g.key, []])),
});

export const applyFilters = (
    list: any[],
    state: FilterState,
    dateField: string = "createdAt"
): any[] => {
    let result = [...list];

    // Date filtering
    if (state.datePreset !== "all") {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        result = result.filter((item) => {
            const ts = item[dateField];
            const itemDate: Date = ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : null;
            if (!itemDate) return false;
            const d = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
            if (state.datePreset === "today") return d.getTime() === today.getTime();
            if (state.datePreset === "yesterday") return d.getTime() === yesterday.getTime();
            if (state.datePreset === "week") return d >= weekStart && d <= today;
            if (state.datePreset === "month") return d >= monthStart && d <= today;
            if (state.datePreset === "custom") {
                const from = state.customFrom ? new Date(state.customFrom.getFullYear(), state.customFrom.getMonth(), state.customFrom.getDate()) : null;
                const to = state.customTo ? new Date(state.customTo.getFullYear(), state.customTo.getMonth(), state.customTo.getDate()) : null;
                if (from && d < from) return false;
                if (to && d > to) return false;
                return true;
            }
            return true;
        });
    }

    return result;
};

// ─── Component ────────────────────────────────────────────────────────────────

const DATE_PRESETS: { key: DatePreset; label: string; icon: string }[] = [
    { key: "all", label: "All Time", icon: "infinite" },
    { key: "today", label: "Today", icon: "sunny" },
    { key: "yesterday", label: "Yesterday", icon: "partly-sunny" },
    { key: "week", label: "This Week", icon: "calendar" },
    { key: "month", label: "This Month", icon: "calendar-number" },
    { key: "custom", label: "Custom Range", icon: "options" },
];

export default function FilterSheet({
    visible,
    onClose,
    onApply,
    chipGroups = [],
    activeFilters,
}: FilterSheetProps) {
    const insets = useSafeAreaInsets();
    const [local, setLocal] = useState<FilterState>(activeFilters);
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);

    // Sync local state when sheet opens
    const handleOpen = () => setLocal(activeFilters);

    const setDatePreset = (p: DatePreset) =>
        setLocal((prev) => ({ ...prev, datePreset: p }));

    const toggleChip = (groupKey: string, option: string, multi: boolean) => {
        setLocal((prev) => {
            const cur = prev.chips[groupKey] || [];
            let next: string[];
            if (multi) {
                next = cur.includes(option) ? cur.filter((o) => o !== option) : [...cur, option];
            } else {
                next = cur.includes(option) ? [] : [option];
            }
            return { ...prev, chips: { ...prev.chips, [groupKey]: next } };
        });
    };

    const hasActiveFilters = (f: FilterState) => {
        if (f.datePreset !== "all") return true;
        return Object.values(f.chips).some((arr) => arr.length > 0);
    };

    const reset = () => {
        const cleared = defaultFilterState(chipGroups);
        setLocal(cleared);
        onApply(cleared);
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onShow={handleOpen}>
            <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
                <View style={{ backgroundColor: "white", borderTopLeftRadius: 40, borderTopRightRadius: 40, overflow: 'hidden', maxHeight: '92%' }}>
                    <View style={{ backgroundColor: "white", paddingBottom: Math.max(24, insets.bottom + 10) }}>
                        <View style={{ paddingTop: 14, paddingHorizontal: 20 }}>
                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                            {/* Header */}
                            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                                <View>
                                    <Text style={{ fontSize: 22, fontWeight: "900", color: "#1f2937" }}>Filter</Text>
                                    <Text style={{ fontSize: 10, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1.5 }}>Narrow your results</Text>
                                </View>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                                    {hasActiveFilters(local) && (
                                        <TouchableOpacity onPress={reset} style={{ backgroundColor: "#fee2e2", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }}>
                                            <Text style={{ color: "#ef4444", fontWeight: "800", fontSize: 12 }}>Clear All</Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity onPress={onClose} style={{ backgroundColor: "#f3f4f6", padding: 8, borderRadius: 20 }}>
                                        <Ionicons name="close" size={20} color="#374151" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Date Presets */}
                            <Text style={{ fontSize: 10, fontWeight: "800", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12, marginLeft: 4 }}>Date Range</Text>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                                {DATE_PRESETS.map((p, idx) => {
                                    const active = local.datePreset === p.key;
                                    return (
                                        <TouchableOpacity
                                            key={`date-preset-${p.key}-${idx}`}
                                            onPress={() => setDatePreset(p.key)}
                                            style={{
                                                flexDirection: "row", alignItems: "center",
                                                paddingHorizontal: 14, paddingVertical: 9,
                                                borderRadius: 20, borderWidth: 1.5,
                                                backgroundColor: active ? "#2f5d34" : "#f8fafc",
                                                borderColor: active ? "#2f5d34" : "#f0f0f0",
                                            }}
                                        >
                                            <Ionicons name={p.icon as any} size={13} color={active ? "white" : "#6b7280"} style={{ marginRight: 5 }} />
                                            <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "white" : "#374151" }}>{p.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Custom range pickers */}
                            {local.datePreset === "custom" && (
                                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 20, gap: 10 }}>
                                    <TouchableOpacity
                                        onPress={() => setShowFromPicker(true)}
                                        style={{ flex: 1, backgroundColor: "#f8fafc", borderRadius: 16, paddingVertical: 14, paddingHorizontal: 14, borderWidth: 1.5, borderColor: "#f0f0f0", flexDirection: "row", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}
                                    >
                                        <Ionicons name="calendar-outline" size={16} color="#2f5d34" style={{ marginRight: 6 }} />
                                        <Text style={{ fontSize: 12, fontWeight: "700", color: local.customFrom ? "#4b5563" : "#9ca3af" }}>
                                            {local.customFrom ? local.customFrom.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "From"}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => setShowToPicker(true)}
                                        style={{ flex: 1, backgroundColor: "#f8fafc", borderRadius: 16, paddingVertical: 14, paddingHorizontal: 14, borderWidth: 1.5, borderColor: "#f0f0f0", flexDirection: "row", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}
                                    >
                                        <Ionicons name="calendar-outline" size={16} color="#2f5d34" style={{ marginRight: 6 }} />
                                        <Text style={{ fontSize: 12, fontWeight: "700", color: local.customTo ? "#4b5563" : "#9ca3af" }}>
                                            {local.customTo ? local.customTo.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "To"}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {showFromPicker && (
                                <DateTimePicker
                                    value={local.customFrom || new Date()}
                                    mode="date"
                                    display="default"
                                    maximumDate={local.customTo || new Date()}
                                    onChange={(_, d) => { setShowFromPicker(false); if (d) setLocal((prev) => ({ ...prev, customFrom: d })); }}
                                />
                            )}
                            {showToPicker && (
                                <DateTimePicker
                                    value={local.customTo || new Date()}
                                    mode="date"
                                    display="default"
                                    minimumDate={local.customFrom || undefined}
                                    maximumDate={new Date()}
                                    onChange={(_, d) => { setShowToPicker(false); if (d) setLocal((prev) => ({ ...prev, customTo: d })); }}
                                />
                            )}

                            {/* Dynamic chip groups */}
                            {chipGroups.map((group) => (
                                <View key={group.key} style={{ marginBottom: 20 }}>
                                    <Text style={{ fontSize: 10, fontWeight: "800", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12, marginLeft: 4 }}>{group.label}</Text>
                                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                                        {group.options.map((opt, oIdx) => {
                                            const selected = (local.chips[group.key] || []).includes(opt);
                                            return (
                                                <TouchableOpacity
                                                    key={`filter-chip-${group.key}-${oIdx}`}
                                                    onPress={() => toggleChip(group.key, opt, group.multi ?? false)}
                                                    style={{
                                                        paddingHorizontal: 14, paddingVertical: 9,
                                                        borderRadius: 20, borderWidth: 1.5,
                                                        backgroundColor: selected ? "#2f5d34" : "#f8fafc",
                                                        borderColor: selected ? "#2f5d34" : "#f0f0f0",
                                                    }}
                                                >
                                                    <Text style={{ fontSize: 12, fontWeight: "700", color: selected ? "white" : "#374151" }}>{opt}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            ))}
                        </ScrollView>

                        {/* Apply Button Section */}
                        <View style={{ marginTop: 8 }}>
                            <TouchableOpacity
                                onPress={() => { onApply(local); onClose(); }}
                                style={{ backgroundColor: "#2f5d34", borderRadius: 24, paddingVertical: 18, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6 }}
                            >
                                <Text style={{ color: "white", fontWeight: "900", fontSize: 16, textTransform: "uppercase", letterSpacing: 2 }}>Apply Filters</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    </Modal>
);
}
