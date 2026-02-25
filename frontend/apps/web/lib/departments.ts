import { buildServerApiHeaders, buildServerApiUrl } from '@/lib/server-api'

export type DepartmentOption = {
  id: string
  name: string
}

export async function getPublicDepartments(): Promise<DepartmentOption[]> {
  const departmentsUrl = buildServerApiUrl('/api/departments/')
  if (!departmentsUrl) {
    return []
  }

  try {
    const response = await fetch(departmentsUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: buildServerApiHeaders()
    })

    if (!response.ok) {
      return []
    }

    const payload = (await response.json()) as {
      results?: Array<{ id?: string; name: string }>
    }

    return (payload.results || [])
      .filter((department) => Boolean(department.id))
      .map((department) => ({
        id: department.id as string,
        name: department.name
      }))
  } catch {
    return []
  }
}
