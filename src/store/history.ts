import {
  activeFileSessionId,
  hasFileSession,
  ObjStore,
  objStore,
  State,
} from "./obj"
import { sanitizeWorkspaceSearch } from "./workspace-route"
import { bus, trimBase } from "~/utils"

interface HistorySnapshot {
  obj: object
  page: number
  scroll: number
}

type HistoryRoute = {
  pathname: string
  search: string
}

type ActiveSessionHistory = {
  sessionId: string
  snapshots: Map<string, HistorySnapshot>
}

// Keep snapshots only for the currently active workspace session. This allows
// same-session back/forward restoration across multiple routes while still
// dropping the whole snapshot set when the user switches workspaces.
let activeSessionHistory: ActiveSessionHistory | null = null

const waitForNextFrame = () => {
  return new Promise((resolve) => setTimeout(resolve))
}

const decodePathSafely = (pathname: string) => {
  try {
    return decodeURIComponent(pathname)
  } catch (_error) {
    return pathname
  }
}

const normalizeRoute = (pathname: string, search = ""): HistoryRoute => {
  return {
    pathname: trimBase(
      decodePathSafely(pathname.split("?")[0] || pathname || "/"),
    ),
    search: sanitizeWorkspaceSearch(search),
  }
}

const resolveRouteKey = (pathname: string, search = "") => {
  const route = normalizeRoute(pathname, search)
  return `${route.pathname}${route.search}`
}

const getSessionHistory = (sessionId = activeFileSessionId()) => {
  if (!sessionId || activeSessionHistory?.sessionId !== sessionId) {
    return undefined
  }
  return activeSessionHistory.snapshots
}

const parseHistoryHref = (href: string): HistoryRoute | null => {
  if (!href || href.startsWith("#")) return null
  try {
    const base =
      typeof window !== "undefined"
        ? window.location.href
        : "https://example.invalid/"
    const url = new URL(href, base)
    if (
      typeof window !== "undefined" &&
      url.origin !== window.location.origin
    ) {
      return null
    }
    return normalizeRoute(url.pathname, url.search)
  } catch (_error) {
    const [pathname, ...searchParts] = href.split("?")
    if (!pathname) return null
    return normalizeRoute(
      pathname,
      searchParts.length ? `?${searchParts.join("?")}` : "",
    )
  }
}

export const recordHistory = ({
  pathname,
  search = "",
  page = 1,
  sessionId = activeFileSessionId(),
}: {
  pathname: string
  search?: string
  page?: number
  sessionId?: string
}) => {
  if (!sessionId || !hasFileSession(sessionId)) return
  if (
    ![State.FetchingMore, State.Folder, State.File].includes(objStore.state)
  ) {
    return
  }
  const obj = JSON.parse(JSON.stringify(objStore))
  if (objStore.state === State.FetchingMore) {
    obj.state = State.Folder
  }
  const routeKey = resolveRouteKey(pathname, search)
  if (!routeKey) return
  if (activeSessionHistory?.sessionId !== sessionId) {
    activeSessionHistory = {
      sessionId,
      snapshots: new Map(),
    }
  }
  activeSessionHistory.snapshots.set(routeKey, {
    obj,
    page,
    scroll: typeof window !== "undefined" ? window.scrollY : 0,
  })
}

export const hasHistory = ({
  pathname,
  search = "",
  sessionId = activeFileSessionId(),
}: {
  pathname: string
  search?: string
  sessionId?: string
}) => {
  return (
    getSessionHistory(sessionId)?.has(resolveRouteKey(pathname, search)) ??
    false
  )
}

export const recoverHistory = async ({
  pathname,
  search = "",
  sessionId = activeFileSessionId(),
  syncPage,
}: {
  pathname: string
  search?: string
  sessionId?: string
  syncPage?: (page: number) => void
}) => {
  const history = getSessionHistory(sessionId)?.get(
    resolveRouteKey(pathname, search),
  )
  if (!history) {
    return false
  }
  syncPage?.(history.page)
  ObjStore.setState(State.Initial)
  await waitForNextFrame()
  ObjStore.set(JSON.parse(JSON.stringify(history.obj)))
  await waitForNextFrame()
  if (typeof window !== "undefined") {
    window.scroll({ top: history.scroll })
  }
  return true
}

export const clearHistory = ({
  pathname,
  search = "",
  sessionId = activeFileSessionId(),
}: {
  pathname: string
  search?: string
  sessionId?: string
}) => {
  const snapshots = getSessionHistory(sessionId)
  if (!snapshots) {
    return
  }
  snapshots.delete(resolveRouteKey(pathname, search))
  if (snapshots.size === 0) {
    activeSessionHistory = null
  }
}

export const clearHistoryForSession = (sessionId: string) => {
  if (activeSessionHistory?.sessionId === sessionId) {
    activeSessionHistory = null
  }
}

const clearHistoryOnSessionClone = () => {
  activeSessionHistory = null
}

export const clearHistoryByHref = (
  href: string,
  sessionId = activeFileSessionId(),
) => {
  const route = parseHistoryHref(href)
  if (!route) return
  clearHistory({ ...route, sessionId })
}

export const __resetHistoryForTests = () => {
  activeSessionHistory = null
}

bus.on("file_session_closed", clearHistoryForSession)
bus.on("file_session_password_changed", clearHistoryForSession)
bus.on("file_session_cloned", clearHistoryOnSessionClone)

if (typeof document !== "undefined") {
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement | null
      const link = target?.closest("a")
      const href = link?.getAttribute("href")
      if (!href) return
      clearHistoryByHref(href)
    },
    true,
  )
}
