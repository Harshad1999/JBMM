import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useAuth } from "@/src/context/AuthContext";
import { api, AppUser, Collection, API_BASE } from "@/src/api/client";
import { COLORS, RADIUS, SPACING } from "@/src/theme";
import ScreenHeader from "@/src/components/ScreenHeader";
import { formatINR } from "@/src/utils/money";

type Mode = "" | "cash" | "upi";
type Range = "all" | "today" | "week" | "month";

function rangeDates(r: Range): { start?: string; end?: string } {
  if (r === "all") return {};
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (r === "week") start.setDate(start.getDate() - start.getDay());
  if (r === "month") start.setDate(1);
  return { start: start.toISOString() };
}

export default function AllCollectionsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<Mode>("");
  const [range, setRange] = useState<Range>("all");
  const [volunteerId, setVolunteerId] = useState<string>("");
  const [volunteers, setVolunteers] = useState<AppUser[]>([]);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { start, end } = rangeDates(range);
      const data = await api.listCollections(token, {
        start,
        end,
        payment_mode: mode || undefined,
        volunteer_id: volunteerId || undefined,
        search: search || undefined,
      });
      setItems(data);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, range, mode, volunteerId, search]);

  useEffect(() => {
    if (!token) return;
    api.listUsers(token).then(setVolunteers).catch(() => {});
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const total = useMemo(
    () => items.reduce((s, c) => s + (c.amount || 0), 0),
    [items],
  );

  const doExport = async () => {
    if (!token) return;
    setExporting(true);
    try {
      const { start, end } = rangeDates(range);
      const usp = new URLSearchParams();
      if (start) usp.append("start", start);
      if (end) usp.append("end", end);
      if (mode) usp.append("payment_mode", mode);
      if (volunteerId) usp.append("volunteer_id", volunteerId);
      if (search) usp.append("search", search);
      const url = `${API_BASE}/collections/export.csv?${usp.toString()}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export failed");

      if (Platform.OS === "web") {
        const blob = await res.blob();
        const dl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = dl;
        a.download = "jbm_collections.csv";
        a.click();
        URL.revokeObjectURL(dl);
      } else {
        // Save to cache and share via native share sheet
        const text = await res.text();
        const FileSystem = await import("expo-file-system/legacy").catch(
          async () => await import("expo-file-system"),
        );
        // @ts-ignore
        const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
        const fileUri = `${dir}jbm_collections_${Date.now()}.csv`;
        // @ts-ignore
        await FileSystem.writeAsStringAsync(fileUri, text, {
          // @ts-ignore
          encoding: FileSystem.EncodingType?.UTF8 ?? "utf8",
        });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: "text/csv",
            dialogTitle: "Export Collections",
            UTI: "public.comma-separated-values-text",
          });
        } else {
          await Linking.openURL(fileUri);
        }
      }
    } catch (e: any) {
      Alert.alert("Export failed", e?.message || "Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const rangeChips: { key: Range; label: string }[] = [
    { key: "all", label: "All Time" },
    { key: "today", label: "Today" },
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
  ];
  const modeChips: { key: Mode; label: string }[] = [
    { key: "", label: "All" },
    { key: "cash", label: "Cash" },
    { key: "upi", label: "UPI" },
  ];

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Collections"
        subtitle={`${items.length} • ${formatINR(total)}`}
        right={
          <TouchableOpacity
            testID="export-csv-button"
            onPress={doExport}
            style={styles.exportBtn}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="download-outline" size={16} color="#fff" />
                <Text style={styles.exportTxt}>CSV</Text>
              </>
            )}
          </TouchableOpacity>
        }
      />

      <View style={styles.filters}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} />
          <TextInput
            testID="search-input"
            value={search}
            onChangeText={setSearch}
            placeholder="Donor, phone, receipt"
            placeholderTextColor={COLORS.textMuted}
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {rangeChips.map((c) => (
            <Chip
              key={c.key}
              testID={`chip-range-${c.key}`}
              label={c.label}
              active={range === c.key}
              onPress={() => setRange(c.key)}
            />
          ))}
          <View style={styles.sep} />
          {modeChips.map((c) => (
            <Chip
              key={c.key || "any"}
              testID={`chip-mode-${c.key || "any"}`}
              label={c.label}
              active={mode === c.key}
              onPress={() => setMode(c.key)}
            />
          ))}
          <View style={styles.sep} />
          <Chip
            testID="chip-vol-all"
            label="All Volunteers"
            active={volunteerId === ""}
            onPress={() => setVolunteerId("")}
          />
          {volunteers
            .filter((v) => v.role !== "admin" || true)
            .map((v) => (
              <Chip
                key={v.user_id}
                testID={`chip-vol-${v.user_id}`}
                label={v.name.split(" ")[0]}
                active={volunteerId === v.user_id}
                onPress={() => setVolunteerId(v.user_id)}
              />
            ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{
            paddingHorizontal: SPACING.lg,
            paddingTop: SPACING.md,
            paddingBottom: 100,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={COLORS.primary}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="filter-outline"
                size={44}
                color={COLORS.textMuted}
              />
              <Text style={styles.emptyTxt}>No collections match filters</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`row-${item.id}`}
              activeOpacity={0.85}
              style={styles.card}
              onPress={() => router.push(`/(admin)/receipt/${item.id}`)}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.donor} numberOfLines={1}>
                    {item.donor_name}
                  </Text>
                  <Text style={styles.receipt}>
                    {item.receipt_no} • +91 {item.donor_phone}
                  </Text>
                </View>
                <Text style={styles.amount}>{formatINR(item.amount)}</Text>
              </View>
              <View style={styles.cardFoot}>
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor:
                        item.payment_mode === "cash"
                          ? COLORS.cashBg
                          : COLORS.paidBg,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color:
                        item.payment_mode === "cash"
                          ? COLORS.cashFg
                          : COLORS.paidFg,
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                  >
                    {item.payment_mode === "cash" ? "Cash" : "UPI"}
                  </Text>
                </View>
                <Text style={styles.byline} numberOfLines={1}>
                  by {item.collector_name}
                </Text>
                <Text style={styles.date}>
                  {new Date(item.created_at).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      activeOpacity={0.85}
    >
      <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  exportTxt: { color: "#fff", fontWeight: "700", fontSize: 12 },
  filters: { padding: SPACING.lg, paddingBottom: 0 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 48,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  chipsRow: {
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingRight: SPACING.md,
    alignItems: "center",
  },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#fff",
    justifyContent: "center",
    flexShrink: 0,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipTxt: { fontSize: 12, fontWeight: "700", color: COLORS.textSecondary },
  chipTxtActive: { color: "#fff" },
  sep: {
    width: 1,
    height: 20,
    backgroundColor: COLORS.border,
    marginHorizontal: 4,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  donor: { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },
  receipt: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  amount: { fontSize: 18, fontWeight: "800", color: COLORS.primary },
  cardFoot: {
    marginTop: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
  },
  byline: { flex: 1, fontSize: 11, color: COLORS.textSecondary },
  date: { fontSize: 11, color: COLORS.textMuted },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTxt: { color: COLORS.textMuted },
});
