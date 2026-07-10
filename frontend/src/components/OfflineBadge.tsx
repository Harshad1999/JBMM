import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADIUS, SPACING } from "@/src/theme";

type Props = {
  online: boolean;
  pending: number;
};

export default function OfflineBadge({ online, pending }: Props) {
  if (online && pending === 0) return null;
  const color = online ? COLORS.warning : COLORS.error;
  const bg = online ? "#FEF3C7" : "#FEE2E2";
  const label = !online
    ? `Offline${pending > 0 ? ` • ${pending} queued` : ""}`
    : `${pending} pending sync`;
  return (
    <View
      style={[styles.wrap, { backgroundColor: bg, borderColor: color }]}
      testID="offline-badge"
    >
      <Ionicons
        name={online ? "sync" : "cloud-offline"}
        size={14}
        color={color}
      />
      <Text style={[styles.txt, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  txt: { fontSize: 11, fontWeight: "700" },
});
