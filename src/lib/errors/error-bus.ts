import type { AppError } from './app-error'

const MAX_QUEUE = 5
let queue: AppError[] = []
const listeners = new Set<() => void>()

function emit(): void {
  for (const l of listeners) l()
}

function sameError(a: AppError, b: AppError): boolean {
  return a.kind === b.kind && a.message === b.message && a.rpc === b.rpc
}

export function reportError(e: AppError): void {
  if (queue.length > 0 && sameError(queue[0], e)) return
  queue = [e, ...queue].slice(0, MAX_QUEUE)
  emit()
}

export function dismiss(index: number): void {
  queue = queue.filter((_, i) => i !== index)
  emit()
}

export function clear(): void {
  if (queue.length === 0) return
  queue = []
  emit()
}

export function getSnapshot(): AppError[] {
  return queue
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
