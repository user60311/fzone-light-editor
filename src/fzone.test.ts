import { describe, expect, it } from 'vitest'
import { SAMPLE_PAYLOADS, encodeFzoneProfile, parseFzoneJsonProfile, parseFzonePayload, profileToJson } from './fzone'

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

  it('exports and imports an editable JSON profile', () => {
    const original = parseFzonePayload(SAMPLE_PAYLOADS[2].value)
    const json = profileToJson(original)
    const imported = parseFzoneJsonProfile(json)

    expect(json.format).toBe('fzone-light-lab-profile')
    expect(json.profileIdHex).toBe('11')
    expect(imported.modelLabel).toBe('FZONE Brite Light 120')
    expect(encodeFzoneProfile(imported)).toBe(encodeFzoneProfile(original))
  })

  it('recognizes User Light 60311 by new prefix and legacy alias', () => {
    const baseProfile = {
      profileId: 0x01,
      points: parseFzonePayload(SAMPLE_PAYLOADS[1].value).points.slice(0, 2),
    }
    const renamed = parseFzonePayload(encodeFzoneProfile({ ...baseProfile, prefix: 'user_light_60311' }))
    const legacy = parseFzonePayload(encodeFzoneProfile({ ...baseProfile, prefix: 'aquarium_hg221' }))

    expect(renamed.modelLabel).toBe('User Light 60311')
    expect(legacy.modelLabel).toBe('User Light 60311')
  })
})
