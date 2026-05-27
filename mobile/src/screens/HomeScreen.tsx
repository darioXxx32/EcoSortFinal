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
import * as Network from "expo-network";

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
const LAN_FALLBACK_HOSTS = ["192.168.1.14", "172.23.201.242"];
const COMMON_SERVER_OCTETS = [242, 14, 1, 2, 10, 20, 50, 100, 101, 102, 150, 200, 254];
const DISCOVERY_BATCH_SIZE = 28;

const QUICK_NOTES = [
  { label: "PET limpio", text: "Botella PET limpia y vacia" },
  { label: "Jugo en lata", text: "Jugo en lata de aluminio recien comprado" },
  { label: "Panal", text: "Panales de mi hijo que ya no uso" },
  { label: "Composta", text: "Cascara de fruta para compost" },
  { label: "Caja grasa", text: "Caja de carton con grasa y restos de comida" },
  { label: "Pila", text: "Pila usada de control remoto" },
  { label: "Control viejo", text: "Son de un control antiguo" },
  { label: "Ropa", text: "Ropa en buen estado para donar" },
  { label: "Vidrio roto", text: "Frasco de vidrio roto y vacio" },
  { label: "Tetrapak", text: "Envase tetrapak de jugo ya vacio" },
  { label: "Aceite", text: "Aceite de cocina usado en una botella cerrada" },
  { label: "Medicamento", text: "Medicamentos vencidos en su caja" },
  { label: "Papel mojado", text: "Papel mojado con restos de comida" },
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

function parseIpv4(host?: string | null): number[] | null {
  if (!host) return null;
  const parts = host.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return parts;
}

function isPrivateIpv4(host?: string | null): boolean {
  const parts = parseIpv4(host);
  if (!parts) return false;
  const [first, second] = parts;
  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}

function subnetPrefix(host?: string | null): string | null {
  const parts = parseIpv4(host);
  if (!parts || !isPrivateIpv4(host)) return null;
  return `${parts[0]}.${parts[1]}.${parts[2]}.`;
}

function hostPriority(host: string): number {
  if (host.startsWith("192.168.")) return 0;
  if (host.startsWith("10.")) return 1;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return 2;
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

function buildSubnetCandidates(deviceIp?: string | null, currentUrl?: string): string[] {
  const prefix = subnetPrefix(deviceIp);
  if (!prefix) return [];
  const deviceLastOctet = parseIpv4(deviceIp)?.[3];
  const currentHost = extractHost(currentUrl);
  const preferredOctets = [
    ...(currentHost?.startsWith(prefix) ? [parseIpv4(currentHost)?.[3]] : []),
    ...LAN_FALLBACK_HOSTS.filter((host) => host.startsWith(prefix)).map((host) => parseIpv4(host)?.[3]),
    ...COMMON_SERVER_OCTETS
  ].filter((value): value is number => typeof value === "number");
  const allOctets = [
    ...preferredOctets,
    ...Array.from({ length: 254 }, (_, index) => index + 1)
  ].filter((octet) => octet !== deviceLastOctet);
  return Array.from(new Set(allOctets))
    .map((octet) => normalizeApiUrl(`http://${prefix}${octet}:8000`));
}

function buildApiCandidates(currentUrl: string, deviceIp?: string | null): string[] {
  const currentCandidate = normalizeApiUrl(currentUrl);
  const currentHost = extractHost(currentCandidate);
  const subnetCandidates = buildSubnetCandidates(deviceIp, currentUrl);
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
      ...subnetCandidates.slice(0, 16),
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

type ActionIdea = {
  title: string;
  detail: string;
  tone: string;
  kind: "youtube" | "maps" | "web" | "share" | "new-scan";
  query?: string;
};

function actionIdeasFor(labelKey: string, recommendation: PredictionResponse["recommendation"], primaryQuery: string): ActionIdea[] {
  const detected = recommendation.detected_item ?? recommendation.label_display;
  if (labelKey === "biological") {
    return [
      { title: "Compost express", detail: "Video para convertir sobras en abono.", tone: "#EAF8E8", kind: "youtube", query: primaryQuery },
      { title: "Si / No compost", detail: "Confirma que restos separar antes.", tone: "#FFF5DE", kind: "web", query: `${detected} que se puede compostar y que no` },
      { title: "Compost cercano", detail: "Busca punto o huerto comunitario.", tone: "#EAF4FF", kind: "maps", query: "compostaje comunitario cerca" },
      { title: "Nuevo residuo", detail: "Escanea otro objeto sin perder ritmo.", tone: "#F1ECFF", kind: "new-scan" },
    ];
  }
  if (labelKey === "battery") {
    return [
      { title: "Punto limpio", detail: "Encuentra acopio de pilas cercano.", tone: "#FFE7D6", kind: "maps", query: "punto limpio pilas cerca" },
      { title: "Riesgo real", detail: "Aprende por que no va a basura.", tone: "#EAF4FF", kind: "youtube", query: "por que las pilas no van a la basura" },
      { title: "Guardar seguro", detail: "Como almacenarla hasta entregarla.", tone: "#FFF5DE", kind: "web", query: "como guardar pilas usadas de forma segura" },
      { title: "Compartir", detail: "Envia el plan a tu grupo.", tone: "#F1ECFF", kind: "share" },
    ];
  }
  if (labelKey === "trash" && recommendation.safety_level === "alto") {
    return [
      { title: "Manejo seguro", detail: "Pasos para cerrar y desechar.", tone: "#FFE7D6", kind: "youtube", query: primaryQuery },
      { title: "Que evitar", detail: "Por que no se dona ni recicla.", tone: "#FFF5DE", kind: "web", query: `${detected} no reciclable manejo sanitario` },
      { title: "Ruta local", detail: "Busca manejo sanitario cercano.", tone: "#EAF4FF", kind: "maps", query: "manejo residuos sanitarios cerca" },
      { title: "Compartir", detail: "Envia advertencia y pasos.", tone: "#F1ECFF", kind: "share" },
    ];
  }
  if (labelKey === "clothes" || labelKey === "shoes") {
    return [
      { title: "Donar", detail: "Busca lugares de recepcion.", tone: "#EAF8E8", kind: "maps", query: "donar ropa zapatos cerca" },
      { title: "Reparar", detail: "Ideas para alargar su vida.", tone: "#FFF5DE", kind: "youtube", query: `${detected} reparar reutilizar donar` },
      { title: "Segunda vida", detail: "Opciones antes de botarlo.", tone: "#EAF4FF", kind: "web", query: `${detected} reutilizar donar reciclar` },
      { title: "Compartir", detail: "Pasa el plan a otra persona.", tone: "#F1ECFF", kind: "share" },
    ];
  }
  return [
    { title: "Video guia", detail: "Aprende el proceso correcto.", tone: "#EAF4FF", kind: "youtube", query: primaryQuery },
    { title: "Punto cercano", detail: "Busca reciclaje o acopio.", tone: "#EAF8E8", kind: "maps", query: mapQueryFor(labelKey, recommendation) },
    { title: "Guia rapida", detail: "Consulta informacion especifica.", tone: "#FFF5DE", kind: "web", query: webQueryFor(labelKey, recommendation) },
    { title: "Compartir plan", detail: "Envia los pasos a otra persona.", tone: "#F1ECFF", kind: "share" },
  ];
}

function signalLevel(signal: string): `${number}%` {
  const normalized = signal.toLowerCase();
  if (normalized.includes("fuerte") || normalized.includes("activa")) return "100%";
  if (normalized.includes("media") || normalized.includes("recibida")) return "72%";
  if (normalized.includes("debil") || normalized.includes("pendiente")) return "42%";
  return "58%";
}

async function readDeviceIp(): Promise<string | null> {
  try {
    const ip = await Network.getIpAddressAsync();
    return isPrivateIpv4(ip) ? ip : null;
  } catch {
    return null;
  }
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
  const [deviceIp, setDeviceIp] = useState<string | null>(null);
  const [discoveryProgress, setDiscoveryProgress] = useState("");
  const [showConnectionDetails, setShowConnectionDetails] = useState(false);
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
  const modelWarning = health && !(health.mode ?? "").includes("keras")
    ? (health.model?.hint ?? "Motor semantico activo: inicia con scripts/start_api.ps1 para usar best_model.keras.")
    : "";
  const primarySteps = recommendation?.preparation_steps?.length
    ? recommendation.preparation_steps
    : recommendation?.disposal_steps ?? [];
  const modalityEvidence = recommendation?.modality_evidence ?? [];
  const decisionBadges = recommendation?.decision_badges ?? [];
  const materialCues = recommendation?.material_cues ?? [];
  const youtubeSuggestions = result ? getSuggestionsForLabel(result.label_key) : [];
  const searchSuggestions = useMemo(() => getSearchSuggestions(note), [note]);
  const connectionCandidates = useMemo(() => buildApiCandidates(serverInput, deviceIp).slice(0, 6), [serverInput, deviceIp]);
  const primaryLearningQuery = youtubeSuggestions[0]?.query ?? webQueryFor(result?.label_key ?? "reciclaje", recommendation);
  const educationFact = result ? educationFactFor(result.label_key) : funFact;
  const encouragement = result ? encouragementFor(result.label_key) : "Escanea un residuo y EcoSort te dira la accion correcta.";
  const workflowSteps = [
    { label: "Foto", detail: asset ? "lista" : "pendiente", active: Boolean(asset) },
    { label: "Texto", detail: note.trim().length >= 3 ? "contexto" : "falta pista", active: note.trim().length >= 3 },
    { label: "Plan", detail: result ? "generado" : "por crear", active: Boolean(result) },
  ];
  const extraActions = result && recommendation ? actionIdeasFor(result.label_key, recommendation, primaryLearningQuery) : [];
  const modalityTiles = [
    { label: "Vision", detail: asset ? "imagen recibida" : "sin foto", active: Boolean(asset) },
    { label: "Texto", detail: note.trim().length >= 3 ? "descripcion activa" : "sin contexto", active: note.trim().length >= 3 },
    { label: "Reglas", detail: result ? "fusion aplicadas" : "listas", active: Boolean(result) },
  ];

  useEffect(() => {
    void syncBackend(apiUrl, true);
  }, []);

  useEffect(() => {
    void readDeviceIp().then((ip) => {
      if (ip) setDeviceIp(ip);
    });
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
    const activeDeviceIp = deviceIp ?? await readDeviceIp();
    if (activeDeviceIp && activeDeviceIp !== deviceIp) setDeviceIp(activeDeviceIp);
    const candidates = buildApiCandidates(nextApiUrl, activeDeviceIp);
    if (showStatus) setConnectionMessage("Buscando backend EcoSort en la red local...");

    for (const candidate of candidates) {
      try {
        if (showStatus) setConnectionMessage(`Probando ${candidate}...`);
        const [nextHealth, nextTaxonomy] = await Promise.all([checkHealth(candidate, 1200), fetchTaxonomy(candidate, 1600)]);
        setApiUrl(candidate);
        setServerInput(candidate);
        setHealth(nextHealth);
        setTaxonomy(nextTaxonomy);
        setShowConnectionDetails(false);
        setDiscoveryProgress(activeDeviceIp ? `Red detectada: ${activeDeviceIp}` : "");
        setConnectionMessage(
          `Conectado: ${formatModeLabel(nextHealth.mode)}${
            nextHealth.model?.epochs_completed ? `, ${nextHealth.model.epochs_completed} epocas` : ""
          } en ${candidate}.`
        );
        return candidate;
      } catch {
      }
    }

    const subnetCandidates = buildSubnetCandidates(activeDeviceIp, nextApiUrl).filter((candidate) => !candidates.includes(candidate));
    const prefix = subnetPrefix(activeDeviceIp);
    if (subnetCandidates.length && prefix) {
      for (let index = 0; index < subnetCandidates.length; index += DISCOVERY_BATCH_SIZE) {
        const batch = subnetCandidates.slice(index, index + DISCOVERY_BATCH_SIZE);
        const checked = Math.min(index + batch.length, subnetCandidates.length);
        if (showStatus) {
          setConnectionMessage(`Escaneando ${prefix}x en puerto 8000...`);
          setDiscoveryProgress(`${checked}/${subnetCandidates.length} direcciones revisadas`);
        }
        const probes = await Promise.all(
          batch.map((candidate) =>
            checkHealth(candidate, 650)
              .then((nextHealth) => ({ candidate, nextHealth }))
              .catch(() => null)
          )
        );
        const found = probes.find((probe): probe is { candidate: string; nextHealth: HealthResponse } => Boolean(probe));
        if (found) {
          try {
            const nextTaxonomy = await fetchTaxonomy(found.candidate, 2400);
            setApiUrl(found.candidate);
            setServerInput(found.candidate);
            setHealth(found.nextHealth);
            setTaxonomy(nextTaxonomy);
            setShowConnectionDetails(false);
            setDiscoveryProgress(`Servidor encontrado desde ${activeDeviceIp}`);
            setConnectionMessage(
              `Conectado: ${formatModeLabel(found.nextHealth.mode)}${
                found.nextHealth.model?.epochs_completed ? `, ${found.nextHealth.model.epochs_completed} epocas` : ""
              } en ${found.candidate}.`
            );
            return found.candidate;
          } catch {
          }
        }
      }
    }

    setHealth(null);
    setTaxonomy(null);
    setShowConnectionDetails(true);
    setDiscoveryProgress(activeDeviceIp ? `Celular en ${activeDeviceIp}; no encontre EcoSort en esa subred.` : "No pude leer la IP local del celular.");
    setConnectionMessage("No se encontro la API. Revisa firewall o escribe la URL que muestra scripts/start_api.ps1.");
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

  async function openActionIdea(item: ActionIdea) {
    if (item.kind === "share") {
      await handleSharePlan();
      return;
    }
    if (item.kind === "new-scan") {
      handleNewScan();
      return;
    }
    const query = item.query ?? primaryLearningQuery;
    if (item.kind === "youtube") {
      await Linking.openURL(getYouTubeSearchUrl(query));
      return;
    }
    if (item.kind === "maps") {
      await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
      return;
    }
    await Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
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
              <Pressable
                style={styles.syncButton}
                onPress={() => health ? setShowConnectionDetails((value) => !value) : syncBackend(serverInput)}
              >
                <Text style={styles.syncButtonText}>{health ? (showConnectionDetails ? "Ocultar" : "Red") : "Reconectar"}</Text>
              </Pressable>
            </View>

            {(!health || showConnectionDetails) ? (
              <View style={styles.serverEditor}>
                <Text style={styles.fieldLabel}>URL del backend</Text>
                <TextInput
                  style={styles.serverInput}
                  value={serverInput}
                  onChangeText={(value) => {
                    setServerInput(value);
                    setHealth(null);
                    setShowConnectionDetails(true);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  placeholder="http://192.168.1.14:8000"
                  placeholderTextColor={colors.muted}
                />
                <View style={styles.lanInfoRow}>
                  <Text style={styles.serverHint}>Celular: {deviceIp ?? "detectando red..."}</Text>
                  {discoveryProgress ? <Text style={styles.serverHint}>{discoveryProgress}</Text> : null}
                </View>
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
                <Pressable style={styles.autoScanButton} onPress={() => syncBackend(serverInput)}>
                  <Text style={styles.autoScanText}>Buscar automaticamente en esta red</Text>
                </Pressable>
              </View>
            ) : null}
            <Text style={styles.helper}>{connectionMessage}</Text>
            {modelWarning ? <Text style={styles.modelWarning}>{modelWarning}</Text> : null}
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

          <View style={styles.multimodalPanel}>
            {modalityTiles.map((item, index) => (
              <Animated.View
                key={item.label}
                style={[
                  styles.modalityTile,
                  item.active && styles.modalityTileActive,
                  { opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }
                ]}
              >
                <Text style={[styles.modalityIndex, item.active && styles.modalityIndexActive]}>{index + 1}</Text>
                <Text style={[styles.modalityLabel, item.active && styles.modalityLabelActive]}>{item.label}</Text>
                <Text style={styles.modalityDetail}>{item.detail}</Text>
              </Animated.View>
            ))}
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

              <View style={styles.extraPanel}>
                <View style={styles.extraHeader}>
                  <View style={styles.extraHeaderCopy}>
                    <Text style={styles.actionTitle}>Acciones para este resultado</Text>
                    <Text style={styles.helperDark}>Opciones utiles segun lo que detecto la IA.</Text>
                  </View>
                  <Pressable style={styles.newScanButton} onPress={handleNewScan}>
                    <Text style={styles.newScanText}>Nuevo</Text>
                  </Pressable>
                </View>
                <View style={styles.extraGrid}>
                  {extraActions.map((item) => (
                    <Animated.View key={item.title} style={[styles.extraCardWrap, { opacity: resultAnim, transform: [{ translateY: resultLift }] }]}>
                      <Pressable style={[styles.extraCard, { backgroundColor: item.tone }]} onPress={() => void openActionIdea(item)}>
                        <Text style={styles.extraTitle}>{item.title}</Text>
                        <Text style={styles.extraDetail}>{item.detail}</Text>
                      </Pressable>
                    </Animated.View>
                  ))}
                </View>
              </View>

              <View style={styles.verdictPanel}>
                <Text style={styles.actionTitle}>Veredicto</Text>
                <Text style={styles.verdictText}>{recommendation.quick_verdict}</Text>
                <Text style={styles.nextAction}>{recommendation.next_best_action}</Text>
              </View>

              <View style={styles.routePanel}>
                <Text style={styles.actionTitle}>Ruta visual</Text>
                <View style={styles.routeTrack}>
                  {primarySteps.slice(0, 3).map((step, index) => (
                    <Animated.View
                      key={`${step}-route-${index}`}
                      style={[styles.routeCard, { opacity: resultAnim, transform: [{ translateY: resultLift }] }]}
                    >
                      <Text style={styles.routeNumber}>{index + 1}</Text>
                      <Text style={styles.routeText} numberOfLines={3}>{step}</Text>
                    </Animated.View>
                  ))}
                </View>
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
                      <View style={styles.evidenceMeter}>
                        <Animated.View
                          style={[
                            styles.evidenceMeterFill,
                            { width: signalLevel(item.signal), transform: [{ scaleX: resultAnim }] }
                          ]}
                        />
                      </View>
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
  lanInfoRow: { gap: 2 },
  serverHint: { color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: "700" },
  candidateRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  candidateChip: { borderRadius: 999, backgroundColor: "#EEF6EA", borderWidth: 1, borderColor: "#D3E5CF", paddingHorizontal: 10, paddingVertical: 7 },
  candidateChipText: { color: colors.moss, fontSize: 11, fontWeight: "900" },
  autoScanButton: { minHeight: 44, borderRadius: 8, backgroundColor: "#123B2C", alignItems: "center", justifyContent: "center" },
  autoScanText: { color: colors.white, fontWeight: "900", fontSize: 13 },
  helper: { color: colors.muted, lineHeight: 20 },
  helperDark: { color: colors.ink, lineHeight: 21, fontWeight: "600" },
  modelWarning: { color: "#7A431A", lineHeight: 19, fontWeight: "800", backgroundColor: "#FFF1DC", borderWidth: 1, borderColor: "#E3BF81", borderRadius: 8, padding: spacing.sm },
  textPanel: { gap: spacing.sm },
  fieldLabel: { color: colors.ink, fontWeight: "900", fontSize: 16 },
  fieldHint: { color: colors.muted, lineHeight: 19, fontWeight: "600" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  noteChip: { borderRadius: 999, backgroundColor: "#E7F2EC", borderWidth: 1, borderColor: "#D1E4D8", paddingHorizontal: 11, paddingVertical: 8 },
  noteChipText: { color: colors.forest, fontWeight: "800", fontSize: 12 },
  textArea: { minHeight: 104, textAlignVertical: "top", backgroundColor: "#FBFCFA", borderRadius: 8, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 16, color: colors.ink },
  multimodalPanel: { flexDirection: "row", gap: spacing.sm },
  modalityTile: { flex: 1, minHeight: 92, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: "#F8FAF6", padding: spacing.sm, justifyContent: "space-between" },
  modalityTileActive: { backgroundColor: "#E4F4EA", borderColor: "#B7DFC4" },
  modalityIndex: { width: 25, height: 25, borderRadius: 13, backgroundColor: "#E5E8E1", color: colors.muted, textAlign: "center", lineHeight: 25, fontWeight: "900", fontSize: 12 },
  modalityIndexActive: { backgroundColor: colors.forest, color: colors.white },
  modalityLabel: { color: colors.ink, fontWeight: "900", fontSize: 13 },
  modalityLabelActive: { color: colors.forest },
  modalityDetail: { color: colors.muted, fontWeight: "700", fontSize: 11, lineHeight: 15 },
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
  routePanel: { backgroundColor: "#F8FAF6", borderRadius: 8, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: spacing.sm },
  routeTrack: { flexDirection: "row", gap: spacing.sm },
  routeCard: { flex: 1, minHeight: 116, borderRadius: 8, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, padding: spacing.sm, gap: 8 },
  routeNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.ink, color: colors.white, textAlign: "center", lineHeight: 28, fontWeight: "900", fontSize: 12 },
  routeText: { color: colors.ink, fontSize: 12, lineHeight: 17, fontWeight: "800" },
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
  evidenceMeter: { height: 7, borderRadius: 999, backgroundColor: "#E7ECE3", overflow: "hidden", marginTop: 5 },
  evidenceMeterFill: { height: 7, borderRadius: 999, backgroundColor: "#2E6B4D" },
  confidenceText: { color: colors.moss, lineHeight: 21, fontWeight: "900" },
  planPanel: { backgroundColor: "#FAFBF8", borderRadius: 8, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: spacing.sm },
  stepRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  stepNumber: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.ink, color: colors.white, textAlign: "center", lineHeight: 26, fontWeight: "900", fontSize: 12 },
  stepText: { flex: 1, color: colors.ink, lineHeight: 21, fontWeight: "700" },
  infoPanel: { backgroundColor: "#F7FAF2", borderRadius: 8, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: spacing.sm },
  extraPanel: { backgroundColor: "#FAFBF8", borderRadius: 8, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: spacing.sm },
  extraHeader: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm, alignItems: "flex-start" },
  extraHeaderCopy: { flex: 1, minWidth: 0 },
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
