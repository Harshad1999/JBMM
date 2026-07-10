import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { api, Collection } from "@/src/api/client";
import { COLORS, RADIUS, SPACING } from "@/src/theme";
import { amountToWords, formatINR } from "@/src/utils/money";
import { shareReceipt } from "@/src/utils/pdf";
import { MANDAL } from "@/src/config/mandal";
import ScreenHeader from "@/src/components/ScreenHeader";

export default function ReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!token || !id) return;
    (async () => {
      try {
        const c = await api.getCollection(token, String(id));
        setItem(c);
      } catch (e: any) {
        Alert.alert("Error", e?.message || "Could not load receipt");
      } finally {
        setLoading(false);
      }
    })();
  }, [token, id]);

  const doShare = async () => {
    if (!item) return;
    setSharing(true);
    try {
      await shareReceipt(item);
    } catch (e: any) {
      Alert.alert("Share Failed", e?.message || "Could not share receipt.");
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }
  if (!item) {
    return (
      <View style={styles.center}>
        <Text>Receipt not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Receipt"
        subtitle={item.receipt_no}
        right={
          <TouchableOpacity
            testID="back-button"
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={18} color="#fff" />
            <Text style={styles.backTxt}>Back</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={{
          padding: SPACING.lg,
          paddingBottom: 140,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.receipt} testID="receipt-preview">
          <View style={styles.band}>
            <View style={styles.bandLogoWrap}>
              <Image
                source={require("../../../assets/images/logo.png")}
                style={styles.bandLogo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.bandOm}>॥ श्री गणेशाय नमः ॥</Text>
            <Text style={styles.bandTitle}>{MANDAL.orgName}</Text>
            <Text style={styles.bandGanpati}>{MANDAL.ganpatiName}</Text>
            <Text style={styles.bandSub}>Ganesh Festival — Donation Receipt</Text>
          </View>

          <View style={styles.body}>
            <View style={styles.rnRow}>
              <View>
                <Text style={styles.rnLabel}>Receipt No.</Text>
                <Text style={styles.rnVal}>{item.receipt_no}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.rnLabel}>Date</Text>
                <Text style={styles.rnDate}>
                  {new Date(item.created_at).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            </View>

            <Row k="Donor Name" v={item.donor_name} />
            <Row k="WhatsApp" v={`+91 ${item.donor_phone}`} />
            {item.address ? <Row k="Address / Shop" v={item.address} /> : null}
            <Row
              k="Payment Mode"
              v={item.payment_mode === "cash" ? "Cash" : "UPI"}
            />
            <Row k="Collector" v={item.collector_name} />
            {item.notes ? <Row k="Notes" v={item.notes} /> : null}

            <View style={styles.amtBox}>
              <Text style={styles.amtLabel}>Amount Received</Text>
              <Text style={styles.amtFig}>{formatINR(item.amount)}</Text>
              <Text style={styles.amtWords}>
                {amountToWords(item.amount)}
              </Text>
            </View>

            <View style={styles.foot}>
              <Text style={styles.footThanks}>
                🙏 Thank you for your kind contribution
              </Text>
              <Text style={styles.footNote}>{MANDAL.blessing}</Text>
              <Text style={styles.footTagline}>{MANDAL.tagline}</Text>
              <Text style={styles.footContact}>
                Mandal Contact: {MANDAL.contactWhatsAppE164}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.actions,
          { paddingBottom: Math.max(insets.bottom, SPACING.md) },
        ]}
      >
        <TouchableOpacity
          testID="share-receipt-button"
          style={styles.shareBtn}
          onPress={doShare}
          disabled={sharing}
          activeOpacity={0.85}
        >
          {sharing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="share-social" size={22} color="#fff" />
              <Text style={styles.shareTxt}>Share Receipt</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowK}>{k}</Text>
      <Text style={styles.rowV} numberOfLines={2}>
        {v}
      </Text>
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
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  backTxt: { color: "#fff", fontWeight: "700", fontSize: 12 },
  receipt: {
    backgroundColor: "#fff",
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  band: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    alignItems: "center",
  },
  bandLogoWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#fff",
    borderWidth: 4,
    borderColor: "#fff",
    marginBottom: 10,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  bandLogo: { width: "88%", height: "88%" },
  bandOm: { color: "#fff", fontSize: 14, fontWeight: "600", opacity: 0.95 },
  bandTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 2,
    letterSpacing: 0.4,
  },
  bandGanpati: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 2,
  },
  bandSub: { color: "rgba(255,255,255,0.9)", fontSize: 11, marginTop: 6 },
  body: { padding: SPACING.lg },
  rnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: SPACING.md,
    marginBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    borderStyle: "dashed" as const,
  },
  rnLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "700",
  },
  rnVal: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.primary,
    marginTop: 2,
  },
  rnDate: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    gap: SPACING.md,
  },
  rowK: { fontSize: 13, color: COLORS.textSecondary, flexShrink: 0 },
  rowV: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
    textAlign: "right",
    flex: 1,
  },
  amtBox: {
    marginTop: SPACING.md,
    padding: SPACING.lg,
    backgroundColor: "#FFF7ED",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "#FED7AA",
    alignItems: "center",
  },
  amtLabel: {
    fontSize: 11,
    color: "#92400E",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  amtFig: {
    fontSize: 32,
    fontWeight: "800",
    color: COLORS.primaryDark,
    marginTop: 4,
  },
  amtWords: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
    fontStyle: "italic",
    textAlign: "center",
  },
  foot: {
    marginTop: SPACING.md,
    alignItems: "center",
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  footThanks: { color: COLORS.primary, fontWeight: "800", fontSize: 14 },
  footNote: { color: COLORS.textMuted, fontSize: 11, marginTop: 4 },
  footTagline: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderStyle: "dashed" as const,
    color: COLORS.primaryDark,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
    alignSelf: "stretch",
    textAlign: "center",
  },
  footContact: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 4,
  },
  actions: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  shareBtn: {
    height: 54,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  shareTxt: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
