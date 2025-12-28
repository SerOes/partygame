# Gemini 3 Flash Preview (`gemini-3-flash-preview`) – Webapp-Doku (Stand: 2025‑12‑25)

> Ziel: Diese Datei ist eine **praxisnahe** Referenz, um **Gemini 3 Flash Preview** korrekt und sicher in einer Web‑App (z. B. Next.js / Node.js Backend + Browser-Frontend) einzusetzen.

---

## 1) Modell-Überblick

**Model ID:** `gemini-3-flash-preview`  
**Status:** Preview (kann sich vor “stable” ändern; ggf. restriktivere Limits / Lifecycle)  
**Stärken:** sehr schnell, starkes Reasoning für “Flash”-Klasse, sehr gutes Multimodal‑Verständnis (Input) bei Text‑Output.  
**Outputs:** **nur Text** (kein Image‑Output über dieses Modell).

### Harte Fakten (Specs)
- **Context Window:** **1,048,576** Input Tokens / **65,536** Output Tokens  
- **Knowledge Cutoff:** **Januar 2025**
- **Inputs:** Text, Code, **Images, Audio, Video, PDF** (multimodal)  
- **Outputs:** Text  
- **Feature‑Support (Gemini API):**
  - **Search grounding:** ja
  - **Structured outputs (JSON Schema):** ja
  - **Thinking:** ja (Thinking Levels)
  - **URL context:** ja
  - **Live API:** nein
  - **Image generation:** nein (dafür andere Modelle verwenden)

---

## 2) “Preview” bedeutet in der Praxis

Preview‑Modelle:
- können **Features/Verhalten ändern**, bevor sie “stable” werden,
- haben oft **restriktivere Rate Limits** als stabile Modelle,
- sind grundsätzlich **für Produktion nutzbar**, aber du solltest **Versionierung/Monitoring** ernst nehmen:
  - Modell‑ID bewusst setzen (nicht “irgendein Default”),
  - Logging für Prompt/Config/Model‑Version,
  - Fallback‑Strategie (z. B. auf `gemini-2.5-flash`).

---

## 3) Preise & Kostenkontrolle (Gemini Developer API)

> Preise ändern sich — als Referenz bitte immer die offizielle Pricing-Seite prüfen.

### Standard (Pay‑as‑you‑go)
- **Input (Text/Image/Video):** **$0.50 / 1M Tokens**
- **Input (Audio):** **$1.00 / 1M Tokens**
- **Output (inkl. Thinking Tokens):** **$3.00 / 1M Tokens**
- **Context caching:** $0.05 / 1M Tokens (Text/Image/Video), $0.10 / 1M Tokens (Audio)  
  + Storage: $1.00 / 1,000,000 Tokens pro Stunde

### Batch
- **Input:** $0.25 / 1M Tokens (Text/Image/Video), $0.50 / 1M Tokens (Audio)
- **Output:** $1.50 / 1M Tokens

### Wichtig: Grounding mit Google Search
- Für Gemini 3 ist in den Release Notes angekündigt, dass **Search‑Grounding‑Billing ab 2026‑01‑05** startet.

### Kosten-Hebel
- **Thinking Level runterdrehen** (siehe Abschnitt 6) für “Chat/FAQ/High throughput”
- **Structured Output** vermeiden, wenn nicht nötig (spart Nacharbeit, kostet aber nicht “extra”; nur Token‑Mehrverbrauch)
- **Context Caching** bei großen, wiederholten System‑Prompts / großen Dateien nutzen
- Input‑Material (Videos/PDFs) **nicht jedes Mal inline** schicken → **Files API** nutzen

---

## 4) Rate Limits / Quotas (Kurz)

Es gibt unterschiedliche Limits (RPM/TPM etc.) und Batch‑Limits. Beispiel aus der offiziellen Rate‑Limit‑Doku (Batch Enqueued Tokens):

- **Gemini 3 Flash Preview (Batch, Tier 1):** **3,000,000** enqueued tokens

> Für produktionsrelevante RPM/TPM‑Grenzen: in der “Gemini models” / Rate‑Limit‑Doku nachsehen und ggf. Paid Tier Upgrade / Increase anfragen.

---

## 5) Architektur für eine Web‑App (Best Practice)

### Empfehlung (Production)
**Frontend (Browser)** → **dein Backend (API Route / Cloud Run / Server)** → **Gemini API / Vertex AI**

Warum?
- API Key / Credentials **dürfen nicht** im Browser landen
- du kannst:
  - Rate limiting, Abuse‑Protection, Logging, Prompt‑Policies
  - per‑User Quotas / Billing‑Controls
  - Caching, Retries, Fallback‑Modelle

### Alternative (Client‑SDK im Browser)
Nur, wenn du:
- einen **client‑sicheren** Weg nutzt (z. B. Firebase AI Logic + App Check),
- genau weißt, was du tust (Abuse‑Risiko!).

---

## 6) Thinking (Thinking Levels) – richtig einsetzen

Gemini 3 ersetzt “Thinking Budgets” (2.5) durch **Thinking Levels**.

### Grundlevels
- **`low`**: geringe Latenz/Kosten, gut für einfache Anweisungen, Chat, high‑throughput
- **`high`** (Default/dynamisch): tiefere Überlegung, kann länger bis “first token” dauern

### Zusätzliche Levels (nur Gemini 3 Flash)
- **`minimal`**
- **`medium`**

**Praxis-Heuristik**
- UI‑Chat, Autocomplete, einfache Klassifikation → `minimal`/`low`
- mehrstufige Logik, komplexe Extraktion, Agent‑Orchestrierung → `medium`/`high`

> Hinweis: Output‑Preise zählen **inkl. Thinking Tokens**.

---

## 7) Gemini API vs. Vertex AI (Enterprise) – Entscheidungslogik

### Gemini Developer API (AI Studio Key)
**Gut für:** schnelle Integration, Prototyping, einfache Server‑Backends.

**Auth:** API Key (Cloud Billing für Paid Tier).  
**Endpoint (REST):** `https://generativelanguage.googleapis.com/...`

### Vertex AI (Google Cloud)
**Gut für:** Enterprise‑Compliance, IAM, Regions/Org‑Kontrolle, Observability, VPC‑Patterns.

**Wichtig:** Gemini 3 wird (zumindest in Teilen) über **Global Endpoints** bereitgestellt (siehe Vertex Doku).  
**Auth:** Service Account / ADC (IAM) – empfohlen.

---

## 8) Schnellstart mit JavaScript/TypeScript (Node/Next.js Backend)

### Installation
```bash
npm i @google/genai
```

### Minimal: Text generieren (Server‑Side)
```ts
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function generate() {
  const resp = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: "Schreibe 5 kreative Produktnamen für eine 70cm Schultüte.",
  });

  return resp.text; // plain text convenience
}
```

### Next.js Route Handler (Beispiel)
```ts
// app/api/chat/route.ts
import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function POST(req: Request) {
  const { message } = await req.json();

  const resp = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        role: "user",
        parts: [{ text: message }],
      },
    ],
    // Optional config:
    // config: { /* thinking, safety, schema ... */ }
  });

  return NextResponse.json({ text: resp.text });
}
```

### Streaming (Server‑Side)
```ts
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function streamExample() {
  const stream = await ai.models.generateContentStream({
    model: "gemini-3-flash-preview",
    contents: "Erkläre Kindern (10 Jahre) kurz, wie Umsatzsteuer funktioniert.",
  });

  let out = "";
  for await (const chunk of stream) {
    out += chunk.text ?? "";
  }
  return out;
}
```

---

## 9) REST API (Gemini Developer API) – direkt per HTTP

### generateContent (Beispiel)
```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "role": "user",
      "parts": [{"text": "Gib mir 3 kurze Slogans für personalisierte Schultüten."}]
    }]
  }'
```

> Streaming läuft typischerweise über `:streamGenerateContent` (siehe API Reference “Generating content”).

---

## 10) Multimodal Input (Bilder, PDFs, Video) – Files API + fileData

### Wann Files API nutzen?
- wenn Request‑Gesamtgröße **> 20 MB**
- wenn du dieselbe Datei **mehrmals** verwendest
- für Videos/PDFs generell oft sinnvoll

### Files API – Eckdaten
- Projekt‑Speicher: **bis 20 GB**, pro Datei **bis 2 GB**
- Files werden **48 Stunden** gespeichert (danach auto‑delete)
- Upload‑Endpoint:
  - `POST https://generativelanguage.googleapis.com/upload/v1beta/files` (Media upload)
  - `POST https://generativelanguage.googleapis.com/v1beta/files` (Metadata only)

### Upload & Nutzung (JS)
```ts
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function pdfQnA() {
  const file = await ai.files.upload({
    file: "path/to/manual.pdf",
    config: { mimeType: "application/pdf" },
  });

  const resp = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        role: "user",
        parts: [
          // file reference (URI + mimeType)
          { fileData: { fileUri: file.uri, mimeType: file.mimeType } },
          { text: "\n\nFasse die wichtigsten Punkte in 8 Bulletpoints zusammen." },
        ],
      },
    ],
  });

  return resp.text;
}
```

---

## 11) Structured Outputs (JSON Schema) – stabile, parsbare Antworten

Wenn du UI‑Komponenten, DB‑Writes, Agent‑Pipelines oder Validierung brauchst: **Structured Outputs** nutzen.

### Beispiel (Zod → JSON Schema, JS)
```ts
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const Schema = z.object({
  title: z.string(),
  bullets: z.array(z.string()).max(8),
});

export async function structured(message: string) {
  const resp = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: message,
    config: {
      responseMimeType: "application/json",
      responseSchema: zodToJsonSchema(Schema),
    },
  });

  // resp.text enthält JSON (string) – danach JSON.parse + Schema‑Validate
  return JSON.parse(resp.text);
}
```

---

## 12) Function Calling (Tools) – Actions & Data Fetch

Wenn die Webapp:
- externe APIs abfragen soll (Wetter, Lagerstand, CRM),
- Aktionen ausführen soll (Bestellung anlegen, Ticket erstellen),

… dann **Function Calling**. Typischer Ablauf:
1) Funktionen (Signaturen) deklarieren  
2) Model entscheidet “functionCall”  
3) Du führst Function aus  
4) Du gibst das Ergebnis als Tool‑Response zurück  
5) Model formuliert finalen Text/JSON

> Siehe offizielle “Function calling” Doku für Details & Examples.

---

## 13) Context Caching – für große Systemprompts & wiederholte Assets

Zwei Mechanismen:
- **Implicit caching** (automatisch, keine Garantie)
- **Explicit caching** (manuell, Garantie + TTL + Storage‑Kosten)

Use Cases:
- große System‑Anweisungen (z. B. “Brand Voice”)
- wiederholte Analyse derselben PDFs/Videos
- wiederholte RAG‑Anfragen an dieselbe Corpus‑Basis

---

## 14) Vertex‑Spezifika: Global Endpoints, Media Resolution

### Global Endpoints (Vertex)
Gemini 3 wird (laut Vertex Doku) über **Global Endpoints** genutzt. Das wirkt sich auf URL/Location aus.

### Media resolution
Vertex erwähnt eine **`media_resolution`** Option (Default: `medium`) mit Stufen:
- `low`, `medium`, `high`, `ultra_high`

Höhere Auflösung kann Token‑Verbrauch erhöhen, verbessert aber Details.

---

## 15) Typische Fehlerbilder & Fixes (praktisch)

### 401/403 (Auth)
- falscher API Key / nicht gesetzt
- Billing nicht aktiviert (Paid Tier nötig)
- Key‑Restrictions blockieren Server‑Origin

### 400 INVALID_ARGUMENT
- falscher JSON Body (`contents` / `parts` falsch)
- MIME Type fehlt/inkorrekt
- fileUri ohne passendes fileData‑Format

### Antworten sind “zu lang / teuer”
- Thinking Level reduzieren
- Output‑Tokens limitieren (falls unterstützt via config)
- Caching nutzen

### “Weird output” / unzuverlässige Agent‑Loops
- Structured Outputs nutzen (Schema)
- Tool‑Loop strikt implementieren (functionCall → toolResult → final)

---

## 16) Offizielle Referenzen (Links)

> Diese Links sind die “Source of Truth” für Änderungen (Pricing, Limits, Felder, Lifecycle).

- Gemini 3 Developer Guide: https://ai.google.dev/gemini-api/docs/gemini-3
- Gemini Models & Feature Matrix: https://ai.google.dev/gemini-api/docs/models
- Pricing (Gemini API): https://ai.google.dev/gemini-api/docs/pricing
- Rate limits: https://ai.google.dev/gemini-api/docs/rate-limits
- Thinking: https://ai.google.dev/gemini-api/docs/thinking
- Files API Guide: https://ai.google.dev/gemini-api/docs/files
- Files API Reference (upload endpoints): https://ai.google.dev/api/files
- Structured Outputs: https://ai.google.dev/gemini-api/docs/structured-output
- Function calling: https://ai.google.dev/gemini-api/docs/function-calling
- Context caching: https://ai.google.dev/gemini-api/docs/caching
- Vertex: Gemini 3 Flash model page: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-flash
- Vertex: Get started with Gemini 3 (media_resolution/thought signatures etc.): https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-0-flash

