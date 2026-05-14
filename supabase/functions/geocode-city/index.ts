// geocode-city — accepts {place_name: string}, queries postcodes.io /places,
// returns {display_name, lat, lng} or 404 if not found.
//
// Why: postcodes.io has no API key and is server-trusted enough for MVP UK only.
// Pre-launch: swap for Mapbox/Nominatim for global coverage; that swap happens
// inside this file and nowhere else.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

interface PostcodesIoPlace {
  name_1: string
  county_unitary: string | null
  region: string | null
  longitude: number
  latitude: number
}

interface PostcodesIoResponse {
  status: number
  result: PostcodesIoPlace[] | null
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    })
  }

  let body: { place_name?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  const placeName = body.place_name?.trim()
  if (!placeName || placeName.length < 2) {
    return new Response(JSON.stringify({ ok: false, error: 'place_name_required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  const url = `https://api.postcodes.io/places?q=${encodeURIComponent(placeName)}`
  const upstream = await fetch(url, { headers: { accept: 'application/json' } })
  if (!upstream.ok) {
    return new Response(JSON.stringify({ ok: false, error: 'upstream_error' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    })
  }
  const data: PostcodesIoResponse = await upstream.json()
  if (!data.result || data.result.length === 0) {
    return new Response(JSON.stringify({ ok: false, error: 'not_found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    })
  }

  const top = data.result[0]
  const labelParts = [top.name_1, top.county_unitary ?? top.region].filter(Boolean)
  const display_name = labelParts.join(', ')

  return new Response(
    JSON.stringify({
      ok: true,
      display_name,
      lat: top.latitude,
      lng: top.longitude,
    }),
    { headers: { 'content-type': 'application/json' } },
  )
})
