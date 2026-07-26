import { describe, expect, it } from 'vitest'
import { SAMPLE_PAYLOADS, encodeFzoneProfile, parseFzonePayload } from './fzone'

describe('FZone profile parser', () => {
  it('parses all known sample payloads with valid length and checksum', () => {
    const profiles = SAMPLE_PAYLOADS.map((sample) => parseFzonePayload(sample.value))

    expect(profiles.map((profile) => profile.points.length)).toEqual([10, 10, 19])
    expect(profiles.map((profile) => profile.modelLabel)).toEqual([
      'FZONE Solo 55',
      'FZONE Brite 55',
      'FZONE Brite Light 120',
    ])
    expect(profiles.every((profile) => profile.lengthValid)).toBe(true)
    expect(profiles.every((profile) => profile.checksumValid)).toBe(true)
    expect(profiles.map((profile) => profile.checksumActual)).toEqual([0xcf, 0xd1, 0x01])
  })

  it('maps internal WGBR records to display WRGB points', () => {
    const profile = parseFzonePayload(SAMPLE_PAYLOADS[1].value)
    const secondPoint = profile.points[1]

    expect(secondPoint).toMatchObject({
      hour: 8,
      minute: 0,
      white: 20,
      red: 10,
      green: 3,
      blue: 7,
    })
  })

  it('re-encodes a parsed payload to a valid profile', () => {
    const original = parseFzonePayload(SAMPLE_PAYLOADS[2].value)
    const encoded = encodeFzoneProfile(original)
    const reparsed = parseFzonePayload(encoded)

    expect(reparsed.modelLabel).toBe('FZONE Brite Light 120')
    expect(reparsed.points).toHaveLength(19)
    expect(reparsed.lengthValid).toBe(true)
    expect(reparsed.checksumValid).toBe(true)
    expect(reparsed.checksumActual).toBe(0x01)
  })
})
