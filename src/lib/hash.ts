// SHA-256 hex of a Blob/File. Production uses WebCrypto. Tests pass deterministic Files.
export async function sha256Hex(input: Blob | ArrayBuffer): Promise<string> {
  const buffer = input instanceof ArrayBuffer ? input : await input.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
