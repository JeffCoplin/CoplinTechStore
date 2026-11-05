/** Normaliza un número de WhatsApp a solo dígitos (formato internacional sin "+"). */
export function normalizeWhatsappNumber(raw: string): string {
  return raw.replace(/\D/g, '')
}

export function isValidWhatsappNumber(digits: string): boolean {
  return /^[0-9]{8,15}$/.test(digits)
}

/** Enlace wa.me con mensaje prellenado. Devuelve null si no hay número configurado. */
export function buildWhatsappLink(number: string | null | undefined, productName: string, productUrl: string): string | null {
  if (!number || !isValidWhatsappNumber(number)) return null
  const text = `Hola, me interesa este producto: ${productName}\n${productUrl}`
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}
