export function orderStatusBadgeClass(status: string): string {
  if (status === 'PAID') {
    return 'bg-emerald-100 text-emerald-800'
  }

  if (status === 'AWAITING_PAYMENT') {
    return 'bg-amber-100 text-amber-900'
  }

  if (status === 'MISSED_DEADLINE') {
    return 'bg-orange-100 text-orange-900'
  }

  if (status === 'CANCELLED') {
    return 'bg-rose-100 text-rose-800'
  }

  return 'bg-slate-100 text-slate-700'
}
