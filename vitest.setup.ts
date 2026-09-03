function createStorage(): Storage {
  const entries = new Map<string, string>()

  return {
    get length() {
      return entries.size
    },
    clear() {
      entries.clear()
    },
    getItem(key: string) {
      return entries.get(key) ?? null
    },
    key(index: number) {
      return Array.from(entries.keys())[index] ?? null
    },
    removeItem(key: string) {
      entries.delete(key)
    },
    setItem(key: string, value: string) {
      entries.set(key, String(value))
    },
  }
}

for (const storageKey of [`localStorage`, `sessionStorage`] as const) {
  const storage = createStorage()

  for (const target of [globalThis, window]) {
    Object.defineProperty(target, storageKey, {
      configurable: true,
      enumerable: true,
      value: storage,
    })
  }
}
