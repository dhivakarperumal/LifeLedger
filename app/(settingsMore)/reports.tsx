import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import {
    collection,
    getDocs,
    query,
    where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../firebase";

// ─── Types ────────────────────────────────────────────────────────────────────
type Period = "week" | "month" | "year" | "custom";

interface Expense {
    id: string;
    amount: number;
    category: string;
    paymentMethod: string;
    name: string;
    createdAt: any;
    expenseDate?: any;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
    Food: "#f97316",
    Travel: "#3b82f6",
    Shopping: "#a855f7",
    Bills: "#ef4444",
    Health: "#ec4899",
    Fun: "#6366f1",
    UPI: "#10b981",
};
const CATEGORY_ICONS: Record<string, string> = {
    Food: "fast-food",
    Travel: "car",
    Shopping: "cart",
    Bills: "receipt",
    Health: "heart",
    Fun: "game-controller",
    UPI: "qr-code",
};
const PAY_COLORS = ["#2f5d34", "#3b82f6", "#f97316", "#a855f7", "#ef4444", "#10b981"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDateForItem(item: Expense): Date | null {
    const ts = item.expenseDate || item.createdAt;
    if (!ts) return null;
    return ts.toDate ? ts.toDate() : ts instanceof Date ? ts : null;
}

function getPeriodRange(period: Period, customFrom: Date | null, customTo: Date | null) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === "week") {
        const start = new Date(today); start.setDate(today.getDate() - 6);
        return { start, end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59) };
    }
    if (period === "month") {
        return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59) };
    }
    if (period === "year") {
        return { start: new Date(now.getFullYear(), 0, 1), end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59) };
    }
    return {
        start: customFrom ?? new Date(now.getFullYear(), 0, 1),
        end: customTo ?? new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59),
    };
}

const fmt = (n: number) =>
    n >= 100000 ? `₹${(n / 100000).toFixed(1)}L`
        : n >= 1000 ? `₹${(n / 1000).toFixed(1)}K`
            : `₹${n.toFixed(0)}`;

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG = "#ffffff";           // page background
const CARD = "#f8fafc";         // card backgrounds
const BORDER = "#f0f4f8";       // card borders
const TEXT_PRIMARY = "#111827"; // headings
const TEXT_SEC = "#6b7280";     // sub-labels
const TEXT_HINT = "#9ca3af";    // placeholder, hints
const ACCENT = "#2f5d34";       // brand green

// ─── Component ────────────────────────────────────────────────────────────────
export default function Reports() {
    const [uid, setUid] = useState<string | null>(auth.currentUser?.uid || null);
    const [authLoaded, setAuthLoaded] = useState(false);

    const [loading, setLoading] = useState(true);
    const [expenses, setExpenses] = useState<Expense[]>([]);

    const [period, setPeriod] = useState<Period>("month");
    const [customFrom, setCustomFrom] = useState<Date | null>(null);
    const [customTo, setCustomTo] = useState<Date | null>(null);
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);
    const [showCustomModal, setShowCustomModal] = useState(false);

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
            (async () => {
                setLoading(true);
                try {
                    const q = query(collection(db, "expenses"), where("userId", "==", uid));
                    const snap = await getDocs(q);
                    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Expense[];
                    setExpenses(list);
                } catch (e) {
                    console.log("Reports error:", e);
                } finally {
                    setLoading(false);
                }
            })();
        } else if (authLoaded && !uid) {
            setLoading(false);
        }
    }, [uid, authLoaded]);

    const filtered = useMemo(() => {
        const { start, end } = getPeriodRange(period, customFrom, customTo);
        return expenses.filter((e) => {
            const d = getDateForItem(e);
            return d && d >= start && d <= end;
        });
    }, [expenses, period, customFrom, customTo]);

    const totalSpent = useMemo(() => filtered.reduce((s, e) => s + (e.amount || 0), 0), [filtered]);
    const avgPerDay = useMemo(() => {
        if (!filtered.length) return 0;
        const { start, end } = getPeriodRange(period, customFrom, customTo);
        const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
        return totalSpent / days;
    }, [filtered, totalSpent, period, customFrom, customTo]);
    const largestExpense = useMemo(() => Math.max(0, ...filtered.map((e) => e.amount || 0)), [filtered]);

    const categoryBreakdown = useMemo(() => {
        const map: Record<string, number> = {};
        filtered.forEach((e) => { const cat = e.category || "Other"; map[cat] = (map[cat] || 0) + (e.amount || 0); });
        return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
    }, [filtered]);

    const paymentBreakdown = useMemo(() => {
        const map: Record<string, number> = {};
        filtered.forEach((e) => { const pm = e.paymentMethod || "Other"; map[pm] = (map[pm] || 0) + (e.amount || 0); });
        return Object.entries(map).sort((a, b) => b[1] - a[1]);
    }, [filtered]);

    const topExpenses = useMemo(() =>
        [...filtered].sort((a, b) => (b.amount || 0) - (a.amount || 0)).slice(0, 5),
        [filtered]);

    const trendData = useMemo(() => {
        if (period === "week") {
            return Array.from({ length: 7 }, (_, i) => {
                const d = new Date(); d.setDate(d.getDate() - (6 - i));
                const ds = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                const de = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
                const amount = filtered.filter((e) => { const ed = getDateForItem(e); return ed && ed >= ds && ed <= de; }).reduce((s, e) => s + (e.amount || 0), 0);
                return { label: d.toLocaleDateString("en-IN", { weekday: "short" }), amount };
            });
        }
        if (period === "month") {
            const weeks = [{ label: "W1", amount: 0 }, { label: "W2", amount: 0 }, { label: "W3", amount: 0 }, { label: "W4", amount: 0 }];
            filtered.forEach((e) => { const d = getDateForItem(e); if (d) weeks[Math.min(3, Math.floor((d.getDate() - 1) / 7))].amount += e.amount || 0; });
            return weeks;
        }
        const months = Array.from({ length: 12 }, (_, i) => ({ label: new Date(2024, i, 1).toLocaleDateString("en-IN", { month: "short" }), amount: 0 }));
        filtered.forEach((e) => { const d = getDateForItem(e); if (d) months[d.getMonth()].amount += e.amount || 0; });
        return months;
    }, [filtered, period]);

    const maxTrend = Math.max(1, ...trendData.map((t) => t.amount));

    const PERIOD_TABS: { key: Period; label: string; icon: string }[] = [
        { key: "week", label: "Weekly", icon: "today" },
        { key: "month", label: "Monthly", icon: "calendar" },
        { key: "year", label: "Yearly", icon: "calendar-number" },
        { key: "custom", label: "Custom", icon: "options" },
    ];

    const isFilterActive = (key: Period) => period === key;

    return (
        <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: "#111827" }}>

            {/* ── Header ── */}
            <View className="bg-gray-900 px-4 py-4 flex-row items-center">

                <TouchableOpacity onPress={() => router.back()} className="mr-3">
                    <Ionicons name="arrow-back-circle-outline" size={32} color="white" />
                </TouchableOpacity>

                <Text className="text-white text-xl font-bold">
                    Expense Reports
                </Text>

            </View>
            {/* ── Period Tabs ── */}
            <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, gap: 8, backgroundColor: BG }}>
                {PERIOD_TABS.map((t) => {
                    const active = isFilterActive(t.key);
                    return (
                        <TouchableOpacity
                            key={t.key}
                            onPress={() => { if (t.key === "custom") setShowCustomModal(true); else setPeriod(t.key); }}
                            style={{
                                flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                                paddingVertical: 11, borderRadius: 16,
                                backgroundColor: active ? ACCENT : CARD,
                                borderWidth: 1.5, borderColor: active ? ACCENT : BORDER,
                            }}
                        >
                            <Ionicons name={t.icon as any} size={12} color={active ? "white" : TEXT_SEC} style={{ marginRight: 3 }} />
                            <Text style={{ fontSize: 11, fontWeight: "800", color: active ? "white" : TEXT_SEC }}>{t.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Custom range pill */}
            {period === "custom" && customFrom && customTo && (
                <TouchableOpacity
                    onPress={() => setShowCustomModal(true)}
                    style={{ marginHorizontal: 16, marginBottom: 4, flexDirection: "row", alignItems: "center", backgroundColor: "#f0fdf4", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "#bbf7d0" }}
                >
                    <Ionicons name="calendar-outline" size={14} color={ACCENT} style={{ marginRight: 6 }} />
                    <Text style={{ color: ACCENT, fontSize: 12, fontWeight: "700" }}>
                        {customFrom.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}  →  {customTo.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </Text>
                    <Ionicons name="pencil" size={11} color={ACCENT} style={{ marginLeft: "auto" }} />
                </TouchableOpacity>
            )}

            {loading ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: BG }}>
                    <ActivityIndicator size="large" color={ACCENT} />
                    <Text style={{ color: TEXT_SEC, marginTop: 12, fontWeight: "600" }}>Loading report...</Text>
                </View>
            ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 60, backgroundColor: BG }}>

                    {/* ── KPI Cards ── */}
                    <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
                        {[
                            { label: "Total Spent", value: fmt(totalSpent), icon: "wallet", color: ACCENT, bg: "#f0fdf4" },
                            { label: "Daily Avg", value: fmt(avgPerDay), icon: "trending-up", color: "#3b82f6", bg: "#eff6ff" },
                            { label: "Largest", value: fmt(largestExpense), icon: "arrow-up-circle", color: "#ef4444", bg: "#fef2f2" },
                        ].map((kpi) => (
                            <View key={kpi.label} style={{ flex: 1, backgroundColor: CARD, borderRadius: 20, padding: 14, borderWidth: 1.5, borderColor: BORDER }}>
                                <View style={{ backgroundColor: kpi.bg, borderRadius: 10, padding: 7, alignSelf: "flex-start", marginBottom: 8 }}>
                                    <Ionicons name={kpi.icon as any} size={16} color={kpi.color} />
                                </View>
                                <Text style={{ color: TEXT_PRIMARY, fontSize: 16, fontWeight: "900" }}>{kpi.value}</Text>
                                <Text style={{ color: TEXT_HINT, fontSize: 10, fontWeight: "700", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.8 }}>{kpi.label}</Text>
                            </View>
                        ))}
                    </View>

                    {/* ── Transaction Count Banner ── */}
                    <View style={{ backgroundColor: CARD, borderRadius: 20, padding: 16, marginBottom: 14, flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: BORDER }}>
                        <View style={{ backgroundColor: "#fffbeb", borderRadius: 12, padding: 10, marginRight: 14 }}>
                            <Ionicons name="layers" size={22} color="#f59e0b" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: TEXT_PRIMARY, fontSize: 24, fontWeight: "900" }}>{filtered.length}</Text>
                            <Text style={{ color: TEXT_SEC, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>Transactions</Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                            <Text style={{ color: "#f59e0b", fontSize: 13, fontWeight: "800" }}>
                                {filtered.length > 0 ? fmt(totalSpent / filtered.length) : "—"}
                            </Text>
                            <Text style={{ color: TEXT_HINT, fontSize: 10, fontWeight: "600" }}>avg each</Text>
                        </View>
                    </View>

                    {/* ── Trend Bar Chart ── */}
                    <View style={{ backgroundColor: CARD, borderRadius: 24, padding: 20, marginBottom: 14, borderWidth: 1.5, borderColor: BORDER }}>
                        <Text style={{ color: TEXT_HINT, fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 16 }}>
                            {period === "week" ? "Daily Spend (Last 7 Days)" : period === "month" ? "Weekly Breakdown" : period === "year" ? "Monthly Breakdown" : "Custom Period Trend"}
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "flex-end", height: 90, gap: 5 }}>
                            {trendData.map((t, i) => {
                                const barH = Math.max(4, (t.amount / maxTrend) * 78);
                                const isMax = t.amount === maxTrend && t.amount > 0;
                                return (
                                    <View key={i} style={{ flex: 1, alignItems: "center" }}>
                                        {isMax && t.amount > 0 && (
                                            <Text style={{ color: ACCENT, fontSize: 8, fontWeight: "800", marginBottom: 2 }}>{fmt(t.amount)}</Text>
                                        )}
                                        <View style={{ width: "100%", height: barH, borderRadius: 6, backgroundColor: isMax ? ACCENT : "#d1fae5" }} />
                                        <Text style={{ color: TEXT_HINT, fontSize: 9, fontWeight: "700", marginTop: 5 }}>{t.label}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>

                    {/* ── Category Breakdown ── */}
                    {categoryBreakdown.length > 0 && (
                        <View style={{ backgroundColor: CARD, borderRadius: 24, padding: 20, marginBottom: 14, borderWidth: 1.5, borderColor: BORDER }}>
                            <Text style={{ color: TEXT_HINT, fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 16 }}>
                                Spend by Category
                            </Text>
                            {categoryBreakdown.map(([cat, amt], i) => {
                                const pct = totalSpent > 0 ? (amt / totalSpent) * 100 : 0;
                                const color = CATEGORY_COLORS[cat] || PAY_COLORS[i % PAY_COLORS.length];
                                const icon = CATEGORY_ICONS[cat] || "wallet";
                                return (
                                    <View key={cat} style={{ marginBottom: 14 }}>
                                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 7 }}>
                                            <View style={{ backgroundColor: color + "18", borderRadius: 9, padding: 6, marginRight: 10 }}>
                                                <Ionicons name={icon as any} size={13} color={color} />
                                            </View>
                                            <Text style={{ flex: 1, color: TEXT_PRIMARY, fontSize: 13, fontWeight: "700" }}>{cat}</Text>
                                            <Text style={{ color: TEXT_HINT, fontSize: 12, fontWeight: "600" }}>{pct.toFixed(1)}%</Text>
                                            <Text style={{ color: TEXT_PRIMARY, fontSize: 13, fontWeight: "900", marginLeft: 12, minWidth: 58, textAlign: "right" }}>{fmt(amt)}</Text>
                                        </View>
                                        <View style={{ height: 7, backgroundColor: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                                            <View style={{ width: `${pct}%`, height: "100%", backgroundColor: color, borderRadius: 4 }} />
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {/* ── Payment Methods ── */}
                    {paymentBreakdown.length > 0 && (
                        <View style={{ backgroundColor: CARD, borderRadius: 24, padding: 20, marginBottom: 14, borderWidth: 1.5, borderColor: BORDER }}>
                            <Text style={{ color: TEXT_HINT, fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 16 }}>
                                Payment Methods
                            </Text>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                                {paymentBreakdown.map(([pm, amt], i) => {
                                    const color = PAY_COLORS[i % PAY_COLORS.length];
                                    const pct = totalSpent > 0 ? ((amt / totalSpent) * 100).toFixed(0) : "0";
                                    return (
                                        <View key={pm} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "white", borderRadius: 14, padding: 12, flex: 1, minWidth: "44%", borderWidth: 1, borderColor: BORDER }}>
                                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, marginRight: 8 }} />
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ color: TEXT_PRIMARY, fontSize: 12, fontWeight: "800" }}>{pm}</Text>
                                                <Text style={{ color: TEXT_HINT, fontSize: 10, fontWeight: "600" }}>{fmt(amt)} · {pct}%</Text>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    {/* ── Top 5 Expenses ── */}
                    {topExpenses.length > 0 && (
                        <View style={{ backgroundColor: CARD, borderRadius: 24, padding: 20, marginBottom: 14, borderWidth: 1.5, borderColor: BORDER }}>
                            <Text style={{ color: TEXT_HINT, fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 16 }}>
                                Top Expenses
                            </Text>
                            {topExpenses.map((e, i) => {
                                const color = CATEGORY_COLORS[e.category] || PAY_COLORS[i % PAY_COLORS.length];
                                const icon = CATEGORY_ICONS[e.category] || "wallet";
                                const d = getDateForItem(e);
                                return (
                                    <View key={e.id} style={{ flexDirection: "row", alignItems: "center", marginBottom: i < topExpenses.length - 1 ? 14 : 0 }}>
                                        <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                                            <Text style={{ color: TEXT_SEC, fontSize: 11, fontWeight: "900" }}>#{i + 1}</Text>
                                        </View>
                                        <View style={{ backgroundColor: color + "18", borderRadius: 10, padding: 7, marginRight: 10 }}>
                                            <Ionicons name={icon as any} size={14} color={color} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: TEXT_PRIMARY, fontSize: 13, fontWeight: "700" }} numberOfLines={1}>{e.name || e.category || "Expense"}</Text>
                                            <Text style={{ color: TEXT_HINT, fontSize: 10, fontWeight: "600" }}>
                                                {e.category}{d ? " · " + d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : ""}
                                            </Text>
                                        </View>
                                        <Text style={{ color: "#ef4444", fontSize: 14, fontWeight: "900" }}>{fmt(e.amount)}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {/* ── Empty ── */}
                    {filtered.length === 0 && (
                        <View style={{ alignItems: "center", paddingVertical: 60 }}>
                            <View style={{ backgroundColor: CARD, borderRadius: 28, padding: 28, marginBottom: 16, borderWidth: 1.5, borderColor: BORDER }}>
                                <Ionicons name="bar-chart-outline" size={52} color="#cbd5e1" />
                            </View>
                            <Text style={{ color: TEXT_PRIMARY, fontWeight: "800", fontSize: 16 }}>No data for this period</Text>
                            <Text style={{ color: TEXT_SEC, fontSize: 13, marginTop: 4 }}>Add expenses to see your analytics</Text>
                        </View>
                    )}

                </ScrollView>
            )}

            {/* ── Custom Date Modal ── */}
            <Modal visible={showCustomModal} transparent animationType="slide">
                <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}>
                    <View style={{ backgroundColor: BG, borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 24, paddingBottom: 42 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
                            <View>
                                <Text style={{ color: TEXT_PRIMARY, fontSize: 20, fontWeight: "900" }}>Custom Date Range</Text>
                                <Text style={{ color: TEXT_HINT, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>Select your report period</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowCustomModal(false)} style={{ backgroundColor: "#f3f4f6", borderRadius: 12, padding: 9 }}>
                                <Ionicons name="close" size={20} color={TEXT_PRIMARY} />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: TEXT_HINT, fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>From Date</Text>
                        <TouchableOpacity
                            onPress={() => setShowFromPicker(true)}
                            style={{ backgroundColor: CARD, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", marginBottom: 16, borderWidth: 1.5, borderColor: BORDER }}
                        >
                            <Ionicons name="calendar-outline" size={18} color={ACCENT} style={{ marginRight: 10 }} />
                            <Text style={{ color: customFrom ? TEXT_PRIMARY : TEXT_HINT, fontWeight: "700", flex: 1 }}>
                                {customFrom ? customFrom.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "Select start date"}
                            </Text>
                            {customFrom && <Ionicons name="checkmark-circle" size={18} color={ACCENT} />}
                        </TouchableOpacity>
                        {showFromPicker && (
                            <DateTimePicker value={customFrom || new Date()} mode="date" display="default" maximumDate={customTo || new Date()} onChange={(_, d) => { setShowFromPicker(false); if (d) setCustomFrom(d); }} />
                        )}

                        <Text style={{ color: TEXT_HINT, fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>To Date</Text>
                        <TouchableOpacity
                            onPress={() => setShowToPicker(true)}
                            style={{ backgroundColor: CARD, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", marginBottom: 28, borderWidth: 1.5, borderColor: BORDER }}
                        >
                            <Ionicons name="calendar-outline" size={18} color={ACCENT} style={{ marginRight: 10 }} />
                            <Text style={{ color: customTo ? TEXT_PRIMARY : TEXT_HINT, fontWeight: "700", flex: 1 }}>
                                {customTo ? customTo.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "Select end date"}
                            </Text>
                            {customTo && <Ionicons name="checkmark-circle" size={18} color={ACCENT} />}
                        </TouchableOpacity>
                        {showToPicker && (
                            <DateTimePicker value={customTo || new Date()} mode="date" display="default" minimumDate={customFrom || undefined} maximumDate={new Date()} onChange={(_, d) => { setShowToPicker(false); if (d) setCustomTo(d); }} />
                        )}

                        <TouchableOpacity
                            onPress={() => { if (!customFrom || !customTo) return; setPeriod("custom"); setShowCustomModal(false); }}
                            style={{ backgroundColor: customFrom && customTo ? ACCENT : "#f1f5f9", borderRadius: 20, paddingVertical: 18, alignItems: "center", shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: customFrom && customTo ? 0.2 : 0, shadowRadius: 8, elevation: customFrom && customTo ? 4 : 0 }}
                        >
                            <Text style={{ color: customFrom && customTo ? "white" : TEXT_HINT, fontWeight: "900", fontSize: 15, textTransform: "uppercase", letterSpacing: 2 }}>
                                Apply Report
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
}
