export type ChannelKey = 'white' | 'red' | 'green' | 'blue'

export type FzonePoint = {
  id: string
  hour: number
  minute: number
  white: number
  red: number
  green: number
  blue: number
}

export type FzoneProfile = {
  prefix: string
  modelLabel: string
  profileType: number
  profileId: number
  declaredLength: number
  rawBytes: number[]
  checksumExpected: number
  checksumActual: number
  checksumValid: boolean
  lengthValid: boolean
  points: FzonePoint[]
}

export const MAX_POINTS = 24
export const RECORD_SIZE = 10

export const SAMPLE_PAYLOADS = [
  {
    label: 'FZONE Solo 55, 10 Punkte',
    value:
      'fzone_solo55AA0600660410071e000000000000000008001403070a00000000090028060e12000000000a003c0a161c000000000b00500e1e23000000000d005a122028000000000f004b0d1a2000000000101e3208101200000000111e1903080900000000121e0000000000000000cf',
  },
  {
    label: 'FZONE Brite 55, 10 Punkte',
    value:
      'smartaqua_brite55AA0600660412071e000000000000000008001403070a00000000090028060e12000000000a003c0a161c000000000b00500e1e23000000000d005a122028000000000f004b0d1a2000000000101e3208101200000000111e1903080900000000121e0000000000000000d1',
  },
  {
    label: 'FZONE Bright Light 120, 19 Punkte',
    value:
      'smartaqua_brite55AA0600C004110B0000000000000000000B020002000F000000000B0F00080223000000000B2300120A38000000000B3705231948000000000C1416373055000000000C322C46465D000000000D1E41505462000000000E1E52555E64000000000F1E5E58636400000000101E645A646400000000121E645A646400000000131E4E554E64000000001400324C345F00000000141E163E1C52000000001500042C0A400000000015140016032800000000152D00080012000000001600000000000000000001',
  },
]

export function normalizePayload(payload: string) {
  return payload.replace(/\s+/g, '').trim()
}

export function modelLabelForPrefix(prefix: string) {
  const normalized = prefix.toLowerCase()

  if (normalized === 'fzone_solo55') {
    return 'FZONE Solo 55'
  }

  if (normalized === 'smartaqua_brite55') {
    return 'FZONE Brite 55'
  }

  return prefix ? `Unbekanntes Modell (${prefix})` : 'Unbekanntes Modell'
}

export function modelLabelForProfile(prefix: string, profileId: number) {
  const normalized = prefix.toLowerCase()

  if (normalized === 'smartaqua_brite55' && profileId === 0x11) {
    return 'FZONE Bright Light 120'
  }

  if (normalized === 'smartaqua_brite55' && profileId === 0x12) {
    return 'FZONE Brite 55'
  }

  return modelLabelForPrefix(prefix)
}

export function parseFzonePayload(payload: string): FzoneProfile {
  const compact = normalizePayload(payload)
  const aaIndex = compact.search(/AA/i)

  if (aaIndex < 1) {
    throw new Error('Kein Modell-Prefix vor der AA-Startkennung gefunden.')
  }

  const prefix = compact.slice(0, aaIndex)
  const hex = compact.slice(aaIndex)

  if (hex.length % 2 !== 0 || !/^[\da-f]+$/i.test(hex)) {
    throw new Error('Der Datenblock nach dem Prefix ist kein gueltiger Hex-String.')
  }

  const bytes = hexToBytes(hex)

  if (bytes.length < 7) {
    throw new Error('Der Datenblock ist zu kurz fuer ein FZone-Lichtprofil.')
  }

  if (bytes[0] !== 0xaa || bytes[1] !== 0x06) {
    throw new Error('Startkennung oder Befehlstyp passen nicht zum bekannten FZone-Schema.')
  }

  if (bytes[2] !== 0x00) {
    throw new Error('Das dritte Header-Byte ist unerwartet. Dieses Profil wird noch nicht unterstuetzt.')
  }

  const declaredLength = bytes[3]
  const profileType = bytes[4]
  const profileId = bytes[5]
  const checksumActual = bytes.at(-1)!
  const checksumExpected = checksumFor(bytes.slice(0, -1))
  const lengthValid = declaredLength === bytes.length - 5
  const records = bytes.slice(6, -1)

  if (profileType !== 0x04) {
    throw new Error('Der Profiltyp ist nicht 04. Dieses Format ist noch nicht sicher bekannt.')
  }

  if (records.length % RECORD_SIZE !== 0) {
    throw new Error('Die Schaltpunkte passen nicht in 10-Byte-Bloecke.')
  }

  const points = chunk(records, RECORD_SIZE).map((record, index) => parsePoint(record, index))

  if (points.length > MAX_POINTS) {
    throw new Error(`Das Profil enthaelt ${points.length} Punkte. Unterstuetzt sind derzeit bis ${MAX_POINTS}.`)
  }

  return {
    prefix,
    modelLabel: modelLabelForProfile(prefix, profileId),
    profileType,
    profileId,
    declaredLength,
    rawBytes: bytes,
    checksumExpected,
    checksumActual,
    checksumValid: checksumExpected === checksumActual,
    lengthValid,
    points,
  }
}

export function encodeFzoneProfile(profile: Pick<FzoneProfile, 'prefix' | 'profileId'> & { points: FzonePoint[] }) {
  if (!profile.prefix.trim()) {
    throw new Error('Bitte einen Modell-Prefix eintragen.')
  }

  if (profile.points.length < 1) {
    throw new Error('Mindestens ein Schaltpunkt ist erforderlich.')
  }

  if (profile.points.length > MAX_POINTS) {
    throw new Error(`Maximal ${MAX_POINTS} Schaltpunkte sind vorgesehen.`)
  }

  const sortedPoints = [...profile.points].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
  const records = sortedPoints.flatMap(pointToRecord)
  const declaredLength = records.length + 2
  const body = [0xaa, 0x06, 0x00, declaredLength, 0x04, clampByte(profile.profileId), ...records]
  const checksum = checksumFor(body)

  return `${profile.prefix}${bytesToHex([...body, checksum])}`
}

export function checksumFor(bytes: number[]) {
  return (bytes.reduce((sum, byte) => sum + byte, 0) + 0x55) & 0xff
}

export function bytesToHex(bytes: number[]) {
  return bytes.map((byte) => clampByte(byte).toString(16).padStart(2, '0')).join('').toUpperCase()
}

function hexToBytes(hex: string) {
  return hex.match(/.{2}/g)!.map((pair) => Number.parseInt(pair, 16))
}

function parsePoint(record: number[], index: number): FzonePoint {
  const [hour, minute, white, green, blue, red] = record

  if (hour > 23 || minute > 59) {
    throw new Error(`Schaltpunkt ${index + 1} hat eine ungueltige Uhrzeit.`)
  }

  return {
    id: crypto.randomUUID(),
    hour,
    minute,
    white,
    red,
    green,
    blue,
  }
}

function pointToRecord(point: FzonePoint) {
  return [
    clamp(point.hour, 0, 23),
    clamp(point.minute, 0, 59),
    clampByte(point.white),
    clampByte(point.green),
    clampByte(point.blue),
    clampByte(point.red),
    0,
    0,
    0,
    0,
  ]
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

export function clampByte(value: number) {
  return clamp(value, 0, 255)
}

export function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) {
    return min
  }

  return Math.min(max, Math.max(min, Math.round(value)))
}
