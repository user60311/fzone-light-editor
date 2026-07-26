import { error, json } from '../../_shared/http'

type Env = {
  DB: D1Database
  ADMIN_TOKEN?: string
}

type ProfileDetailRow = {
  id: string
  name: string
  description: string
  model_label: string
  prefix: string
  profile_id: number
  point_count: number
  start_time: string
  end_time: string
  payload: string
  checksum: string
  tags: string
  created_at: string
}

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const id = typeof params.id === 'string' ? params.id : ''

  if (!/^[\da-f-]{36}$/i.test(id)) {
    return error('Ungültige Profil-ID.', 400)
  }

  const row = await env.DB.prepare(
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
      id: row.id,
      name: row.name,
      description: row.description,
      modelLabel: row.model_label,
      prefix: row.prefix,
      profileId: row.profile_id,
      pointCount: row.point_count,
      startTime: row.start_time,
      endTime: row.end_time,
      payload: row.payload,
      checksum: row.checksum,
      tags: row.tags,
      createdAt: row.created_at,
    },
  })
}

export const onRequestDelete: PagesFunction<Env> = async ({ env, params, request }) => {
  const id = typeof params.id === 'string' ? params.id : ''

  if (!/^[\da-f-]{36}$/i.test(id)) {
    return error('Ungültige Profil-ID.', 400)
  }

  if (!env.ADMIN_TOKEN) {
    return error('Admin-Löschen ist noch nicht eingerichtet.', 503)
  }

  if ((request.headers.get('x-admin-token') ?? '') !== env.ADMIN_TOKEN) {
    return error('Admin-Code ist ungültig.', 401)
  }

  const result = await env.DB.prepare('DELETE FROM community_profiles WHERE id = ?').bind(id).run()

  if (!result.meta.changes) {
    return error('Profil nicht gefunden.', 404)
  }

  return json({ deleted: true })
}
