import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { searchPlaces, setProfileLocation } from './api'

export function useSearchPlaces(query: string) {
  return useQuery({
    queryKey: ['search-places', query],
    queryFn: () => searchPlaces(query),
    enabled: query.length >= 2,
    staleTime: 60_000,
    // Rendered inline by PlaceCombobox; a toast per keystroke would be noise.
    meta: { suppressGlobalError: true },
  })
}

export function useSetLocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { place_id: number }) => setProfileLocation(args.place_id),
    meta: { suppressGlobalError: true },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-profile'] }),
  })
}
