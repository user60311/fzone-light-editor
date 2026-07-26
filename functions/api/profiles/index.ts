import { cleanText, error, json } from '../../_shared/http'
import { parsePayload } from '../../_shared/fzone'

type Env = {
  DB: D1Database
  ADMIN_TOKEN?: string
}

type CommunityProfileRow = {
  id: string
  name: string
  description: string
  model_label: string
  prefix: string
  profile_id: number
  point_count: number
  start_time: string
  end_time: string
  checksum: string
  tags: string
  created_at: string
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url)
  const model = cleanText(url.searchParams.get('model'), 80)

  const query = model
    ? env.DB.prepare(
        `SELECT id, name, description, model_label, prefix, profile_id, point_count, start_time, end_time, checksum, tags, created_at
         FROM community_profiles
         WHERE model_label = ?
         ORDER BY created_at DESC
         LIMIT 100`,
      ).bind(model)
    : env.DB.prepare(
        `SELECT id, name, description, model_label, prefix, profile_id, point_count, start_time, end_time, checksum, tags, created_at
         FROM community_profiles
         ORDER BY created_at DESC
         LIMIT 100`,
      )

  const result = await query.all<CommunityProfileRow>()

  return json({
    profiles: (result.results ?? []).map(rowToProfile),
  })
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  let body: Record<string, unknown>

  try {
    body = await request.json()
  } catch {
    return error('Die Anfrage enthält kein gültiges JSON.')
  }

  const honeypot = cleanText(body.website, 200)

  if (honeypot) {
    return error('Dieses Profil wurde nicht gespeichert.', 422)
  }

  const name = cleanText(body.name, 80)
  const description = cleanText(body.description, 360)
  const tags = cleanText(body.tags, 120)
  const payload = cleanText(body.payload, 4200)

  if (name.length < 3) {
    return error('Bitte gib einen Profilnamen mit mindestens 3 Zeichen ein.')
  }

  if (!payload) {
    return error('Kein QR-Payload übergeben.')
  }

  let parsed

  try {
    parsed = parsePayload(payload)
  } catch (exception) {
    return error(exception instanceof Error ? exception.message : 'Das Profil konnte nicht validiert werden.')
  }

  const id = crypto.randomUUID()

  try {
    await env.DB.prepare(
      `INSERT INTO community_profiles
       (id, name, description, model_label, prefix, profile_id, point_count, start_time, end_time, payload, checksum, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        name,
        description,
        parsed.modelLabel,
        parsed.prefix,
        parsed.profileId,
        parsed.pointCount,
        parsed.startTime,
        parsed.endTime,
        payload,
        parsed.checksum,
        tags,
      )
      .run()
  } catch {
    const duplicate = await env.DB.prepare(
      `SELECT id, name, description, model_label, prefix, profile_id, point_count, start_time, end_time, checksum, tags, created_at
       FROM community_profiles
       WHERE payload = ?`,
    )
      .bind(payload)
      .first<CommunityProfileRow>()

    return json(
      {
        error: duplicate
          ? `Dieses Profil existiert bereits: ${duplicate.name}.`
          : 'Dieses Profil ist bereits in der Community-Bibliothek gespeichert.',
        duplicateProfile: duplicate ? rowToProfile(duplicate) : undefined,
      },
      { status: 409 },
    )
  }

  return json(
    {
      profile: {
        id,
        name,
        description,
        modelLabel: parsed.modelLabel,
        prefix: parsed.prefix,
        profileId: parsed.profileId,
        pointCount: parsed.pointCount,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        checksum: parsed.checksum,
        tags,
        createdAt: new Date().toISOString(),
      },
    },
    { status: 201 },
  )
}

function rowToProfile(row: CommunityProfileRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    modelLabel: row.model_label,
    prefix: row.prefix,
    profileId: row.profile_id,
    pointCount: row.point_count,
    startTime: row.start_time,
    endTime: row.end_time,
    checksum: row.checksum,
    tags: row.tags,
    createdAt: row.created_at,
  }
}
