import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { COLORS, RADIUS, SPACING } from "@/src/theme";
import ScreenHeader from "@/src/components/ScreenHeader";
import { useRouter } from "expo-router";

export default function VolunteerProfile() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const performLogout = async () => {
    await signOut();
    router.replace("/login");
  };

  const doLogout = () => {
    if (Platform.OS === "web") {
      // Alert.alert is a no-op on RN-Web — use window.confirm instead
      const ok =
        typeof window !== "undefined" &&
        window.confirm("Sign out? You will need to sign in again.");
      if (ok) performLogout();
      return;
    }
    Alert.alert("Sign out?", "You will need to sign in again.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: performLogout,
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Profile" subtitle={user?.email ?? ""} />
      <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
        <View style={styles.card}>
          <View style={styles.avatar}>
            {user?.picture ? (
              <Image source={{ uri: user.picture }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarTxt}>
                {(user?.name || "?").charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Ionicons name="ribbon" size={14} color={COLORS.primary} />
            <Text style={styles.roleTxt}>
              {user?.role === "admin" ? "Administrator" : "Volunteer"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          testID="logout-button"
          style={styles.logout}
          onPress={doLogout}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
          <Text style={styles.logoutTxt}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          Jai Bharat Mitra Mandal • Collection App v1
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  card: {
    backgroundColor: "#fff",
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#FFF7ED",
    borderWidth: 2,
    borderColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarTxt: { fontSize: 32, fontWeight: "800", color: COLORS.primary },
  name: {
    fontSize: 20,
    fontWeight: "800",
    marginTop: SPACING.md,
    color: COLORS.textPrimary,
  },
  email: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: SPACING.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  roleTxt: { color: COLORS.primary, fontWeight: "700", fontSize: 12 },
  logout: {
    marginTop: SPACING.lg,
    height: 52,
    borderRadius: RADIUS.md,
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  logoutTxt: { color: COLORS.error, fontWeight: "700", fontSize: 15 },
  hint: {
    marginTop: SPACING.xl,
    textAlign: "center",
    color: COLORS.textMuted,
    fontSize: 11,
  },
});
