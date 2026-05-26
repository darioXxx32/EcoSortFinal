import * as ImagePicker from "expo-image-picker";

export type PredictionResponse = {
  mode: string;
  label_key: string;
  confidence: number;
  probabilities: Record<string, number>;
  recommendation: {
    detected_item?: string;
    label_display: string;
    family_display?: string;
    waste_stream: string;
    recyclable: boolean;
    recyclable_condition: string;
    bin_color: string;
    disposal_steps: string[];
    notes: string[];
    confidence_band: string;
    matched_terms?: string[];
    decision_summary?: string;
    recommendation_title?: string;
    primary_outcome?: string;
    preparation_steps?: string[];
    useful_options?: string[];
    avoid?: string[];
    impact_note?: string;
    smart_reason?: string;
    quick_verdict?: string;
    next_best_action?: string;
    confidence_explanation?: string;
    safety_level?: string;
    decision_badges?: string[];
    material_cues?: string[];
    modality_evidence?: Array<{
      source: string;
      signal: string;
      detail: string;
    }>;
    review_required?: boolean;
    review_reason?: string;
    alternatives?: Array<{
      label_key: string;
      label_display: string;
      score: number;
    }>;
  };
};

export type TaxonomyResponse = {
  app: {
    name: string;
    tagline: string;
    elevator_pitch: string;
  };
  labels: Record<
    string,
    {
      display_name: string;
      waste_stream: string;
      recyclable: boolean;
    }
  >;
  overview: {
    base_label_count: number;
    family_count: number;
    waste_stream_count: number;
    waste_streams: string[];
    supported_item_count: number;
    recyclable_label_count: number;
    special_handling_label_count: number;
    top_labels: Array<{
      label_key: string;
      label_display: string;
      supported_object_count: number;
    }>;
  };
  supported_objects: Record<string, string[]>;
};

export type HealthResponse = {
  status: string;
  mode: string;
  model?: {
    artifact_format?: string;
    epochs_completed?: number | null;
    test_accuracy?: number | null;
    test_loss?: number | null;
  };
};

const DEFAULT_TAXONOMY_OVERVIEW: TaxonomyResponse["overview"] = {
  base_label_count: 12,
  family_count: 9,
  waste_stream_count: 9,
  waste_streams: [],
  supported_item_count: 562,
  recyclable_label_count: 9,
  special_handling_label_count: 3,
  top_labels: []
};

function getConfidenceBand(confidence: number) {
  if (confidence >= 0.8) return "alta";
  if (confidence >= 0.55) return "media";
  return "baja";
}

export function normalizeApiUrl(apiUrl: string) {
  const rawUrl = apiUrl.trim();
  const withProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `http://${rawUrl}`;
  try {
    const parsed = new URL(withProtocol);
    if (["8081", "19000", "19001", "19002"].includes(parsed.port)) {
      parsed.port = "8000";
    }
    if (!parsed.port) {
      parsed.port = "8000";
    }
    parsed.pathname = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "");
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return withProtocol.replace(/:(8081|19000|19001|19002)(\/)?$/, ":8000").replace(/\/+$/, "");
  }
}

function cleanUrl(apiUrl: string) {
  return normalizeApiUrl(apiUrl);
}

async function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function checkHealth(apiUrl: string): Promise<HealthResponse> {
  const response = await fetchWithTimeout(`${cleanUrl(apiUrl)}/health`, {}, 1800);
  if (!response.ok) {
    throw new Error("No se pudo conectar con la API.");
  }
  const payload = (await response.json()) as Partial<HealthResponse>;
  if (payload.status !== "ok" || !payload.mode) {
    throw new Error("La URL responde, pero no es la API de EcoSort.");
  }
  return payload as HealthResponse;
}

export async function fetchTaxonomy(apiUrl: string): Promise<TaxonomyResponse> {
  const response = await fetchWithTimeout(`${cleanUrl(apiUrl)}/taxonomy`, {}, 2200);
  if (!response.ok) {
    throw new Error("No se pudo cargar la taxonomia.");
  }
  const payload = (await response.json()) as Partial<TaxonomyResponse>;
  return {
    app: {
      name: payload.app?.name ?? "EcoSort",
      tagline: payload.app?.tagline ?? "Tu residuo, en el lugar correcto.",
      elevator_pitch:
        payload.app?.elevator_pitch ??
        "Sube una foto, agrega una pista corta y obten una recomendacion de desecho en segundos."
    },
    labels: payload.labels ?? {},
    overview: {
      ...DEFAULT_TAXONOMY_OVERVIEW,
      ...payload.overview,
      waste_streams: payload.overview?.waste_streams ?? DEFAULT_TAXONOMY_OVERVIEW.waste_streams,
      top_labels: payload.overview?.top_labels ?? DEFAULT_TAXONOMY_OVERVIEW.top_labels
    },
    supported_objects: payload.supported_objects ?? {}
  };
}

export async function sendPrediction(
  apiUrl: string,
  asset: ImagePicker.ImagePickerAsset,
  note: string
): Promise<PredictionResponse> {
  const formData = new FormData();
  formData.append("note", note);
  formData.append("file", {
    uri: asset.uri,
    name: asset.fileName ?? "capture.jpg",
    type: asset.mimeType ?? "image/jpeg"
  } as unknown as Blob);

  const response = await fetchWithTimeout(
    `${cleanUrl(apiUrl)}/predict`,
    {
      method: "POST",
      body: formData
    },
    60000
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "La prediccion fallo.");
  }

  const payload = (await response.json()) as Partial<PredictionResponse>;

  if (!payload.label_key || !payload.recommendation || !payload.recommendation.label_display) {
    if ("runtimeVersion" in payload || "launchAsset" in payload) {
      throw new Error("Estas conectado al servidor de Expo en 8081. EcoSort cambio automaticamente al puerto 8000; vuelve a sincronizar.");
    }
    const preview = JSON.stringify(payload).slice(0, 240);
    throw new Error(
      `La API respondio con un formato inesperado. Verifica que el backend de EcoSort este en el puerto 8000. Respuesta: ${preview}`
    );
  }

  const confidence = payload.confidence ?? 0;
  const labelKey = payload.label_key;
  const labelDisplay = payload.recommendation.label_display;

  return {
    mode: payload.mode ?? "semantic_heuristic",
    label_key: labelKey,
    confidence,
    probabilities: payload.probabilities ?? {},
    recommendation: {
      detected_item: payload.recommendation.detected_item ?? labelDisplay,
      label_display: labelDisplay,
      family_display: payload.recommendation.family_display ?? payload.recommendation.waste_stream ?? "Clasificacion pendiente",
      waste_stream: payload.recommendation.waste_stream ?? "Clasificacion pendiente",
      recyclable: payload.recommendation.recyclable ?? false,
      recyclable_condition:
        payload.recommendation.recyclable_condition ??
        "No hay suficiente detalle del backend para esta condicion.",
      bin_color: payload.recommendation.bin_color ?? "Por confirmar",
      disposal_steps:
        payload.recommendation.disposal_steps ?? [
          "Revisa el resultado en el backend o vuelve a intentar con una foto mas clara.",
          "Agrega una pista corta del material para mejorar la clasificacion."
        ],
      notes: payload.recommendation.notes ?? ["Respuesta parcial recibida desde la API."],
      confidence_band: payload.recommendation.confidence_band ?? getConfidenceBand(confidence),
      matched_terms: payload.recommendation.matched_terms ?? [],
      decision_summary:
        payload.recommendation.decision_summary ??
        "La respuesta del backend llego incompleta; se aplicaron valores de respaldo en la app.",
      recommendation_title:
        payload.recommendation.recommendation_title ?? `Plan para ${payload.recommendation.detected_item ?? labelDisplay}`,
      primary_outcome:
        payload.recommendation.primary_outcome ?? payload.recommendation.recyclable_condition,
      preparation_steps:
        payload.recommendation.preparation_steps ?? payload.recommendation.disposal_steps ?? [],
      useful_options: payload.recommendation.useful_options ?? [],
      avoid: payload.recommendation.avoid ?? [],
      impact_note: payload.recommendation.impact_note ?? payload.recommendation.recyclable_condition,
      smart_reason: payload.recommendation.smart_reason ?? payload.recommendation.decision_summary,
      quick_verdict:
        payload.recommendation.quick_verdict ??
        `${payload.recommendation.detected_item ?? labelDisplay}: revisa la accion recomendada antes de desechar.`,
      next_best_action:
        payload.recommendation.next_best_action ??
        payload.recommendation.preparation_steps?.[0] ??
        payload.recommendation.disposal_steps?.[0] ??
        "Confirma material y estado antes de depositarlo.",
      confidence_explanation:
        payload.recommendation.confidence_explanation ??
        "EcoSort combina la foto, la descripcion y reglas de manejo para estimar la mejor accion.",
      safety_level: payload.recommendation.safety_level ?? "medio",
      decision_badges:
        payload.recommendation.decision_badges ?? [
          `Confianza ${getConfidenceBand(confidence)}`,
          payload.recommendation.waste_stream ?? "Flujo por confirmar"
        ],
      material_cues: payload.recommendation.material_cues ?? [payload.recommendation.detected_item ?? labelDisplay],
      modality_evidence:
        payload.recommendation.modality_evidence ?? [
          {
            source: "Foto",
            signal: "recibida",
            detail: "La imagen se envio al backend para la clasificacion visual."
          },
          {
            source: "Descripcion",
            signal: note.trim() ? "recibida" : "pendiente",
            detail: note.trim() || "Agrega una pista corta para reforzar la decision multimodal."
          }
        ],
      review_required: payload.recommendation.review_required ?? true,
      review_reason:
        payload.recommendation.review_reason ??
        "Conviene confirmar manualmente este resultado antes de decidir el desecho.",
      alternatives: payload.recommendation.alternatives ?? []
    }
  };
}
