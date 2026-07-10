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
  Alert,
  Image,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { api, AppUser } from "@/src/api/client";
import { COLORS, RADIUS, SPACING } from "@/src/theme";
import ScreenHeader from "@/src/components/ScreenHeader";

export default function VolunteersScreen() {
  const { token, user: me } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.listUsers(token);
      setUsers(data);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not load users");
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
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [users, search]);

  const toggleRole = async (u: AppUser) => {
    if (!token) return;
    const target = u.role === "admin" ? "volunteer" : "admin";
    Alert.alert(
      target === "admin" ? "Promote to Admin?" : "Demote to Volunteer?",
      `${u.name} will ${target === "admin" ? "gain full admin access" : "become a regular volunteer"}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              const updated = await api.setRole(token, u.user_id, target);
              setUsers((prev) =>
                prev.map((x) => (x.user_id === u.user_id ? updated : x)),
              );
            } catch (e: any) {
              Alert.alert("Error", e?.message || "Update failed");
            }
          },
        },
      ],
    );
  };

  const toggleActive = async (u: AppUser) => {
    if (!token) return;
    const target = !u.active;
    Alert.alert(
      target ? "Reactivate user?" : "Deactivate user?",
      `${u.name} will ${target ? "regain access" : "lose access to the app"}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: target ? "default" : "destructive",
          onPress: async () => {
            try {
              const updated = await api.setActive(token, u.user_id, target);
              setUsers((prev) =>
                prev.map((x) => (x.user_id === u.user_id ? updated : x)),
              );
            } catch (e: any) {
              Alert.alert("Error", e?.message || "Update failed");
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Volunteers"
        subtitle={`${users.length} member${users.length === 1 ? "" : "s"}`}
      />

      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} />
          <TextInput
            testID="search-user-input"
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or email"
            placeholderTextColor={COLORS.textMuted}
            style={styles.searchInput}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(u) => u.user_id}
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
            <View style={styles.empty}>
              <Ionicons
                name="people-outline"
                size={44}
                color={COLORS.textMuted}
              />
              <Text style={styles.emptyTxt}>No users yet</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMe = me?.user_id === item.user_id;
            return (
              <View style={styles.card} testID={`user-row-${item.user_id}`}>
                <View style={styles.row}>
                  <View style={styles.avatar}>
                    {item.picture ? (
                      <Image
                        source={{ uri: item.picture }}
                        style={styles.avatarImg}
                      />
                    ) : (
                      <Text style={styles.avatarTxt}>
                        {(item.name || "?").charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {isMe && (
                        <View style={styles.youBadge}>
                          <Text style={styles.youTxt}>YOU</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.email} numberOfLines={1}>
                      {item.email}
                    </Text>
                    <View style={styles.badgesRow}>
                      <View
                        style={[
                          styles.badge,
                          item.role === "admin"
                            ? { backgroundColor: COLORS.adminBg }
                            : { backgroundColor: "#E0E7FF" },
                        ]}
                      >
                        <Ionicons
                          name={
                            item.role === "admin" ? "shield" : "person"
                          }
                          size={11}
                          color={
                            item.role === "admin"
                              ? COLORS.adminFg
                              : "#3730A3"
                          }
                        />
                        <Text
                          style={[
                            styles.badgeTxt,
                            {
                              color:
                                item.role === "admin"
                                  ? COLORS.adminFg
                                  : "#3730A3",
                            },
                          ]}
                        >
                          {item.role === "admin" ? "Admin" : "Volunteer"}
                        </Text>
                      </View>
                      {!item.active && (
                        <View
                          style={[
                            styles.badge,
                            { backgroundColor: "#FEE2E2" },
                          ]}
                        >
                          <Text
                            style={[styles.badgeTxt, { color: "#B91C1C" }]}
                          >
                            Deactivated
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                <View style={styles.actions}>
                  <TouchableOpacity
                    testID={`toggle-role-${item.user_id}`}
                    style={[styles.actionBtn, isMe && styles.disabled]}
                    disabled={isMe}
                    onPress={() => toggleRole(item)}
                  >
                    <Ionicons
                      name={
                        item.role === "admin"
                          ? "arrow-down-circle-outline"
                          : "arrow-up-circle-outline"
                      }
                      size={16}
                      color={isMe ? COLORS.textMuted : COLORS.primary}
                    />
                    <Text
                      style={[
                        styles.actionTxt,
                        { color: isMe ? COLORS.textMuted : COLORS.primary },
                      ]}
                    >
                      {item.role === "admin" ? "Demote" : "Promote"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID={`toggle-active-${item.user_id}`}
                    style={[styles.actionBtn, isMe && styles.disabled]}
                    disabled={isMe}
                    onPress={() => toggleActive(item)}
                  >
                    <Ionicons
                      name={
                        item.active
                          ? "lock-closed-outline"
                          : "lock-open-outline"
                      }
                      size={16}
                      color={
                        isMe
                          ? COLORS.textMuted
                          : item.active
                            ? COLORS.error
                            : COLORS.success
                      }
                    />
                    <Text
                      style={[
                        styles.actionTxt,
                        {
                          color: isMe
                            ? COLORS.textMuted
                            : item.active
                              ? COLORS.error
                              : COLORS.success,
                        },
                      ]}
                    >
                      {item.active ? "Deactivate" : "Reactivate"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
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
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary },
  card: {
    backgroundColor: "#fff",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  row: { flexDirection: "row", gap: SPACING.md, alignItems: "center" },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarTxt: { fontSize: 18, fontWeight: "800", color: COLORS.primary },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },
  youBadge: {
    backgroundColor: COLORS.textPrimary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  youTxt: { color: "#fff", fontSize: 9, fontWeight: "800" },
  email: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  badgesRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
    flexWrap: "wrap",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
  },
  badgeTxt: { fontSize: 10, fontWeight: "700" },
  actions: {
    marginTop: SPACING.md,
    flexDirection: "row",
    gap: SPACING.sm,
  },
  actionBtn: {
    flex: 1,
    height: 40,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  disabled: { opacity: 0.4 },
  actionTxt: { fontSize: 12, fontWeight: "700" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTxt: { color: COLORS.textMuted },
});
