import { beforeEach, describe, expect, it, vi } from "vitest"

const historyState = vi.hoisted(() => {
  const store = {
    obj: { name: "folder", is_dir: true },
    raw_url: "",
    related: [],
    objs: [{ name: "a.txt" }],
    total: 1,
    readme: "readme",
    header: "header",
    provider: "provider",
    direct_upload_tools: undefined as string[] | undefined,
    state: 4,
    err: "",
    write: true,
    write_content_bypass: false,
  }

  return {
    currentSessionId: "session-1",
    openSessions: new Set(["session-1", "session-2", "session-a", "session-b"]),
    scrollY: 120,
    store,
    setState: vi.fn((state: number) => {
      historyState.store.state = state
    }),
    set: vi.fn((data: Record<string, unknown>) => {
      Object.assign(historyState.store, data)
    }),
  }
})

const busState = vi.hoisted(() => {
  const handlers = new Map<string, Set<(payload: unknown) => void>>()
  return {
    on: (event: string, handler: (payload: unknown) => void) => {
      if (!handlers.has(event)) {
        handlers.set(event, new Set())
      }
      handlers.get(event)!.add(handler)
    },
    off: (event: string, handler: (payload: unknown) => void) => {
      handlers.get(event)?.delete(handler)
    },
    emit: (event: string, payload: unknown) => {
      handlers.get(event)?.forEach((handler) => handler(payload))
    },
    reset: () => {
      handlers.clear()
    },
  }
})

vi.mock("./obj", () => ({
  activeFileSessionId: () => historyState.currentSessionId,
  hasFileSession: (sessionId: string) =>
    historyState.openSessions.has(sessionId),
  objStore: historyState.store,
  ObjStore: {
    setState: historyState.setState,
    set: historyState.set,
  },
  State: {
    Initial: 0,
    FetchingObj: 1,
    FetchingObjs: 2,
    FetchingMore: 3,
    Folder: 4,
    File: 5,
    NeedPassword: 6,
  },
}))

vi.mock("~/utils", () => ({
  trimBase: (value: string) => value,
  bus: {
    on: busState.on,
    off: busState.off,
    emit: busState.emit,
  },
}))

describe("history store", () => {
  beforeEach(async () => {
    vi.resetModules()
    busState.reset()
    historyState.currentSessionId = "session-1"
    historyState.openSessions = new Set([
      "session-1",
      "session-2",
      "session-a",
      "session-b",
    ])
    historyState.scrollY = 120
    historyState.store.obj = { name: "folder", is_dir: true }
    historyState.store.raw_url = ""
    historyState.store.related = []
    historyState.store.objs = [{ name: "a.txt" }]
    historyState.store.total = 1
    historyState.store.readme = "readme"
    historyState.store.header = "header"
    historyState.store.provider = "provider"
    historyState.store.direct_upload_tools = undefined
    historyState.store.state = 4
    historyState.store.err = ""
    historyState.store.write = true
    historyState.store.write_content_bypass = false
    historyState.setState.mockClear()
    historyState.set.mockClear()
    vi.stubGlobal("window", {
      scrollY: historyState.scrollY,
      scroll: vi.fn(),
      location: {
        href: "https://example.com/folder",
        origin: "https://example.com",
      },
    })
    vi.stubGlobal("document", {
      addEventListener: vi.fn(),
    })
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    })
    vi.stubGlobal("sessionStorage", {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    })
    const mod = await import("./history")
    mod.__resetHistoryForTests()
  })

  it("records and restores the page snapshot and scroll position", async () => {
    const mod = await import("./history")
    const syncPage = vi.fn()

    mod.recordHistory({
      pathname: "/folder",
      search: "?view=list",
      page: 4,
      sessionId: "session-1",
    })

    historyState.store.objs = []
    historyState.store.total = 0
    historyState.store.header = ""
    historyState.store.readme = ""
    historyState.store.state = 0

    await mod.recoverHistory({
      pathname: "/folder",
      search: "?view=list",
      sessionId: "session-1",
      syncPage,
    })

    expect(syncPage).toHaveBeenCalledWith(4)
    expect(historyState.setState).toHaveBeenCalledWith(0)
    expect(historyState.set).toHaveBeenCalledWith(
      expect.objectContaining({
        objs: [{ name: "a.txt" }],
        total: 1,
        header: "header",
        readme: "readme",
        state: 4,
      }),
    )
    expect(window.scroll).toHaveBeenCalledWith({ top: 120 })
  })

  it("keeps multiple route snapshots within the active workspace session", async () => {
    const mod = await import("./history")

    mod.recordHistory({
      pathname: "/folder",
      search: "?view=list",
      page: 2,
      sessionId: "session-1",
    })
    mod.recordHistory({
      pathname: "/other",
      search: "?view=list",
      page: 5,
      sessionId: "session-1",
    })

    expect(
      mod.hasHistory({
        pathname: "/folder",
        search: "?view=list",
        sessionId: "session-1",
      }),
    ).toBe(true)
    expect(
      mod.hasHistory({
        pathname: "/other",
        search: "?view=list",
        sessionId: "session-1",
      }),
    ).toBe(true)
  })

  it("restores older routes after navigating back through multiple entries", async () => {
    const mod = await import("./history")
    const syncPage = vi.fn()

    mod.recordHistory({
      pathname: "/alpha",
      search: "?view=list",
      page: 2,
      sessionId: "session-1",
    })
    mod.recordHistory({
      pathname: "/beta",
      search: "?view=list",
      page: 4,
      sessionId: "session-1",
    })

    await mod.recoverHistory({
      pathname: "/alpha",
      search: "?view=list",
      sessionId: "session-1",
      syncPage,
    })

    expect(syncPage).toHaveBeenCalledWith(2)
    expect(historyState.set).toHaveBeenCalledWith(
      expect.objectContaining({
        objs: [{ name: "a.txt" }],
      }),
    )
  })

  it("drops the previous workspace snapshot when another session records one", async () => {
    const mod = await import("./history")

    mod.recordHistory({
      pathname: "/shared",
      search: "?view=list",
      page: 3,
      sessionId: "session-a",
    })
    mod.recordHistory({
      pathname: "/shared",
      search: "?view=list",
      page: 5,
      sessionId: "session-b",
    })

    expect(
      mod.hasHistory({
        pathname: "/shared",
        search: "?view=list",
        sessionId: "session-a",
      }),
    ).toBe(false)
    expect(
      mod.hasHistory({
        pathname: "/shared",
        search: "?view=list",
        sessionId: "session-b",
      }),
    ).toBe(true)
  })

  it("does not clone snapshots into a duplicated workspace session", async () => {
    const mod = await import("./history")

    mod.recordHistory({
      pathname: "/shared",
      search: "?view=list",
      page: 3,
      sessionId: "session-1",
    })

    busState.emit("file_session_cloned", {
      sourceSessionId: "session-1",
      sessionId: "session-2",
    })

    expect(
      mod.hasHistory({
        pathname: "/shared",
        search: "?view=list",
        sessionId: "session-1",
      }),
    ).toBe(false)
    expect(
      mod.hasHistory({
        pathname: "/shared",
        search: "?view=list",
        sessionId: "session-2",
      }),
    ).toBe(false)
  })

  it("keeps encoded reserved characters distinct in history keys", async () => {
    const mod = await import("./history")

    mod.recordHistory({
      pathname: "/shared",
      search: "?q=a%26b",
      page: 2,
      sessionId: "session-1",
    })

    expect(
      mod.hasHistory({
        pathname: "/shared",
        search: "?q=a%26b",
        sessionId: "session-1",
      }),
    ).toBe(true)
    expect(
      mod.hasHistory({
        pathname: "/shared",
        search: "?q=a&b=",
        sessionId: "session-1",
      }),
    ).toBe(false)
  })

  it("handles router-derived paths containing a literal percent sign", async () => {
    const mod = await import("./history")

    expect(() =>
      mod.recordHistory({
        pathname: "/folder/100% done.txt",
        search: "?view=list",
        page: 2,
        sessionId: "session-1",
      }),
    ).not.toThrow()

    expect(
      mod.hasHistory({
        pathname: "/folder/100% done.txt",
        search: "?view=list",
        sessionId: "session-1",
      }),
    ).toBe(true)

    expect(() =>
      mod.clearHistoryByHref(
        "/folder/100%25%20done.txt?view=list",
        "session-1",
      ),
    ).not.toThrow()
  })

  it("keeps snapshots in memory and never persists them to browser storage", async () => {
    const mod = await import("./history")

    mod.recordHistory({
      pathname: "/shared",
      search: "?view=list",
      page: 2,
      sessionId: "session-1",
    })

    await mod.recoverHistory({
      pathname: "/shared",
      search: "?view=list",
      sessionId: "session-1",
      syncPage: vi.fn(),
    })

    mod.clearHistory({
      pathname: "/shared",
      search: "?view=list",
      sessionId: "session-1",
    })

    expect(localStorage.getItem).not.toHaveBeenCalled()
    expect(localStorage.setItem).not.toHaveBeenCalled()
    expect(localStorage.removeItem).not.toHaveBeenCalled()
    expect(sessionStorage.getItem).not.toHaveBeenCalled()
    expect(sessionStorage.setItem).not.toHaveBeenCalled()
    expect(sessionStorage.removeItem).not.toHaveBeenCalled()
  })

  it("clears the active snapshot for a closed workspace session", async () => {
    const mod = await import("./history")

    mod.recordHistory({
      pathname: "/shared",
      search: "?view=list",
      page: 2,
      sessionId: "session-1",
    })

    busState.emit("file_session_closed", "session-1")

    expect(
      mod.hasHistory({
        pathname: "/shared",
        search: "?view=list",
        sessionId: "session-1",
      }),
    ).toBe(false)
  })

  it("clears the active snapshot when the workspace password changes", async () => {
    const mod = await import("./history")

    mod.recordHistory({
      pathname: "/shared",
      search: "?view=list",
      page: 2,
      sessionId: "session-1",
    })

    busState.emit("file_session_password_changed", "session-1")

    expect(
      mod.hasHistory({
        pathname: "/shared",
        search: "?view=list",
        sessionId: "session-1",
      }),
    ).toBe(false)
  })

  it("does not recreate snapshots for a workspace after it has been closed", async () => {
    const mod = await import("./history")

    mod.recordHistory({
      pathname: "/shared",
      search: "?view=list",
      page: 2,
      sessionId: "session-1",
    })

    historyState.openSessions.delete("session-1")
    busState.emit("file_session_closed", "session-1")

    mod.recordHistory({
      pathname: "/shared",
      search: "?view=list",
      page: 3,
      sessionId: "session-1",
    })

    expect(
      mod.hasHistory({
        pathname: "/shared",
        search: "?view=list",
        sessionId: "session-1",
      }),
    ).toBe(false)
  })
})
