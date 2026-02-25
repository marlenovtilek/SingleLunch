export type DepartmentOption = {
  id: string
  name: string
}

export async function getPublicDepartments(): Promise<DepartmentOption[]> {
  const apiUrl = process.env.API_URL
  if (!apiUrl) {
    return []
  }

  try {
    const response = await fetch(`${apiUrl}/api/departments/`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'X-Forwarded-Proto': 'https'
      }
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
