const canonicalizeSearchParams = (params: URLSearchParams) => {
  const next = new URLSearchParams()
  Array.from(params.entries())
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey === rightKey) {
        return leftValue.localeCompare(rightValue)
      }
      return leftKey.localeCompare(rightKey)
    })
    .forEach(([key, value]) => {
      next.append(key, value)
    })
  return next
}

export const sanitizeWorkspaceSearchWithIgnoredParams = (
  search = "",
  ignoredParams: string[] = ["pwd", "preview"],
) => {
  if (!search) return ""

  const normalized = search.startsWith("?") ? search.slice(1) : search
  if (!normalized) return ""

  const params = new URLSearchParams(normalized)
  ignoredParams.forEach((key) => {
    params.delete(key)
  })

  const nextSearch = canonicalizeSearchParams(params).toString()
  return nextSearch ? `?${nextSearch}` : ""
}

export const sanitizeWorkspaceSearch = (search = "") =>
  sanitizeWorkspaceSearchWithIgnoredParams(search, ["pwd", "preview"])

export const getUrlPassword = (search = "") => {
  const normalized = search.startsWith("?") ? search.slice(1) : search
  const password = new URLSearchParams(normalized).get("pwd")
  return password || undefined
}

export const isSameWorkspaceRoute = (
  leftPathname: string,
  leftSearch = "",
  rightPathname: string,
  rightSearch = "",
) =>
  leftPathname === rightPathname &&
  sanitizeWorkspaceSearch(leftSearch) === sanitizeWorkspaceSearch(rightSearch)

const folderScopedSearchParams = new Set(["page", "view"])

const getParentFolderPath = (pathname: string) => {
  const lastSlashIndex = pathname.lastIndexOf("/")
  return lastSlashIndex <= 0 ? "/" : pathname.slice(0, lastSlashIndex)
}

export const normalizeFolderRouteSearch = (search = "") => {
  if (!search) return ""

  const normalized = search.startsWith("?") ? search.slice(1) : search
  if (!normalized) return ""

  const params = new URLSearchParams(normalized)
  const next = new URLSearchParams()

  params.forEach((value, key) => {
    if (folderScopedSearchParams.has(key)) {
      next.append(key, value)
    }
  })

  const nextSearch = canonicalizeSearchParams(next).toString()
  return nextSearch ? `?${nextSearch}` : ""
}

export const normalizeFileRouteToFolderRoute = (
  pathname: string,
  search = "",
) => ({
  pathname: getParentFolderPath(pathname),
  search: normalizeFolderRouteSearch(search),
})
