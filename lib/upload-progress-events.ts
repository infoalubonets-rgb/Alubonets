export type UploadProgressEvent = {
  id: string
  label: string
  percent: number
  status: 'uploading' | 'done' | 'error'
  message?: string
}

const EVENT_NAME = 'app-upload-progress'

/** Broadcasts an upload's progress so a toast can show it even after the form that started it unmounts. */
export function emitUploadProgress(event: UploadProgressEvent) {
  window.dispatchEvent(new CustomEvent<UploadProgressEvent>(EVENT_NAME, { detail: event }))
}

export function onUploadProgress(handler: (event: UploadProgressEvent) => void) {
  const listener = (event: Event) => handler((event as CustomEvent<UploadProgressEvent>).detail)
  window.addEventListener(EVENT_NAME, listener)
  return () => window.removeEventListener(EVENT_NAME, listener)
}
