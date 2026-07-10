import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { COLORS, RADIUS, SPACING } from "@/src/theme";
import ScreenHeader from "@/src/components/ScreenHeader";
import OfflineBadge from "@/src/components/OfflineBadge";
import { MANDAL } from "@/src/config/mandal";
import {
  enqueue,
  getPendingCount,
  isOnline,
  subscribeOnline,
  syncQueue,
} from "@/src/utils/offlineQueue";

type Mode = "cash" | "upi";

export default function CollectScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [donorName, setDonorName] = useState("");
  const [donorPhone, setDonorPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<Mode>("cash");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  const refreshPending = useCallback(async () => {
    setPending(await getPendingCount());
  }, []);

  useEffect(() => {
    (async () => {
      setOnline(await isOnline());
      await refreshPending();
    })();
    const unsub = subscribeOnline(async (o) => {
      setOnline(o);
      if (o && token) {
        const res = await syncQueue(token);
        await refreshPending();
        if (res.synced.length) {
          console.log(`Synced ${res.synced.length} offline entries`);
        }
      }
    });
    return () => unsub();
  }, [token, refreshPending]);

  useFocusEffect(
    useCallback(() => {
      refreshPending();
    }, [refreshPending]),
  );

  const reset = () => {
    setDonorName("");
    setDonorPhone("");
    setAmount("");
    setAddress("");
    setNotes("");
    setMode("cash");
  };

  const submit = async () => {
    if (!donorName.trim()) {
      Alert.alert("Missing", "Donor name is required.");
      return;
    }
    if (!/^\d{10}$/.test(donorPhone)) {
      Alert.alert("Invalid Phone", "Please enter a 10-digit WhatsApp number.");
      return;
    }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount.");
      return;
    }

    setBusy(true);
    try {
      const nowOnline = await isOnline();
      if (nowOnline && token) {
        const created = await api.createCollection(token, {
          donor_name: donorName.trim(),
          donor_phone: donorPhone.trim(),
          amount: amt,
          payment_mode: mode,
          address: address.trim(),
          notes: notes.trim(),
        });
        reset();
        router.push(`/(volunteer)/receipt/${created.id}`);
      } else {
        await enqueue({
          donor_name: donorName.trim(),
          donor_phone: donorPhone.trim(),
          amount: amt,
          payment_mode: mode,
          address: address.trim(),
          notes: notes.trim(),
        });
        reset();
        await refreshPending();
        Alert.alert(
          "Queued Offline",
          "Entry saved locally. It will sync automatically when back online.",
        );
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not save collection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={MANDAL.orgName}
        subtitle={`${MANDAL.volunteerTitle} • ${user?.name ?? ""}`}
        right={<OfflineBadge online={online} pending={pending} />}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top + 60}
      >
        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card} testID="collection-form">
            <Text style={styles.section}>New Donation</Text>

            <Field label="Donor Name *">
              <TextInput
                testID="input-donor-name"
                style={styles.input}
                value={donorName}
                onChangeText={setDonorName}
                placeholder="e.g. Rakesh Sharma"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="words"
              />
            </Field>

            <Field label="WhatsApp Number *">
              <View style={styles.phoneWrap}>
                <View style={styles.cc}>
                  <Text style={styles.ccTxt}>+91</Text>
                </View>
                <TextInput
                  testID="input-donor-phone"
                  style={[styles.input, { flex: 1, marginLeft: 8 }]}
                  value={donorPhone}
                  onChangeText={(t) => setDonorPhone(t.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10-digit mobile"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>
            </Field>

            <Field label="Amount (₹) *">
              <TextInput
                testID="input-amount"
                style={[styles.input, styles.amountInput]}
                value={amount}
                onChangeText={(t) => setAmount(t.replace(/[^\d.]/g, ""))}
                placeholder="0"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad"
              />
            </Field>

            <Field label="Payment Mode *">
              <View style={styles.segmented}>
                <SegBtn
                  testID="mode-cash"
                  label="Cash"
                  icon="cash-outline"
                  active={mode === "cash"}
                  onPress={() => setMode("cash")}
                />
                <SegBtn
                  testID="mode-upi"
                  label="UPI"
                  icon="qr-code-outline"
                  active={mode === "upi"}
                  onPress={() => setMode("upi")}
                />
              </View>
            </Field>

            <Field label="Address / Shop Name (optional)">
              <TextInput
                testID="input-address"
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder="e.g. Om Provisions, MG Road"
                placeholderTextColor={COLORS.textMuted}
              />
            </Field>

            <Field label="Notes (optional)">
              <TextInput
                testID="input-notes"
                style={[styles.input, styles.multiline]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Any remarks…"
                placeholderTextColor={COLORS.textMuted}
                multiline
              />
            </Field>

            <TouchableOpacity
              testID="submit-collection-button"
              style={[styles.submit, busy && { opacity: 0.7 }]}
              onPress={submit}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={20} color="#fff" />
                  <Text style={styles.submitTxt}>
                    Mark as Paid & Generate Receipt
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.hint}>
              A sequential receipt number (JBM-{new Date().getFullYear()}-####) will be
              auto-generated on submit.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: SPACING.lg }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function SegBtn({
  label,
  icon,
  active,
  onPress,
  testID,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.seg, active && styles.segActive]}
    >
      <Ionicons
        name={icon}
        size={18}
        color={active ? "#fff" : COLORS.textPrimary}
      />
      <Text style={[styles.segTxt, active && styles.segTxtActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  section: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: 15,
    color: COLORS.textPrimary,
    backgroundColor: "#fff",
  },
  amountInput: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.primary,
  },
  multiline: {
    minHeight: 80,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  phoneWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  cc: {
    height: 48,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    justifyContent: "center",
  },
  ccTxt: { fontWeight: "700", color: COLORS.primary },
  segmented: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  seg: {
    flex: 1,
    height: 52,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  segActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  segTxt: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  segTxtActive: { color: "#fff" },
  submit: {
    marginTop: SPACING.sm,
    height: 54,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
  },
  submitTxt: { color: "#fff", fontWeight: "800", fontSize: 16 },
  hint: {
    marginTop: SPACING.md,
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: "center",
  },
});
