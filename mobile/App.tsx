import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { colors, radii, spacing } from "./src/theme/tokens";
import type { PredictionResponse } from "./src/api/client";
import HomeScreen from "./src/screens/HomeScreen";
import TipsScreen from "./src/screens/TipsScreen";
import FunFactsScreen from "./src/screens/FunFactsScreen";

type Tab = "home" | "tips" | "facts";

const TAB_ICONS: Record<Tab, string> = {
  home: "AI",
  tips: "VID",
  facts: "INFO",
};

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [lastPrediction, setLastPrediction] = useState<PredictionResponse | null>(null);
  const [lastNote, setLastNote] = useState("");

  const tabs: { key: Tab; label: string }[] = [
    { key: "home", label: "Analizar" },
    { key: "tips", label: "Aprender" },
    { key: "facts", label: "Datos" },
  ];

  return (
    <View style={styles.root}>
      <StatusBar style="dark" translucent={false} backgroundColor="#F4F7F1" />
      <View style={styles.content}>
        {activeTab === "home" && (
          <HomeScreen
            onPrediction={(result, note) => {
              setLastPrediction(result);
              setLastNote(note);
            }}
          />
        )}
        {activeTab === "tips" && <TipsScreen prediction={lastPrediction} note={lastNote} />}
        {activeTab === "facts" && <FunFactsScreen />}
      </View>
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>{TAB_ICONS[tab.key]}</Text>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F4F7F1" },
  content: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingBottom: Platform.OS === "ios" ? 24 : 16,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    gap: 2,
  },
  tabActive: {
    backgroundColor: colors.mist,
  },
  tabIcon: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.muted,
  },
  tabIconActive: {
    color: colors.moss,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.muted,
  },
  tabLabelActive: {
    color: colors.moss,
  },
});
