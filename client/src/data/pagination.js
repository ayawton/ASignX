export function pageNumbers(current, total, neighbors = 1) {
 if (total <= 5 && (neighbors > 0 || total <= 3)) return Array.from({ length: total }, (_, index) => index + 1)
 const pages = new Set([1, total, current])
 const start = current <= 2 ? 2 : Math.max(2, current - neighbors)
 const end = current >= total - 1 ? total - 1 : Math.min(total - 1, current + neighbors)
 for (let page = start; page <= end; page++) pages.add(page)
 if (neighbors && current <= 2) pages.add(3)
 if (neighbors && current >= total - 1) pages.add(total - 2)
 const result = []
 for (const page of [...pages].sort((a, b) => a - b)) {
  const previous = result.at(-1)
  if (typeof previous === 'number' && page - previous > 1) result.push('gap-' + page)
  result.push(page)
 }
 return result
}
