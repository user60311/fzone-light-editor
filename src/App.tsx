import {
  AlertTriangle,
  Check,
  Copy,
  Database,
  Download,
  FileJson,
  FileImage,
  Globe2,
  KeyRound,
  Lock,
  Plus,
  QrCode,
  Redo2,
  RotateCcw,
  ScanLine,
  Search,
  Trash2,
  Undo2,
  Unlock,
} from 'lucide-react'
import jsQR from 'jsqr'
import QRCode from 'qrcode'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, PointerEvent } from 'react'
import './App.css'
import {
  MAX_POINTS,
  SAMPLE_PAYLOADS,
  clamp,
  clampByte,
  encodeFzoneProfile,
  parseFzonePayload,
  parseFzoneJsonProfile,
  profileToJson,
} from './fzone'
import type { ChannelKey, FzonePoint, FzoneProfile } from './fzone'

type CommunityProfile = {
  id: string
  name: string
  description: string
  modelLabel: string
  prefix: string
  profileId: number
  pointCount: number
  startTime: string
  endTime: string
  checksum: string
  tags: string
  createdAt: string
}

const channelMeta: Array<{ key: ChannelKey; label: string; color: string }> = [
  { key: 'white', label: 'W', color: '#f8fafc' },
  { key: 'red', label: 'R', color: '#ef4444' },
  { key: 'green', label: 'G', color: '#22c55e' },
  { key: 'blue', label: 'B', color: '#3b82f6' },
]

const MAX_INTENSITY_PERCENT = 100
const MAX_HISTORY_ITEMS = 60

type UiLanguage = 'de' | 'en'

const UI_TEXT = {
  de: {
    heroTitle: 'Lichtprofile einfach bauen.',
    heroCopy: 'Importieren, anpassen, speichern und wieder als QR-Code ausgeben.',
    viewLabel: 'Ansicht wählen',
    languageLabel: 'Sprache wählen',
    checksum: 'Checksumme',
    length: 'Länge',
    switchPoints: 'Schaltpunkte',
    importExport: 'Import/Export',
    uploadQr: 'QR-Bild hochladen',
    importJson: 'JSON-Datei importieren',
    qrRawData: 'QR-Rohdaten',
    decode: 'Dekodieren',
    reset: 'Reset',
    samples: 'Beispielprofile',
    curveCreation: 'Kurvenerstellung',
    profileIdHex: 'Profil-ID hex',
    profileIdShort: 'Profil-ID',
    unknownModel: 'Unbekanntes Modell erkannt',
    unknownModelHelp: 'ist noch nicht zugeordnet.',
    unknownModelAction: 'Modell vorschlagen',
    channelLocks: 'Kanäle sperren',
    presetGenerator: 'Preset-Generator',
    presetHelp: 'Wähle eine Kurve und lege fest, wann sie beginnt und endet.',
    preset: 'Preset',
    start: 'Anfang',
    end: 'Ende',
    generate: 'Generieren',
    actions: 'Aktionen',
    hour: 'Stunde',
    minute: 'Minute',
    intensity: 'Intensität',
    duplicatePoint: 'Schaltpunkt duplizieren',
    deletePoint: 'Schaltpunkt löschen',
    copy: 'Kopieren',
    generatedQr: 'Generierter FZone QR-Code',
    publishProfile: 'Profil veröffentlichen',
    profileName: 'Profilname',
    description: 'Beschreibung',
    save: 'Speichern',
    publish: 'Veröffentlichen',
    newLength: 'Neue Länge',
    newChecksum: 'Neue Checksumme',
    generatedPayload: 'Generierter Payload',
    storageSearch: 'Profil-Speicher/Suche',
    search: 'Suchen',
    model: 'Modell',
    adminCode: 'Admin-Code',
    optional: 'optional',
    adminActive: 'Admin-Modus aktiv. Löschbuttons sind eingeblendet.',
    readOnly: 'Ohne Admin-Code sind Profile nur lesbar.',
    communityProfiles: 'Community-Profile',
    allModels: 'Alle Modelle',
    searchPlaceholder: 'Name, Tag, Modell',
    points: 'Punkte',
    delete: 'Löschen',
    noProfiles: 'Keine passenden Profile gefunden.',
    footer: 'Inoffizielles Community-Tool von User60311. Nicht verbunden mit FZone; QR-Profile werden nur freiwillig veröffentlicht.',
    undo: 'Rückgängig',
    redo: 'Wiederholen',
    point: 'Punkt',
    lightCurve: 'Lichtkurve',
    chartHelp: 'Farbpunkte ändern die Intensität. Zeitpunkte unten verschieben die Uhrzeit.',
    zoomPoints: 'Auf Schaltpunkte zoomen',
    showFullDay: '24 Stunden anzeigen',
    chartLabel: 'WRGB Tagesverlauf',
    checksumMeta: 'Checksumme',
  },
  en: {
    heroTitle: 'Build light profiles fast.',
    heroCopy: 'Import, edit, save, and export again as QR code.',
    viewLabel: 'Choose view',
    languageLabel: 'Choose language',
    checksum: 'Checksum',
    length: 'Length',
    switchPoints: 'Switch points',
    importExport: 'Import/Export',
    uploadQr: 'Upload QR image',
    importJson: 'Import JSON file',
    qrRawData: 'QR raw data',
    decode: 'Decode',
    reset: 'Reset',
    samples: 'Sample profiles',
    curveCreation: 'Curve editor',
    profileIdHex: 'Profile ID hex',
    profileIdShort: 'Profile ID',
    unknownModel: 'Unknown model detected',
    unknownModelHelp: 'is not mapped yet.',
    unknownModelAction: 'Suggest model',
    channelLocks: 'Lock channels',
    presetGenerator: 'Preset generator',
    presetHelp: 'Choose a curve and set when it starts and ends.',
    preset: 'Preset',
    start: 'Start',
    end: 'End',
    generate: 'Generate',
    actions: 'Actions',
    hour: 'Hour',
    minute: 'Minute',
    intensity: 'Intensity',
    duplicatePoint: 'Duplicate switch point',
    deletePoint: 'Delete switch point',
    copy: 'Copy',
    generatedQr: 'Generated FZone QR code',
    publishProfile: 'Publish profile',
    profileName: 'Profile name',
    description: 'Description',
    save: 'Saving',
    publish: 'Publish',
    newLength: 'New length',
    newChecksum: 'New checksum',
    generatedPayload: 'Generated payload',
    storageSearch: 'Profile storage/search',
    search: 'Search',
    model: 'Model',
    adminCode: 'Admin code',
    optional: 'optional',
    adminActive: 'Admin mode active. Delete buttons are visible.',
    readOnly: 'Without an admin code, profiles are read-only.',
    communityProfiles: 'Community profiles',
    allModels: 'All models',
    searchPlaceholder: 'Name, tag, model',
    points: 'points',
    delete: 'Delete',
    noProfiles: 'No matching profiles found.',
    footer: 'Unofficial community tool by User60311. Not affiliated with FZone; QR profiles are only published voluntarily.',
    undo: 'Undo',
    redo: 'Redo',
    point: 'Point',
    lightCurve: 'Light curve',
    chartHelp: 'Color points change intensity. Time points below move the switch time.',
    zoomPoints: 'Zoom to switch points',
    showFullDay: 'Show 24 hours',
    chartLabel: 'WRGB daily curve',
    checksumMeta: 'Checksum',
  },
} as const

type LightPreset = {
  name: string
  description: string
  points: Array<Omit<FzonePoint, 'id'>>
}

const LIGHT_PRESETS: LightPreset[] = [
  {
    name: 'Sanfter Tag',
    description: 'Weicher Start, ruhiger Peak, kurzer Abend.',
    points: [
      { hour: 7, minute: 30, white: 0, red: 0, green: 0, blue: 0 },
      { hour: 8, minute: 15, white: 14, red: 6, green: 8, blue: 16 },
      { hour: 9, minute: 0, white: 35, red: 18, green: 24, blue: 32 },
      { hour: 10, minute: 15, white: 56, red: 30, green: 38, blue: 52 },
      { hour: 12, minute: 30, white: 78, red: 48, green: 58, blue: 72 },
      { hour: 14, minute: 30, white: 84, red: 52, green: 62, blue: 76 },
      { hour: 16, minute: 30, white: 82, red: 50, green: 60, blue: 74 },
      { hour: 18, minute: 30, white: 52, red: 28, green: 34, blue: 48 },
      { hour: 20, minute: 0, white: 22, red: 12, green: 14, blue: 25 },
      { hour: 20, minute: 45, white: 8, red: 4, green: 4, blue: 12 },
      { hour: 21, minute: 30, white: 0, red: 0, green: 0, blue: 0 },
    ],
  },
  {
    name: 'Pflanzen-Peak',
    description: 'Längerer heller Mittelteil für stark bepflanzte Becken.',
    points: [
      { hour: 8, minute: 0, white: 0, red: 0, green: 0, blue: 0 },
      { hour: 8, minute: 45, white: 22, red: 12, green: 16, blue: 22 },
      { hour: 9, minute: 30, white: 45, red: 28, green: 34, blue: 42 },
      { hour: 10, minute: 15, white: 68, red: 44, green: 54, blue: 64 },
      { hour: 11, minute: 0, white: 92, red: 62, green: 72, blue: 88 },
      { hour: 13, minute: 0, white: 100, red: 72, green: 84, blue: 96 },
      { hour: 15, minute: 30, white: 98, red: 70, green: 82, blue: 94 },
      { hour: 17, minute: 30, white: 92, red: 62, green: 72, blue: 88 },
      { hour: 18, minute: 30, white: 64, red: 38, green: 46, blue: 58 },
      { hour: 19, minute: 30, white: 36, red: 18, green: 22, blue: 34 },
      { hour: 20, minute: 15, white: 12, red: 6, green: 8, blue: 14 },
      { hour: 21, minute: 0, white: 0, red: 0, green: 0, blue: 0 },
    ],
  },
  {
    name: 'Abendblau',
    description: 'Normaler Tag mit längerem blauen Ausklang.',
    points: [
      { hour: 8, minute: 0, white: 0, red: 0, green: 0, blue: 0 },
      { hour: 8, minute: 45, white: 20, red: 8, green: 12, blue: 28 },
      { hour: 10, minute: 0, white: 60, red: 32, green: 40, blue: 55 },
      { hour: 12, minute: 0, white: 82, red: 42, green: 52, blue: 78 },
      { hour: 15, minute: 0, white: 85, red: 45, green: 55, blue: 80 },
      { hour: 17, minute: 0, white: 66, red: 32, green: 40, blue: 70 },
      { hour: 18, minute: 30, white: 45, red: 20, green: 24, blue: 52 },
      { hour: 19, minute: 45, white: 22, red: 8, green: 12, blue: 42 },
      { hour: 21, minute: 0, white: 8, red: 2, green: 4, blue: 20 },
      { hour: 21, minute: 45, white: 4, red: 0, green: 2, blue: 12 },
      { hour: 22, minute: 30, white: 0, red: 0, green: 0, blue: 0 },
    ],
  },
  {
    name: 'Amazonas',
    description: 'Warm, weich und leicht rötlich für Schwarzwasser-Look.',
    points: [
      { hour: 7, minute: 30, white: 0, red: 0, green: 0, blue: 0 },
      { hour: 8, minute: 15, white: 12, red: 10, green: 5, blue: 4 },
      { hour: 9, minute: 0, white: 30, red: 28, green: 12, blue: 10 },
      { hour: 10, minute: 30, white: 52, red: 48, green: 22, blue: 18 },
      { hour: 12, minute: 30, white: 66, red: 62, green: 32, blue: 24 },
      { hour: 15, minute: 0, white: 70, red: 66, green: 34, blue: 26 },
      { hour: 17, minute: 30, white: 56, red: 52, green: 24, blue: 18 },
      { hour: 19, minute: 0, white: 30, red: 30, green: 12, blue: 10 },
      { hour: 20, minute: 15, white: 10, red: 12, green: 4, blue: 4 },
      { hour: 21, minute: 0, white: 0, red: 0, green: 0, blue: 0 },
    ],
  },
  {
    name: 'Meerwasser',
    description: 'Blau betont, klarer Peak und langer Actinic-Abend.',
    points: [
      { hour: 7, minute: 0, white: 0, red: 0, green: 0, blue: 0 },
      { hour: 8, minute: 0, white: 4, red: 0, green: 2, blue: 22 },
      { hour: 9, minute: 0, white: 18, red: 2, green: 8, blue: 52 },
      { hour: 10, minute: 30, white: 48, red: 6, green: 20, blue: 82 },
      { hour: 12, minute: 0, white: 76, red: 10, green: 34, blue: 100 },
      { hour: 15, minute: 30, white: 78, red: 10, green: 34, blue: 100 },
      { hour: 17, minute: 30, white: 52, red: 6, green: 20, blue: 86 },
      { hour: 19, minute: 30, white: 18, red: 2, green: 8, blue: 58 },
      { hour: 21, minute: 0, white: 4, red: 0, green: 2, blue: 28 },
      { hour: 22, minute: 30, white: 0, red: 0, green: 0, blue: 0 },
    ],
  },
  {
    name: 'Asien-Style',
    description: 'Frischer Look mit sattem Grün und kühler Klarheit.',
    points: [
      { hour: 7, minute: 45, white: 0, red: 0, green: 0, blue: 0 },
      { hour: 8, minute: 30, white: 18, red: 8, green: 18, blue: 20 },
      { hour: 9, minute: 30, white: 42, red: 18, green: 42, blue: 46 },
      { hour: 10, minute: 45, white: 70, red: 30, green: 72, blue: 76 },
      { hour: 12, minute: 30, white: 86, red: 38, green: 92, blue: 90 },
      { hour: 15, minute: 30, white: 88, red: 38, green: 94, blue: 92 },
      { hour: 17, minute: 30, white: 68, red: 28, green: 70, blue: 76 },
      { hour: 19, minute: 0, white: 34, red: 14, green: 34, blue: 42 },
      { hour: 20, minute: 30, white: 8, red: 4, green: 8, blue: 16 },
      { hour: 21, minute: 15, white: 0, red: 0, green: 0, blue: 0 },
    ],
  },
  {
    name: 'Low-Tech',
    description: 'Kürzer und sanfter für Becken ohne CO2.',
    points: [
      { hour: 9, minute: 0, white: 0, red: 0, green: 0, blue: 0 },
      { hour: 10, minute: 0, white: 20, red: 10, green: 12, blue: 18 },
      { hour: 11, minute: 30, white: 48, red: 24, green: 28, blue: 42 },
      { hour: 14, minute: 30, white: 62, red: 30, green: 36, blue: 54 },
      { hour: 17, minute: 0, white: 46, red: 22, green: 26, blue: 40 },
      { hour: 18, minute: 30, white: 18, red: 8, green: 10, blue: 18 },
      { hour: 19, minute: 30, white: 0, red: 0, green: 0, blue: 0 },
    ],
  },
  {
    name: 'Algenpause',
    description: 'Geteilter Tag mit ruhiger Mittagspause.',
    points: [
      { hour: 8, minute: 0, white: 0, red: 0, green: 0, blue: 0 },
      { hour: 9, minute: 0, white: 34, red: 18, green: 22, blue: 34 },
      { hour: 10, minute: 30, white: 76, red: 44, green: 54, blue: 72 },
      { hour: 12, minute: 0, white: 82, red: 48, green: 58, blue: 76 },
      { hour: 13, minute: 0, white: 28, red: 12, green: 16, blue: 28 },
      { hour: 14, minute: 30, white: 28, red: 12, green: 16, blue: 28 },
      { hour: 15, minute: 30, white: 78, red: 44, green: 54, blue: 74 },
      { hour: 17, minute: 30, white: 82, red: 48, green: 58, blue: 76 },
      { hour: 19, minute: 0, white: 34, red: 16, green: 20, blue: 34 },
      { hour: 20, minute: 0, white: 0, red: 0, green: 0, blue: 0 },
    ],
  },
  {
    name: 'Showcase',
    description: 'Viele Punkte, deutlicher Verlauf, ideal zum Ausprobieren.',
    points: [
      { hour: 7, minute: 0, white: 0, red: 0, green: 0, blue: 0 },
      { hour: 7, minute: 45, white: 8, red: 4, green: 4, blue: 14 },
      { hour: 8, minute: 30, white: 22, red: 12, green: 14, blue: 28 },
      { hour: 9, minute: 15, white: 42, red: 24, green: 30, blue: 46 },
      { hour: 10, minute: 15, white: 68, red: 42, green: 52, blue: 70 },
      { hour: 11, minute: 30, white: 88, red: 58, green: 70, blue: 88 },
      { hour: 13, minute: 0, white: 100, red: 68, green: 82, blue: 98 },
      { hour: 14, minute: 45, white: 96, red: 64, green: 80, blue: 96 },
      { hour: 16, minute: 15, white: 82, red: 50, green: 64, blue: 84 },
      { hour: 17, minute: 45, white: 64, red: 34, green: 44, blue: 68 },
      { hour: 19, minute: 0, white: 36, red: 18, green: 22, blue: 42 },
      { hour: 20, minute: 15, white: 16, red: 8, green: 8, blue: 26 },
      { hour: 21, minute: 15, white: 4, red: 1, green: 2, blue: 12 },
      { hour: 22, minute: 0, white: 0, red: 0, green: 0, blue: 0 },
    ],
  },
  {
    name: 'Garnelen-Morgen',
    description: 'Sehr sanft, früh hell, ohne harten Peak.',
    points: [
      { hour: 6, minute: 45, white: 0, red: 0, green: 0, blue: 0 },
      { hour: 7, minute: 15, white: 5, red: 3, green: 3, blue: 8 },
      { hour: 8, minute: 0, white: 18, red: 8, green: 10, blue: 18 },
      { hour: 9, minute: 30, white: 36, red: 16, green: 20, blue: 32 },
      { hour: 11, minute: 30, white: 52, red: 24, green: 30, blue: 46 },
      { hour: 14, minute: 30, white: 54, red: 24, green: 30, blue: 48 },
      { hour: 16, minute: 30, white: 44, red: 18, green: 24, blue: 38 },
      { hour: 18, minute: 0, white: 24, red: 10, green: 12, blue: 24 },
      { hour: 19, minute: 15, white: 8, red: 3, green: 4, blue: 12 },
      { hour: 20, minute: 0, white: 0, red: 0, green: 0, blue: 0 },
    ],
  },
  {
    name: 'Diskus-Warm',
    description: 'Warm und ruhig mit weichem Rotanteil.',
    points: [
      { hour: 8, minute: 0, white: 0, red: 0, green: 0, blue: 0 },
      { hour: 8, minute: 45, white: 10, red: 12, green: 4, blue: 5 },
      { hour: 9, minute: 45, white: 28, red: 34, green: 12, blue: 12 },
      { hour: 11, minute: 0, white: 48, red: 56, green: 22, blue: 20 },
      { hour: 12, minute: 30, white: 62, red: 72, green: 30, blue: 26 },
      { hour: 15, minute: 0, white: 66, red: 76, green: 32, blue: 28 },
      { hour: 17, minute: 0, white: 52, red: 60, green: 24, blue: 22 },
      { hour: 18, minute: 45, white: 30, red: 38, green: 12, blue: 14 },
      { hour: 20, minute: 0, white: 10, red: 14, green: 4, blue: 5 },
      { hour: 20, minute: 45, white: 0, red: 0, green: 0, blue: 0 },
    ],
  },
  {
    name: 'Dutch Style',
    description: 'Knackiger Tagesbogen für dichte Pflanzenfarben.',
    points: [
      { hour: 7, minute: 30, white: 0, red: 0, green: 0, blue: 0 },
      { hour: 8, minute: 0, white: 18, red: 10, green: 14, blue: 18 },
      { hour: 8, minute: 45, white: 42, red: 24, green: 34, blue: 42 },
      { hour: 9, minute: 45, white: 70, red: 42, green: 62, blue: 68 },
      { hour: 11, minute: 0, white: 94, red: 62, green: 88, blue: 90 },
      { hour: 13, minute: 0, white: 100, red: 70, green: 98, blue: 96 },
      { hour: 15, minute: 30, white: 96, red: 66, green: 94, blue: 92 },
      { hour: 17, minute: 0, white: 76, red: 46, green: 68, blue: 72 },
      { hour: 18, minute: 30, white: 44, red: 24, green: 36, blue: 42 },
      { hour: 19, minute: 30, white: 16, red: 8, green: 10, blue: 16 },
      { hour: 20, minute: 0, white: 0, red: 0, green: 0, blue: 0 },
    ],
  },
  {
    name: 'Iwagumi Klar',
    description: 'Kühl, hell und minimalistisch für Steinlayouts.',
    points: [
      { hour: 8, minute: 30, white: 0, red: 0, green: 0, blue: 0 },
      { hour: 9, minute: 0, white: 14, red: 4, green: 8, blue: 18 },
      { hour: 9, minute: 45, white: 42, red: 10, green: 22, blue: 46 },
      { hour: 10, minute: 45, white: 74, red: 18, green: 42, blue: 78 },
      { hour: 12, minute: 0, white: 92, red: 24, green: 56, blue: 96 },
      { hour: 15, minute: 0, white: 94, red: 24, green: 56, blue: 98 },
      { hour: 17, minute: 0, white: 72, red: 16, green: 38, blue: 76 },
      { hour: 18, minute: 15, white: 34, red: 8, green: 18, blue: 42 },
      { hour: 19, minute: 15, white: 8, red: 2, green: 4, blue: 14 },
      { hour: 19, minute: 45, white: 0, red: 0, green: 0, blue: 0 },
    ],
  },
  {
    name: 'Schattenwald',
    description: 'Gedämpftes Licht mit warmem, natürlichem Verlauf.',
    points: [
      { hour: 7, minute: 45, white: 0, red: 0, green: 0, blue: 0 },
      { hour: 8, minute: 30, white: 8, red: 6, green: 4, blue: 6 },
      { hour: 9, minute: 30, white: 24, red: 18, green: 14, blue: 16 },
      { hour: 11, minute: 0, white: 42, red: 32, green: 24, blue: 26 },
      { hour: 13, minute: 0, white: 58, red: 44, green: 34, blue: 36 },
      { hour: 15, minute: 30, white: 56, red: 42, green: 32, blue: 34 },
      { hour: 17, minute: 30, white: 38, red: 28, green: 20, blue: 22 },
      { hour: 19, minute: 0, white: 18, red: 14, green: 8, blue: 10 },
      { hour: 20, minute: 15, white: 5, red: 4, green: 2, blue: 3 },
      { hour: 20, minute: 45, white: 0, red: 0, green: 0, blue: 0 },
    ],
  },
  {
    name: 'Biotop Soft',
    description: 'Natürlich und zurückhaltend mit sanfter Mittagshöhe.',
    points: [
      { hour: 8, minute: 0, white: 0, red: 0, green: 0, blue: 0 },
      { hour: 8, minute: 40, white: 10, red: 6, green: 5, blue: 8 },
      { hour: 9, minute: 30, white: 26, red: 16, green: 14, blue: 22 },
      { hour: 10, minute: 45, white: 46, red: 28, green: 28, blue: 42 },
      { hour: 12, minute: 30, white: 64, red: 40, green: 42, blue: 58 },
      { hour: 14, minute: 30, white: 68, red: 42, green: 44, blue: 60 },
      { hour: 16, minute: 45, white: 52, red: 30, green: 32, blue: 46 },
      { hour: 18, minute: 30, white: 28, red: 16, green: 16, blue: 28 },
      { hour: 19, minute: 45, white: 8, red: 4, green: 4, blue: 10 },
      { hour: 20, minute: 30, white: 0, red: 0, green: 0, blue: 0 },
    ],
  },
  {
    name: 'Rio Negro Schwarzwasser',
    description: 'Dunkel, bernsteinfarben und sehr sanft für Schwarzwasser-Becken.',
    points: [
      { hour: 8, minute: 30, white: 0, red: 0, green: 0, blue: 0 },
      { hour: 9, minute: 15, white: 6, red: 8, green: 2, blue: 2 },
      { hour: 10, minute: 15, white: 18, red: 24, green: 6, blue: 5 },
      { hour: 11, minute: 45, white: 34, red: 44, green: 12, blue: 9 },
      { hour: 13, minute: 30, white: 44, red: 58, green: 18, blue: 12 },
      { hour: 15, minute: 30, white: 42, red: 54, green: 16, blue: 11 },
      { hour: 17, minute: 30, white: 28, red: 36, green: 10, blue: 8 },
      { hour: 19, minute: 0, white: 12, red: 18, green: 4, blue: 4 },
      { hour: 20, minute: 0, white: 0, red: 0, green: 0, blue: 0 },
    ],
  },
  {
    name: 'Orinoco Klarwasser',
    description: 'Klarer, natürlicher Tagesbogen mit leicht kühlem Peak.',
    points: [
      { hour: 7, minute: 45, white: 0, red: 0, green: 0, blue: 0 },
      { hour: 8, minute: 30, white: 14, red: 8, green: 10, blue: 16 },
      { hour: 9, minute: 45, white: 38, red: 20, green: 26, blue: 40 },
      { hour: 11, minute: 30, white: 66, red: 34, green: 44, blue: 68 },
      { hour: 13, minute: 30, white: 78, red: 40, green: 52, blue: 82 },
      { hour: 16, minute: 0, white: 74, red: 36, green: 48, blue: 78 },
      { hour: 18, minute: 0, white: 42, red: 20, green: 26, blue: 48 },
      { hour: 19, minute: 30, white: 12, red: 6, green: 8, blue: 18 },
      { hour: 20, minute: 15, white: 0, red: 0, green: 0, blue: 0 },
    ],
  },
  {
    name: 'Südostasien Bach',
    description: 'Grünlich-weich mit gedämpftem Licht für Bach- und Wurzelbecken.',
    points: [
      { hour: 7, minute: 30, white: 0, red: 0, green: 0, blue: 0 },
      { hour: 8, minute: 15, white: 8, red: 5, green: 8, blue: 7 },
      { hour: 9, minute: 15, white: 24, red: 12, green: 24, blue: 20 },
      { hour: 10, minute: 45, white: 46, red: 24, green: 48, blue: 40 },
      { hour: 12, minute: 45, white: 62, red: 34, green: 68, blue: 56 },
      { hour: 15, minute: 30, white: 60, red: 32, green: 66, blue: 54 },
      { hour: 17, minute: 45, white: 38, red: 18, green: 40, blue: 34 },
      { hour: 19, minute: 15, white: 14, red: 6, green: 14, blue: 14 },
      { hour: 20, minute: 0, white: 0, red: 0, green: 0, blue: 0 },
    ],
  },
  {
    name: 'Tanganjika Fels',
    description: 'Heller, klarer Look für Felsaufbauten und sandige Böden.',
    points: [
      { hour: 8, minute: 0, white: 0, red: 0, green: 0, blue: 0 },
      { hour: 8, minute: 45, white: 18, red: 4, green: 10, blue: 24 },
      { hour: 9, minute: 45, white: 50, red: 10, green: 26, blue: 58 },
      { hour: 11, minute: 15, white: 82, red: 18, green: 42, blue: 90 },
      { hour: 13, minute: 30, white: 96, red: 22, green: 50, blue: 100 },
      { hour: 16, minute: 0, white: 92, red: 20, green: 48, blue: 98 },
      { hour: 18, minute: 0, white: 54, red: 10, green: 28, blue: 64 },
      { hour: 19, minute: 30, white: 16, red: 2, green: 8, blue: 24 },
      { hour: 20, minute: 15, white: 0, red: 0, green: 0, blue: 0 },
    ],
  },
  {
    name: 'Malawi Klar',
    description: 'Kontrastreiches, blau-kühles Licht für Cichliden-Becken.',
    points: [
      { hour: 7, minute: 30, white: 0, red: 0, green: 0, blue: 0 },
      { hour: 8, minute: 15, white: 20, red: 3, green: 10, blue: 28 },
      { hour: 9, minute: 30, white: 56, red: 8, green: 26, blue: 70 },
      { hour: 11, minute: 0, white: 88, red: 14, green: 40, blue: 96 },
      { hour: 13, minute: 30, white: 100, red: 18, green: 48, blue: 100 },
      { hour: 16, minute: 30, white: 94, red: 14, green: 42, blue: 98 },
      { hour: 18, minute: 30, white: 52, red: 8, green: 24, blue: 68 },
      { hour: 20, minute: 0, white: 14, red: 2, green: 6, blue: 26 },
      { hour: 20, minute: 45, white: 0, red: 0, green: 0, blue: 0 },
    ],
  },
  {
    name: 'Westafrika Bach',
    description: 'Warm, flach und ruhig für Waldfluss- und Bachbiotope.',
    points: [
      { hour: 8, minute: 15, white: 0, red: 0, green: 0, blue: 0 },
      { hour: 9, minute: 0, white: 8, red: 8, green: 4, blue: 4 },
      { hour: 10, minute: 0, white: 24, red: 24, green: 12, blue: 10 },
      { hour: 11, minute: 30, white: 42, red: 42, green: 22, blue: 16 },
      { hour: 13, minute: 30, white: 54, red: 56, green: 30, blue: 22 },
      { hour: 16, minute: 0, white: 48, red: 48, green: 24, blue: 18 },
      { hour: 18, minute: 0, white: 24, red: 26, green: 12, blue: 10 },
      { hour: 19, minute: 15, white: 8, red: 10, green: 4, blue: 3 },
      { hour: 20, minute: 0, white: 0, red: 0, green: 0, blue: 0 },
    ],
  },
  {
    name: 'Mangroven Dämmerung',
    description: 'Langer, warmer Randlicht-Verlauf mit wenig Blau.',
    points: [
      { hour: 7, minute: 0, white: 0, red: 0, green: 0, blue: 0 },
      { hour: 7, minute: 45, white: 5, red: 8, green: 2, blue: 2 },
      { hour: 8, minute: 45, white: 18, red: 24, green: 8, blue: 6 },
      { hour: 10, minute: 30, white: 42, red: 52, green: 20, blue: 14 },
      { hour: 13, minute: 0, white: 60, red: 72, green: 32, blue: 20 },
      { hour: 15, minute: 30, white: 58, red: 68, green: 30, blue: 18 },
      { hour: 17, minute: 30, white: 38, red: 48, green: 16, blue: 12 },
      { hour: 19, minute: 0, white: 18, red: 26, green: 6, blue: 5 },
      { hour: 20, minute: 30, white: 4, red: 8, green: 1, blue: 1 },
      { hour: 21, minute: 15, white: 0, red: 0, green: 0, blue: 0 },
    ],
  },
  {
    name: 'Wabi-Kusa',
    description: 'Kurzer, klarer Tag für offene Pflanzen-Setups.',
    points: [
      { hour: 9, minute: 0, white: 0, red: 0, green: 0, blue: 0 },
      { hour: 9, minute: 20, white: 12, red: 6, green: 10, blue: 12 },
      { hour: 10, minute: 0, white: 40, red: 20, green: 34, blue: 38 },
      { hour: 11, minute: 0, white: 74, red: 40, green: 68, blue: 72 },
      { hour: 12, minute: 30, white: 92, red: 52, green: 88, blue: 88 },
      { hour: 14, minute: 30, white: 88, red: 48, green: 82, blue: 84 },
      { hour: 16, minute: 0, white: 58, red: 28, green: 52, blue: 58 },
      { hour: 17, minute: 0, white: 24, red: 10, green: 18, blue: 26 },
      { hour: 17, minute: 45, white: 0, red: 0, green: 0, blue: 0 },
    ],
  },
  {
    name: 'Feierabend',
    description: 'Später Start und schöner Abend für Becken im Wohnraum.',
    points: [
      { hour: 11, minute: 0, white: 0, red: 0, green: 0, blue: 0 },
      { hour: 11, minute: 45, white: 10, red: 4, green: 6, blue: 12 },
      { hour: 12, minute: 45, white: 34, red: 18, green: 22, blue: 34 },
      { hour: 14, minute: 30, white: 64, red: 36, green: 44, blue: 62 },
      { hour: 16, minute: 30, white: 82, red: 46, green: 58, blue: 78 },
      { hour: 18, minute: 30, white: 78, red: 42, green: 54, blue: 76 },
      { hour: 20, minute: 0, white: 52, red: 26, green: 34, blue: 58 },
      { hour: 21, minute: 15, white: 22, red: 8, green: 10, blue: 36 },
      { hour: 22, minute: 30, white: 6, red: 1, green: 2, blue: 16 },
      { hour: 23, minute: 0, white: 0, red: 0, green: 0, blue: 0 },
    ],
  },
  {
    name: 'Mondlicht Blau',
    description: 'Kleiner Tagesbogen mit kurzem blauem Ausklang.',
    points: [
      { hour: 8, minute: 30, white: 0, red: 0, green: 0, blue: 0 },
      { hour: 9, minute: 30, white: 22, red: 8, green: 12, blue: 24 },
      { hour: 11, minute: 0, white: 58, red: 24, green: 34, blue: 58 },
      { hour: 13, minute: 30, white: 76, red: 34, green: 46, blue: 74 },
      { hour: 16, minute: 0, white: 72, red: 30, green: 42, blue: 74 },
      { hour: 18, minute: 0, white: 42, red: 16, green: 22, blue: 52 },
      { hour: 19, minute: 30, white: 14, red: 4, green: 6, blue: 34 },
      { hour: 20, minute: 45, white: 2, red: 0, green: 0, blue: 12 },
      { hour: 21, minute: 30, white: 0, red: 0, green: 0, blue: 0 },
    ],
  },
]

const PRESET_GROUPS = [
  {
    labelDe: 'Alltag',
    labelEn: 'Everyday',
    presets: ['Sanfter Tag', 'Garnelen-Morgen', 'Low-Tech', 'Feierabend', 'Abendblau', 'Mondlicht Blau'],
  },
  {
    labelDe: 'Pflanzen & Aquascaping',
    labelEn: 'Plants & Aquascaping',
    presets: ['Pflanzen-Peak', 'Dutch Style', 'Iwagumi Klar', 'Asien-Style', 'Wabi-Kusa', 'Showcase', 'Algenpause'],
  },
  {
    labelDe: 'Biotop & Regionen',
    labelEn: 'Biotope & Regions',
    presets: [
      'Biotop Soft',
      'Amazonas',
      'Rio Negro Schwarzwasser',
      'Orinoco Klarwasser',
      'Südostasien Bach',
      'Schattenwald',
      'Diskus-Warm',
      'Westafrika Bach',
      'Mangroven Dämmerung',
    ],
  },
  {
    labelDe: 'Spezial',
    labelEn: 'Special',
    presets: ['Meerwasser', 'Tanganjika Fels', 'Malawi Klar'],
  },
] as const

const emptyPoint = (): FzonePoint => ({
  id: crypto.randomUUID(),
  hour: 12,
  minute: 0,
  white: 30,
  red: 20,
  green: 20,
  blue: 25,
})

function App() {
  const [rawInput, setRawInput] = useState(SAMPLE_PAYLOADS[1].value)
  const [profile, setProfile] = useState<FzoneProfile>(() => parseFzonePayload(SAMPLE_PAYLOADS[1].value))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('Beispielprofil geladen.')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [communityProfiles, setCommunityProfiles] = useState<CommunityProfile[]>([])
  const [communityMessage, setCommunityMessage] = useState('Community-Speicher wird verbunden.')
  const [communityAvailable, setCommunityAvailable] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishName, setPublishName] = useState(() => suggestProfileName(parseFzonePayload(SAMPLE_PAYLOADS[1].value)))
  const [publishDescription, setPublishDescription] = useState('')
  const [publishTags, setPublishTags] = useState('')
  const [communityQuery, setCommunityQuery] = useState('')
  const [communityModel, setCommunityModel] = useState('Alle Modelle')
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem('fzone-admin-token') ?? '')
  const [jsonDataUrl, setJsonDataUrl] = useState('')
  const [chartViewMode, setChartViewMode] = useState<'day' | 'points'>('day')
  const [interfaceMode, setInterfaceMode] = useState<'simple' | 'profi'>('simple')
  const [language, setLanguage] = useState<UiLanguage>('de')
  const [selectedPresetName, setSelectedPresetName] = useState(LIGHT_PRESETS[0].name)
  const [presetStartTime, setPresetStartTime] = useState('08:00')
  const [presetEndTime, setPresetEndTime] = useState('21:30')
  const [lockedChannels, setLockedChannels] = useState<Record<ChannelKey, boolean>>({
    white: false,
    red: false,
    green: false,
    blue: false,
  })
  const [undoStack, setUndoStack] = useState<FzoneProfile[]>([])
  const [redoStack, setRedoStack] = useState<FzoneProfile[]>([])
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)
  const profileRef = useRef(profile)

  useEffect(() => {
    profileRef.current = profile
  }, [profile])

  const encodedPayload = useMemo(() => {
    try {
      return encodeFzoneProfile(profile)
    } catch {
      return ''
    }
  }, [profile])

  const jsonExport = useMemo(() => JSON.stringify(profileToJson(profile), null, 2), [profile])
  const jsonFileName = useMemo(() => `${slugify(profile.modelLabel)}.json`, [profile.modelLabel])

  useEffect(() => {
    const url = URL.createObjectURL(new Blob([jsonExport], { type: 'application/json' }))
    setJsonDataUrl(url)

    return () => URL.revokeObjectURL(url)
  }, [jsonExport])

  useEffect(() => {
    if (!encodedPayload || !qrCanvasRef.current) {
      return
    }

    QRCode.toCanvas(qrCanvasRef.current, encodedPayload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 340,
      color: {
        dark: '#111827',
        light: '#ffffff',
      },
    }).then(() => {
      setQrDataUrl(qrCanvasRef.current?.toDataURL('image/png') ?? '')
    })
  }, [encodedPayload])

  const generatedProfile = useMemo(() => {
    if (!encodedPayload) {
      return null
    }

    try {
      return parseFzonePayload(encodedPayload)
    } catch {
      return null
    }
  }, [encodedPayload])
  const text = UI_TEXT[language]

  const modelOptions = useMemo(
    () => ['Alle Modelle', ...Array.from(new Set(communityProfiles.map((item) => item.modelLabel))).sort()],
    [communityProfiles],
  )

  const filteredCommunityProfiles = useMemo(() => {
    const query = communityQuery.trim().toLowerCase()

    return communityProfiles.filter((item) => {
      const matchesModel = communityModel === 'Alle Modelle' || item.modelLabel === communityModel
      const searchable = `${item.name} ${item.description} ${item.tags} ${item.modelLabel} ${item.prefix}`.toLowerCase()

      return matchesModel && (!query || searchable.includes(query))
    })
  }, [communityProfiles, communityModel, communityQuery])

  const unknownModel = profile.modelLabel.startsWith('Unbekanntes Modell')

  useEffect(() => {
    loadCommunityProfiles()
  }, [])

  function commitProfile(update: FzoneProfile | ((current: FzoneProfile) => FzoneProfile)) {
    const current = profileRef.current
    const nextProfile = typeof update === 'function' ? update(current) : update

    rememberProfile(current)
    setProfile(nextProfile)
    profileRef.current = nextProfile
  }

  function rememberProfile(snapshot = profileRef.current) {
    setUndoStack((items) => [...items, snapshot].slice(-MAX_HISTORY_ITEMS))
    setRedoStack([])
  }

  function replaceProfile(nextProfile: FzoneProfile) {
    commitProfile(nextProfile)
    setPublishName(suggestProfileName(nextProfile))
    setPublishDescription('')
    setPublishTags('')
  }

  function undoProfile() {
    setUndoStack((items) => {
      const previous = items.at(-1)

      if (!previous) {
        return items
      }

      const current = profileRef.current
      setRedoStack((redoItems) => [current, ...redoItems].slice(0, MAX_HISTORY_ITEMS))
      setProfile(previous)
      profileRef.current = previous

      return items.slice(0, -1)
    })
  }

  function redoProfile() {
    setRedoStack((items) => {
      const nextProfile = items[0]

      if (!nextProfile) {
        return items
      }

      const current = profileRef.current
      setUndoStack((undoItems) => [...undoItems, current].slice(-MAX_HISTORY_ITEMS))
      setProfile(nextProfile)
      profileRef.current = nextProfile

      return items.slice(1)
    })
  }

  function toggleChannelLock(channel: ChannelKey) {
    setLockedChannels((current) => ({
      ...current,
      [channel]: !current[channel],
    }))
  }

  function importPayload(payload: string, source = 'Payload importiert.') {
    try {
      const nextProfile = parseFzonePayload(payload)
      replaceProfile(nextProfile)
      setRawInput(payload)
      setError('')
      setNotice(
        nextProfile.modelLabel.startsWith('Unbekanntes Modell')
          ? `${source} Modell ist noch nicht bekannt.`
          : source,
      )
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Der QR-Code konnte nicht gelesen werden.')
      setNotice('')
    }
  }

  async function decodeImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const imageUrl = URL.createObjectURL(file)

    try {
      const image = await loadImage(imageUrl)
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight

      const context = canvas.getContext('2d')

      if (!context) {
        throw new Error('Canvas konnte nicht vorbereitet werden.')
      }

      context.drawImage(image, 0, 0)

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
      const qrCode = jsQR(imageData.data, imageData.width, imageData.height)

      if (!qrCode) {
        throw new Error('Kein QR-Code gefunden.')
      }

      importPayload(qrCode.data, 'QR-Bild erfolgreich dekodiert.')
    } catch {
      setError('In diesem Bild konnte kein QR-Code erkannt werden.')
      setNotice('')
    } finally {
      URL.revokeObjectURL(imageUrl)
      event.target.value = ''
    }
  }

  function updatePoint(id: string, key: keyof FzonePoint, value: number) {
    if (isChannelKey(key) && lockedChannels[key]) {
      return
    }

    commitProfile((current) => ({
      ...current,
      points: current.points.map((point) => {
        if (point.id !== id) {
          return point
        }

        const nextValue =
          key === 'hour'
            ? clamp(value, 0, 23)
            : key === 'minute'
              ? clamp(value, 0, 59)
              : clamp(value, 0, MAX_INTENSITY_PERCENT)

        return { ...point, [key]: nextValue }
      }),
    }))
  }

  function updatePointFields(id: string, updates: Partial<Pick<FzonePoint, 'hour' | 'minute' | ChannelKey>>, remember = true) {
    const updateProfile = (current: FzoneProfile): FzoneProfile => ({
      ...current,
      points: current.points.map((point) => {
        if (point.id !== id) {
          return point
        }

        return {
          ...point,
          hour: updates.hour === undefined ? point.hour : clamp(updates.hour, 0, 23),
          minute: updates.minute === undefined ? point.minute : clamp(updates.minute, 0, 59),
          white: updates.white === undefined || lockedChannels.white ? point.white : clamp(updates.white, 0, MAX_INTENSITY_PERCENT),
          red: updates.red === undefined || lockedChannels.red ? point.red : clamp(updates.red, 0, MAX_INTENSITY_PERCENT),
          green: updates.green === undefined || lockedChannels.green ? point.green : clamp(updates.green, 0, MAX_INTENSITY_PERCENT),
          blue: updates.blue === undefined || lockedChannels.blue ? point.blue : clamp(updates.blue, 0, MAX_INTENSITY_PERCENT),
        }
      }),
    })

    if (remember) {
      commitProfile(updateProfile)
      return
    }

    const nextProfile = updateProfile(profileRef.current)
    setProfile(nextProfile)
    profileRef.current = nextProfile
  }

  function addPoint() {
    commitProfile((current) => ({
      ...current,
      points: [...current.points, emptyPoint()].slice(0, MAX_POINTS),
    }))
  }

  function duplicatePoint(id: string) {
    commitProfile((current) => {
      if (current.points.length >= MAX_POINTS) {
        return current
      }

      const index = current.points.findIndex((point) => point.id === id)

      if (index < 0) {
        return current
      }

      const source = current.points[index]
      const sourceMinute = source.hour * 60 + source.minute
      const nextMinute = clamp(sourceMinute + 30, 0, 1439)
      const duplicate = {
        ...source,
        id: crypto.randomUUID(),
        hour: Math.floor(nextMinute / 60),
        minute: nextMinute % 60,
      }
      const points = [...current.points]
      points.splice(index + 1, 0, duplicate)

      return {
        ...current,
        points,
      }
    })
  }

  function removePoint(id: string) {
    commitProfile((current) => ({
      ...current,
      points: current.points.length > 1 ? current.points.filter((point) => point.id !== id) : current.points,
    }))
  }

  function updateProfileMeta(key: 'prefix' | 'profileId', value: string) {
    commitProfile((current) => ({
      ...current,
      [key]: key === 'profileId' ? clampByte(Number.parseInt(value || '0', 16)) : value.trim(),
    }))
  }

  function generatePreset() {
    const preset = LIGHT_PRESETS.find((item) => item.name === selectedPresetName) ?? LIGHT_PRESETS[0]
    const startMinute = parseTimeInput(presetStartTime)
    const endMinute = parseTimeInput(presetEndTime)

    if (endMinute <= startMinute) {
      setError('Die Endzeit muss nach der Startzeit liegen.')
      setNotice('')
      return
    }

    commitProfile((current) => ({
      ...current,
      points: fitPresetToRange(preset, startMinute, endMinute).map((point) => ({
        id: crypto.randomUUID(),
        ...point,
      })),
    }))
    setNotice(`${preset.name} von ${presetStartTime} bis ${presetEndTime} erzeugt.`)
    setError('')
  }

  async function copyPayload() {
    await navigator.clipboard.writeText(encodedPayload)
    setNotice('Payload in die Zwischenablage kopiert.')
  }

  async function importJsonFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      const json = JSON.parse(await file.text()) as unknown
      const nextProfile = parseFzoneJsonProfile(json)
      const nextPayload = encodeFzoneProfile(nextProfile)

      replaceProfile(nextProfile)
      setRawInput(nextPayload)
      setError('')
      setNotice(`${file.name} importiert.`)
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Die JSON-Datei konnte nicht gelesen werden.')
      setNotice('')
    } finally {
      event.target.value = ''
    }
  }

  async function loadCommunityProfiles() {
    try {
      const response = await fetch('/api/profiles')

      if (!response.ok) {
        throw new Error('Community-API nicht erreichbar.')
      }

      const data = (await response.json()) as { profiles?: CommunityProfile[] }
      setCommunityProfiles(data.profiles ?? [])
      setCommunityAvailable(true)
      setCommunityMessage((data.profiles ?? []).length ? 'Community-Profile geladen.' : 'Noch keine Community-Profile gespeichert.')
    } catch {
      setCommunityAvailable(false)
      setCommunityMessage('Community-Speicher ist auf diesem Hosting noch nicht verbunden.')
    }
  }

  async function publishProfile() {
    if (!encodedPayload || isPublishing) {
      return
    }

    setIsPublishing(true)
    setCommunityMessage('Profil wird veröffentlicht.')

    try {
      const response = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: publishName,
          description: publishDescription,
          tags: publishTags,
          payload: encodedPayload,
          website: '',
        }),
      })

      const data = (await response.json()) as { error?: string; duplicateProfile?: CommunityProfile }

      if (!response.ok) {
        throw new Error(
          data.duplicateProfile
            ? `Dieses Profil existiert bereits: ${data.duplicateProfile.name}.`
            : data.error ?? 'Das Profil konnte nicht gespeichert werden.',
        )
      }

      setCommunityAvailable(true)
      setCommunityMessage('Profil wurde veröffentlicht.')
      await loadCommunityProfiles()
    } catch (exception) {
      setCommunityMessage(exception instanceof Error ? exception.message : 'Das Profil konnte nicht gespeichert werden.')
    } finally {
      setIsPublishing(false)
    }
  }

  async function loadCommunityProfile(id: string) {
    try {
      const response = await fetch(`/api/profiles/${id}`)
      const data = (await response.json()) as { profile?: CommunityProfile & { payload?: string }; error?: string }

      if (!response.ok || !data.profile?.payload) {
        throw new Error(data.error ?? 'Das Profil konnte nicht geladen werden.')
      }

      importPayload(data.profile.payload, `${data.profile.name} geladen.`)
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Das Profil konnte nicht geladen werden.')
      setNotice('')
    }
  }

  async function deleteCommunityProfile(id: string, name: string) {
    if (!adminToken.trim()) {
      setCommunityMessage('Bitte zuerst den Admin-Code eintragen.')
      return
    }

    if (!window.confirm(`Profil "${name}" wirklich löschen?`)) {
      return
    }

    try {
      const response = await fetch(`/api/profiles/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': adminToken.trim() },
      })
      const data = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(data.error ?? 'Das Profil konnte nicht gelöscht werden.')
      }

      setCommunityProfiles((items) => items.filter((item) => item.id !== id))
      setCommunityMessage(`Profil gelöscht: ${name}`)
      await loadCommunityProfiles()
    } catch (exception) {
      setCommunityMessage(exception instanceof Error ? exception.message : 'Das Profil konnte nicht gelöscht werden.')
    }
  }

  function updateAdminToken(value: string) {
    setAdminToken(value)

    if (value.trim()) {
      localStorage.setItem('fzone-admin-token', value.trim())
    } else {
      localStorage.removeItem('fzone-admin-token')
    }
  }

  async function copyModelSuggestion() {
    const header = `04 ${profile.profileId.toString(16).padStart(2, '0').toUpperCase()}`
    const suggestion = [
      'Unknown FZone model suggestion',
      `Prefix: ${profile.prefix}`,
      `Header: ${header}`,
      `Points: ${profile.points.length}`,
      `Payload: ${encodedPayload}`,
    ].join('\n')

    await navigator.clipboard.writeText(suggestion)
    setNotice('Modellvorschlag in die Zwischenablage kopiert.')
  }

  return (
    <main className="app-shell">
      <section className="app-hero">
        <div>
          <p className="eyebrow">FZone Light Lab (by User60311)</p>
          <h1>{text.heroTitle}</h1>
          <p className="hero-copy">
            {text.heroCopy}
          </p>
        </div>
        <div className="hero-status" aria-label="Profilstatus">
          <div className="mode-switch" aria-label={text.viewLabel}>
            <button
              type="button"
              className={interfaceMode === 'simple' ? 'active' : ''}
              onClick={() => setInterfaceMode('simple')}
            >
              Simple
            </button>
            <button
              type="button"
              className={interfaceMode === 'profi' ? 'active' : ''}
              onClick={() => setInterfaceMode('profi')}
            >
              Profi
            </button>
          </div>
          <div className="mode-switch" aria-label={text.languageLabel}>
            <button type="button" className={language === 'de' ? 'active' : ''} onClick={() => setLanguage('de')}>
              DE
            </button>
            <button type="button" className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>
              EN
            </button>
          </div>
          {interfaceMode === 'profi' && (
            <>
              <StatusPill ok={profile.checksumValid} label={text.checksum} />
              <StatusPill ok={profile.lengthValid} label={text.length} />
            </>
          )}
          <div className="metric">
            <strong>{profile.points.length}</strong>
            <span>{text.switchPoints}</span>
          </div>
        </div>
      </section>

      <section className="workspace-grid">
        <aside className="panel import-panel">
          <div className="panel-heading">
            <ScanLine size={20} aria-hidden="true" />
            <h2>{text.importExport}</h2>
          </div>

          <label className="file-drop">
            <FileImage size={22} aria-hidden="true" />
            <span>{text.uploadQr}</span>
            <input type="file" accept="image/*" onChange={decodeImage} />
          </label>

          <label className="file-drop">
            <FileJson size={22} aria-hidden="true" />
            <span>{text.importJson}</span>
            <input type="file" accept="application/json,.json" onChange={importJsonFile} />
          </label>

          {interfaceMode === 'profi' && (
            <>
              <label className="field">
                <span>{text.qrRawData}</span>
                <textarea value={rawInput} onChange={(event) => setRawInput(event.target.value)} spellCheck={false} />
              </label>

              <div className="button-row">
                <button type="button" onClick={() => importPayload(rawInput)}>
                  <QrCode size={17} aria-hidden="true" />
                  {text.decode}
                </button>
                <button type="button" className="ghost" onClick={() => importPayload(SAMPLE_PAYLOADS[1].value)}>
                  <RotateCcw size={17} aria-hidden="true" />
                  {text.reset}
                </button>
              </div>
            </>
          )}

          <div className="sample-list" aria-label={text.samples}>
            {SAMPLE_PAYLOADS.map((sample) => (
              <button type="button" className="sample-button" key={sample.label} onClick={() => importPayload(sample.value, `${sample.label} geladen.`)}>
                {sample.label}
              </button>
            ))}
          </div>

          {(error || notice) && (
            <div className={error ? 'message error' : 'message'}>
              {error ? <AlertTriangle size={18} aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}
              <span>{error || notice}</span>
            </div>
          )}
        </aside>

        <section className="panel editor-panel">
          <div className="panel-heading split">
            <div>
              <p className="section-kicker">{text.curveCreation}</p>
              <h2>{profile.modelLabel}</h2>
              {interfaceMode === 'profi' && (
                <p>
                  Prefix <code>{profile.prefix}</code> / {text.profileIdShort}{' '}
                  <code>{profile.profileId.toString(16).padStart(2, '0').toUpperCase()}</code>
                </p>
              )}
            </div>
            <div className="editor-actions">
              <button type="button" className="ghost" onClick={undoProfile} disabled={!undoStack.length} aria-label={text.undo}>
                <Undo2 size={17} aria-hidden="true" />
              </button>
              <button type="button" className="ghost" onClick={redoProfile} disabled={!redoStack.length} aria-label={text.redo}>
                <Redo2 size={17} aria-hidden="true" />
              </button>
              <button type="button" onClick={addPoint} disabled={profile.points.length >= MAX_POINTS}>
                <Plus size={17} aria-hidden="true" />
                {text.point}
              </button>
            </div>
          </div>

          {interfaceMode === 'profi' && (
            <div className="meta-grid">
              <label className="field">
                <span>Prefix</span>
                <input value={profile.prefix} onChange={(event) => updateProfileMeta('prefix', event.target.value)} />
              </label>
              <label className="field">
                <span>{text.profileIdHex}</span>
                <input
                  value={profile.profileId.toString(16).padStart(2, '0').toUpperCase()}
                  maxLength={2}
                  onChange={(event) => updateProfileMeta('profileId', event.target.value)}
                />
              </label>
            </div>
          )}

          {unknownModel && (
            <div className="unknown-model">
              <AlertTriangle size={18} aria-hidden="true" />
              <div>
                <strong>{text.unknownModel}</strong>
                <p>
                  Prefix <code>{profile.prefix}</code> mit Header{' '}
                  <code>04 {profile.profileId.toString(16).padStart(2, '0').toUpperCase()}</code> {text.unknownModelHelp}
                </p>
              </div>
              <button type="button" className="ghost" onClick={copyModelSuggestion}>
                <Copy size={16} aria-hidden="true" />
                {text.unknownModelAction}
              </button>
            </div>
          )}

          <ProfileChart
            points={profile.points}
            viewMode={chartViewMode}
            lockedChannels={lockedChannels}
            language={language}
            onBeginEdit={() => rememberProfile()}
            onToggleViewMode={() => setChartViewMode((mode) => (mode === 'day' ? 'points' : 'day'))}
            onChangePoint={(id, updates) => updatePointFields(id, updates, false)}
          />

          <div className="channel-locks chart-locks" aria-label={text.channelLocks}>
            <span className="inline-label">{text.channelLocks}</span>
            <div className="lock-grid">
              {channelMeta.map((channel) => (
                <button
                  type="button"
                  className={lockedChannels[channel.key] ? 'lock-button active' : 'lock-button'}
                  key={channel.key}
                  onClick={() => toggleChannelLock(channel.key)}
                >
                  {lockedChannels[channel.key] ? <Lock size={16} aria-hidden="true" /> : <Unlock size={16} aria-hidden="true" />}
                  <i style={{ background: channel.color }} />
                  {channel.label}
                </button>
              ))}
            </div>
          </div>

          <section className="preset-generator">
            <div className="tool-heading">
              <strong>{text.presetGenerator}</strong>
              <span>{text.presetHelp}</span>
            </div>
            <div className="generator-grid">
              <label className="field">
                <span>{text.preset}</span>
                <select
                  value={selectedPresetName}
                  onChange={(event) => setSelectedPresetName(event.target.value)}
                  onInput={(event) => setSelectedPresetName(event.currentTarget.value)}
                >
                  {PRESET_GROUPS.map((group) => (
                    <optgroup key={group.labelDe} label={language === 'de' ? group.labelDe : group.labelEn}>
                      {group.presets.map((presetName) => (
                        <option key={presetName}>{presetName}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{text.start}</span>
                <input
                  type="time"
                  value={presetStartTime}
                  onChange={(event) => setPresetStartTime(event.target.value)}
                  onInput={(event) => setPresetStartTime(event.currentTarget.value)}
                />
              </label>
              <label className="field">
                <span>{text.end}</span>
                <input
                  type="time"
                  value={presetEndTime}
                  onChange={(event) => setPresetEndTime(event.target.value)}
                  onInput={(event) => setPresetEndTime(event.currentTarget.value)}
                />
              </label>
              <button type="button" onClick={generatePreset}>
                <Plus size={17} aria-hidden="true" />
                {text.generate}
              </button>
            </div>
            <p className="generator-description">
              {(LIGHT_PRESETS.find((preset) => preset.name === selectedPresetName) ?? LIGHT_PRESETS[0]).description}
            </p>
          </section>

          <details className="expander-card" open>
            <summary>
              <span>{text.switchPoints}</span>
              <strong>{profile.points.length}</strong>
            </summary>
            <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{language === 'de' ? 'Zeit' : 'Time'}</th>
                  <th>W</th>
                  <th>R</th>
                  <th>G</th>
                  <th>B</th>
                  <th aria-label={text.actions} />
                </tr>
              </thead>
              <tbody>
                {[...profile.points]
                  .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
                  .map((point) => (
                    <tr key={point.id}>
                      <td className="time-cell">
                        <input
                          aria-label={text.hour}
                          type="number"
                          min={0}
                          max={23}
                          value={point.hour}
                          onChange={(event) => updatePoint(point.id, 'hour', Number(event.target.value))}
                        />
                        <span>:</span>
                        <input
                          aria-label={text.minute}
                          type="number"
                          min={0}
                          max={59}
                          value={point.minute}
                          onChange={(event) => updatePoint(point.id, 'minute', Number(event.target.value))}
                        />
                      </td>
                      {channelMeta.map((channel) => (
                        <td key={channel.key}>
                          <input
                            aria-label={`${channel.label} ${text.intensity}`}
                            type="number"
                            min={0}
                            max={MAX_INTENSITY_PERCENT}
                            value={point[channel.key]}
                            disabled={lockedChannels[channel.key]}
                            onChange={(event) => updatePoint(point.id, channel.key, Number(event.target.value))}
                          />
                        </td>
                      ))}
                      <td className="action-cell">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => duplicatePoint(point.id)}
                          disabled={profile.points.length >= MAX_POINTS}
                          aria-label={text.duplicatePoint}
                        >
                          <Copy size={17} aria-hidden="true" />
                        </button>
                        <button type="button" className="icon-button" onClick={() => removePoint(point.id)} aria-label={text.deletePoint}>
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          </details>
        </section>

        <aside className="panel export-panel">
          <div className="panel-heading">
            <QrCode size={20} aria-hidden="true" />
            <h2>Export</h2>
          </div>

          <div className="qr-box">
            <canvas ref={qrCanvasRef} aria-label={text.generatedQr} />
          </div>

          <div className="button-row">
            <button type="button" onClick={copyPayload} disabled={!encodedPayload}>
              <Copy size={17} aria-hidden="true" />
              {text.copy}
            </button>
            <a className="button" href={qrDataUrl} download="fzone-lichtprofil.png">
              <Download size={17} aria-hidden="true" />
              PNG
            </a>
            <a className="button" href={jsonDataUrl} download={jsonFileName}>
              <FileJson size={17} aria-hidden="true" />
              JSON
            </a>
          </div>

          <div className="publish-box">
            <div className="panel-heading mini">
              <Globe2 size={18} aria-hidden="true" />
              <h3>{text.publishProfile}</h3>
            </div>
            <label className="field">
              <span>{text.profileName}</span>
              <input value={publishName} maxLength={80} onChange={(event) => setPublishName(event.target.value)} />
            </label>
            <label className="field">
              <span>{text.description}</span>
              <textarea
                className="compact-textarea"
                value={publishDescription}
                maxLength={360}
                onChange={(event) => setPublishDescription(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Tags</span>
              <input value={publishTags} maxLength={120} placeholder="Low-Tech, CO2, Nano" onChange={(event) => setPublishTags(event.target.value)} />
            </label>
            <button type="button" onClick={publishProfile} disabled={!encodedPayload || isPublishing}>
              <Globe2 size={17} aria-hidden="true" />
              {isPublishing ? text.save : text.publish}
            </button>
          </div>

          {interfaceMode === 'profi' && (
            <>
              <div className="checksum-box">
                <div>
                  <span>{text.newLength}</span>
                  <strong>{generatedProfile?.declaredLength ?? '-'}</strong>
                </div>
                <div>
                  <span>{text.newChecksum}</span>
                  <strong>{generatedProfile ? generatedProfile.checksumActual.toString(16).padStart(2, '0').toUpperCase() : '-'}</strong>
                </div>
              </div>

              <label className="field">
                <span>{text.generatedPayload}</span>
                <textarea className="payload-output" value={encodedPayload} readOnly spellCheck={false} />
              </label>
            </>
          )}
        </aside>

        <aside className="panel storage-panel">
          <div className="panel-heading">
            <Database size={20} aria-hidden="true" />
            <h2>{text.storageSearch}</h2>
          </div>
          <p className={communityAvailable ? 'community-status online' : 'community-status'}>
            {communityMessage}
          </p>
          <div className="community-tools">
            <label className="field">
              <span>{text.search}</span>
              <div className="input-with-icon">
                <Search size={15} aria-hidden="true" />
                <input value={communityQuery} onChange={(event) => setCommunityQuery(event.target.value)} placeholder={text.searchPlaceholder} />
              </div>
            </label>
            <label className="field">
              <span>{text.model}</span>
              <select value={communityModel} onChange={(event) => setCommunityModel(event.target.value)}>
                {modelOptions.map((model) => (
                  <option key={model} value={model}>
                    {model === 'Alle Modelle' ? text.allModels : model}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{text.adminCode}</span>
              <div className="input-with-icon">
                <KeyRound size={15} aria-hidden="true" />
                <input type="password" value={adminToken} onChange={(event) => updateAdminToken(event.target.value)} placeholder={text.optional} />
              </div>
            </label>
            <p className={adminToken.trim() ? 'admin-status active' : 'admin-status'}>
              {adminToken.trim() ? text.adminActive : text.readOnly}
            </p>
          </div>
          <div className="community-list" aria-label={text.communityProfiles}>
            {filteredCommunityProfiles.map((item) => (
              <article className={adminToken.trim() ? 'community-card admin-enabled' : 'community-card'} key={item.id}>
                <button type="button" className="community-load" onClick={() => loadCommunityProfile(item.id)}>
                  <strong>{item.name}</strong>
                  <span>{item.modelLabel}</span>
                  <small>
                    {item.pointCount} {text.points} / {item.startTime}-{item.endTime}
                  </small>
                  <small>
                    Prefix {item.prefix} / Header 04 {item.profileId.toString(16).padStart(2, '0').toUpperCase()}
                  </small>
                  {item.description && <small>{item.description}</small>}
                  <CommunityMeta item={item} language={language} />
                </button>
                {adminToken.trim() && (
                  <div className="community-actions">
                    <button
                      type="button"
                      className="community-delete"
                      onClick={() => deleteCommunityProfile(item.id, item.name)}
                      aria-label={`${item.name} ${text.delete}`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                      {text.delete}
                    </button>
                  </div>
                )}
              </article>
            ))}
            {!filteredCommunityProfiles.length && <p className="empty-state">{text.noProfiles}</p>}
          </div>
        </aside>
      </section>
      <footer className="app-footer">
        {text.footer}
      </footer>
    </main>
  )
}

function CommunityMeta({ item, language }: { item: CommunityProfile; language: UiLanguage }) {
  const text = UI_TEXT[language]
  const date = new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(new Date(item.createdAt))

  return (
    <div className="community-meta">
      <span>{date}</span>
      <span>{text.checksumMeta} {item.checksum}</span>
      {item.tags && <span>{item.tags}</span>}
    </div>
  )
}

function suggestProfileName(profile: FzoneProfile) {
  const sorted = [...profile.points].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
  const first = sorted[0]
  const last = sorted.at(-1)!

  return `${profile.modelLabel} / ${sorted.length} Punkte / ${formatPointTime(first)}-${formatPointTime(last)}`
}

function formatPointTime(point: FzonePoint) {
  return `${point.hour.toString().padStart(2, '0')}:${point.minute.toString().padStart(2, '0')}`
}

function parseTimeInput(value: string) {
  const [hour = '0', minute = '0'] = value.split(':')

  return clamp(Number.parseInt(hour, 10), 0, 23) * 60 + clamp(Number.parseInt(minute, 10), 0, 59)
}

function fitPresetToRange(preset: LightPreset, startMinute: number, endMinute: number) {
  const sorted = [...preset.points].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
  const sourceStart = sorted[0].hour * 60 + sorted[0].minute
  const sourceEnd = sorted.at(-1)!.hour * 60 + sorted.at(-1)!.minute
  const sourceSpan = Math.max(1, sourceEnd - sourceStart)
  const targetSpan = Math.max(1, endMinute - startMinute)

  return sorted.map((point) => {
    const sourceMinute = point.hour * 60 + point.minute
    const targetMinute = clamp(startMinute + ((sourceMinute - sourceStart) / sourceSpan) * targetSpan, 0, 1439)

    return {
      ...point,
      hour: Math.floor(targetMinute / 60),
      minute: targetMinute % 60,
    }
  })
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'fzone-light-profile'
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Bild konnte nicht geladen werden.'))
    image.src = src
  })
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={ok ? 'status-pill ok' : 'status-pill warn'}>
      {ok ? <Check size={15} aria-hidden="true" /> : <AlertTriangle size={15} aria-hidden="true" />}
      {label}
    </span>
  )
}

function ProfileChart({
  points,
  viewMode,
  lockedChannels,
  language,
  onBeginEdit,
  onToggleViewMode,
  onChangePoint,
}: {
  points: FzonePoint[]
  viewMode: 'day' | 'points'
  lockedChannels: Record<ChannelKey, boolean>
  language: UiLanguage
  onBeginEdit: () => void
  onToggleViewMode: () => void
  onChangePoint: (id: string, updates: Partial<Pick<FzonePoint, 'hour' | 'minute' | ChannelKey>>) => void
}) {
  const text = UI_TEXT[language]
  const svgRef = useRef<SVGSVGElement>(null)
  const [dragTarget, setDragTarget] = useState<
    { pointId: string; channel: ChannelKey } | { pointId: string; mode: 'time' } | null
  >(null)
  const [dragTooltip, setDragTooltip] = useState<{ x: number; y: number; label: string } | null>(null)
  const sorted = [...points].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
  const firstMinute = sorted[0] ? sorted[0].hour * 60 + sorted[0].minute : 0
  const lastMinute = sorted.at(-1) ? sorted.at(-1)!.hour * 60 + sorted.at(-1)!.minute : 1440
  const zoomPaddingMinutes = 60
  const domainStart = viewMode === 'points' ? clamp(firstMinute - zoomPaddingMinutes, 0, 1440) : 0
  const domainEnd =
    viewMode === 'points'
      ? Math.max(domainStart + 1, clamp(lastMinute + zoomPaddingMinutes, 0, 1440))
      : 1440
  const chartSize = { width: 1200, height: 420 }
  const plot = { left: 72, right: 1172, top: 26, bottom: 342 }
  const plotWidth = plot.right - plot.left
  const plotHeight = plot.bottom - plot.top
  const x = (point: FzonePoint) => plot.left + (((point.hour * 60 + point.minute) - domainStart) / (domainEnd - domainStart)) * plotWidth
  const y = (value: number) => plot.bottom - (clamp(value, 0, MAX_INTENSITY_PERCENT) / MAX_INTENSITY_PERCENT) * plotHeight
  const xTicks = buildHourTicks(domainStart, domainEnd)
  const yTicks = [0, 25, 50, 75, 100]

  function updateFromPointer(
    event: PointerEvent<SVGElement>,
    target: { pointId: string; channel: ChannelKey } | { pointId: string; mode: 'time' },
  ) {
    const box = svgRef.current?.getBoundingClientRect()

    if (!box) {
      return
    }

    const pointerX = ((event.clientX - box.left) / box.width) * chartSize.width
    const pointerY = ((event.clientY - box.top) / box.height) * chartSize.height
    const minuteOfDay = clamp(
      ((pointerX - plot.left) / plotWidth) * (domainEnd - domainStart) + domainStart,
      0,
      1439,
    )
    const value = clamp(((plot.bottom - pointerY) / plotHeight) * MAX_INTENSITY_PERCENT, 0, MAX_INTENSITY_PERCENT)
    const timeUpdates = {
      hour: Math.floor(minuteOfDay / 60),
      minute: minuteOfDay % 60,
    }

    if ('mode' in target) {
      onChangePoint(target.pointId, timeUpdates)
      setDragTooltip({
        x: clamp(pointerX + 16, 90, chartSize.width - 190),
        y: 360,
        label: `${language === 'de' ? 'Zeit' : 'Time'} ${formatAxisTime(timeUpdates.hour * 60 + timeUpdates.minute)}`,
      })
      return
    }

    if (lockedChannels[target.channel]) {
      return
    }

    const currentPoint = sorted.find((point) => point.id === target.pointId)
    const currentMinute = currentPoint ? currentPoint.hour * 60 + currentPoint.minute : timeUpdates.hour * 60 + timeUpdates.minute

    onChangePoint(target.pointId, {
      [target.channel]: value,
    })
    setDragTooltip({
      x: clamp(pointerX + 16, 90, chartSize.width - 210),
      y: clamp(pointerY - 18, 38, 318),
      label: `${formatAxisTime(currentMinute)} / ${channelLabel(target.channel)} ${Math.round(value)}%`,
    })
  }

  function startDrag(event: PointerEvent<SVGCircleElement>, pointId: string, channel: ChannelKey) {
    if (lockedChannels[channel]) {
      return
    }

    const target = { pointId, channel }

    event.currentTarget.setPointerCapture(event.pointerId)
    onBeginEdit()
    setDragTarget(target)
    updateFromPointer(event, target)
  }

  function startTimeDrag(event: PointerEvent<SVGCircleElement>, pointId: string) {
    const target = { pointId, mode: 'time' as const }

    event.currentTarget.setPointerCapture(event.pointerId)
    onBeginEdit()
    setDragTarget(target)
    updateFromPointer(event, target)
  }

  function moveDrag(event: PointerEvent<SVGSVGElement>) {
    if (!dragTarget) {
      return
    }

    updateFromPointer(event, dragTarget)
  }

  return (
    <div className="chart-panel" aria-label={text.chartLabel}>
      <div className="chart-toolbar">
        <div>
          <strong>{text.lightCurve}</strong>
          <span>{text.chartHelp}</span>
        </div>
        <button type="button" className="ghost" onClick={onToggleViewMode}>
          {viewMode === 'day' ? text.zoomPoints : text.showFullDay}
        </button>
      </div>
      <div className="chart">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${chartSize.width} ${chartSize.height}`}
          role="img"
          onPointerMove={moveDrag}
          onPointerUp={() => {
            setDragTarget(null)
            setDragTooltip(null)
          }}
          onPointerLeave={() => {
            setDragTarget(null)
            setDragTooltip(null)
          }}
        >
          <title>{text.chartLabel}</title>
          <line x1={plot.left} x2={plot.left} y1={plot.top} y2={plot.bottom} className="axis-line" />
          <line x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom} className="axis-line" />
          {xTicks.map((minute) => (
            <g key={minute}>
              <line x1={minuteToChartX(minute, domainStart, domainEnd, plot.left, plotWidth)} x2={minuteToChartX(minute, domainStart, domainEnd, plot.left, plotWidth)} y1={plot.top} y2={plot.bottom} className="grid-line" />
              <text x={minuteToChartX(minute, domainStart, domainEnd, plot.left, plotWidth)} y="375" className="axis-label">
                {formatAxisTime(minute)}
              </text>
            </g>
          ))}
          {yTicks.map((percent) => {
            const tickY = plot.bottom - (percent / 100) * plotHeight

            return (
              <g key={percent}>
                <line x1={plot.left} x2={plot.right} y1={tickY} y2={tickY} className="grid-line horizontal" />
                <text x="18" y={tickY + 5} className="axis-label percent">
                  {percent}%
                </text>
              </g>
            )
          })}
          {channelMeta.map((channel) => (
            <g key={channel.key}>
              <polyline
                points={sorted.map((point) => `${x(point)},${y(point[channel.key])}`).join(' ')}
                className={`chart-line ${channel.key}`}
                vectorEffect="non-scaling-stroke"
              />
              {sorted.map((point) => (
                <circle
                  key={`${point.id}-${channel.key}`}
                  cx={x(point)}
                  cy={y(point[channel.key])}
                  r="6"
                  className={lockedChannels[channel.key] ? `chart-handle ${channel.key} locked` : `chart-handle ${channel.key}`}
                  vectorEffect="non-scaling-stroke"
                  onPointerDown={(event) => startDrag(event, point.id, channel.key)}
                />
              ))}
            </g>
          ))}
          <line x1={plot.left} x2={plot.right} y1="395" y2="395" className="time-rail" />
          {sorted.map((point) => (
            <g key={`time-${point.id}`}>
              <line x1={x(point)} x2={x(point)} y1={plot.bottom} y2="395" className="time-guide" />
              <circle
                cx={x(point)}
                cy="395"
                r="7"
                className="time-handle"
                vectorEffect="non-scaling-stroke"
                onPointerDown={(event) => startTimeDrag(event, point.id)}
              />
            </g>
          ))}
          {dragTooltip && (
            <g className="drag-tooltip">
              <rect x={dragTooltip.x} y={dragTooltip.y - 24} width="176" height="30" rx="6" />
              <text x={dragTooltip.x + 10} y={dragTooltip.y - 5}>
                {dragTooltip.label}
              </text>
            </g>
          )}
        </svg>
        <div className="chart-legend">
          {channelMeta.map((channel) => (
            <span key={channel.key}>
              <i style={{ background: channel.color }} />
              {channel.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function buildHourTicks(domainStart: number, domainEnd: number) {
  const span = domainEnd - domainStart
  const step = span <= 180 ? 30 : span <= 480 ? 60 : span <= 900 ? 180 : 360
  const first = Math.ceil(domainStart / step) * step
  const ticks = [domainStart, ...Array.from({ length: Math.floor((domainEnd - first) / step) + 1 }, (_, index) => first + index * step), domainEnd]

  return Array.from(new Set(ticks.filter((minute) => minute >= domainStart && minute <= domainEnd)))
}

function minuteToChartX(minute: number, domainStart: number, domainEnd: number, left: number, width: number) {
  return left + ((minute - domainStart) / (domainEnd - domainStart)) * width
}

function formatAxisTime(minute: number) {
  if (minute >= 1440) {
    return '24:00'
  }

  return `${Math.floor(minute / 60).toString().padStart(2, '0')}:${(minute % 60).toString().padStart(2, '0')}`
}

function channelLabel(channel: ChannelKey) {
  return channelMeta.find((item) => item.key === channel)?.label ?? channel
}

function isChannelKey(key: keyof FzonePoint): key is ChannelKey {
  return channelMeta.some((item) => item.key === key)
}

export default App
