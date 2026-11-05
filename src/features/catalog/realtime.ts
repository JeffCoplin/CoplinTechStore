import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

/**
 * Canal único de Broadcast público "catalog". La base de datos emite solo
 * { kind, slug } (sin precios, costos ni cantidades); los suscriptores vuelven a
 * consultar las RPC públicas. Se comparte entre componentes con conteo de
 * referencias para no duplicar suscripciones.
 */

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'disconnected'

export interface CatalogChangeEvent {
  kind: 'product' | 'category' | 'store'
  slug: string | null
}

type Listener = (event: CatalogChangeEvent) => void

let channel: RealtimeChannel | null = null
let refCount = 0
let status: RealtimeStatus = 'idle'
let retryTimer: ReturnType<typeof setTimeout> | null = null
let retryAttempt = 0
const listeners = new Set<Listener>()
const statusListeners = new Set<() => void>()

function setStatus(next: RealtimeStatus) {
  if (status === next) return
  status = next
  statusListeners.forEach((l) => l())
}

function parseEvent(payload: unknown): CatalogChangeEvent | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as { kind?: unknown; slug?: unknown }
  if (p.kind !== 'product' && p.kind !== 'category' && p.kind !== 'store') return null
  return { kind: p.kind, slug: typeof p.slug === 'string' ? p.slug : null }
}

function connect() {
  if (channel) return
  setStatus('connecting')
  const ch = supabase.channel('catalog', { config: { private: false, broadcast: { self: false } } })
  ch.on('broadcast', { event: 'catalog_changed' }, ({ payload }) => {
    const event = parseEvent(payload)
    if (event) listeners.forEach((l) => l(event))
  })
  ch.subscribe((state) => {
    if (state === 'SUBSCRIBED') {
      const wasReconnect = retryAttempt > 0
      retryAttempt = 0
      setStatus('connected')
      // Tras reconectar pudo perderse algún evento: forzar revalidación.
      if (wasReconnect) listeners.forEach((l) => l({ kind: 'store', slug: null }))
    } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
      setStatus('disconnected')
      scheduleReconnect()
    }
  })
  channel = ch
}

function scheduleReconnect() {
  if (refCount === 0 || retryTimer) return
  retryAttempt += 1
  const delay = Math.min(30_000, 1_000 * 2 ** Math.min(retryAttempt, 5))
  retryTimer = setTimeout(() => {
    retryTimer = null
    if (refCount === 0) return
    const old = channel
    channel = null
    if (old) void supabase.removeChannel(old)
    connect()
  }, delay)
}

function disconnect() {
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
  retryAttempt = 0
  const old = channel
  channel = null
  if (old) void supabase.removeChannel(old)
  setStatus('idle')
}

export function subscribeCatalogChanges(listener: Listener): () => void {
  listeners.add(listener)
  refCount += 1
  connect()
  return () => {
    listeners.delete(listener)
    refCount = Math.max(0, refCount - 1)
    if (refCount === 0) disconnect()
  }
}

export function getRealtimeStatus(): RealtimeStatus {
  return status
}

export function onRealtimeStatusChange(listener: () => void): () => void {
  statusListeners.add(listener)
  return () => statusListeners.delete(listener)
}
