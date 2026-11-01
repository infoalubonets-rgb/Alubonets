export function eventStartMs(startsAt: Date | string) {
  return startsAt instanceof Date ? startsAt.getTime() : new Date(startsAt).getTime()
}

/** Split a cached event list using the request clock so a passed date becomes Past, not hidden. */
export function partitionEventsByStart<T extends { startsAt: Date | string }>(
  rows: T[],
  now: Date = new Date(),
) {
  const nowMs = now.getTime()
  const upcoming: T[] = []
  const past: T[] = []
  for (const row of rows) {
    if (eventStartMs(row.startsAt) >= nowMs) upcoming.push(row)
    else past.push(row)
  }
  upcoming.sort((a, b) => eventStartMs(a.startsAt) - eventStartMs(b.startsAt))
  past.sort((a, b) => eventStartMs(b.startsAt) - eventStartMs(a.startsAt))
  return { upcoming, past }
}

export function eventDeleteSnapshot(event: {
  id: string
  title: string
  description?: string | null
  location?: string | null
  mapsUrl?: string | null
  startsAt: Date
  endsAt?: Date | null
  imageUrl?: string | null
  isPublic: boolean
  audienceType: string
  capacity?: number | null
}) {
  return {
    id: event.id,
    title: event.title,
    description: event.description ?? null,
    location: event.location ?? null,
    mapsUrl: event.mapsUrl ?? null,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    imageUrl: event.imageUrl ?? null,
    isPublic: event.isPublic,
    audienceType: event.audienceType,
    capacity: event.capacity ?? null,
  }
}
