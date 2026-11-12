import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { PILOT_SEATS_FALLBACK } from '../config'

export type Seats = { total: number; taken: number; remaining: number; loaded: boolean }

export function useSeats(): Seats {
  const [s, setS] = useState<Seats>({ total: PILOT_SEATS_FALLBACK, taken: 0, remaining: PILOT_SEATS_FALLBACK, loaded: false })
  useEffect(() => {
    if (!supabase) return
    let alive = true
    supabase.rpc('pilot_seats').then(({ data, error }) => {
      if (!alive || error || !data?.[0]) return
      const r = data[0] as { total: number; taken: number; remaining: number }
      setS({ ...r, loaded: true })
    })
    return () => { alive = false }
  }, [])
  return s
}
