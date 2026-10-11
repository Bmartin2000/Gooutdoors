/** Client-side image intake: type/size limits, EXIF-aware decoding and downscaling. */

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const MAX_INPUT_BYTES = 25 * 1024 * 1024
const STORE_MAX_SIDE = 1280
const INFERENCE_MAX_SIDE = 640

export class ImageIntakeError extends Error {}

export interface PreparedImage {
  blob: Blob
  width: number
  height: number
  mimeType: 'image/jpeg'
}

async function decode(source: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(source, { imageOrientation: 'from-image' })
  } catch {
    throw new ImageIntakeError('This image could not be read. Try a JPEG, PNG or WebP photo.')
  }
}

async function encode(bitmap: ImageBitmap, maxSide: number, quality: number): Promise<PreparedImage> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new ImageIntakeError('Your browser could not process the image.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) throw new ImageIntakeError('Your browser could not process the image.')
  return { blob, width, height, mimeType: 'image/jpeg' }
}

/**
 * Validates and re-encodes a photo for local storage. Re-encoding through a canvas also
 * strips EXIF metadata (including any GPS tags) before the photo is stored or shared.
 */
export async function prepareForStorage(file: Blob): Promise<PreparedImage> {
  // Some Android/iOS pickers report an empty type; let the decoder decide in that case.
  if (file.type && !(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    throw new ImageIntakeError('Please use a JPEG, PNG or WebP image.')
  }
  if (file.size > MAX_INPUT_BYTES) throw new ImageIntakeError('That image is larger than 25 MB.')
  const bitmap = await decode(file)
  try {
    return await encode(bitmap, STORE_MAX_SIDE, 0.86)
  } finally {
    bitmap.close()
  }
}

/** Smaller copy for the vision model: CPU inference time grows with image tokens. */
export async function toInferenceBase64(stored: Blob): Promise<string> {
  const bitmap = await decode(stored)
  try {
    const { blob } = await encode(bitmap, INFERENCE_MAX_SIDE, 0.82)
    return blobToBase64(blob)
  } finally {
    bitmap.close()
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const bytes = atob(base64)
  const array = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i)
  return new Blob([array], { type: mimeType })
}
