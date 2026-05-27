import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import type { PredictionResponse } from "../api/client";
import { getRandomFact } from "../data/funFacts";
import {
  getSearchSuggestions,
  getSuggestionsForLabel,
  getYouTubeSearchUrl,
  type YouTubeSuggestion
} from "../data/youtubeQueries";
import { colors, spacing } from "../theme/tokens";

const titleFont = Platform.select({ ios: "Georgia", android: "serif", default: undefined });
const HERO_GRADIENT = ["#F7FAF3", "#DFF5F3", "#FFFFFF"] as const;

type Props = {
  prediction: PredictionResponse | null;
  note: string;
  onScanRequest: () => void;
};

type LearningModule = {
  title: string;
  eyebrow: string;
  detail: string;
  query: string;
  tone: string;
  accent: string;
};

type SortingGuide = {
  item: string;
  route: string;
  detail: string;
  query: string;
  tone: string;
};

const LEARNING_MODULES: LearningModule[] = [
  {
    eyebrow: "Fundamentos",
    title: "Introduccion a la contaminacion",
    detail: "Aprende por que una servilleta con grasa puede arruinar papel limpio.",
    query: "contaminacion en reciclaje wishcycling explicacion",
    tone: "#E8F8F6",
    accent: "#2AA6A0"
  },
  {
    eyebrow: "Materiales confusos",
    title: "Pilas, panales y vidrio roto",
    detail: "Tres casos donde la accion correcta cambia por seguridad, higiene o quimicos.",
    query: "como desechar pilas panales vidrio roto correctamente",
    tone: "#FFF3E5",
    accent: "#D47A53"
  },
  {
    eyebrow: "Compostaje",
    title: "Organico sin malos olores",
    detail: "Que si entra, que no entra y como empezar con restos de cocina.",
    query: "compostaje casero para principiantes residuos organicos",
    tone: "#EAF5E7",
    accent: "#5C8E52"
  }
];

const SORTING_GUIDES: SortingGuide[] = [
  {
    item: "Pilas AA",
    route: "Punto limpio",
    detail: "Guardalas secas, cubre polos sueltos y no las mezcles con reciclaje.",
    query: "punto limpio pilas AA como desechar",
    tone: "#FFF2D8"
  },
  {
    item: "Caja con grasa",
    route: "Basura o compost",
    detail: "Solo recicla la parte seca; lo grasoso contamina el carton recuperable.",
    query: "carton con grasa se recicla o basura",
    tone: "#EAF5E7"
  },
  {
    item: "Botella PET",
    route: "Reciclaje limpio",
    detail: "Vaciar, enjuagar y aplastar ayuda a recuperar mejor el material.",
    query: "botella PET como reciclar correctamente",
    tone: "#EAF3FF"
  },
  {
    item: "Panal usado",
    route: "Sanitario",
    detail: "Cerrar en una bolsa y desechar como no reciclable por higiene.",
    query: "como desechar panales usados correctamente",
    tone: "#F5ECE7"
  },
  {
    item: "Comida vegetal",
    route: "Composta",
    detail: "Cascara, fruta y poda pueden convertirse en abono si se separan bien.",
    query: "que residuos organicos van en la composta",
    tone: "#E7F7DE"
  },
  {
    item: "Vidrio roto",
    route: "Seguro primero",
    detail: "Envolver, marcar y evitar que lastime a quien recolecta.",
    query: "como desechar vidrio roto seguro",
    tone: "#E9F8F8"
  }
];

const HABIT_DAYS = [
  { day: "L", date: "05", dots: ["#122318"] },
  { day: "M", date: "06", active: true, dots: ["#2A85D0"] },
  { day: "M", date: "07", dots: [] },
  { day: "J", date: "08", dots: ["#122318"] },
  { day: "V", date: "09", dots: ["#122318", "#5C8E52"] },
  { day: "S", date: "10", dots: [] },
  { day: "D", date: "11", dots: ["#BBBBBB", "#9B2FAE"] }
];

const DEFAULT_VIDEO_IDEAS: YouTubeSuggestion[] = [
  { title: "Separar residuos en casa", query: "como separar residuos en casa reciclaje" },
  { title: "Que va al reciclaje y que no", query: "que se puede reciclar y que no ejemplos" },
  { title: "Reciclaje para principiantes", query: "reciclaje para principiantes guia practica" }
];

function percent(value?: number) {
  return `${Math.round((value ?? 0) * 100)}%`;
}

function uniqueVideos(items: YouTubeSuggestion[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.title}-${item.query}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function TipsScreen({ prediction, note, onScanRequest }: Props) {
  const [searchText, setSearchText] = useState("");
  const [quizAnswer, setQuizAnswer] = useState<"yes" | "no" | null>(null);
  const [funFact] = useState(getRandomFact);
  const introAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  const labelKey = prediction?.label_key ?? "";
  const recommendation = prediction?.recommendation;
  const hasPrediction = Boolean(prediction && recommendation);

  const introLift = introAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });
  const contentLift = contentAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  useEffect(() => {
    introAnim.setValue(0);
    contentAnim.setValue(0);
    Animated.stagger(120, [
      Animated.timing(introAnim, {
        toValue: 1,
        duration: 520,
        useNativeDriver: true
      }),
      Animated.spring(contentAnim, {
        toValue: 1,
        damping: 16,
        stiffness: 130,
        mass: 0.8,
        useNativeDriver: true
      })
    ]).start();
  }, [contentAnim, introAnim]);

  const videos = useMemo(() => {
    const manual = searchText.trim().length >= 3 ? getSearchSuggestions(searchText) : [];
    const fromPrediction = labelKey ? getSuggestionsForLabel(labelKey) : [];
    return uniqueVideos([...manual, ...fromPrediction, ...DEFAULT_VIDEO_IDEAS]).slice(0, 5);
  }, [labelKey, searchText]);

  const guideResults = useMemo(() => {
    const clean = searchText.trim().toLowerCase();
    if (!clean) return SORTING_GUIDES;
    return SORTING_GUIDES.filter((guide) => {
      const haystack = `${guide.item} ${guide.route} ${guide.detail}`.toLowerCase();
      return haystack.includes(clean) || clean.includes(guide.item.toLowerCase().split(" ")[0]);
    });
  }, [searchText]);

  const openVideo = (query: string) => {
    void Linking.openURL(getYouTubeSearchUrl(query));
  };

  const searchOrLearn = () => {
    const query = searchText.trim() || recommendation?.label_display || "reciclaje correcto";
    openVideo(query);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: introAnim, transform: [{ translateY: introLift }] }}>
          <LinearGradient colors={HERO_GRADIENT} style={styles.discoveryHero}>
            <Text style={styles.brand}>EcoSort Discovery</Text>
            <Text style={styles.title}>Aprende a separar mejor</Text>
            <Text style={styles.subtitle}>
              Busca un residuo, mira el resultado de la IA y convierte cada escaneo en una accion util.
            </Text>
            <View style={styles.heroWave} />
          </LinearGradient>
        </Animated.View>

        <Animated.View style={[styles.lookupCard, { opacity: contentAnim, transform: [{ translateY: contentLift }] }]}>
          <View style={styles.lookupHeader}>
            <View style={styles.lookupTitleBlock}>
              <Text style={styles.sectionEyebrow}>Busqueda rapida</Text>
              <Text style={styles.lookupTitle}>Que va donde?</Text>
            </View>
            <Pressable style={styles.scanMiniButton} onPress={onScanRequest}>
              <Text style={styles.scanMiniText}>CAM</Text>
            </Pressable>
          </View>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Ej. pilas AA, panal, caja grasa"
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              onSubmitEditing={searchOrLearn}
            />
            <Pressable style={styles.searchButton} onPress={searchOrLearn}>
              <Text style={styles.searchButtonText}>BUS</Text>
            </Pressable>
          </View>
        </Animated.View>

        {hasPrediction && recommendation ? (
          <Animated.View style={{ opacity: contentAnim, transform: [{ translateY: contentLift }] }}>
            <Pressable
              style={styles.predictionSpotlight}
              onPress={() => openVideo(`${recommendation.label_display} reciclaje manejo correcto`)}
            >
              <View style={styles.spotlightTop}>
                <View>
                  <Text style={styles.sectionEyebrow}>Segun tu ultimo analisis</Text>
                  <Text style={styles.spotlightTitle}>{recommendation.detected_item ?? recommendation.label_display}</Text>
                  <Text style={styles.spotlightFamily}>{recommendation.family_display ?? recommendation.waste_stream}</Text>
                </View>
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreText}>{percent(prediction?.confidence)}</Text>
                </View>
              </View>
              <Text style={styles.spotlightVerdict}>
                {recommendation.quick_verdict ?? recommendation.recyclable_condition}
              </Text>
              {note.trim() ? <Text style={styles.noteLine}>Tu descripcion: {note.trim()}</Text> : null}
            </Pressable>
          </Animated.View>
        ) : (
          <Animated.View style={[styles.emptySpotlight, { opacity: contentAnim, transform: [{ translateY: contentLift }] }]}>
            <Text style={styles.sectionEyebrow}>Listo para analizar</Text>
            <Text style={styles.emptyTitle}>Escanea con foto + descripcion</Text>
            <Text style={styles.emptyText}>La guia se personaliza cuando EcoSort detecta el residuo.</Text>
          </Animated.View>
        )}

        <View style={styles.habitPanel}>
          <View style={styles.habitHeader}>
            <Text style={styles.sectionEyebrow}>Habitos inteligentes</Text>
            <Text style={styles.habitTitle}>Tu semana EcoSort</Text>
          </View>
          <View style={styles.calendarGrid}>
            {HABIT_DAYS.map((day) => (
              <View key={`${day.day}-${day.date}`} style={[styles.calendarDay, day.active && styles.calendarDayActive]}>
                <Text style={[styles.calendarLabel, day.active && styles.calendarLabelActive]}>{day.day}</Text>
                <Text style={[styles.calendarDate, day.active && styles.calendarDateActive]}>{day.date}</Text>
                <View style={styles.dotRow}>
                  {day.dots.map((dot) => (
                    <View key={dot} style={[styles.dot, { backgroundColor: dot }]} />
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>Discovery zone</Text>
            <Text style={styles.sectionTitle}>Lecciones cortas</Text>
          </View>
          <Text style={styles.sectionHint}>Video + accion</Text>
        </View>

        <View style={styles.moduleList}>
          {LEARNING_MODULES.map((module) => (
            <Pressable
              key={module.title}
              style={[styles.moduleCard, { backgroundColor: module.tone, borderColor: module.accent }]}
              onPress={() => openVideo(module.query)}
            >
              <View style={[styles.playBadge, { backgroundColor: module.accent }]}>
                <Text style={styles.playBadgeText}>PLAY</Text>
              </View>
              <View style={styles.moduleCopy}>
                <Text style={styles.moduleEyebrow}>{module.eyebrow}</Text>
                <Text style={styles.moduleTitle}>{module.title}</Text>
                <Text style={styles.moduleDetail}>{module.detail}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>Info rapida</Text>
            <Text style={styles.sectionTitle}>Materiales que confunden</Text>
          </View>
          <Text style={styles.sectionHint}>{guideResults.length} guias</Text>
        </View>

        <View style={styles.guideGrid}>
          {guideResults.map((guide) => (
            <Pressable
              key={guide.item}
              style={[styles.guideCard, { backgroundColor: guide.tone }]}
              onPress={() => {
                setSearchText(guide.item);
                openVideo(guide.query);
              }}
            >
              <Text style={styles.guideItem}>{guide.item}</Text>
              <Text style={styles.guideRoute}>{guide.route}</Text>
              <Text style={styles.guideDetail}>{guide.detail}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.quizCard}>
          <Text style={styles.sectionEyebrow}>Mini quiz</Text>
          <Text style={styles.quizTitle}>La caja de pizza con grasa va al reciclaje?</Text>
          <View style={styles.quizOptions}>
            <Pressable
              style={[styles.quizOption, quizAnswer === "yes" && styles.quizWrong]}
              onPress={() => setQuizAnswer("yes")}
            >
              <Text style={styles.quizOptionText}>Si</Text>
            </Pressable>
            <Pressable
              style={[styles.quizOption, quizAnswer === "no" && styles.quizCorrect]}
              onPress={() => setQuizAnswer("no")}
            >
              <Text style={styles.quizOptionText}>No</Text>
            </Pressable>
          </View>
          {quizAnswer ? (
            <Text style={styles.quizFeedback}>
              {quizAnswer === "no"
                ? "Correcto: la parte grasosa contamina el papel y carton limpio."
                : "Casi: si tiene grasa, separa la parte limpia y desecha o composta lo sucio."}
            </Text>
          ) : null}
        </View>

        <Pressable style={styles.funFactCard} onPress={() => openVideo("reciclaje datos curiosos")}>
          <Text style={styles.sectionEyebrow}>Dato curioso</Text>
          <Text style={styles.funFactText}>{funFact}</Text>
          <Text style={styles.linkHint}>Ver videos relacionados</Text>
        </Pressable>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>Videos sugeridos</Text>
            <Text style={styles.sectionTitle}>Aprende segun tu caso</Text>
          </View>
        </View>

        <View style={styles.videoList}>
          {videos.map((video) => (
            <Pressable key={`${video.title}-${video.query}`} style={styles.videoCard} onPress={() => openVideo(video.query)}>
              <Text style={styles.videoTitle}>{video.title}</Text>
              <Text style={styles.linkHint}>Abrir en YouTube</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F7F2" },
  scroll: { paddingTop: 44, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.md, gap: spacing.lg },
  discoveryHero: {
    minHeight: 220,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    justifyContent: "center",
    overflow: "hidden"
  },
  heroWave: {
    position: "absolute",
    left: -30,
    right: -30,
    bottom: -42,
    height: 86,
    borderTopLeftRadius: 90,
    borderTopRightRadius: 90,
    backgroundColor: colors.white
  },
  brand: { color: colors.moss, fontSize: 13, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" },
  title: { color: colors.ink, fontSize: 36, lineHeight: 40, fontWeight: "900", fontFamily: titleFont, maxWidth: 300 },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: spacing.xs, maxWidth: 310 },
  lookupCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.sm
  },
  lookupHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  lookupTitleBlock: { flex: 1, minWidth: 0 },
  sectionEyebrow: { color: colors.moss, fontSize: 11, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" },
  lookupTitle: { color: colors.ink, fontSize: 24, lineHeight: 28, fontWeight: "900" },
  scanMiniButton: {
    minWidth: 54,
    height: 42,
    borderRadius: 8,
    backgroundColor: colors.forest,
    alignItems: "center",
    justifyContent: "center"
  },
  scanMiniText: { color: colors.white, fontSize: 12, fontWeight: "900" },
  searchRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  searchInput: {
    flex: 1,
    minHeight: 50,
    backgroundColor: "#FBFCFA",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700"
  },
  searchButton: {
    minWidth: 58,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#2AA6A0",
    alignItems: "center",
    justifyContent: "center"
  },
  searchButtonText: { color: colors.white, fontSize: 12, fontWeight: "900" },
  predictionSpotlight: {
    backgroundColor: colors.forest,
    borderRadius: 8,
    padding: spacing.md,
    gap: spacing.sm
  },
  spotlightTop: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, alignItems: "flex-start" },
  spotlightTitle: { color: colors.white, fontSize: 28, lineHeight: 32, fontWeight: "900", fontFamily: titleFont },
  spotlightFamily: { color: "#DFF5F3", fontSize: 13, fontWeight: "900", marginTop: 3 },
  scoreBadge: {
    minWidth: 66,
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: "#DFF5F3",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs
  },
  scoreText: { color: colors.forest, fontSize: 18, fontWeight: "900" },
  spotlightVerdict: { color: colors.white, fontSize: 15, lineHeight: 22, fontWeight: "800" },
  noteLine: { color: "#DFF5F3", fontSize: 12, lineHeight: 17, fontWeight: "700" },
  emptySpotlight: {
    backgroundColor: "#FFF8E7",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#EED994",
    padding: spacing.md,
    gap: spacing.xs
  },
  emptyTitle: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 20, fontWeight: "700" },
  habitPanel: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2AA6A0",
    padding: spacing.md,
    gap: spacing.sm
  },
  habitHeader: { gap: 3 },
  habitTitle: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  calendarGrid: { flexDirection: "row", justifyContent: "space-between", gap: 5 },
  calendarDay: {
    flex: 1,
    minHeight: 82,
    borderRadius: 8,
    backgroundColor: "#F7F8F5",
    alignItems: "center",
    justifyContent: "center",
    gap: 4
  },
  calendarDayActive: { backgroundColor: "#2A85D0" },
  calendarLabel: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  calendarLabelActive: { color: colors.white },
  calendarDate: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  calendarDateActive: { color: colors.white },
  dotRow: { flexDirection: "row", minHeight: 9, gap: 3, alignItems: "center", justifyContent: "center" },
  dot: { width: 7, height: 7, borderRadius: 4 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm, alignItems: "flex-end" },
  sectionTitle: { color: colors.ink, fontSize: 22, lineHeight: 26, fontWeight: "900" },
  sectionHint: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  moduleList: { gap: spacing.sm },
  moduleCard: {
    minHeight: 116,
    borderRadius: 8,
    borderWidth: 2,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  playBadge: {
    width: 68,
    height: 68,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  playBadgeText: { color: colors.white, fontSize: 11, fontWeight: "900" },
  moduleCopy: { flex: 1, minWidth: 0, gap: 3 },
  moduleEyebrow: { color: colors.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  moduleTitle: { color: colors.ink, fontSize: 19, lineHeight: 23, fontWeight: "900" },
  moduleDetail: { color: colors.muted, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  guideGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  guideCard: {
    width: "48%",
    minHeight: 138,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.sm,
    justifyContent: "space-between"
  },
  guideItem: { color: colors.ink, fontSize: 18, lineHeight: 22, fontWeight: "900" },
  guideRoute: { color: colors.moss, fontSize: 13, fontWeight: "900" },
  guideDetail: { color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: "700" },
  quizCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.sm
  },
  quizTitle: { color: colors.ink, fontSize: 19, lineHeight: 24, fontWeight: "900" },
  quizOptions: { flexDirection: "row", gap: spacing.sm },
  quizOption: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#F8FAF6",
    alignItems: "center",
    justifyContent: "center"
  },
  quizCorrect: { backgroundColor: "#E3F6E8", borderColor: "#40A86A" },
  quizWrong: { backgroundColor: "#FFF1EA", borderColor: colors.coral },
  quizOptionText: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  quizFeedback: { color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: "800" },
  funFactCard: {
    backgroundColor: "#FFF8E7",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#EED994",
    padding: spacing.md,
    gap: spacing.xs
  },
  funFactText: { color: colors.ink, fontSize: 15, lineHeight: 22, fontWeight: "800" },
  linkHint: { color: "#2A85D0", fontSize: 12, fontWeight: "900" },
  videoList: { gap: spacing.sm },
  videoCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.xs
  },
  videoTitle: { color: colors.ink, fontSize: 16, lineHeight: 21, fontWeight: "900" }
});
