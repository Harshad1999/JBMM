import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { api, Collection } from "@/src/api/client";
import { COLORS, RADIUS, SPACING } from "@/src/theme";
import ScreenHeader from "@/src/components/ScreenHeader";
import { formatINR } from "@/src/utils/money";

export default function MyCollectionsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.listCollections(token, {});
      setItems(data);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (c) =>
        c.donor_name.toLowerCase().includes(q) ||
        c.donor_phone.includes(q) ||
        c.receipt_no.toLowerCase().includes(q),
    );
  }, [items, search]);

  const total = useMemo(
    () => items.reduce((sum, c) => sum + (c.amount || 0), 0),
    [items],
  );

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="My Collections"
        subtitle={`${items.length} receipt${items.length === 1 ? "" : "s"} • ${formatINR(total)}`}
      />

      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} />
          <TextInput
            testID="search-input"
            value={search}
            onChangeText={setSearch}
            placeholder="Search donor, phone, receipt…"
            placeholderTextColor={COLORS.textMuted}
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons
                name="close-circle"
                size={18}
                color={COLORS.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: SPACING.lg,
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
            <View style={styles.empty} testID="empty-state">
              <Ionicons
                name="documents-outline"
                size={48}
                color={COLORS.textMuted}
              />
              <Text style={styles.emptyTitle}>No collections yet</Text>
              <Text style={styles.emptySub}>
                Tap the New tab to record your first donation.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`collection-row-${item.id}`}
              activeOpacity={0.85}
              onPress={() =>
                router.push(`/(volunteer)/receipt/${item.id}`)
              }
              style={styles.card}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.donor} numberOfLines={1}>
                    {item.donor_name}
                  </Text>
                  <Text style={styles.receipt}>{item.receipt_no}</Text>
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
                <Text style={styles.date}>
                  {new Date(item.created_at).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={COLORS.textMuted}
                />
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  searchWrap: { padding: SPACING.lg, paddingBottom: 0 },
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
  receipt: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
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
  date: { flex: 1, fontSize: 12, color: COLORS.textMuted },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.textPrimary },
  emptySub: { fontSize: 13, color: COLORS.textMuted },
});
