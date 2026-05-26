import { useMemo, useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { colors, radii, spacing } from "../theme/tokens";
import { SectionCard } from "../components/SectionCard";
import type { PredictionResponse } from "../api/client";
import { getRandomFact } from "../data/funFacts";
import {
  getSuggestionsForLabel,
  getSearchSuggestions,
  getYouTubeSearchUrl,
} from "../data/youtubeQueries";

const titleFont = Platform.select({ ios: "Georgia", android: "serif", default: undefined });

type Props = {
  prediction: PredictionResponse | null;
  note: string;
};

const GENERAL_TIPS = [
  "Separa tus residuos en organico, inorganico reciclable y no reciclable.",
  "Limpia los envases antes de reciclarlos para evitar contaminar otros materiales.",
  "Composta tus residuos organicos: cascaras, restos de comida y poda.",
  "Lleva las pilas y electronicos a centros de acopio especializados.",
  "Reduce el uso de plasticos de un solo uso: lleva tu propia bolsa y botella.",
  "Dona ropa, libros y muebles en buen estado en lugar de tirarlos.",
  "Los popotes y cubiertos de plastico no son reciclables, evitalos.",
  "El vidrio se recicla infinitamente, pero separalo por color si tu municipio lo pide.",
  "El papel con grasa o alimentos NO va al reciclaje, va a la basura o composta.",
  "Los residuos electronicos contienen materiales valiosos y toxicos: llevalos a recicladores certificados.",
];

export default function TipsScreen({ prediction, note }: Props) {
  const [searchText, setSearchText] = useState("");
  const [funFact] = useState(getRandomFact);

  const labelKey = prediction?.label_key ?? "";

  const videoSuggestions = useMemo(() => {
    if (labelKey) return getSuggestionsForLabel(labelKey);
    if (searchText.trim()) return getSearchSuggestions(searchText);
    return [];
  }, [labelKey, searchText]);

  const manualSuggestions = useMemo(() => {
    if (searchText.trim().length >= 3) {
      return getSearchSuggestions(searchText);
    }
    return [];
  }, [searchText]);

  const hasPrediction = prediction && labelKey;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerSection}>
          <Text style={styles.brand}>EcoSort</Text>
          <Text style={styles.title}>Consejos y videos</Text>
          <Text style={styles.subtitle}>Aprende mas sobre reciclaje, compostaje y reduccion de residuos.</Text>
        </View>

        <Pressable style={styles.funFactCard} onPress={() => Linking.openURL(getYouTubeSearchUrl("reciclaje datos curiosos"))}>
          <Text style={styles.funFactLabel}>Dato curioso del dia</Text>
          <Text style={styles.funFactText}>{funFact}</Text>
          <Text style={styles.funFactHint}>Toca para ver videos relacionados →</Text>
        </Pressable>

        {hasPrediction && (
          <SectionCard eyebrow="Basado en tu analisis" title={prediction.recommendation.label_display}>
            <Text style={styles.tipText}>
              Detectamos <Text style={styles.boldText}>{prediction.recommendation.detected_item ?? prediction.recommendation.label_display}</Text>.
              {prediction.recommendation.recyclable
                ? " Este material es reciclable. Sigue los pasos indicados en la pantalla de analisis."
                : " Este material no es reciclable convencional. Revisa las opciones de disposicion especial."}
            </Text>
            {prediction.recommendation.useful_options?.length ? (
              <View style={styles.tipOptions}>
                {prediction.recommendation.useful_options.map((opt, i) => (
                  <View key={i} style={styles.tipBullet}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>{opt}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </SectionCard>
        )}

        <SectionCard eyebrow="Buscar" title="Videos educativos">
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder={hasPrediction ? "Ej. composta, reciclaje plastico..." : "Busca tips de reciclaje..."}
            placeholderTextColor={colors.muted}
          />
          {manualSuggestions.length > 0 && (
            <View style={styles.videoList}>
              {manualSuggestions.map((s, i) => (
                <Pressable
                  key={i}
                  style={styles.videoCard}
                  onPress={() => Linking.openURL(getYouTubeSearchUrl(s.query))}
                >
                  <Text style={styles.videoTitle}>{s.title}</Text>
                  <Text style={styles.videoHint}>Ver en YouTube →</Text>
                </Pressable>
              ))}
            </View>
          )}
          {!searchText.trim() && videoSuggestions.length > 0 && (
            <View style={styles.videoList}>
              {videoSuggestions.map((s, i) => (
                <Pressable
                  key={i}
                  style={styles.videoCard}
                  onPress={() => Linking.openURL(getYouTubeSearchUrl(s.query))}
                >
                  <Text style={styles.videoTitle}>{s.title}</Text>
                  <Text style={styles.videoHint}>Ver en YouTube →</Text>
                </Pressable>
              ))}
            </View>
          )}
          {!searchText.trim() && !videoSuggestions.length && (
            <View>
              <Text style={styles.sectionLabel}>Consejos generales</Text>
              <View style={styles.tipList}>
                {GENERAL_TIPS.map((tip, i) => (
                  <View key={i} style={styles.tipBullet}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>{tip}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </SectionCard>

        <SectionCard eyebrow="Explora mas" title="Canales recomendados">
          {[
            { name: "Ecología Verde", query: "Ecologia Verde reciclaje" },
            { name: "Greenpeace México", query: "Greenpeace Mexico reciclaje" },
            { name: "TEDx sobre medio ambiente", query: "TEDx medio ambiente reciclaje" },
            { name: "Zero Waste España", query: "Zero Waste hogar reciclaje" },
          ].map((channel, i) => (
            <Pressable
              key={i}
              style={styles.channelCard}
              onPress={() => Linking.openURL(getYouTubeSearchUrl(channel.query))}
            >
              <Text style={styles.channelName}>{channel.name}</Text>
              <Text style={styles.channelHint}>Buscar en YouTube →</Text>
            </Pressable>
          ))}
        </SectionCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F7F2" },
  scroll: { paddingTop: 54, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.md, gap: spacing.lg },
  headerSection: { gap: 7, paddingBottom: spacing.xs },
  brand: { color: colors.moss, fontSize: 13, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" },
  title: { color: colors.ink, fontSize: 34, lineHeight: 38, fontWeight: "900", fontFamily: titleFont },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  funFactCard: {
    borderRadius: radii.md, backgroundColor: "#FFF8E7", borderWidth: 1, borderColor: "#F0D78E",
    padding: spacing.md, gap: spacing.xs,
  },
  funFactLabel: { color: "#8B6914", fontWeight: "900", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 },
  funFactText: { color: colors.ink, fontSize: 15, lineHeight: 21, fontWeight: "700" },
  funFactHint: { color: "#8B6914", fontSize: 12, fontWeight: "700", marginTop: 4 },
  tipText: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  boldText: { fontWeight: "900" },
  tipOptions: { gap: 6 },
  tipBullet: { flexDirection: "row", gap: spacing.xs, alignItems: "flex-start" },
  bulletDot: { color: colors.moss, fontWeight: "900", fontSize: 16, lineHeight: 20 },
  bulletText: { flex: 1, color: colors.ink, fontSize: 14, lineHeight: 20 },
  searchInput: {
    backgroundColor: "#FBFCFA", borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 15, color: colors.ink, minHeight: 48,
  },
  sectionLabel: { color: colors.muted, fontWeight: "800", fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  tipList: { gap: 8 },
  videoList: { gap: spacing.xs },
  videoCard: {
    borderRadius: radii.sm, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 4,
  },
  videoTitle: { color: colors.ink, fontWeight: "800", fontSize: 14, lineHeight: 18 },
  videoHint: { color: "#5555CC", fontWeight: "700", fontSize: 12 },
  channelCard: {
    borderRadius: radii.sm, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 3,
  },
  channelName: { color: colors.ink, fontWeight: "800", fontSize: 14 },
  channelHint: { color: colors.moss, fontWeight: "700", fontSize: 12 },
});
