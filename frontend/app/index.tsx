import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { COLORS } from "@/src/theme";

export default function Index() {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <View style={styles.center} testID="root-loader">
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;
  if (user.role === "admin") return <Redirect href="/(admin)/dashboard" />;
  return <Redirect href="/(volunteer)/collect" />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
});
