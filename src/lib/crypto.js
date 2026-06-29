/**
 * Criptografia AES-GCM 256-bit usando Web Crypto API nativa.
 * A chave vem da variável de ambiente VITE_ENCRYPTION_KEY.
 * Campos sensíveis (razao_social, cnpj, email, etc.) são criptografados
 * antes de salvar no banco e descriptografados ao buscar.
 *
 * Formato do valor criptografado: "ENC:<base64(iv + ciphertext)>"
 */

const KEY_RAW = import.meta.env.VITE_ENCRYPTION_KEY // string hex de 64 chars (256 bits)

let _key = null

async function getKey() {
  if (_key) return _key
  if (!KEY_RAW) {
    console.warn('[crypto] VITE_ENCRYPTION_KEY não definida — criptografia desabilitada')
    return null
  }
  const keyBytes = hexToBytes(KEY_RAW)
  _key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
  return _key
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  return bytes
}

function arrayBufferToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

function base64ToArrayBuffer(b64) {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

export async function encrypt(plaintext) {
  if (!plaintext) return plaintext
  const key = await getKey()
  if (!key) return plaintext // sem chave → texto puro (dev)
  if (typeof plaintext !== 'string') return plaintext
  if (plaintext.startsWith('ENC:')) return plaintext // já criptografado

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)

  // Concatena iv (12 bytes) + ciphertext e converte para base64
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return 'ENC:' + arrayBufferToBase64(combined.buffer)
}

export async function decrypt(value) {
  if (!value || !String(value).startsWith('ENC:')) return value
  const key = await getKey()
  if (!key) return value

  try {
    const combined = new Uint8Array(base64ToArrayBuffer(value.slice(4)))
    const iv = combined.slice(0, 12)
    const ciphertext = combined.slice(12)
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
    return new TextDecoder().decode(plainBuf)
  } catch {
    return value // falha ao descriptografar → retorna valor original
  }
}

// Criptografa um objeto nos campos especificados
export async function encryptFields(obj, fields) {
  const result = { ...obj }
  for (const f of fields) {
    if (result[f]) result[f] = await encrypt(String(result[f]))
  }
  return result
}

// Descriptografa um objeto nos campos especificados
export async function decryptFields(obj, fields) {
  if (!obj) return obj
  const result = { ...obj }
  for (const f of fields) {
    if (result[f]) result[f] = await decrypt(String(result[f]))
  }
  return result
}

// Descriptografa um array de objetos
export async function decryptMany(arr, fields) {
  if (!arr) return arr
  return Promise.all(arr.map(obj => decryptFields(obj, fields)))
}
