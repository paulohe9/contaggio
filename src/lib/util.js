// Utilitários compartilhados (datas sem problema de fuso, moeda, WhatsApp)

export function hojeISO(offsetDias = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDias)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

export function isoDe(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function addMesesISO(iso, n) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const ultimoDia = new Date(y, m - 1 + n + 1, 0).getDate()
  return isoDe(new Date(y, m - 1 + n, Math.min(d, ultimoDia)))
}

// 'AAAA-MM-DD' → 'DD/MM/AAAA' sem converter fuso
export function fmtData(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function fmtBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0)
}

export function diasDesde(isoDateTime) {
  if (!isoDateTime) return 0
  return Math.floor((Date.now() - new Date(isoDateTime).getTime()) / 86400000)
}

export function soDigitos(s) {
  return (s || '').replace(/\D/g, '')
}

// Monta link wa.me — acrescenta 55 se o número vier sem DDI
export function waLink(telefone, mensagem = '') {
  let n = soDigitos(telefone)
  if (!n) return null
  if (n.length <= 11) n = '55' + n
  return `https://wa.me/${n}${mensagem ? `?text=${encodeURIComponent(mensagem)}` : ''}`
}

export const inputBase = {
  padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13,
  background: 'white', outline: 'none', boxSizing: 'border-box',
}
