type Branding = {
  projectName: string
  logoUrl: string | null
  paymentQrUrl: string | null
}

const fallbackBranding: Branding = {
  projectName: 'SingleLunch',
  logoUrl: null,
  paymentQrUrl: null
}

export async function getBranding(): Promise<Branding> {
  const apiUrl = process.env.API_URL
  if (!apiUrl) {
    return fallbackBranding
  }

  try {
    const response = await fetch(`${apiUrl}/api/branding/`, {
      method: 'GET',
      cache: 'no-store'
    })
    if (!response.ok) {
      return fallbackBranding
    }

    const payload = (await response.json()) as {
      project_name?: string
      logo_url?: string | null
      payment_qr_url?: string | null
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
          : null
    }
  } catch {
    return fallbackBranding
  }
}
