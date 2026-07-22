// Client-side image compression before upload.
// Resizes to a max dimension and re-encodes as JPEG at a reasonable quality,
// so phone photos (often 4-8MB) upload fast and reliably instead of being
// rejected outright by a hard size limit.

const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.8

export function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    // Skip compression for already-small files or non-image types we can't safely re-encode (e.g. HEIC in some browsers)
    if (!file.type.startsWith('image/')) {
      resolve(file)
      return
    }

    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      let { width, height } = img
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height / width) * MAX_DIMENSION)
          width = MAX_DIMENSION
        } else {
          width = Math.round((width / height) * MAX_DIMENSION)
          height = MAX_DIMENSION
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(file); return }
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        blob => {
          if (!blob) { resolve(file); return }
          // If compression somehow produced a larger file (rare, tiny images), keep the original
          if (blob.size >= file.size) { resolve(file); return }
          const compressedName = file.name.replace(/\.(heic|heif|png|webp)$/i, '.jpg')
          const compressedFile = new File([blob], compressedName, { type: 'image/jpeg', lastModified: Date.now() })
          resolve(compressedFile)
        },
        'image/jpeg',
        JPEG_QUALITY
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      // If the browser can't decode it (e.g. some HEIC cases), fall back to the original file
      resolve(file)
    }

    img.src = objectUrl
  })
}
