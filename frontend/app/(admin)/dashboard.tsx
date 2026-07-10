import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { COLORS, RADIUS, SPACING } from "@/src/theme";
import ScreenHeader from "@/src/components/ScreenHeader";
import { formatINR } from "@/src/utils/money";

type Stats = Awaited<ReturnType<typeof api.dashboard>>;

export default function DashboardScreen() {
  const { token, user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const s = await api.dashboard(token);
      setStats(s);
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

  if (loading || !stats) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Dashboard" subtitle="Overall performance" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  const cashPct = stats.total.amount
    ? Math.round((stats.by_mode.cash.total / stats.total.amount) * 100)
    : 0;
  const upiPct = stats.total.amount
    ? 100 - cashPct
    : 0;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Dashboard"
        subtitle={`Namaste ${user?.name?.split(" ")[0] ?? "Admin"} 🙏`}
      />
      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 100 }}
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
      >
        <View style={styles.heroCard} testID="stat-total">
          <Text style={styles.heroLabel}>TOTAL RAISED</Text>
          <Text style={styles.heroAmt}>{formatINR(stats.total.amount)}</Text>
          <Text style={styles.heroCount}>
            {stats.total.count} donation{stats.total.count === 1 ? "" : "s"}
          </Text>
        </View>

        <View style={styles.row2}>
          <StatCard
            testID="stat-today"
            icon="today"
            label="Today"
            amount={stats.today.amount}
            count={stats.today.count}
            color="#059669"
          />
          <StatCard
            testID="stat-week"
            icon="calendar"
            label="This Week"
            amount={stats.week.amount}
            count={stats.week.count}
            color="#7C3AED"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Payment Breakdown</Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barCash,
                {
                  flex: cashPct || 0.001,
                  minWidth: cashPct > 0 ? 4 : 0,
                },
              ]}
            />
            <View
              style={[
                styles.barPaid,
                {
                  flex: upiPct || 0.001,
                  minWidth: upiPct > 0 ? 4 : 0,
                },
              ]}
            />
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legend}>
              <View style={[styles.dot, { backgroundColor: "#F59E0B" }]} />
              <Text style={styles.legendLbl}>Cash</Text>
              <Text style={styles.legendVal}>
                {formatINR(stats.by_mode.cash.total)}
                <Text style={styles.legendPct}> • {cashPct}%</Text>
              </Text>
            </View>
            <View style={styles.legend}>
              <View style={[styles.dot, { backgroundColor: COLORS.success }]} />
              <Text style={styles.legendLbl}>UPI</Text>
              <Text style={styles.legendVal}>
                {formatINR(stats.by_mode.upi.total)}
                <Text style={styles.legendPct}> • {upiPct}%</Text>
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.rowHead}>
            <Text style={styles.section}>Volunteer Leaderboard</Text>
            <Text style={styles.sectionHint}>
              {stats.leaderboard.length} active
            </Text>
          </View>
          {stats.leaderboard.length === 0 ? (
            <Text style={styles.emptyTxt}>
              No collections yet — waiting for the first receipt 🌺
            </Text>
          ) : (
            stats.leaderboard.map((row, idx) => (
              <View
                key={row.user_id}
                style={styles.lbRow}
                testID={`lb-row-${row.user_id}`}
              >
                <View
                  style={[
                    styles.rank,
                    idx === 0 && { backgroundColor: "#FEF3C7" },
                    idx === 1 && { backgroundColor: "#E5E7EB" },
                    idx === 2 && { backgroundColor: "#FED7AA" },
                  ]}
                >
                  <Text style={styles.rankTxt}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lbName} numberOfLines={1}>
                    {row.name}
                  </Text>
                  <Text style={styles.lbCount}>
                    {row.count} receipt{row.count === 1 ? "" : "s"}
                  </Text>
                </View>
                <Text style={styles.lbAmt}>{formatINR(row.total)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function StatCard({
  icon,
  label,
  amount,
  count,
  color,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  amount: number;
  count: number;
  color: string;
  testID: string;
}) {
  return (
    <View style={[styles.statCard]} testID={testID}>
      <View style={[styles.statIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.statLbl}>{label}</Text>
      <Text style={styles.statAmt}>{formatINR(amount)}</Text>
      <Text style={styles.statCnt}>
        {count} donation{count === 1 ? "" : "s"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.md,
  },
  heroLabel: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    letterSpacing: 1.2,
    fontWeight: "700",
  },
  heroAmt: { color: "#fff", fontSize: 40, fontWeight: "800", marginTop: 4 },
  heroCount: { color: "rgba(255,255,255,0.9)", marginTop: 4, fontSize: 13 },
  row2: {
    flexDirection: "row",
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  statLbl: { fontSize: 11, color: COLORS.textSecondary, fontWeight: "700" },
  statAmt: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  statCnt: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  card: {
    backgroundColor: "#fff",
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  section: { fontSize: 15, fontWeight: "800", color: COLORS.textPrimary },
  sectionHint: { fontSize: 12, color: COLORS.textMuted },
  rowHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  barTrack: {
    height: 12,
    backgroundColor: COLORS.border,
    borderRadius: 999,
    overflow: "hidden",
    flexDirection: "row",
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  barCash: { backgroundColor: "#F59E0B", height: "100%" },
  barPaid: { backgroundColor: COLORS.success, height: "100%" },
  legendRow: { marginTop: 6, gap: 8 },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendLbl: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: "700",
    width: 50,
  },
  legendVal: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
  legendPct: { color: COLORS.textMuted, fontWeight: "500" },
  lbRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
  },
  rank: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F5F5F4",
    justifyContent: "center",
    alignItems: "center",
  },
  rankTxt: { fontWeight: "800", color: COLORS.textPrimary, fontSize: 13 },
  lbName: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  lbCount: { fontSize: 11, color: COLORS.textMuted },
  lbAmt: { fontSize: 15, fontWeight: "800", color: COLORS.primary },
  emptyTxt: {
    paddingVertical: 20,
    textAlign: "center",
    color: COLORS.textMuted,
  },
});
