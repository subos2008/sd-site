import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listInterests, setProfileInterests } from './api'

export function useInterests() {
  return useQuery({
    queryKey: ['interests'],
    queryFn: listInterests,
    staleTime: 60 * 60 * 1000,  // hour
  })
}

export function useSetProfileInterests() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: setProfileInterests,
    meta: { suppressGlobalError: true },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-profile'] }),
  })
}
