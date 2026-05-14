import { supabase } from '@/lib/supabase'
import { GeocodeCityResult } from '@shared/rpc-contracts'

export async function geocodeCity(placeName: string) {
  const { data, error } = await supabase.functions.invoke('geocode-city', {
    body: { place_name: placeName },
  })
  if (error) throw error
  return GeocodeCityResult.parse(data)
}
