import { cleanText, error, json } from '../functions/_shared/http'
import { parsePayload } from '../functions/_shared/fzone'

type Env = {
  ASSETS: Fetcher
  DB?: D1Database
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

type ProfileDetailRow = CommunityProfileRow & {
  payload: string
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/api/profiles' && request.method === 'GET') {
      return listProfiles(env, request)
    }

    if (url.pathname === '/api/profiles' && request.method === 'POST') {
      return createProfile(env, request)
    }

    const detailMatch = url.pathname.match(/^\/api\/profiles\/([\da-f-]{36})$/i)

    if (detailMatch && request.method === 'GET') {
      return getProfile(env, detailMatch[1])
    }

    if (detailMatch && request.method === 'DELETE') {
      return deleteProfile(env, request, detailMatch[1])
    }

    if (url.pathname.startsWith('/api/')) {
      return error('API-Endpunkt nicht gefunden.', 404)
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>

async function listProfiles(env: Env, request: Request) {
  const db = requireDb(env)

  if (db instanceof Response) {
    return db
  }

  const url = new URL(request.url)
  const model = cleanText(url.searchParams.get('model'), 80)

  const query = model
    ? db
        .prepare(
          `SELECT id, name, description, model_label, prefix, profile_id, point_count, start_time, end_time, checksum, tags, created_at
           FROM community_profiles
           WHERE model_label = ?
           ORDER BY created_at DESC
           LIMIT 100`,
        )
        .bind(model)
    : db.prepare(
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

async function createProfile(env: Env, request: Request) {
  const db = requireDb(env)

  if (db instanceof Response) {
    return db
  }

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
    await db
      .prepare(
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
    const duplicate = await db
      .prepare(
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

async function getProfile(env: Env, id: string) {
  const db = requireDb(env)

  if (db instanceof Response) {
    return db
  }

  const row = await db
    .prepare(
      `SELECT id, name, description, model_label, prefix, profile_id, point_count, start_time, end_time, payload, checksum, tags, created_at
       FROM community_profiles
       WHERE id = ?`,
    )
    .bind(id)
    .first<ProfileDetailRow>()

  if (!row) {
    return error('Profil nicht gefunden.', 404)
  }

  return json({
    profile: {
      ...rowToProfile(row),
      payload: row.payload,
    },
  })
}

async function deleteProfile(env: Env, request: Request, id: string) {
  const db = requireDb(env)

  if (db instanceof Response) {
    return db
  }

  const auth = authorizeAdmin(env, request)

  if (auth instanceof Response) {
    return auth
  }

  const result = await db.prepare('DELETE FROM community_profiles WHERE id = ?').bind(id).run()

  if (!result.meta.changes) {
    return error('Profil nicht gefunden.', 404)
  }

  return json({ deleted: true })
}

function requireDb(env: Env) {
  if (!env.DB) {
    return error('Community-Speicher ist noch nicht verbunden.', 503)
  }

  return env.DB
}

function authorizeAdmin(env: Env, request: Request) {
  if (!env.ADMIN_TOKEN) {
    return error('Admin-Löschen ist noch nicht eingerichtet.', 503)
  }

  const token = request.headers.get('x-admin-token') ?? ''

  if (!token || token !== env.ADMIN_TOKEN) {
    return error('Admin-Code ist ungültig.', 401)
  }

  return true
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
