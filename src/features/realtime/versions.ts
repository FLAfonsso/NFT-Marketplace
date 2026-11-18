import type { RealtimeEvent } from '@/contracts'

/** Recursos acompanhados ao mesmo tempo; o menos recente sai primeiro. */
export const MAX_TRACKED_RESOURCES = 500
/** Ids de evento lembrados por recurso. */
export const MAX_IDS_PER_RESOURCE = 20

interface ResourceEntry {
  version: number
  /** Ids já vistos, do mais antigo ao mais novo. */
  ids: string[]
}

export type EventVerdict = 'accept' | 'duplicate' | 'stale'

const resourceKey = (event: RealtimeEvent) => `${event.resource.type}:${event.resource.id}`

/**
 * Controle de versão por recurso (Map recurso -> última version e ids vistos), com tamanho
 * limitado. Um evento é descartado se o id já foi visto (duplicata) ou se a version é menor
 * ou igual à conhecida aqui ou à do dado em cache (evento antigo).
 */
export class VersionTracker {
  private entries = new Map<string, ResourceEntry>()

  check(event: RealtimeEvent, cachedVersion?: number): EventVerdict {
    const entry = this.entries.get(resourceKey(event))
    if (entry?.ids.includes(event.id)) return 'duplicate'
    if (entry && event.version <= entry.version) return 'stale'
    if (cachedVersion !== undefined && event.version <= cachedVersion) return 'stale'
    return 'accept'
  }

  /** Marca o evento como aplicado: a version passa a ser o piso do recurso. */
  record(event: RealtimeEvent) {
    const key = resourceKey(event)
    const entry = this.entries.get(key) ?? { version: 0, ids: [] }
    // Reinserir move o recurso para o fim (mais recente).
    this.entries.delete(key)
    entry.version = Math.max(entry.version, event.version)
    if (!entry.ids.includes(event.id)) entry.ids.push(event.id)
    if (entry.ids.length > MAX_IDS_PER_RESOURCE) entry.ids.shift()
    this.entries.set(key, entry)

    while (this.entries.size > MAX_TRACKED_RESOURCES) {
      const oldest = this.entries.keys().next().value
      if (oldest === undefined) break
      this.entries.delete(oldest)
    }
  }

  clear() {
    this.entries.clear()
  }

  get size() {
    return this.entries.size
  }
}
