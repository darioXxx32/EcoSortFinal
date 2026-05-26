import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  NativeModules,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";

import {
  checkHealth,
  fetchTaxonomy,
  normalizeApiUrl,
  sendPrediction,
  type HealthResponse,
  type PredictionResponse,
  type TaxonomyResponse
} from "./src/api/client";
import { SectionCard } from "./src/components/SectionCard";
import { colors, radii, spacing } from "./src/theme/tokens";

const titleFont = Platform.select({ ios: "Georgia", android: "serif", default: undefined });

const QUICK_NOTES = [
  { label: "PET limpio", text: "Botella PET limpia y vacia" },
  { label: "Caja seca", text: "Caja de carton seca de un pedido" },
  { label: "Papel escolar", text: "Hojas de escuela escritas con datos personales" },
  { label: "Lata", text: "Lata de aluminio vacia, con borde filoso" },
  { label: "Vidrio", text: "Frasco de vidrio limpio para guardar" },
  { label: "Organico", text: "Cascara de fruta para compost" },
  { label: "Pila", text: "Pila usada de control remoto" },
  { label: "Textil", text: "Ropa en buen estado para donar" },
  { label: "Calzado", text: "Zapatos usados que todavia sirven" },
  { label: "Con grasa", text: "Papel con grasa y restos de comida" },
  { label: "Quimico", text: "Envase plastico de producto de limpieza, vacio" },
  { label: "Sanitario", text: "Mascarilla usada" }
];

const LAN_FALLBACK_HOSTS = ["172.23.201.242", "192.168.1.14"];

function extractHost(value?: string | null): string | null {
  if (!value) return null;
  const rawValue = value.trim();
  try {
    return new URL(rawValue.includes("://") ? rawValue : `http://${rawValue}`).hostname;
  } catch {
    const match = rawValue.match(/(?:https?:\/\/)?([^/:?]+)/i);
    return match?.[1] ?? null;
  }
}

function getExpoHosts(): string[] {
  const sourceUrl = NativeModules.SourceCode?.scriptURL as string | undefined;
  const manifest = Constants.manifest as { debuggerHost?: string; packagerOpts?: { hostUri?: string } } | null;
  const expoConfig = Constants.expoConfig as { hostUri?: string } | null;
  const candidates = [
    sourceUrl,
    Constants.linkingUri,
    expoConfig?.hostUri,
    manifest?.debuggerHost,
    manifest?.packagerOpts?.hostUri
  ];
  return Array.from(
    new Set(
      candidates
        .map(extractHost)
        .filter((host): host is string => Boolean(host && host !== "localhost" && host !== "127.0.0.1"))
    )
  );
}

function inferApiUrl(): string {
  const host = getExpoHosts()[0] ?? LAN_FALLBACK_HOSTS[0] ?? "127.0.0.1";
  return normalizeApiUrl(`http://${host}:8000`);
}

function buildApiCandidates(currentUrl: string): string[] {
  const expoHostCandidates = getExpoHosts().map((host) => normalizeApiUrl(`http://${host}:8000`));
  const fallbackCandidates = LAN_FALLBACK_HOSTS.map((host) => normalizeApiUrl(`http://${host}:8000`));
  const candidates = [
    inferApiUrl(),
    ...expoHostCandidates,
    ...fallbackCandidates,
    normalizeApiUrl(currentUrl),
    normalizeApiUrl("http://127.0.0.1:8000"),
    normalizeApiUrl("http://localhost:8000")
  ];
  return Array.from(new Set(candidates));
}

function formatModeLabel(mode: string): string {
  switch (mode) {
    case "hybrid_keras":
      return "Keras multimodal";
    case "hybrid_keras_text_boost":
      return "Keras + texto";
    case "hybrid_text_boost":
      return "IA + reglas";
    case "hybrid_ai":
      return "PyTorch hibrido";
    case "semantic_heuristic":
    case "heuristic":
      return "Semantico";
    default:
      return mode || "Sin conexion";
  }
}

function percent(value?: number | null): string {
  if (typeof value !== "number") return "-";
  return `${Math.round(value * 1000) / 10}%`;
}

function safetyLabel(value?: string) {
  if (value === "alto") return "Riesgo alto";
  if (value === "medio") return "Riesgo medio";
  return "Riesgo bajo";
}

export default function App() {
  const [apiUrl, setApiUrl] = useState(inferApiUrl);
  const [note, setNote] = useState("Botella PET limpia y vacia");
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [taxonomy, setTaxonomy] = useState<TaxonomyResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState("Conectando automaticamente con EcoSort API...");
  const [errorMessage, setErrorMessage] = useState("");

  const overview = taxonomy?.overview;
  const recommendation = result?.recommendation;
  const modelAccuracy = health?.model?.test_accuracy;
  const modelEpochs = health?.model?.epochs_completed;
  const activeMode = formatModeLabel(health?.mode ?? result?.mode ?? "");

  const topAlternatives = useMemo(
    () => recommendation?.alternatives?.slice(0, 3) ?? [],
    [recommendation]
  );
  const modalityEvidence = recommendation?.modality_evidence ?? [];
  const decisionBadges = recommendation?.decision_badges ?? [];
  const materialCues = recommendation?.material_cues ?? [];
  const primarySteps = recommendation?.preparation_steps?.length
    ? recommendation.preparation_steps
    : recommendation?.disposal_steps ?? [];

  useEffect(() => {
    void syncBackend(apiUrl, true);
  }, []);

  async function syncBackend(nextApiUrl: string, showStatus = true): Promise<string | null> {
    const candidates = buildApiCandidates(nextApiUrl);
    if (showStatus) setConnectionMessage("Buscando backend EcoSort en la red local...");

    for (const candidate of candidates) {
      try {
        const [nextHealth, nextTaxonomy] = await Promise.all([
          checkHealth(candidate),
          fetchTaxonomy(candidate)
        ]);
        setApiUrl(candidate);
        setHealth(nextHealth);
        setTaxonomy(nextTaxonomy);
        setConnectionMessage(
          `Conectado: ${formatModeLabel(nextHealth.mode)}${
            nextHealth.model?.epochs_completed ? `, ${nextHealth.model.epochs_completed} epocas` : ""
          } en ${candidate}.`
        );
        return candidate;
      } catch {
        // Try the next likely backend URL.
      }
    }

    setHealth(null);
    setTaxonomy(null);
    setConnectionMessage("No se encontro la API. Inicia scripts/start_api.ps1 y reinicia Expo.");
    return null;
  }

  async function handlePick(mode: "camera" | "gallery") {
    setErrorMessage("");
    const permission =
      mode === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrorMessage("Concede permisos para usar camara o galeria.");
      return;
    }
    const response =
      mode === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.92, allowsEditing: true })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.92, allowsEditing: true });
    if (!response.canceled) {
      setAsset(response.assets[0]);
      setResult(null);
    }
  }

  async function handlePredict() {
    if (!asset) {
      setErrorMessage("Selecciona o toma una foto del residuo.");
      return;
    }
    if (note.trim().length < 3) {
      setErrorMessage("Agrega una descripcion corta para usar la modalidad de texto.");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      const activeUrl = health ? normalizeApiUrl(apiUrl) : await syncBackend(apiUrl);
      if (!activeUrl) {
        setErrorMessage("No encontre el backend. Levanta la API y vuelve a intentar.");
        return;
      }
      setResult(await sendPrediction(activeUrl, asset, note));
    } catch (error) {
      const normalizedUrl = normalizeApiUrl(apiUrl);
      const isLoopback = normalizedUrl.includes("127.0.0.1") || normalizedUrl.includes("localhost");
      setErrorMessage(
        error instanceof Error && error.message !== "Network request failed"
          ? error.message
          : isLoopback
            ? "En celular usa la IP de tu PC, no 127.0.0.1."
            : `No se pudo llegar a ${apiUrl}.`
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <RNStatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.brand}>{taxonomy?.app.name ?? "EcoSort"}</Text>
            <Text style={styles.title}>Tu residuo, en el lugar correcto.</Text>
            <Text style={styles.subtitle}>Foto + descripcion para decidir si reusar, limpiar, reciclar, compostar o llevar a punto limpio.</Text>
          </View>
          <View style={[styles.statusPill, health ? styles.statusOnline : styles.statusOffline]}>
            <View style={[styles.statusDot, health ? styles.dotOnline : styles.dotOffline]} />
            <Text style={styles.statusText}>{health ? "Online" : "Local"}</Text>
          </View>
        </View>

        <View style={styles.modelPanel}>
          <View style={styles.modelMetric}>
            <Text style={styles.metricLabel}>Motor</Text>
            <Text style={styles.metricValue}>{activeMode}</Text>
          </View>
          <View style={styles.modelMetric}>
            <Text style={styles.metricLabel}>Entrada</Text>
            <Text style={styles.metricValue}>Imagen + texto</Text>
          </View>
          <View style={styles.modelMetric}>
            <Text style={styles.metricLabel}>Test</Text>
            <Text style={styles.metricValue}>{percent(modelAccuracy)}</Text>
          </View>
        </View>

        <SectionCard eyebrow="Entrada multimodal" title="Analisis del residuo">
          <View style={styles.inputPanel}>
            {asset ? (
              <Image source={{ uri: asset.uri }} style={styles.preview} />
            ) : (
              <LinearGradient colors={["#DCEEE5", "#F8F2E0"]} style={styles.placeholder}>
                <Text style={styles.placeholderTitle}>Foto pendiente</Text>
                <Text style={styles.placeholderText}>La clasificacion visual se activa al tomar o elegir una imagen.</Text>
              </LinearGradient>
            )}
            <View style={styles.actions}>
              <Pressable style={styles.primaryButton} onPress={() => handlePick("camera")}>
                <Text style={styles.primaryButtonText}>Tomar foto</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => handlePick("gallery")}>
                <Text style={styles.secondaryButtonText}>Galeria</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.connectionBox}>
            <View style={styles.connectionCopy}>
              <Text style={styles.connectionTitle}>{health ? "Backend conectado" : "Backend pendiente"}</Text>
              <Text style={styles.connectionUrl}>{normalizeApiUrl(apiUrl)}</Text>
            </View>
            <Pressable style={styles.syncButton} onPress={() => syncBackend(apiUrl)}>
              <Text style={styles.syncButtonText}>Reconectar</Text>
            </Pressable>
          </View>
          <Text style={styles.helper}>{connectionMessage}</Text>

          <View style={styles.textPanel}>
            <Text style={styles.fieldLabel}>Descripcion breve</Text>
            <View style={styles.chipRow}>
              {QUICK_NOTES.map((item) => (
                <Pressable key={item.label} style={styles.noteChip} onPress={() => setNote(item.text)}>
                  <Text style={styles.noteChipText}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={note}
              onChangeText={setNote}
              multiline
              placeholder="Ej. botella PET limpia, carton con grasa, pila usada, ropa para donar..."
              placeholderTextColor={colors.muted}
            />
          </View>

          <Pressable
            style={[styles.analyzeButton, loading && styles.disabledButton]}
            onPress={handlePredict}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.analyzeButtonText}>Analizar con IA multimodal</Text>}
          </Pressable>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        </SectionCard>

        <SectionCard eyebrow="Decision" title={result ? "Plan de accion" : "Resultado pendiente"}>
          {result && recommendation ? (
            <View style={styles.resultStack}>
              <View style={styles.resultHero}>
                <View style={styles.resultCopy}>
                  <Text style={styles.resultLabel}>Residuo detectado</Text>
                  <Text style={styles.resultTitle}>{recommendation.detected_item ?? recommendation.label_display}</Text>
                  <Text style={styles.resultFamily}>{recommendation.family_display ?? recommendation.waste_stream}</Text>
                </View>
                <View style={styles.confidenceBadge}>
                  <Text style={styles.confidenceValue}>{percent(result.confidence)}</Text>
                  <Text style={styles.confidenceLabel}>{recommendation.confidence_band}</Text>
                </View>
              </View>

              <View style={styles.verdictPanel}>
                <Text style={styles.actionTitle}>Veredicto</Text>
                <Text style={styles.verdictText}>{recommendation.quick_verdict}</Text>
                <Text style={styles.nextAction}>{recommendation.next_best_action}</Text>
              </View>

              <View style={styles.badgeRow}>
                {decisionBadges.map((badge) => (
                  <View key={badge} style={styles.decisionBadge}>
                    <Text style={styles.decisionBadgeText}>{badge}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.decisionRow}>
                <View style={styles.decisionTile}>
                  <Text style={styles.metricLabel}>Reciclable</Text>
                  <Text style={styles.decisionValue}>{recommendation.recyclable ? "Si" : "No"}</Text>
                </View>
                <View style={styles.decisionTile}>
                  <Text style={styles.metricLabel}>Ruta</Text>
                  <Text style={styles.decisionValue}>{recommendation.bin_color}</Text>
                </View>
                <View style={styles.decisionTile}>
                  <Text style={styles.metricLabel}>Seguridad</Text>
                  <Text style={styles.decisionValue}>{safetyLabel(recommendation.safety_level)}</Text>
                </View>
              </View>

              <View style={styles.evidencePanel}>
                <Text style={styles.actionTitle}>Evidencia multimodal</Text>
                {modalityEvidence.map((item) => (
                  <View key={item.source} style={styles.evidenceRow}>
                    <View style={styles.evidenceSource}>
                      <Text style={styles.evidenceSourceText}>{item.source}</Text>
                    </View>
                    <View style={styles.evidenceCopy}>
                      <Text style={styles.evidenceSignal}>{item.signal}</Text>
                      <Text style={styles.helperDark}>{item.detail}</Text>
                    </View>
                  </View>
                ))}
                <Text style={styles.confidenceText}>{recommendation.confidence_explanation}</Text>
              </View>

              {materialCues.length ? (
                <View style={styles.cueRow}>
                  {materialCues.map((cue) => (
                    <View key={cue} style={styles.cuePill}>
                      <Text style={styles.cueText}>{cue}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.planPanel}>
                <Text style={styles.actionTitle}>Antes de depositarlo</Text>
                {primarySteps.map((step, index) => (
                  <View key={`${step}-${index}`} style={styles.stepRow}>
                    <Text style={styles.stepNumber}>{index + 1}</Text>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>

              {recommendation.useful_options?.length ? (
                <View style={styles.infoPanel}>
                  <Text style={styles.actionTitle}>Mejores opciones</Text>
                  <View style={styles.optionGrid}>
                    {recommendation.useful_options.map((option) => (
                      <View key={option} style={styles.optionPill}>
                        <Text style={styles.optionText}>{option}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {recommendation.avoid?.length ? (
                <View style={styles.warningPanel}>
                  <Text style={styles.warningTitle}>Evita</Text>
                  {recommendation.avoid.map((item) => (
                    <Text key={item} style={styles.warningText}>- {item}</Text>
                  ))}
                </View>
              ) : null}

              {recommendation.impact_note ? (
                <View style={styles.impactPanel}>
                  <Text style={styles.actionTitle}>Impacto</Text>
                  <Text style={styles.helperDark}>{recommendation.impact_note}</Text>
                </View>
              ) : null}

              {recommendation.review_required ? (
                <View style={styles.reviewBanner}>
                  <Text style={styles.reviewTitle}>Revision sugerida</Text>
                  <Text style={styles.reviewText}>{recommendation.review_reason}</Text>
                </View>
              ) : null}

              <View style={styles.summaryPanel}>
                <Text style={styles.actionTitle}>Criterio EcoSort</Text>
                <Text style={styles.helperDark}>{recommendation.smart_reason ?? recommendation.decision_summary}</Text>
              </View>

              {topAlternatives.length ? (
                <View style={styles.alternativesPanel}>
                  <Text style={styles.actionTitle}>Alternativas cercanas</Text>
                  <View style={styles.chipRow}>
                    {topAlternatives.map((item) => (
                      <View key={item.label_key} style={styles.altChip}>
                        <Text style={styles.altText}>{item.label_display}: {percent(item.score)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Lista para una demo clara.</Text>
              <Text style={styles.helperDark}>Cuando envies foto y texto, EcoSort mostrara decision, ruta, seguridad, evidencia y pasos concretos.</Text>
            </View>
          )}
        </SectionCard>

        <SectionCard eyebrow="Cobertura" title="Categorias y alcance">
          <View style={styles.coveragePanel}>
            <View style={styles.coverageMetric}>
              <Text style={styles.metricLabel}>Clases</Text>
              <Text style={styles.coverageValue}>{overview?.base_label_count ?? 12}</Text>
            </View>
            <View style={styles.coverageMetric}>
              <Text style={styles.metricLabel}>Objetos</Text>
              <Text style={styles.coverageValue}>{overview?.supported_item_count ?? 562}</Text>
            </View>
            <View style={styles.coverageMetric}>
              <Text style={styles.metricLabel}>Epocas</Text>
              <Text style={styles.coverageValue}>{modelEpochs ?? "-"}</Text>
            </View>
          </View>
          <Text style={styles.helperDark}>
            La app clasifica residuos visuales y usa la descripcion para ajustar limpieza, riesgo, reuso, privacidad y compostaje.
          </Text>
        </SectionCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F7F2" },
  scroll: { paddingTop: 54, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.md, gap: spacing.lg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.md },
  headerCopy: { flex: 1, gap: 7 },
  brand: { color: colors.moss, fontSize: 13, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" },
  title: { color: colors.ink, fontSize: 34, lineHeight: 38, fontWeight: "900", fontFamily: titleFont, maxWidth: 320 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 21, maxWidth: 330 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1 },
  statusOnline: { backgroundColor: "#E5F6EA", borderColor: "#B5DEC0" },
  statusOffline: { backgroundColor: "#FFF1DC", borderColor: "#E3BF81" },
  statusDot: { width: 8, height: 8, borderRadius: 8 },
  dotOnline: { backgroundColor: colors.success },
  dotOffline: { backgroundColor: colors.gold },
  statusText: { color: colors.ink, fontWeight: "800", fontSize: 12 },
  modelPanel: { flexDirection: "row", gap: spacing.sm },
  modelMetric: { flex: 1, minHeight: 76, borderRadius: radii.sm, backgroundColor: colors.white, padding: spacing.sm, justifyContent: "center", gap: 4, borderWidth: 1, borderColor: colors.line },
  metricLabel: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  metricValue: { color: colors.ink, fontSize: 16, lineHeight: 20, fontWeight: "900" },
  inputPanel: { borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, padding: spacing.sm, gap: spacing.sm },
  preview: { width: "100%", height: 292, borderRadius: radii.sm, backgroundColor: colors.mist },
  placeholder: { minHeight: 260, borderRadius: radii.sm, padding: spacing.lg, justifyContent: "center", borderWidth: 1, borderColor: colors.line },
  placeholderTitle: { color: colors.ink, fontSize: 24, lineHeight: 28, fontWeight: "900", fontFamily: titleFont },
  placeholderText: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 6 },
  actions: { flexDirection: "row", gap: spacing.sm },
  primaryButton: { flex: 1, minHeight: 50, borderRadius: radii.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.forest },
  primaryButtonText: { color: colors.white, fontWeight: "900" },
  secondaryButton: { flex: 1, minHeight: 50, borderRadius: radii.sm, alignItems: "center", justifyContent: "center", backgroundColor: "#EDF6F8", borderWidth: 1, borderColor: "#CDE4EA" },
  secondaryButtonText: { color: "#24556B", fontWeight: "900" },
  connectionBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radii.sm, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, padding: spacing.sm },
  connectionCopy: { flex: 1, gap: 3 },
  connectionTitle: { color: colors.ink, fontWeight: "900" },
  connectionUrl: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  syncButton: { minWidth: 82, minHeight: 42, borderRadius: radii.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.mist, borderWidth: 1, borderColor: colors.line },
  syncButtonText: { color: colors.moss, fontWeight: "900" },
  textPanel: { borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: spacing.sm },
  fieldLabel: { color: colors.ink, fontWeight: "900" },
  input: { backgroundColor: "#FBFCFA", borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 15, color: colors.ink },
  textArea: { minHeight: 96, textAlignVertical: "top" },
  helper: { color: colors.muted, lineHeight: 20 },
  helperDark: { color: colors.ink, lineHeight: 22 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  noteChip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: "#E7F2EC", borderWidth: 1, borderColor: "#D1E4D8" },
  noteChipText: { color: colors.forest, fontWeight: "800", fontSize: 12 },
  analyzeButton: { minHeight: 54, borderRadius: radii.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.moss },
  disabledButton: { opacity: 0.72 },
  analyzeButtonText: { color: colors.white, fontWeight: "900", fontSize: 16 },
  errorText: { color: colors.danger, fontWeight: "800" },
  resultStack: { gap: spacing.sm },
  resultHero: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, alignItems: "flex-start", borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, padding: spacing.md },
  resultCopy: { flex: 1 },
  resultLabel: { color: colors.muted, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  resultTitle: { color: colors.ink, fontSize: 29, lineHeight: 33, fontWeight: "900", fontFamily: titleFont },
  resultFamily: { color: colors.moss, fontSize: 15, fontWeight: "800", marginTop: 4 },
  confidenceBadge: { minWidth: 86, borderRadius: radii.sm, backgroundColor: colors.forest, padding: spacing.sm, alignItems: "center" },
  confidenceValue: { color: colors.white, fontSize: 22, fontWeight: "900" },
  confidenceLabel: { color: colors.sand, fontSize: 12, fontWeight: "800" },
  verdictPanel: { borderRadius: radii.md, padding: spacing.md, backgroundColor: "#E5F6EA", borderWidth: 1, borderColor: "#B5DEC0", gap: 7 },
  actionTitle: { color: colors.moss, fontWeight: "900", textTransform: "uppercase", fontSize: 12 },
  verdictText: { color: colors.ink, fontSize: 18, lineHeight: 24, fontWeight: "900" },
  nextAction: { color: colors.ink, lineHeight: 22, fontWeight: "700" },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  decisionBadge: { borderRadius: radii.pill, backgroundColor: "#EDF6F8", borderWidth: 1, borderColor: "#CDE4EA", paddingHorizontal: 11, paddingVertical: 8 },
  decisionBadgeText: { color: "#24556B", fontWeight: "800", fontSize: 12 },
  decisionRow: { flexDirection: "row", gap: spacing.sm },
  decisionTile: { flex: 1, minHeight: 82, borderRadius: radii.sm, backgroundColor: colors.white, padding: spacing.sm, borderWidth: 1, borderColor: colors.line, gap: 4 },
  decisionValue: { color: colors.ink, fontSize: 15, lineHeight: 20, fontWeight: "900" },
  evidencePanel: { borderRadius: radii.md, padding: spacing.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, gap: spacing.sm },
  evidenceRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  evidenceSource: { width: 88, borderRadius: radii.sm, backgroundColor: "#F7EBDD", paddingHorizontal: 10, paddingVertical: 8, alignItems: "center" },
  evidenceSourceText: { color: "#78451F", fontWeight: "900", fontSize: 12 },
  evidenceCopy: { flex: 1, gap: 2 },
  evidenceSignal: { color: colors.ink, fontWeight: "900", textTransform: "uppercase", fontSize: 12 },
  confidenceText: { color: colors.moss, lineHeight: 21, fontWeight: "800" },
  cueRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  cuePill: { borderRadius: radii.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 11, paddingVertical: 8 },
  cueText: { color: colors.ink, fontWeight: "800", fontSize: 12 },
  planPanel: { borderRadius: radii.md, padding: spacing.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, gap: spacing.sm },
  stepRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  stepNumber: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.ink, color: colors.white, textAlign: "center", lineHeight: 26, fontWeight: "900", fontSize: 12 },
  stepText: { flex: 1, color: colors.ink, lineHeight: 21, fontWeight: "700" },
  infoPanel: { borderRadius: radii.md, padding: spacing.md, backgroundColor: "#F7FAF2", borderWidth: 1, borderColor: colors.line, gap: spacing.sm },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  optionPill: { borderRadius: radii.pill, backgroundColor: "#E7F2EC", borderWidth: 1, borderColor: "#D1E4D8", paddingHorizontal: 11, paddingVertical: 8 },
  optionText: { color: colors.forest, fontWeight: "800", fontSize: 12 },
  warningPanel: { borderRadius: radii.md, padding: spacing.md, backgroundColor: "#FFF1DC", borderWidth: 1, borderColor: "#E3BF81", gap: 6 },
  warningTitle: { color: "#7A431A", fontWeight: "900", textTransform: "uppercase", fontSize: 12 },
  warningText: { color: "#7A431A", lineHeight: 20, fontWeight: "700" },
  impactPanel: { borderRadius: radii.md, padding: spacing.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, gap: 6 },
  reviewBanner: { borderRadius: radii.md, backgroundColor: "#FFF1DC", borderWidth: 1, borderColor: "#E3BF81", padding: spacing.md, gap: 4 },
  reviewTitle: { color: "#7A431A", fontWeight: "900" },
  reviewText: { color: "#7A431A", lineHeight: 20 },
  summaryPanel: { borderRadius: radii.md, padding: spacing.md, backgroundColor: "#EDF6F8", borderWidth: 1, borderColor: "#CDE4EA", gap: 6 },
  alternativesPanel: { gap: spacing.sm },
  altChip: { borderRadius: radii.pill, backgroundColor: colors.mist, paddingHorizontal: 11, paddingVertical: 8 },
  altText: { color: colors.ink, fontWeight: "800", fontSize: 12 },
  emptyState: { borderRadius: radii.md, backgroundColor: colors.white, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.line },
  emptyTitle: { color: colors.ink, fontSize: 22, lineHeight: 27, fontWeight: "900", fontFamily: titleFont },
  coveragePanel: { flexDirection: "row", gap: spacing.sm },
  coverageMetric: { flex: 1, minHeight: 76, borderRadius: radii.sm, backgroundColor: colors.white, padding: spacing.sm, borderWidth: 1, borderColor: colors.line, justifyContent: "center" },
  coverageValue: { color: colors.ink, fontSize: 22, fontWeight: "900" }
});
