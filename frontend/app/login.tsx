import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { COLORS, RADIUS, SPACING } from "@/src/theme";
import { MANDAL } from "@/src/config/mandal";

const { height } = Dimensions.get("window");

export default function Login() {
  const { user, signIn, loading, deactivated, clearDeactivated } = useAuth();
  const [busy, setBusy] = useState(false);
  const [showDeactivated, setShowDeactivated] = useState(false);

  useEffect(() => {
    if (deactivated) setShowDeactivated(true);
  }, [deactivated]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }
  if (user) {
    return user.role === "admin" ? (
      <Redirect href="/(admin)/dashboard" />
    ) : (
      <Redirect href="/(volunteer)/collect" />
    );
  }

  const handleSignIn = async () => {
    setBusy(true);
    try {
      await signIn();
    } catch (e) {
      console.warn(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root} testID="login-screen">
      <LinearGradient
        colors={["#FF671F", "#FFB300"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <SafeAreaView edges={["top"]} style={styles.heroInner}>
          <View style={styles.logoWrap}>
            <View style={styles.logoInner}>
              <Image
                source={require("../assets/images/logo.png")}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          </View>
          <Text style={styles.orgSmall}>॥ श्री गणेशाय नमः ॥</Text>
          <Text style={styles.orgTitle}>{MANDAL.orgName}</Text>
          <Text style={styles.ganpati}>{MANDAL.ganpatiName}</Text>
          <Text style={styles.tagline}>{MANDAL.tagline}</Text>
        </SafeAreaView>
      </LinearGradient>

      <SafeAreaView edges={["bottom"]} style={styles.bottom}>
        <View style={styles.card}>
          <Text style={styles.welcome}>नमस्कार, {MANDAL.volunteerTitle}</Text>
          <Text style={styles.subtitle}>
            Sign in with Google to record donations, generate receipts, and share
            them instantly on WhatsApp.
          </Text>

          <TouchableOpacity
            testID="google-signin-button"
            style={styles.googleBtn}
            activeOpacity={0.85}
            onPress={handleSignIn}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={COLORS.primaryFg} />
            ) : (
              <>
                <View style={styles.googleIcon}>
                  <Text style={styles.googleG}>G</Text>
                </View>
                <Text style={styles.googleTxt}>Continue with Google</Text>
                <Ionicons
                  name="arrow-forward"
                  size={20}
                  color={COLORS.primaryFg}
                />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.footRow}>
            <Ionicons name="shield-checkmark" size={14} color={COLORS.textMuted} />
            <Text style={styles.footTxt}>
              Secure • Offline-ready • Role-based access
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <Modal
        visible={showDeactivated}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowDeactivated(false);
          clearDeactivated();
        }}
      >
        <View style={styles.modalOverlay} testID="deactivated-modal">
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Ionicons name="lock-closed" size={28} color={COLORS.error} />
            </View>
            <Text style={styles.modalTitle}>Account Deactivated</Text>
            <Text style={styles.modalBody}>
              Your access to the Jai Bharat Mitra Mandal Collection App has been
              deactivated. Please contact your Mandal admin to restore access.
            </Text>
            <TouchableOpacity
              testID="deactivated-ok-button"
              style={styles.modalBtn}
              activeOpacity={0.85}
              onPress={() => {
                setShowDeactivated(false);
                clearDeactivated();
              }}
            >
              <Text style={styles.modalBtnTxt}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  hero: { minHeight: height * 0.55 },
  heroInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
  },
  emblem: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
  },
  logoWrap: {
    width: 168,
    height: 168,
    borderRadius: 84,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    borderWidth: 6,
    borderColor: "#FFFFFF",
  },
  logoInner: {
    width: "100%",
    height: "100%",
    borderRadius: 84,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logo: { width: "88%", height: "88%" },
  ganpati: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginTop: SPACING.sm,
    textAlign: "center",
  },
  om: { fontSize: 48, color: "#fff", fontWeight: "800", lineHeight: 56 },
  orgSmall: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: SPACING.sm,
  },
  orgTitle: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 38,
    letterSpacing: 0.5,
  },
  tagline: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    marginTop: SPACING.md,
    fontWeight: "500",
  },
  bottom: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: -SPACING.xxl,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  welcome: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
    lineHeight: 20,
  },
  googleBtn: {
    height: 54,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  googleIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  googleG: { color: COLORS.primary, fontWeight: "900", fontSize: 16 },
  googleTxt: {
    color: COLORS.primaryFg,
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  footRow: {
    marginTop: SPACING.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  footTxt: { color: COLORS.textMuted, fontSize: 12 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.xl,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
  },
  modalIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  modalBody: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  modalBtn: {
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
  },
  modalBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
