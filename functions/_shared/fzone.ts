type Point = {
  hour: number
  minute: number
}

type ParsedPayload = {
  modelLabel: string
  prefix: string
  profileId: number
  pointCount: number
  startTime: string
  endTime: string
  checksum: string
}

const RECORD_SIZE = 10

export function parsePayload(payload: string): ParsedPayload {
  const compact = payload.replace(/\s+/g, '').trim()
  const aaIndex = compact.search(/AA/i)

  if (aaIndex < 1) {
    throw new Error('Kein FZone-Prefix gefunden.')
  }

  const prefix = compact.slice(0, aaIndex)
  const hex = compact.slice(aaIndex)

  if (hex.length % 2 !== 0 || !/^[\da-f]+$/i.test(hex)) {
    throw new Error('Ungültiger Hex-Datenblock.')
  }

  const bytes = hex.match(/.{2}/g)!.map((pair) => Number.parseInt(pair, 16))

  if (bytes.length < 7 || bytes[0] !== 0xaa || bytes[1] !== 0x06 || bytes[2] !== 0x00 || bytes[4] !== 0x04) {
    throw new Error('Das Profil passt nicht zum bekannten FZone-Schema.')
  }

  const declaredLength = bytes[3]
  const profileId = bytes[5]
  const checksumActual = bytes.at(-1)!
  const checksumExpected = checksumFor(bytes.slice(0, -1))

  if (declaredLength !== bytes.length - 5) {
    throw new Error('Das Längenfeld ist ungültig.')
  }

  if (checksumActual !== checksumExpected) {
    throw new Error('Die Checksumme ist ungültig.')
  }

  const records = bytes.slice(6, -1)

  if (records.length % RECORD_SIZE !== 0) {
    throw new Error('Die Schaltpunkte passen nicht in 10-Byte-Blöcke.')
  }

  const points: Point[] = []

  for (let index = 0; index < records.length; index += RECORD_SIZE) {
    const hour = records[index]
    const minute = records[index + 1]

    if (hour > 23 || minute > 59) {
      throw new Error('Mindestens ein Schaltpunkt hat eine ungültige Uhrzeit.')
    }

    points.push({ hour, minute })
  }

  if (points.length < 1 || points.length > 24) {
    throw new Error('Unterstützt sind 1 bis 24 Schaltpunkte.')
  }

  return {
    modelLabel: modelLabelForProfile(prefix, profileId),
    prefix,
    profileId,
    pointCount: points.length,
    startTime: formatTime(points[0]),
    endTime: formatTime(points.at(-1)!),
    checksum: checksumActual.toString(16).padStart(2, '0').toUpperCase(),
  }
}

function modelLabelForProfile(prefix: string, profileId: number) {
  const normalized = prefix.toLowerCase()

  if (normalized === 'smartaqua_brite55' && profileId === 0x11) {
    return 'FZONE Brite Light 120'
  }

  if (normalized === 'smartaqua_brite55' && profileId === 0x12) {
    return 'FZONE Brite 55'
  }

  if (normalized === 'fzone_solo55') {
    return 'FZONE Solo 55'
  }

  return `Unbekanntes Modell (${prefix})`
}

function checksumFor(bytes: number[]) {
  return (bytes.reduce((sum, byte) => sum + byte, 0) + 0x55) & 0xff
}

function formatTime(point: Point) {
  return `${point.hour.toString().padStart(2, '0')}:${point.minute.toString().padStart(2, '0')}`
}
