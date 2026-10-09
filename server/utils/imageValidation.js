import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'

export function hashImageBuffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

export function isValidBase64(value) {
  if (!value.length || value.length % 4 !== 0) return false

  const paddingLength = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0
  const contentLength = value.length - paddingLength
  if (!contentLength) return false

  for (let index = 0; index < contentLength; index += 1) {
    const code = value.charCodeAt(index)
    const isLetter = (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
    const isDigit = code >= 48 && code <= 57
    if (!isLetter && !isDigit && code !== 43 && code !== 47) return false
  }

  return true
}

export function imageSignatureMatches(buffer, mimeType) {
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  }

  if (mimeType === 'image/png') {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  }

  if (mimeType === 'image/webp') {
    return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
  }

  return false
}
