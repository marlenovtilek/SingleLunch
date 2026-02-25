import { buildServerApiHeaders, buildServerApiUrl } from '@/lib/server-api'

type Branding = {
  projectName: string
  logoUrl: string | null
  paymentQrUrl: string | null
  lunchPrice: string
}

const fallbackBranding: Branding = {
  projectName: 'SingleLunch',
  logoUrl: null,
  paymentQrUrl: null,
  lunchPrice: '170.00'
}

export async function getBranding(): Promise<Branding> {
  const brandingUrl = buildServerApiUrl('/api/branding/')
  if (!brandingUrl) {
    return fallbackBranding
  }

  try {
    const response = await fetch(brandingUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: buildServerApiHeaders()
    })
    if (!response.ok) {
      return fallbackBranding
    }

    const payload = (await response.json()) as {
      project_name?: string
      logo_url?: string | null
      payment_qr_url?: string | null
      lunch_price?: string
    }

    return {
      projectName:
        typeof payload.project_name === 'string' &&
        payload.project_name.trim().length > 0
          ? payload.project_name
          : fallbackBranding.projectName,
      logoUrl:
        typeof payload.logo_url === 'string' && payload.logo_url.length > 0
          ? payload.logo_url
          : null,
      paymentQrUrl:
        typeof payload.payment_qr_url === 'string' &&
        payload.payment_qr_url.length > 0
          ? payload.payment_qr_url
          : null,
      lunchPrice:
        typeof payload.lunch_price === 'string' &&
        payload.lunch_price.length > 0
          ? payload.lunch_price
          : fallbackBranding.lunchPrice
    }
  } catch {
    return fallbackBranding
  }
}
