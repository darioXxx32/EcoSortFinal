import { useEffect, useRef, useState } from "react";
import { Animated, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";

import { colors, radii, spacing } from "./src/theme/tokens";
import type { PredictionResponse } from "./src/api/client";
import HomeScreen from "./src/screens/HomeScreen";
import TipsScreen from "./src/screens/TipsScreen";
import FunFactsScreen from "./src/screens/FunFactsScreen";

type Tab = "home" | "tips" | "facts";

const APP_LOGO = require("./assets/icon.png");

const TAB_ICONS: Record<Tab, string> = {
  home: "AI",
  tips: "GUIA",
  facts: "?",
};

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [lastPrediction, setLastPrediction] = useState<PredictionResponse | null>(null);
  const [lastNote, setLastNote] = useState("");
  const [showIntro, setShowIntro] = useState(true);
  const introOpacity = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.78)).current;
  const logoLift = useRef(new Animated.Value(24)).current;
  const progressScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          damping: 8,
          stiffness: 150,
          mass: 0.75,
          useNativeDriver: true
        }),
        Animated.spring(logoLift, {
          toValue: 0,
          damping: 8,
          stiffness: 150,
          mass: 0.75,
          useNativeDriver: true
        })
      ]),
      Animated.timing(progressScale, {
        toValue: 1,
        duration: 760,
        useNativeDriver: true
      })
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(introOpacity, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true
      }).start(() => setShowIntro(false));
    }, 1700);

    return () => clearTimeout(timer);
  }, [introOpacity, logoLift, logoScale, progressScale]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "home", label: "Escanear" },
    { key: "tips", label: "Discovery" },
    { key: "facts", label: "Ayuda" },
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
        {activeTab === "tips" && (
          <TipsScreen prediction={lastPrediction} note={lastNote} onScanRequest={() => setActiveTab("home")} />
        )}
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
      {showIntro ? (
        <Animated.View pointerEvents="none" style={[styles.splashLayer, { opacity: introOpacity }]}>
          <LinearGradient colors={["#F7FAF3", "#DFF5F3", "#FFFFFF"]} style={styles.splashGradient}>
            <Animated.View style={[styles.splashLogo, { transform: [{ translateY: logoLift }, { scale: logoScale }] }]}>
              <Image source={APP_LOGO} style={styles.splashLogoImage} />
            </Animated.View>
            <Text style={styles.splashName}>EcoSort</Text>
            <Text style={styles.splashTagline}>Escanea. Decide. Recicla.</Text>
            <View style={styles.splashProgressTrack}>
              <Animated.View style={[styles.splashProgress, { transform: [{ scaleX: progressScale }] }]} />
            </View>
          </LinearGradient>
        </Animated.View>
      ) : null}
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
  splashLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
  },
  splashGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  splashLogo: {
    width: 102,
    height: 102,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: colors.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  splashLogoImage: {
    width: "100%",
    height: "100%",
  },
  splashName: {
    color: colors.ink,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
    marginTop: spacing.sm,
  },
  splashTagline: {
    color: colors.moss,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800",
  },
  splashProgressTrack: {
    width: 140,
    height: 7,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#CDE4EA",
    marginTop: spacing.md,
  },
  splashProgress: {
    width: 140,
    height: 7,
    borderRadius: 999,
    backgroundColor: colors.forest,
  },
});
