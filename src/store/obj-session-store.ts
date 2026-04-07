import { cookieStorage, createStorageSignal } from "@solid-primitives/storage"
import { createMemo } from "solid-js"
import { createStore, unwrap } from "solid-js/store"
import { nanoid } from "nanoid"
import { bus } from "~/utils"
import { local } from "./local_settings"
import { createObjLayoutController } from "./obj-layout"
import { sanitizeWorkspaceSearch } from "./workspace-route"

export type LayoutType = "list" | "grid" | "image"

const isLayoutType = (value: string): value is LayoutType =>
  value === "list" || value === "grid" || value === "image"

export type FileSession = {
  id: string
  pathname: string
  search: string
}

export type FileSessionSummary = Pick<FileSession, "id" | "pathname" | "search">
export type FileSessionRoute = Pick<FileSession, "pathname" | "search">

type StoredFileSessionState = {
  activeId: string
  sessions: FileSession[]
}

const FILE_SESSIONS_KEY = "file-sessions-lite-v2"
const ACTIVE_FILE_SESSION_KEY = "file-sessions-lite-active-v2"
const FILE_SESSION_PASSWORDS_KEY = "file-sessions-lite-passwords-v1"
const LAYOUT_RECORD_KEY = "layoutRecord"
const PASSWORD_RECORD_KEY = "route-passwords-v2"
const LEGACY_BROWSER_PASSWORD_KEY = "browser-password"
const GLOBAL_PASSWORD_SCOPE_KEY = "global:browser-password"

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const getRouteKey = (pathname: string, search = "") =>
  `${pathname}${sanitizeWorkspaceSearch(search)}`
const getSharePasswordScopeKey = (pathname: string) => {
  const segments = pathname.split("/").filter(Boolean)
  if (segments[0] !== "@s" || !segments[1]) {
    return pathname
  }
  return `/@s/${segments[1]}`
}
const getPasswordScopeKey = (pathname = "/") =>
  pathname.startsWith("/@s/")
    ? getSharePasswordScopeKey(pathname)
    : GLOBAL_PASSWORD_SCOPE_KEY

const readStoredSessionState = (): StoredFileSessionState => {
  if (typeof window === "undefined") {
    return { activeId: "", sessions: [] }
  }
  try {
    const rawSessions = sessionStorage.getItem(FILE_SESSIONS_KEY)
    const rawActiveId = sessionStorage.getItem(ACTIVE_FILE_SESSION_KEY) || ""
    const parsedSessions = rawSessions
      ? (JSON.parse(rawSessions) as unknown)
      : []
    const sessions = Array.isArray(parsedSessions)
      ? parsedSessions.filter((session): session is FileSession => {
          const candidate = session as FileSession
          return (
            typeof session === "object" &&
            session !== null &&
            typeof candidate.id === "string" &&
            typeof candidate.pathname === "string" &&
            typeof candidate.search === "string"
          )
        })
      : []
    return {
      activeId: rawActiveId,
      sessions,
    }
  } catch (_error) {
    return { activeId: "", sessions: [] }
  }
}

const readLegacyBrowserPassword = () => {
  if (typeof window === "undefined") {
    return ""
  }
  try {
    return cookieStorage.getItem(LEGACY_BROWSER_PASSWORD_KEY) || ""
  } catch (_error) {
    return ""
  }
}

const readStoredPasswordRecord = (): Record<string, string> => {
  if (typeof window === "undefined") {
    return {}
  }
  try {
    const rawPasswordRecord = sessionStorage.getItem(PASSWORD_RECORD_KEY)
    const parsedPasswordRecord = rawPasswordRecord
      ? (JSON.parse(rawPasswordRecord) as unknown)
      : null
    if (parsedPasswordRecord && typeof parsedPasswordRecord === "object") {
      return Object.fromEntries(
        Object.entries(parsedPasswordRecord).filter(
          ([key, value]) =>
            typeof key === "string" && typeof value === "string",
        ),
      )
    }
  } catch (_error) {
    // Fall through to legacy migration.
  }

  const migratedRecord: Record<string, string> = {}
  const legacyBrowserPassword = readLegacyBrowserPassword()
  if (legacyBrowserPassword && !migratedRecord[GLOBAL_PASSWORD_SCOPE_KEY]) {
    migratedRecord[GLOBAL_PASSWORD_SCOPE_KEY] = legacyBrowserPassword
  }

  return migratedRecord
}

const readStoredLayoutRecord = (): Record<string, LayoutType> => {
  if (typeof window === "undefined") {
    return {}
  }
  try {
    const rawLayoutRecord = localStorage.getItem(LAYOUT_RECORD_KEY)
    const parsedLayoutRecord = rawLayoutRecord
      ? (JSON.parse(rawLayoutRecord) as unknown)
      : {}
    if (!parsedLayoutRecord || typeof parsedLayoutRecord !== "object") {
      return {}
    }
    return Object.fromEntries(
      Object.entries(parsedLayoutRecord).filter(
        ([pathname, layout]) =>
          typeof pathname === "string" && isLayoutType(String(layout)),
      ),
    ) as Record<string, LayoutType>
  } catch (_error) {
    return {}
  }
}

export const createObjSessionStore = ({
  clearSelection,
}: {
  clearSelection: () => void
}) => {
  const initialSessionState = readStoredSessionState()
  const [fileSessionsStore, setFileSessionsStore] =
    createStore<StoredFileSessionState>(initialSessionState)
  const [fileSessionPasswords, setFileSessionPasswords] = createStore<
    Record<string, string>
  >(readStoredPasswordRecord())
  const [layoutRecord, setLayoutRecord] = createStore<
    Record<string, LayoutType>
  >(readStoredLayoutRecord())

  const [_checkboxOpen, setCheckboxOpen] = createStorageSignal<string>(
    "checkbox-open",
    "false",
  )

  // Non-pagination views only need an in-memory page counter per route within
  // a workspace. We intentionally keep this transient and do not persist it.
  const transientLoadMorePagesBySession: Record<
    string,
    Record<string, number>
  > = {}

  const getActiveSessionId = () => fileSessionsStore.activeId
  const getPasswordForPath = (pathname = "/") =>
    fileSessionPasswords[getPasswordScopeKey(pathname)] || ""

  const setActiveSessionId = (sessionId: string) =>
    setFileSessionsStore("activeId", sessionId)

  const persistSessions = () => {
    if (typeof window === "undefined") return
    sessionStorage.setItem(
      FILE_SESSIONS_KEY,
      JSON.stringify(unwrap(fileSessionsStore.sessions)),
    )
    sessionStorage.setItem(ACTIVE_FILE_SESSION_KEY, fileSessionsStore.activeId)
    sessionStorage.setItem(
      PASSWORD_RECORD_KEY,
      JSON.stringify(
        Object.fromEntries(
          Object.entries(unwrap(fileSessionPasswords)).filter(
            ([scopeKey, value]) => typeof scopeKey === "string" && !!value,
          ),
        ),
      ),
    )
    sessionStorage.removeItem(FILE_SESSION_PASSWORDS_KEY)
  }

  const persistLayoutRecord = () => {
    if (typeof window === "undefined") return
    localStorage.setItem(
      LAYOUT_RECORD_KEY,
      JSON.stringify(unwrap(layoutRecord)),
    )
  }

  const ensureTransientPagesForSession = (sessionId: string) => {
    if (!transientLoadMorePagesBySession[sessionId]) {
      transientLoadMorePagesBySession[sessionId] = {}
    }
    return transientLoadMorePagesBySession[sessionId]!
  }

  const clearTransientPagesForSession = (sessionId: string) => {
    delete transientLoadMorePagesBySession[sessionId]
  }

  const cloneTransientPagesForSession = (
    sourceSessionId: string,
    targetSessionId: string,
  ) => {
    transientLoadMorePagesBySession[targetSessionId] = clone(
      transientLoadMorePagesBySession[sourceSessionId] || {},
    )
  }

  const notifyPasswordChangedForScope = (pathname: string) => {
    const scopeKey = getPasswordScopeKey(pathname)
    fileSessionsStore.sessions.forEach((session) => {
      if (getPasswordScopeKey(session.pathname) === scopeKey) {
        bus.emit("file_session_password_changed", session.id)
      }
    })
  }

  const setPasswordForPath = (pathname: string, password: string) => {
    if (!pathname) return
    const scopeKey = getPasswordScopeKey(pathname)
    const previousPassword = getPasswordForPath(pathname)
    if (previousPassword === password) {
      return
    }
    if (password) {
      setFileSessionPasswords(scopeKey, password)
    } else {
      setFileSessionPasswords(scopeKey, "")
    }
    if (scopeKey === GLOBAL_PASSWORD_SCOPE_KEY) {
      if (password) {
        cookieStorage.setItem(LEGACY_BROWSER_PASSWORD_KEY, password)
      } else {
        cookieStorage.removeItem?.(LEGACY_BROWSER_PASSWORD_KEY)
      }
    }
    notifyPasswordChangedForScope(pathname)
  }

  const activeSessionIndex = () =>
    fileSessionsStore.sessions.findIndex(
      (session) => session.id === getActiveSessionId(),
    )

  const sessionIndexById = (sessionId: string) =>
    fileSessionsStore.sessions.findIndex((session) => session.id === sessionId)

  const currentActiveSession = () =>
    fileSessionsStore.sessions.find(
      (session) => session.id === getActiveSessionId(),
    )

  const makeFileSession = (
    pathname: string,
    search = "",
    seed?: Partial<FileSession>,
  ): FileSession => ({
    id: `session-${nanoid()}`,
    pathname,
    search: sanitizeWorkspaceSearch(search),
    ...seed,
  })

  const activateSessionById = (sessionId: string) => {
    const nextSession = fileSessionsStore.sessions.find(
      (session) => session.id === sessionId,
    )
    if (!nextSession || sessionId === getActiveSessionId()) {
      return currentActiveSession()
    }
    clearSelection()
    setActiveSessionId(sessionId)
    ensureTransientPagesForSession(sessionId)
    persistSessions()
    return nextSession
  }

  const createSessionForRoute = (pathname: string, search = "") => {
    const session = makeFileSession(pathname, search)
    clearSelection()
    setFileSessionsStore("sessions", (sessions) => sessions.concat(session))
    setActiveSessionId(session.id)
    ensureTransientPagesForSession(session.id)
    persistSessions()
    return session
  }

  const getActiveSessionPathname = () =>
    currentActiveSession()?.pathname || location.pathname

  const setPersistedLayoutRecord = (next: Record<string, LayoutType>) => {
    setLayoutRecord(() => next)
    persistLayoutRecord()
  }

  const objLayout = createObjLayoutController<LayoutType>({
    getPathname: getActiveSessionPathname,
    getLayoutRecord: () => layoutRecord,
    setLayoutRecord: setPersistedLayoutRecord,
    getDefaultLayout: () =>
      isLayoutType(local["global_default_layout"])
        ? local["global_default_layout"]
        : "list",
    clone,
  })

  const createFileSession = (pathname?: string, search = "") => {
    const current = currentActiveSession()
    const session = makeFileSession(
      pathname ?? current?.pathname ?? "/",
      pathname === undefined ? current?.search || search : search,
    )
    setFileSessionsStore("sessions", (sessions) => sessions.concat(session))
    if (current) {
      cloneTransientPagesForSession(current.id, session.id)
      bus.emit("file_session_cloned", {
        sourceSessionId: current.id,
        sessionId: session.id,
      })
    }
    persistSessions()
    return session
  }

  const closeFileSession = (sessionId: string) => {
    const index = sessionIndexById(sessionId)
    if (index < 0) return currentActiveSession()

    const remaining = fileSessionsStore.sessions.filter(
      (session) => session.id !== sessionId,
    )

    if (remaining.length === 0) {
      const fallback = makeFileSession("/", "")
      clearSelection()
      setFileSessionsStore({
        activeId: fallback.id,
        sessions: [fallback],
      })
      ensureTransientPagesForSession(fallback.id)
      clearTransientPagesForSession(sessionId)
      persistSessions()
      bus.emit("file_session_closed", sessionId)
      return fallback
    }

    const nextSession = remaining[Math.min(index, remaining.length - 1)]!
    const nextActiveId =
      getActiveSessionId() === sessionId ? nextSession.id : getActiveSessionId()
    if (getActiveSessionId() === sessionId) {
      clearSelection()
    }
    setFileSessionsStore({
      activeId: nextActiveId,
      sessions: remaining,
    })
    if (nextActiveId === nextSession.id) {
      ensureTransientPagesForSession(nextActiveId)
    }
    clearTransientPagesForSession(sessionId)
    persistSessions()
    bus.emit("file_session_closed", sessionId)
    return nextSession
  }

  return {
    fileSessionSummaries: createMemo(() =>
      fileSessionsStore.sessions.map(({ id, pathname, search }) => ({
        id,
        pathname,
        search,
      })),
    ),
    activeFileSessionId: createMemo(() => fileSessionsStore.activeId),
    activeFileSessionRoute: createMemo<FileSessionRoute | undefined>(() => {
      const current = currentActiveSession()
      if (!current) return undefined
      return {
        pathname: current.pathname,
        search: current.search,
      }
    }),
    password: createMemo(() => getPasswordForPath(getActiveSessionPathname())),
    syncWorkspaceSession: (pathname: string, search = "") => {
      const sanitizedSearch = sanitizeWorkspaceSearch(search)
      const index = activeSessionIndex()
      if (index < 0) {
        return createSessionForRoute(pathname, sanitizedSearch)
      }

      const current = fileSessionsStore.sessions[index]!
      if (current.pathname === pathname && current.search === sanitizedSearch) {
        return current
      }

      clearSelection()
      setFileSessionsStore("sessions", index, {
        ...current,
        pathname,
        search: sanitizedSearch,
      })
      persistSessions()
      return fileSessionsStore.sessions[index]
    },
    openFileSession: (sessionId: string) => activateSessionById(sessionId),
    createAndOpenFileSession: (pathname?: string, search = "") => {
      const session = createFileSession(pathname, search)
      return activateSessionById(session.id)!
    },
    closeFileSessionWithRoute: (sessionId: string) => {
      const isActive = getActiveSessionId() === sessionId
      const nextSession = closeFileSession(sessionId)
      return {
        didCloseActiveSession: isActive,
        nextSession,
      }
    },
    getTransientLoadMorePage: (pathname?: string, search = "") => {
      const sessionId = getActiveSessionId()
      if (!sessionId) return 1
      if (!pathname) return 1
      const pages = ensureTransientPagesForSession(sessionId)
      return pages[getRouteKey(pathname, search)] || 1
    },
    syncTransientLoadMorePage: (
      pathname: string,
      search = "",
      page: number,
    ) => {
      const sessionId = getActiveSessionId()
      if (!sessionId) return
      const pages = ensureTransientPagesForSession(sessionId)
      pages[getRouteKey(pathname, search)] = page
    },
    layout: objLayout.layout,
    setLayout: objLayout.setLayout,
    checkboxOpen: () => _checkboxOpen() === "true",
    toggleCheckbox: () => {
      setCheckboxOpen(_checkboxOpen() === "true" ? "false" : "true")
    },
    setPassword: (password: string) => {
      const pathname = getActiveSessionPathname()
      if (!pathname) return
      setPasswordForPath(pathname, password)
      persistSessions()
    },
    hasFileSession: (sessionId: string) => sessionIndexById(sessionId) >= 0,
  }
}
