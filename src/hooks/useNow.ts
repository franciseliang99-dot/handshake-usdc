import { useState } from 'react'

/** Returns the unix timestamp (seconds) captured once at mount time. */
export function useNow(): bigint {
  const [now] = useState(() => BigInt(Math.floor(Date.now() / 1000)))
  return now
}
