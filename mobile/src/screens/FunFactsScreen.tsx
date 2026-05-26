import { useState, useCallback } from "react";
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

import { colors, radii, spacing } from "../theme/tokens";
import { SectionCard } from "../components/SectionCard";
import { getRandomFact } from "../data/funFacts";
import { getYouTubeSearchUrl } from "../data/youtubeQueries";

const titleFont = Platform.select({ ios: "Georgia", android: "serif", default: undefined });

const CATEGORIES = [
  {
    title: "Plastico",
    facts: [
      "Una botella de plastico tarda 450 anios en degradarse.",
      "Reciclar 1 tonelada de plastico ahorra 2000 litros de petroleo.",
      "El 91% del plastico no se recicla globalmente.",
    ],
    query: "reciclaje plastico datos",
  },
  {
    title: "Papel y carton",
    facts: [
      "Reciclar 1 tonelada de papel salva 17 arboles.",
      "El carton reciclado usa 25% menos energia.",
      "El papel puede reciclarse hasta 7 veces antes de que las fibras sean demasiado cortas.",
    ],
    query: "reciclaje papel carton datos",
  },
  {
    title: "Vidrio",
    facts: [
      "El vidrio es 100% reciclable infinitamente.",
      "Reciclar vidrio reduce 20% la contaminacion del aire.",
      "Una botella de vidrio tarda 4000 anios en degradarse.",
    ],
    query: "reciclaje vidrio datos curiosos",
  },
  {
    title: "Organico",
    facts: [
      "Los residuos organicos son el 50% de la basura domestica.",
      "Compostar reduce 30% los residuos al vertedero.",
      "El compostaje reduce emisiones de metano significativamente.",
    ],
    query: "compostaje datos curiosos",
  },
  {
    title: "Metal",
    facts: [
      "Reciclar una lata ahorra energia para 3 horas de TV.",
      "El aluminio se recicla en 60 dias.",
      "Una lata de aluminio puede reciclarse infinitamente.",
    ],
    query: "reciclaje aluminio datos",
  },
  {
    title: "Pilas y electronicos",
    facts: [
      "Una pila boton contamina 600,000 litros de agua.",
      "Los electronicos contienen oro, plata y cobre reciclables.",
      "Solo el 20% de los residuos electronicos se recicla.",
    ],
    query: "reciclaje pilas electronicos datos",
  },
];

export default function FunFactsScreen() {
  const [fact, setFact] = useState(getRandomFact);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const handleNext = useCallback(() => {
    setFact(getRandomFact());
    setSelectedCategory(null);
  }, []);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerSection}>
          <Text style={styles.brand}>EcoSort</Text>
          <Text style={styles.title}>Datos curiosos</Text>
          <Text style={styles.subtitle}>Aprende datos sorprendentes sobre reciclaje y medio ambiente.</Text>
        </View>

        <View style={styles.mainCard}>
          <Text style={styles.mainCardLabel}>Sabias que...</Text>
          <Text style={styles.mainCardText}>{fact}</Text>
          <View style={styles.mainCardActions}>
            <Pressable style={styles.factButton} onPress={handleNext}>
              <Text style={styles.factButtonText}>Siguiente dato</Text>
            </Pressable>
            <Pressable
              style={styles.factLinkButton}
              onPress={() => Linking.openURL(getYouTubeSearchUrl("datos curiosos reciclaje"))}
            >
              <Text style={styles.factLinkText}>Ver videos →</Text>
            </Pressable>
          </View>
        </View>

        <SectionCard eyebrow="Categorias" title="Datos por material">
          {CATEGORIES.map((cat) => (
            <View key={cat.title}>
              <Pressable
                style={[
                  styles.categoryCard,
                  selectedCategory === cat.title && styles.categoryCardActive,
                ]}
                onPress={() => setSelectedCategory(selectedCategory === cat.title ? null : cat.title)}
              >
                <Text style={styles.categoryTitle}>{cat.title}</Text>
                <Text style={styles.categoryArrow}>{selectedCategory === cat.title ? "▲" : "▼"}</Text>
              </Pressable>
              {selectedCategory === cat.title && (
                <View style={styles.categoryFacts}>
                  {cat.facts.map((f, i) => (
                    <View key={i} style={styles.categoryFact}>
                      <Text style={styles.bulletDot}>•</Text>
                      <Text style={styles.categoryFactText}>{f}</Text>
                    </View>
                  ))}
                  <Pressable
                    style={styles.categoryLink}
                    onPress={() => Linking.openURL(getYouTubeSearchUrl(cat.query))}
                  >
                    <Text style={styles.categoryLinkText}>Ver videos sobre {cat.title.toLowerCase()} →</Text>
                  </Pressable>
                </View>
              )}
            </View>
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
  mainCard: {
    borderRadius: radii.xl, backgroundColor: "#173629", padding: spacing.xl, gap: spacing.sm,
    borderWidth: 1, borderColor: "#2A5A44",
  },
  mainCardLabel: { color: "#A3C9B3", fontWeight: "800", fontSize: 12, textTransform: "uppercase", letterSpacing: 1.5 },
  mainCardText: { color: colors.white, fontSize: 20, lineHeight: 28, fontWeight: "800", fontFamily: titleFont },
  mainCardActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  factButton: {
    flex: 1, minHeight: 48, borderRadius: radii.sm, backgroundColor: colors.leaf,
    alignItems: "center", justifyContent: "center",
  },
  factButtonText: { color: colors.white, fontWeight: "900", fontSize: 14 },
  factLinkButton: {
    flex: 1, minHeight: 48, borderRadius: radii.sm, backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
  },
  factLinkText: { color: colors.sand, fontWeight: "800", fontSize: 14 },
  categoryCard: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderRadius: radii.sm, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  categoryCardActive: { backgroundColor: "#E7F2EC", borderColor: "#D1E4D8" },
  categoryTitle: { color: colors.ink, fontWeight: "800", fontSize: 15 },
  categoryArrow: { color: colors.moss, fontSize: 12 },
  categoryFacts: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs,
    backgroundColor: "#FBFCFA", borderLeftWidth: 2, borderLeftColor: colors.moss,
    borderBottomLeftRadius: radii.sm, borderBottomRightRadius: radii.sm,
  },
  categoryFact: { flexDirection: "row", gap: spacing.xs, alignItems: "flex-start" },
  bulletDot: { color: colors.moss, fontWeight: "900", fontSize: 16, lineHeight: 20 },
  categoryFactText: { flex: 1, color: colors.ink, fontSize: 14, lineHeight: 20 },
  categoryLink: { marginTop: spacing.xs },
  categoryLinkText: { color: "#5555CC", fontWeight: "700", fontSize: 13 },
});
