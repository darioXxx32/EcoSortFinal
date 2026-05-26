import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Linking,
  NativeModules,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
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
} from "../api/client";
import { colors, radii, spacing } from "../theme/tokens";
import { getRandomFact } from "../data/funFacts";
import { getSearchSuggestions, getSuggestionsForLabel, getYouTubeSearchUrl } from "../data/youtubeQueries";

type Props = {
  onPrediction: (result: PredictionResponse, note: string) => void;
};

const titleFont = Platform.select({ ios: "Georgia", android: "serif", default: undefined });
const LAN_FALLBACK_HOSTS = ["192.168.1.14"];
const VIRTUAL_HOST_PREFIXES = ["172.23.", "172.24.", "172.25.", "172.26.", "172.27.", "172.28.", "172.29."];

const QUICK_NOTES = [
  { label: "PET limpio", text: "Botella PET limpia y vacia" },
  { label: "Jugo en lata", text: "Jugo en lata de aluminio recien comprado" },
  { label: "Panal", text: "Panales de mi hijo que ya no uso" },
  { label: "Composta", text: "Cascara de fruta para compost" },
  { label: "Caja grasa", text: "Caja de carton con grasa y restos de comida" },
  { label: "Pila", text: "Pila usada de control remoto" },
  { label: "Ropa", text: "Ropa en buen estado para donar" },
  { label: "Vidrio roto", text: "Frasco de vidrio roto y vacio" },
];

const CATEGORY_STORIES = [
  { label: "Reciclaje", detail: "material limpio y seco", tone: "#DCEEE5" },
  { label: "Composta", detail: "organicos aprovechables", tone: "#F1E9C8" },
  { label: "Punto limpio", detail: "pilas y quimicos", tone: "#FFE7D6" },
  { label: "Reuso", detail: "donar o reparar", tone: "#E7EEFF" },
];

const EDUCATION_FACTS: Record<string, string> = {
  biological: "Si es compostable, retira plasticos y mezcla restos humedos con material seco como hojas.",
  trash: "Si es sanitario, cierralo bien: no va a compost, donacion ni reciclaje seco.",
  metal: "Las latas limpias son de los materiales mas recuperables si llegan vacias.",
  plastic: "El PET limpio mejora mucho su probabilidad de recuperacion.",
  paper: "El papel con datos personales puede reciclarse, pero primero conviene romper o tachar.",
  cardboard: "El carton seco se recupera mejor si va aplastado y sin grasa.",
  battery: "Las baterias requieren punto limpio: no deben ir al contenedor comun.",
  clothes: "La prenda que aun sirve debe tener prioridad de reuso o donacion.",
  shoes: "El calzado util debe mantenerse en par y limpio para donacion.",
};

const ENCOURAGEMENT: Record<string, string> = {
  biological: "Buen movimiento: compostar convierte basura en vida para el suelo.",
  trash: "Buen criterio: separar lo sanitario protege a otras personas y al reciclaje.",
  metal: "Buen reciclaje: una lata limpia puede volver al ciclo muchas veces.",
  plastic: "Buen paso: vaciar y separar plastico evita contaminar otros materiales.",
  paper: "Buen habito: papel seco y limpio mantiene valor de recuperacion.",
  cardboard: "Buen ahorro de espacio: carton aplastado ayuda al reciclador.",
  battery: "Decision responsable: una pila fuera de basura comun evita contaminacion.",
  clothes: "Buen impacto: alargar la vida de una prenda evita residuos textiles.",
  shoes: "Buen reuso: un par completo y limpio puede servirle a alguien mas.",
};

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

function isVirtualHost(host: string): boolean {
  return VIRTUAL_HOST_PREFIXES.some((prefix) => host.startsWith(prefix));
}

function hostPriority(host: string): number {
  if (host.startsWith("192.168.")) return 0;
  if (host.startsWith("10.")) return 1;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host) && !isVirtualHost(host)) return 2;
  if (isVirtualHost(host)) return 6;
  if (host === "127.0.0.1" || host === "localhost") return 8;
  return 4;
}

function sortBackendHosts(hosts: string[]): string[] {
  return Array.from(new Set(hosts.filter(Boolean))).sort((left, right) => hostPriority(left) - hostPriority(right));
}

function inferApiUrl(): string {
  const host = sortBackendHosts([...LAN_FALLBACK_HOSTS, ...getExpoHosts()])[0] ?? "127.0.0.1";
  return normalizeApiUrl(`http://${host}:8000`);
}

function buildApiCandidates(currentUrl: string): string[] {
  const currentCandidate = normalizeApiUrl(currentUrl);
  const currentHost = extractHost(currentCandidate);
  const hostCandidates = sortBackendHosts([
    ...LAN_FALLBACK_HOSTS,
    ...getExpoHosts(),
    ...(currentHost ? [currentHost] : []),
    "127.0.0.1",
    "localhost"
  ]).map((host) => normalizeApiUrl(`http://${host}:8000`));
  return Array.from(
    new Set([
      currentCandidate,
      ...hostCandidates,
      inferApiUrl()
    ])
  );
}

function formatModeLabel(mode: string): string {
  switch (mode) {
    case "hybrid_keras":
      return "Keras";
    case "hybrid_keras_text_boost":
      return "Keras + texto";
    case "hybrid_text_boost":
      return "IA + reglas";
    case "hybrid_ai":
      return "PyTorch";
    case "semantic_heuristic":
    case "heuristic":
      return "Semantico";
    default:
      return mode || "Buscando";
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

function educationFactFor(labelKey: string) {
  return EDUCATION_FACTS[labelKey] ?? "Separar por material y condicion evita contaminar residuos recuperables.";
}

function encouragementFor(labelKey: string) {
  return ENCOURAGEMENT[labelKey] ?? "Buen paso: una decision informada mejora la separacion desde casa.";
}

function mapQueryFor(labelKey: string, recommendation?: PredictionResponse["recommendation"]): string {
  if (labelKey === "battery") return "punto limpio pilas reciclaje cerca";
  if (labelKey === "trash" && recommendation?.safety_level === "alto") return "manejo residuos sanitarios domesticos cerca";
  if (labelKey === "biological") return "compostaje comunitario cerca";
  if (recommendation?.waste_stream?.toLowerCase().includes("peligroso")) return "punto limpio residuos especiales cerca";
  return `centro de reciclaje ${recommendation?.family_display ?? recommendation?.label_display ?? "residuos"} cerca`;
}

function webQueryFor(labelKey: string, recommendation?: PredictionResponse["recommendation"]): string {
  const detected = recommendation?.detected_item ?? recommendation?.label_display ?? labelKey;
  if (labelKey === "biological") return `${detected} compostaje casero como hacerlo`;
  if (labelKey === "trash" && recommendation?.safety_level === "alto") return `${detected} manejo seguro residuo sanitario`;
  if (labelKey === "battery") return "por que las pilas no van a la basura comun";
  return `como reciclar ${detected} correctamente`;
}

export default function HomeScreen({ onPrediction }: Props) {
  const [apiUrl, setApiUrl] = useState(inferApiUrl);
  const [serverInput, setServerInput] = useState(() => inferApiUrl());
  const [note, setNote] = useState("Botella PET limpia y vacia");
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [taxonomy, setTaxonomy] = useState<TaxonomyResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState("Conectando automaticamente con EcoSort API...");
  const [errorMessage, setErrorMessage] = useState("");
  const [funFact] = useState(getRandomFact);

  const pulseAnim = useRef(new Animated.Value(0)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;
  const resultAnim = useRef(new Animated.Value(0)).current;
  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const scanTranslateY = scanAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 250] });
  const resultScale = resultAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });
  const resultLift = resultAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });

  const overview = taxonomy?.overview;
  const recommendation = result?.recommendation;
  const activeMode = formatModeLabel(health?.mode ?? result?.mode ?? "");
  const modelEpochs = health?.model?.epochs_completed;
  const primarySteps = recommendation?.preparation_steps?.length
    ? recommendation.preparation_steps
    : recommendation?.disposal_steps ?? [];
  const modalityEvidence = recommendation?.modality_evidence ?? [];
  const decisionBadges = recommendation?.decision_badges ?? [];
  const materialCues = recommendation?.material_cues ?? [];
  const youtubeSuggestions = result ? getSuggestionsForLabel(result.label_key) : [];
  const searchSuggestions = useMemo(() => getSearchSuggestions(note), [note]);
  const connectionCandidates = useMemo(() => buildApiCandidates(serverInput).slice(0, 4), [serverInput]);
  const primaryLearningQuery = youtubeSuggestions[0]?.query ?? webQueryFor(result?.label_key ?? "reciclaje", recommendation);
  const educationFact = result ? educationFactFor(result.label_key) : funFact;
  const encouragement = result ? encouragementFor(result.label_key) : "Escanea un residuo y EcoSort te dira la accion correcta.";
  const workflowSteps = [
    { label: "Foto", detail: asset ? "lista" : "pendiente", active: Boolean(asset) },
    { label: "Texto", detail: note.trim().length >= 3 ? "contexto" : "falta pista", active: note.trim().length >= 3 },
    { label: "Plan", detail: result ? "generado" : "por crear", active: Boolean(result) },
  ];
  const extraActions = result && recommendation
    ? [
        {
          title: "Video guia",
          detail: "Aprende el proceso con una busqueda lista.",
          tone: "#EAF4FF",
          action: () => Linking.openURL(getYouTubeSearchUrl(primaryLearningQuery))
        },
        {
          title: "Punto cercano",
          detail: "Busca centros o puntos limpios en Maps.",
          tone: "#EAF8E8",
          action: () => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQueryFor(result.label_key, recommendation))}`)
        },
        {
          title: "Guia rapida",
          detail: "Consulta informacion web segun este residuo.",
          tone: "#FFF5DE",
          action: () => Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(webQueryFor(result.label_key, recommendation))}`)
        },
        {
          title: "Compartir plan",
          detail: "Envia los pasos a otra persona.",
          tone: "#F1ECFF",
          action: handleSharePlan
        },
      ]
    : [];

  useEffect(() => {
    void syncBackend(apiUrl, true);
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(scanAnim, { toValue: 1, duration: 2100, easing: Easing.inOut(Easing.cubic), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [scanAnim]);

  useEffect(() => {
    resultAnim.setValue(0);
    if (result) {
      Animated.spring(resultAnim, {
        toValue: 1,
        friction: 7,
        tension: 70,
        useNativeDriver: true,
      }).start();
    }
  }, [result, resultAnim]);

  async function syncBackend(nextApiUrl: string, showStatus = true): Promise<string | null> {
    const candidates = buildApiCandidates(nextApiUrl);
    if (showStatus) setConnectionMessage("Buscando backend EcoSort en la red local...");

    for (const candidate of candidates) {
      try {
        if (showStatus) setConnectionMessage(`Probando ${candidate}...`);
        const [nextHealth, nextTaxonomy] = await Promise.all([checkHealth(candidate), fetchTaxonomy(candidate)]);
        setApiUrl(candidate);
        setServerInput(candidate);
        setHealth(nextHealth);
        setTaxonomy(nextTaxonomy);
        setConnectionMessage(
          `Conectado: ${formatModeLabel(nextHealth.mode)}${
            nextHealth.model?.epochs_completed ? `, ${nextHealth.model.epochs_completed} epocas` : ""
          } en ${candidate}.`
        );
        return candidate;
      } catch {
      }
    }

    setHealth(null);
    setTaxonomy(null);
    setConnectionMessage("No se encontro la API. Escribe la IPv4 WiFi de tu PC, por ejemplo http://192.168.1.14:8000.");
    return null;
  }

  async function handleSharePlan() {
    if (!recommendation) return;
    const steps = primarySteps.slice(0, 4).map((step, index) => `${index + 1}. ${step}`).join("\n");
    await Share.share({
      message: `EcoSort: ${recommendation.quick_verdict ?? recommendation.recommendation_title}\n\n${steps}\n\n${recommendation.impact_note ?? ""}`.trim()
    });
  }

  function handleNewScan() {
    setResult(null);
    setAsset(null);
    setErrorMessage("");
    setNote("Botella PET limpia y vacia");
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
      setErrorMessage("Agrega una descripcion corta para activar la modalidad de texto.");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      const activeUrl = health ? normalizeApiUrl(apiUrl) : await syncBackend(serverInput);
      if (!activeUrl) {
        setErrorMessage("No encontre el backend. Levanta la API y vuelve a intentar.");
        return;
      }
      const prediction = await sendPrediction(activeUrl, asset, note);
      setResult(prediction);
      onPrediction(prediction, note);
    } catch (error) {
      const normalizedUrl = normalizeApiUrl(serverInput);
      const isLoopback = normalizedUrl.includes("127.0.0.1") || normalizedUrl.includes("localhost");
      setErrorMessage(
        error instanceof Error && error.message !== "Network request failed"
          ? error.message
          : isLoopback
            ? "En celular usa la IP de tu PC, no 127.0.0.1."
            : `No se pudo llegar a ${serverInput}.`
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <LinearGradient colors={["#123B2C", "#2E6B4D"]} style={styles.heroPanel}>
          <View style={styles.heroTop}>
            <View style={styles.headerCopy}>
              <Text style={styles.brand}>{taxonomy?.app.name ?? "EcoSort"}</Text>
              <Text style={styles.title}>Escanea. Describe. Actua.</Text>
              <Text style={styles.subtitle}>Imagen + texto + reglas ambientales para decidir que hacer con cada residuo.</Text>
            </View>
            <Animated.View style={[styles.aiBadge, { transform: [{ scale: pulseScale }] }]}>
              <Text style={styles.aiBadgeValue}>AI</Text>
              <Text style={styles.aiBadgeLabel}>multi</Text>
            </Animated.View>
          </View>
          <View style={styles.heroMeter}>
            <Metric label="Vision" value={asset ? "activa" : "foto"} dark />
            <Metric label="Texto" value={note.trim().length >= 3 ? "activo" : "pista"} dark />
            <Metric label="Motor" value={activeMode} dark />
          </View>
        </LinearGradient>

        <View style={styles.workflowPanel}>
          {workflowSteps.map((step, index) => (
            <View key={step.label} style={styles.workflowItem}>
              <View style={[styles.workflowDot, step.active && styles.workflowDotActive]}>
                <Text style={[styles.workflowNumber, step.active && styles.workflowNumberActive]}>{index + 1}</Text>
              </View>
              <View style={styles.workflowCopy}>
                <Text style={styles.workflowLabel}>{step.label}</Text>
                <Text style={styles.workflowDetail}>{step.detail}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.categoryRail}>
          {CATEGORY_STORIES.map((item) => (
            <View key={item.label} style={[styles.storyCard, { backgroundColor: item.tone }]}>
              <Text style={styles.storyLabel}>{item.label}</Text>
              <Text style={styles.storyDetail}>{item.detail}</Text>
            </View>
          ))}
        </View>

        <Pressable style={styles.factBanner} onPress={() => Linking.openURL(getYouTubeSearchUrl(result ? `${recommendation?.label_display} reciclaje` : "datos curiosos reciclaje"))}>
          <Text style={styles.factIcon}>i</Text>
          <View style={styles.factCopy}>
            <Text style={styles.factLabel}>{result ? "Aprende de este caso" : "Dato curioso"}</Text>
            <Text style={styles.factText}>{educationFact}</Text>
          </View>
          <Text style={styles.factAction}>Ver</Text>
        </Pressable>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.eyebrow}>Entrada multimodal</Text>
              <Text style={styles.sectionTitle}>Analiza el residuo</Text>
            </View>
            <Text style={styles.panelHint}>2 entradas</Text>
          </View>

          <View style={styles.previewFrame}>
            {asset ? (
              <View style={styles.previewWrap}>
                <Image source={{ uri: asset.uri }} style={styles.preview} />
                <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanTranslateY }] }]} />
                <View style={styles.previewBadge}><Text style={styles.previewBadgeText}>Vision activa</Text></View>
              </View>
            ) : (
              <LinearGradient colors={["#E2F1E8", "#FFF6E4"]} style={styles.placeholder}>
                <Text style={styles.placeholderTitle}>Muestra el residuo</Text>
                <Text style={styles.placeholderText}>Toma una foto o elige una imagen. La descripcion le dira al modelo si esta limpio, sucio, lleno, sanitario o reutilizable.</Text>
              </LinearGradient>
            )}
            <View style={styles.actions}>
              <Pressable style={styles.primaryButton} onPress={() => handlePick("camera")}><Text style={styles.primaryButtonText}>Tomar foto</Text></Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => handlePick("gallery")}><Text style={styles.secondaryButtonText}>Galeria</Text></Pressable>
            </View>
          </View>

          <View style={styles.connectionPanel}>
            <View style={styles.connectionBox}>
              <View style={styles.connectionCopy}>
                <View style={styles.connectionStatusLine}>
                  <Animated.View
                    style={[
                      styles.connectionDot,
                      health ? styles.connectionDotOn : styles.connectionDotWarn,
                      !health && { opacity: pulseAnim, transform: [{ scale: pulseScale }] }
                    ]}
                  />
                  <Text style={styles.connectionTitle}>{health ? "Backend conectado" : "Backend pendiente"}</Text>
                </View>
                <Text style={styles.connectionUrl}>{normalizeApiUrl(health ? apiUrl : serverInput)}</Text>
              </View>
              <Pressable style={styles.syncButton} onPress={() => syncBackend(serverInput)}>
                <Text style={styles.syncButtonText}>Reconectar</Text>
              </Pressable>
            </View>

            <View style={styles.serverEditor}>
              <Text style={styles.fieldLabel}>URL del backend</Text>
              <TextInput
                style={styles.serverInput}
                value={serverInput}
                onChangeText={(value) => {
                  setServerInput(value);
                  setHealth(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="http://192.168.1.14:8000"
                placeholderTextColor={colors.muted}
              />
              <Text style={styles.serverHint}>Si ves 172.x.x.x, cambia a la IPv4 WiFi de tu PC.</Text>
              <View style={styles.candidateRow}>
                {connectionCandidates.map((candidate) => (
                  <Pressable
                    key={candidate}
                    style={styles.candidateChip}
                    onPress={() => {
                      setServerInput(candidate);
                      void syncBackend(candidate);
                    }}
                  >
                    <Text style={styles.candidateChipText}>{extractHost(candidate)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <Text style={styles.helper}>{connectionMessage}</Text>
          </View>

          <View style={styles.textPanel}>
            <Text style={styles.fieldLabel}>Cuentalo como usuario real</Text>
            <Text style={styles.fieldHint}>Ejemplo: material, uso anterior, si esta limpio, si es sanitario o si puede donarse.</Text>
            <View style={styles.chipRow}>
              {QUICK_NOTES.map((item) => (
                <Pressable key={item.label} style={styles.noteChip} onPress={() => setNote(item.text)}>
                  <Text style={styles.noteChipText}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.textArea}
              value={note}
              onChangeText={(value) => {
                setNote(value);
                setResult(null);
              }}
              multiline
              placeholder="Ej. jugo en lata, panales usados, cascara para composta..."
              placeholderTextColor={colors.muted}
            />
            {searchSuggestions.length > 0 && (
              <View style={styles.learnBox}>
                <Text style={styles.learnTitle}>Contenido sugerido por tu texto</Text>
                {searchSuggestions.slice(0, 3).map((suggestion) => (
                  <Pressable key={suggestion.title} style={styles.learnRow} onPress={() => Linking.openURL(getYouTubeSearchUrl(suggestion.query))}>
                    <Text style={styles.learnText}>{suggestion.title}</Text>
                    <Text style={styles.learnAction}>YouTube</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <Pressable style={[styles.analyzeButton, loading && styles.disabledButton]} onPress={handlePredict} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.analyzeButtonText}>Analizar con IA multimodal</Text>}
          </Pressable>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.eyebrow}>Decision</Text>
              <Text style={styles.sectionTitle}>{result ? "Plan inteligente" : "Esperando analisis"}</Text>
            </View>
            {result ? <Text style={styles.panelHint}>{percent(result.confidence)}</Text> : null}
          </View>

          {result && recommendation ? (
            <View style={styles.resultStack}>
              <Animated.View style={[styles.rewardPanel, { opacity: resultAnim, transform: [{ scale: resultScale }] }]}>
                <View style={styles.rewardOrb}>
                  <Text style={styles.rewardOrbText}>OK</Text>
                </View>
                <View style={styles.rewardCopy}>
                  <Text style={styles.rewardTitle}>Accion ambiental sugerida</Text>
                  <Text style={styles.rewardText}>{encouragement}</Text>
                </View>
              </Animated.View>

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
                {decisionBadges.map((badge) => <Badge key={badge} text={badge} />)}
              </View>

              <View style={styles.decisionGrid}>
                <Metric label="Reciclable" value={recommendation.recyclable ? "Si" : "No"} />
                <Metric label="Ruta" value={recommendation.bin_color} />
                <Metric label="Seguridad" value={safetyLabel(recommendation.safety_level)} />
              </View>

              <View style={styles.evidencePanel}>
                <Text style={styles.actionTitle}>Evidencia multimodal</Text>
                {modalityEvidence.map((item) => (
                  <View key={item.source} style={styles.evidenceRow}>
                    <Text style={styles.evidenceSource}>{item.source}</Text>
                    <View style={styles.evidenceCopy}>
                      <Text style={styles.evidenceSignal}>{item.signal}</Text>
                      <Text style={styles.helperDark}>{item.detail}</Text>
                    </View>
                  </View>
                ))}
                <Text style={styles.confidenceText}>{recommendation.confidence_explanation}</Text>
              </View>

              {materialCues.length ? (
                <View style={styles.chipRow}>{materialCues.map((cue) => <Badge key={cue} text={cue} light />)}</View>
              ) : null}

              <View style={styles.planPanel}>
                <Text style={styles.actionTitle}>Haz esto ahora</Text>
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
                  <View style={styles.chipRow}>{recommendation.useful_options.map((option) => <Badge key={option} text={option} light />)}</View>
                </View>
              ) : null}

              <View style={styles.extraPanel}>
                <View style={styles.extraHeader}>
                  <View>
                    <Text style={styles.actionTitle}>Opciones extra</Text>
                    <Text style={styles.helperDark}>Elige que hacer despues del diagnostico.</Text>
                  </View>
                  <Pressable style={styles.newScanButton} onPress={handleNewScan}>
                    <Text style={styles.newScanText}>Nuevo</Text>
                  </Pressable>
                </View>
                <View style={styles.extraGrid}>
                  {extraActions.map((item) => (
                    <Animated.View key={item.title} style={[styles.extraCardWrap, { opacity: resultAnim, transform: [{ translateY: resultLift }] }]}>
                      <Pressable style={[styles.extraCard, { backgroundColor: item.tone }]} onPress={() => void item.action()}>
                        <Text style={styles.extraTitle}>{item.title}</Text>
                        <Text style={styles.extraDetail}>{item.detail}</Text>
                      </Pressable>
                    </Animated.View>
                  ))}
                </View>
              </View>

              <View style={styles.learnBox}>
                <Text style={styles.learnTitle}>Informacion relacionada</Text>
                <Text style={styles.helperDark}>{educationFact}</Text>
                {youtubeSuggestions.slice(0, 4).map((suggestion) => (
                  <Pressable key={suggestion.title} style={styles.learnRow} onPress={() => Linking.openURL(getYouTubeSearchUrl(suggestion.query))}>
                    <Text style={styles.learnText}>{suggestion.title}</Text>
                    <Text style={styles.learnAction}>Ver video</Text>
                  </Pressable>
                ))}
              </View>

              {recommendation.avoid?.length ? (
                <View style={styles.warningPanel}>
                  <Text style={styles.warningTitle}>Evita</Text>
                  {recommendation.avoid.map((item) => <Text key={item} style={styles.warningText}>- {item}</Text>)}
                </View>
              ) : null}

              <View style={styles.summaryPanel}>
                <Text style={styles.actionTitle}>Por que EcoSort decide asi</Text>
                <Text style={styles.helperDark}>{recommendation.smart_reason ?? recommendation.decision_summary}</Text>
              </View>

              {recommendation.alternatives?.length ? (
                <View style={styles.altPanel}>
                  <Text style={styles.actionTitle}>Alternativas cercanas</Text>
                  <View style={styles.chipRow}>
                    {recommendation.alternatives.slice(0, 3).map((item) => (
                      <Badge key={item.label_key} text={`${item.label_display}: ${percent(item.score)}`} light />
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No es un formulario: es una decision guiada.</Text>
              <Text style={styles.helperDark}>Sube foto + descripcion y EcoSort mostrara ruta, evidencia, pasos, riesgos y material educativo.</Text>
            </View>
          )}
        </View>

        <View style={styles.coveragePanel}>
          <Metric label="Clases" value={`${overview?.base_label_count ?? 12}`} />
          <Metric label="Objetos" value={`${overview?.supported_item_count ?? 562}`} />
          <Metric label="Epocas" value={`${modelEpochs ?? "-"}`} />
          <Metric label="Modo" value={activeMode} />
        </View>
      </ScrollView>
    </View>
  );
}

function Badge({ text, light = false }: { text: string; light?: boolean }) {
  return (
    <View style={[styles.badge, light && styles.badgeLight]}>
      <Text style={[styles.badgeText, light && styles.badgeTextLight]}>{text}</Text>
    </View>
  );
}

function Metric({ label, value, dark = false }: { label: string; value: string; dark?: boolean }) {
  return (
    <View style={[styles.metric, dark && styles.metricDark]}>
      <Text style={[styles.metricLabel, dark && styles.metricLabelDark]}>{label}</Text>
      <Text style={[styles.metricValue, dark && styles.metricValueDark]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F7F1" },
  scroll: { paddingTop: 48, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.md, gap: spacing.md },
  heroPanel: { borderRadius: 8, padding: spacing.md, gap: spacing.md },
  heroTop: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  headerCopy: { flex: 1, gap: 8 },
  brand: { color: "#CFE8D5", fontSize: 12, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" },
  title: { color: colors.white, fontSize: 34, lineHeight: 38, fontWeight: "900", fontFamily: titleFont },
  subtitle: { color: "#E4F1E6", fontSize: 15, lineHeight: 22 },
  aiBadge: { width: 78, minHeight: 78, borderRadius: 8, backgroundColor: "#F5F0D8", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#DDEBCF" },
  aiBadgeValue: { color: colors.forest, fontSize: 24, fontWeight: "900" },
  aiBadgeLabel: { color: colors.moss, fontSize: 11, fontWeight: "900" },
  heroMeter: { flexDirection: "row", gap: spacing.sm },
  workflowPanel: { flexDirection: "row", gap: spacing.sm },
  workflowItem: { flex: 1, minHeight: 70, backgroundColor: colors.white, borderRadius: 8, borderWidth: 1, borderColor: colors.line, padding: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  workflowDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#EEF0EA", alignItems: "center", justifyContent: "center" },
  workflowDotActive: { backgroundColor: colors.forest },
  workflowNumber: { color: colors.muted, fontWeight: "900", fontSize: 12 },
  workflowNumberActive: { color: colors.white },
  workflowCopy: { flex: 1 },
  workflowLabel: { color: colors.ink, fontWeight: "900", fontSize: 13 },
  workflowDetail: { color: colors.muted, fontWeight: "700", fontSize: 11 },
  categoryRail: { flexDirection: "row", gap: spacing.sm },
  storyCard: { flex: 1, minHeight: 86, borderRadius: 8, padding: spacing.sm, borderWidth: 1, borderColor: colors.line },
  storyLabel: { color: colors.ink, fontWeight: "900", fontSize: 13 },
  storyDetail: { color: colors.muted, fontWeight: "700", fontSize: 11, lineHeight: 15, marginTop: 5 },
  factBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "#FFF8E7", borderWidth: 1, borderColor: "#EED994", borderRadius: 8, padding: spacing.sm },
  factIcon: { width: 28, height: 28, borderRadius: 14, textAlign: "center", lineHeight: 28, backgroundColor: "#F0D987", color: "#6C4C00", fontWeight: "900" },
  factCopy: { flex: 1, gap: 3 },
  factLabel: { color: "#7A5A0A", fontWeight: "900", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.7 },
  factText: { color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  factAction: { color: "#7A5A0A", fontWeight: "900", fontSize: 12 },
  panel: { backgroundColor: colors.white, borderRadius: 8, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: spacing.md },
  panelHeader: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm, alignItems: "flex-start" },
  eyebrow: { color: colors.moss, fontWeight: "900", fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase" },
  sectionTitle: { color: colors.ink, fontSize: 25, lineHeight: 30, fontWeight: "900", fontFamily: titleFont },
  panelHint: { color: colors.moss, fontWeight: "900", backgroundColor: colors.mist, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, overflow: "hidden" },
  previewFrame: { gap: spacing.sm },
  previewWrap: { height: 286, borderRadius: 8, overflow: "hidden", backgroundColor: colors.mist },
  preview: { width: "100%", height: "100%" },
  scanLine: { position: "absolute", left: 14, right: 14, height: 3, backgroundColor: "#BDF3CE", borderRadius: 3, opacity: 0.85 },
  previewBadge: { position: "absolute", left: 12, top: 12, backgroundColor: "rgba(18,59,44,0.88)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  previewBadgeText: { color: colors.white, fontWeight: "900", fontSize: 12 },
  placeholder: { minHeight: 260, borderRadius: 8, padding: spacing.lg, justifyContent: "center", borderWidth: 1, borderColor: colors.line },
  placeholderTitle: { color: colors.ink, fontSize: 26, lineHeight: 31, fontWeight: "900", fontFamily: titleFont },
  placeholderText: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 8 },
  actions: { flexDirection: "row", gap: spacing.sm },
  primaryButton: { flex: 1, minHeight: 52, borderRadius: 8, backgroundColor: colors.forest, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: colors.white, fontWeight: "900", fontSize: 15 },
  secondaryButton: { flex: 1, minHeight: 52, borderRadius: 8, backgroundColor: "#EDF6F8", borderWidth: 1, borderColor: "#CDE4EA", alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { color: "#24556B", fontWeight: "900", fontSize: 15 },
  connectionPanel: { gap: spacing.sm },
  connectionBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: 8, backgroundColor: "#F8FAF6", borderWidth: 1, borderColor: colors.line, padding: spacing.sm },
  connectionCopy: { flex: 1, gap: 3 },
  connectionStatusLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  connectionDot: { width: 11, height: 11, borderRadius: 6 },
  connectionDotOn: { backgroundColor: "#2E9F63" },
  connectionDotWarn: { backgroundColor: "#D99A22" },
  connectionTitle: { color: colors.ink, fontWeight: "900" },
  connectionUrl: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  syncButton: { minHeight: 42, borderRadius: 8, backgroundColor: colors.mist, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  syncButtonText: { color: colors.moss, fontWeight: "900" },
  serverEditor: { backgroundColor: "#FAFBF8", borderRadius: 8, borderWidth: 1, borderColor: colors.line, padding: spacing.sm, gap: 8 },
  serverInput: { minHeight: 46, borderRadius: 8, borderWidth: 1, borderColor: "#D6E0D7", backgroundColor: colors.white, paddingHorizontal: 12, color: colors.ink, fontWeight: "800" },
  serverHint: { color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: "700" },
  candidateRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  candidateChip: { borderRadius: 999, backgroundColor: "#EEF6EA", borderWidth: 1, borderColor: "#D3E5CF", paddingHorizontal: 10, paddingVertical: 7 },
  candidateChipText: { color: colors.moss, fontSize: 11, fontWeight: "900" },
  helper: { color: colors.muted, lineHeight: 20 },
  helperDark: { color: colors.ink, lineHeight: 21, fontWeight: "600" },
  textPanel: { gap: spacing.sm },
  fieldLabel: { color: colors.ink, fontWeight: "900", fontSize: 16 },
  fieldHint: { color: colors.muted, lineHeight: 19, fontWeight: "600" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  noteChip: { borderRadius: 999, backgroundColor: "#E7F2EC", borderWidth: 1, borderColor: "#D1E4D8", paddingHorizontal: 11, paddingVertical: 8 },
  noteChipText: { color: colors.forest, fontWeight: "800", fontSize: 12 },
  textArea: { minHeight: 104, textAlignVertical: "top", backgroundColor: "#FBFCFA", borderRadius: 8, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 16, color: colors.ink },
  analyzeButton: { minHeight: 56, borderRadius: 8, backgroundColor: colors.moss, alignItems: "center", justifyContent: "center" },
  disabledButton: { opacity: 0.72 },
  analyzeButtonText: { color: colors.white, fontWeight: "900", fontSize: 16 },
  errorText: { color: colors.danger, fontWeight: "800" },
  resultStack: { gap: spacing.sm },
  rewardPanel: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "#123B2C", borderRadius: 8, padding: spacing.md },
  rewardOrb: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#CFE8D5", alignItems: "center", justifyContent: "center" },
  rewardOrbText: { color: colors.forest, fontWeight: "900", fontSize: 13 },
  rewardCopy: { flex: 1, gap: 3 },
  rewardTitle: { color: "#CFE8D5", fontWeight: "900", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.7 },
  rewardText: { color: colors.white, fontWeight: "800", lineHeight: 20 },
  resultHero: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start", backgroundColor: "#F8FAF6", borderRadius: 8, borderWidth: 1, borderColor: colors.line, padding: spacing.md },
  resultCopy: { flex: 1 },
  resultLabel: { color: colors.muted, fontWeight: "900", fontSize: 12, textTransform: "uppercase" },
  resultTitle: { color: colors.ink, fontSize: 30, lineHeight: 34, fontWeight: "900", fontFamily: titleFont },
  resultFamily: { color: colors.moss, fontWeight: "900", marginTop: 4 },
  confidenceBadge: { minWidth: 86, borderRadius: 8, backgroundColor: colors.forest, padding: spacing.sm, alignItems: "center" },
  confidenceValue: { color: colors.white, fontSize: 22, fontWeight: "900" },
  confidenceLabel: { color: colors.sand, fontWeight: "900", fontSize: 12 },
  verdictPanel: { backgroundColor: "#E5F6EA", borderRadius: 8, borderWidth: 1, borderColor: "#B5DEC0", padding: spacing.md, gap: 7 },
  actionTitle: { color: colors.moss, fontWeight: "900", textTransform: "uppercase", fontSize: 12, letterSpacing: 0.7 },
  verdictText: { color: colors.ink, fontSize: 18, lineHeight: 24, fontWeight: "900" },
  nextAction: { color: colors.ink, lineHeight: 21, fontWeight: "700" },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  badge: { borderRadius: 999, backgroundColor: "#EDF6F8", borderWidth: 1, borderColor: "#CDE4EA", paddingHorizontal: 11, paddingVertical: 8 },
  badgeLight: { backgroundColor: "#F8FAF6", borderColor: colors.line },
  badgeText: { color: "#24556B", fontWeight: "800", fontSize: 12 },
  badgeTextLight: { color: colors.ink },
  decisionGrid: { flexDirection: "row", gap: spacing.sm },
  metric: { flex: 1, minHeight: 72, borderRadius: 8, backgroundColor: "#F8FAF6", borderWidth: 1, borderColor: colors.line, padding: spacing.sm, justifyContent: "center", gap: 4 },
  metricDark: { backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.18)" },
  metricLabel: { color: colors.muted, fontWeight: "900", fontSize: 11, textTransform: "uppercase" },
  metricLabelDark: { color: "#CFE8D5" },
  metricValue: { color: colors.ink, fontWeight: "900", fontSize: 14, lineHeight: 18 },
  metricValueDark: { color: colors.white },
  evidencePanel: { backgroundColor: "#FAFBF8", borderRadius: 8, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: spacing.sm },
  evidenceRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  evidenceSource: { width: 90, color: "#78451F", backgroundColor: "#F7EBDD", borderRadius: 8, overflow: "hidden", textAlign: "center", paddingVertical: 8, fontWeight: "900", fontSize: 12 },
  evidenceCopy: { flex: 1, gap: 2 },
  evidenceSignal: { color: colors.ink, fontWeight: "900", textTransform: "uppercase", fontSize: 12 },
  confidenceText: { color: colors.moss, lineHeight: 21, fontWeight: "900" },
  planPanel: { backgroundColor: "#FAFBF8", borderRadius: 8, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: spacing.sm },
  stepRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  stepNumber: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.ink, color: colors.white, textAlign: "center", lineHeight: 26, fontWeight: "900", fontSize: 12 },
  stepText: { flex: 1, color: colors.ink, lineHeight: 21, fontWeight: "700" },
  infoPanel: { backgroundColor: "#F7FAF2", borderRadius: 8, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: spacing.sm },
  extraPanel: { backgroundColor: "#FAFBF8", borderRadius: 8, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: spacing.sm },
  extraHeader: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm, alignItems: "flex-start" },
  newScanButton: { minHeight: 36, borderRadius: 8, backgroundColor: colors.ink, paddingHorizontal: 13, alignItems: "center", justifyContent: "center" },
  newScanText: { color: colors.white, fontWeight: "900", fontSize: 12 },
  extraGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  extraCardWrap: { width: "48%", minWidth: 136 },
  extraCard: { minHeight: 108, borderRadius: 8, borderWidth: 1, borderColor: colors.line, padding: spacing.sm, justifyContent: "space-between" },
  extraTitle: { color: colors.ink, fontWeight: "900", fontSize: 15 },
  extraDetail: { color: colors.muted, fontWeight: "700", fontSize: 12, lineHeight: 17 },
  learnBox: { backgroundColor: "#F0F0FF", borderRadius: 8, borderWidth: 1, borderColor: "#D0D0F0", padding: spacing.md, gap: spacing.sm },
  learnTitle: { color: "#5555AA", fontWeight: "900", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.7 },
  learnRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, backgroundColor: colors.white, borderRadius: 8, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.sm, paddingVertical: 10 },
  learnText: { flex: 1, color: colors.ink, fontWeight: "800", lineHeight: 18 },
  learnAction: { color: "#5555AA", fontWeight: "900", fontSize: 12 },
  warningPanel: { backgroundColor: "#FFF1DC", borderRadius: 8, borderWidth: 1, borderColor: "#E3BF81", padding: spacing.md, gap: 6 },
  warningTitle: { color: "#7A431A", fontWeight: "900", textTransform: "uppercase", fontSize: 12 },
  warningText: { color: "#7A431A", lineHeight: 20, fontWeight: "700" },
  summaryPanel: { backgroundColor: "#EDF6F8", borderRadius: 8, borderWidth: 1, borderColor: "#CDE4EA", padding: spacing.md, gap: 6 },
  altPanel: { gap: spacing.sm },
  emptyState: { backgroundColor: "#FAFBF8", borderRadius: 8, borderWidth: 1, borderColor: colors.line, padding: spacing.lg, gap: spacing.sm },
  emptyTitle: { color: colors.ink, fontSize: 22, lineHeight: 27, fontWeight: "900", fontFamily: titleFont },
  coveragePanel: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingBottom: spacing.lg },
});
