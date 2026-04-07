import { beforeEach, describe, expect, it, vi } from "vitest"

const storeMocks = vi.hoisted(() => ({
  currentSessionId: "session-1",
  getPagination: vi.fn(),
  getTransientLoadMorePage: vi.fn(),
  syncTransientLoadMorePage: vi.fn(),
}))

const serviceMocks = vi.hoisted(() => ({
  createdDeps: [] as any[],
  handlePathChange: vi.fn(),
  handleFolder: vi.fn(),
  setPathAs: vi.fn(),
}))

const historyMocks = vi.hoisted(() => ({
  clearHistory: vi.fn(),
  hasHistory: vi.fn(),
  recoverHistory: vi.fn(),
}))

vi.mock("~/store", () => ({
  appendObjs: vi.fn(),
  activeFileSessionId: () => storeMocks.currentSessionId,
  getPagination: storeMocks.getPagination,
  getTransientLoadMorePage: storeMocks.getTransientLoadMorePage,
  me: () => ({ base_path: "/" }),
  ObjStore: {
    setErr: vi.fn(),
    setState: vi.fn(),
    setObj: vi.fn(),
    setProvider: vi.fn(),
    setReadme: vi.fn(),
    setHeader: vi.fn(),
    setRelated: vi.fn(),
    setRawUrl: vi.fn(),
    setObjs: vi.fn(),
    setTotal: vi.fn(),
    setWrite: vi.fn(),
    setWriteContentBypass: vi.fn(),
    setDirectUploadTools: vi.fn(),
  },
  objStore: { total: 0 },
  password: () => "",
  State: {
    FetchingObj: 1,
    FetchingObjs: 2,
    FetchingMore: 3,
    Folder: 4,
    File: 5,
    NeedPassword: 6,
  },
  syncTransientLoadMorePage: storeMocks.syncTransientLoadMorePage,
}))

vi.mock("~/utils", () => ({
  bus: {
    on: vi.fn(),
    off: vi.fn(),
  },
  handleRespWithoutNotify: vi.fn(),
  log: vi.fn(),
  notify: { error: vi.fn() },
}))

vi.mock("./path-session-record", () => ({
  createPathSessionRecordController: () => ({
    getDirRecord: () => ({}),
    setPathAs: serviceMocks.setPathAs,
  }),
}))

vi.mock("./workspace-path-request-adapter", () => ({
  cancelPathRequests: vi.fn(),
  createWorkspacePathRequestAdapter: () => ({
    getObject: vi.fn(),
    getFolder: vi.fn(),
  }),
}))

vi.mock("./workspace-path-service", () => ({
  createWorkspacePathService: vi.fn((deps) => {
    serviceMocks.createdDeps.push(deps)
    return {
      handlePathChange: serviceMocks.handlePathChange,
      handleFolder: serviceMocks.handleFolder,
    }
  }),
}))

vi.mock("~/store/history", () => ({
  clearHistory: historyMocks.clearHistory,
  hasHistory: historyMocks.hasHistory,
  recoverHistory: historyMocks.recoverHistory,
}))

import {
  createWorkspacePathRuntime,
  getCurrentWorkspacePage,
  getWorkspaceRoutePage,
} from "./workspace-path-runtime"

describe("workspace path runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeMocks.currentSessionId = "session-1"
    serviceMocks.createdDeps = []
    storeMocks.getPagination.mockReturnValue({ type: "pagination", size: 20 })
    storeMocks.getTransientLoadMorePage.mockReturnValue(1)
    storeMocks.syncTransientLoadMorePage.mockImplementation(() => {})
    serviceMocks.handlePathChange.mockResolvedValue(undefined)
    serviceMocks.handleFolder.mockResolvedValue(undefined)
    historyMocks.clearHistory.mockImplementation(() => {})
    historyMocks.hasHistory.mockReturnValue(false)
    historyMocks.recoverHistory.mockResolvedValue(false)
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: {
        pathname: "/global",
        search: "?page=9",
      },
    })
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        scrollY: 0,
        scroll: vi.fn(),
      },
    })
  })

  it("reads the current page from the URL only in pagination mode", () => {
    expect(
      getWorkspaceRoutePage({
        search: "?page=4",
        pagination: { type: "pagination", size: 20 },
        getTransientLoadMorePage: () => 2,
      }),
    ).toBe(4)

    expect(
      getWorkspaceRoutePage({
        search: "?page=4",
        pagination: { type: "load_more", size: 20 },
        getTransientLoadMorePage: () => 2,
      }),
    ).toBe(2)
  })

  it("reads non-pagination pages from the transient workspace state", () => {
    storeMocks.getPagination.mockReturnValue({ type: "load_more", size: 20 })
    storeMocks.getTransientLoadMorePage.mockReturnValue(4)

    expect(getCurrentWorkspacePage("/folder", "?view=list")).toBe(4)
    expect(storeMocks.getTransientLoadMorePage).toHaveBeenCalledWith(
      "/folder",
      "?view=list",
    )
  })

  it("prefers the explicit pathname and search over ambient location state", () => {
    expect(getCurrentWorkspacePage("/folder", "?page=3")).toBe(3)
  })

  it("tracks the base-path first-fetch fallback per workspace session", () => {
    createWorkspacePathRuntime({
      pathname: () => "/folder",
      search: () => "?view=list",
      to: vi.fn(),
    })
    const firstDeps = serviceMocks.createdDeps[0]!

    expect(firstDeps.isFirstFetch()).toBe(true)
    firstDeps.consumeFirstFetch()
    expect(firstDeps.isFirstFetch()).toBe(false)

    storeMocks.currentSessionId = "session-2"
    createWorkspacePathRuntime({
      pathname: () => "/other",
      search: () => "?view=list",
      to: vi.fn(),
    })
    const secondDeps = serviceMocks.createdDeps[1]!

    expect(secondDeps.isFirstFetch()).toBe(true)
    secondDeps.consumeFirstFetch()
    expect(secondDeps.isFirstFetch()).toBe(false)

    storeMocks.currentSessionId = "session-1"
    expect(firstDeps.isFirstFetch()).toBe(false)
  })

  it("replays prior load-more pages when restoring a folder route", async () => {
    storeMocks.getPagination.mockReturnValue({ type: "load_more", size: 20 })
    let currentPage = 4
    storeMocks.getTransientLoadMorePage.mockImplementation(() => currentPage)
    storeMocks.syncTransientLoadMorePage.mockImplementation(
      (_path: string, _search: string, page: number) => {
        currentPage = page
      },
    )
    serviceMocks.handlePathChange.mockImplementation(
      async (_path: string, page?: number) => {
        currentPage = page ?? 1
      },
    )
    serviceMocks.handleFolder.mockImplementation(
      async (_path: string, page?: number) => {
        currentPage = page ?? currentPage
      },
    )

    const runtime = createWorkspacePathRuntime({
      pathname: () => "/folder",
      search: () => "?view=list",
      to: vi.fn(),
    })

    await runtime.handlePathChange("/folder", 4)

    expect(storeMocks.syncTransientLoadMorePage).toHaveBeenCalledWith(
      "/folder",
      "?view=list",
      1,
    )
    expect(serviceMocks.handlePathChange).toHaveBeenCalledWith(
      "/folder",
      1,
      undefined,
      undefined,
      expect.any(Function),
    )
    expect(serviceMocks.handleFolder).toHaveBeenNthCalledWith(
      1,
      "/folder",
      2,
      undefined,
      true,
      undefined,
      false,
      "?view=list",
      expect.any(Function),
    )
    expect(serviceMocks.handleFolder).toHaveBeenNthCalledWith(
      2,
      "/folder",
      3,
      undefined,
      true,
      undefined,
      false,
      "?view=list",
      expect.any(Function),
    )
    expect(serviceMocks.handleFolder).toHaveBeenNthCalledWith(
      3,
      "/folder",
      4,
      undefined,
      true,
      undefined,
      false,
      "?view=list",
      expect.any(Function),
    )
  })

  it("restores from the in-memory history before issuing a new request", async () => {
    historyMocks.hasHistory.mockReturnValue(true)

    const runtime = createWorkspacePathRuntime({
      pathname: () => "/folder",
      search: () => "?view=list",
      to: vi.fn(),
    })

    await runtime.handlePathChange("/folder", 4)

    expect(historyMocks.hasHistory).toHaveBeenCalledWith({
      pathname: "/folder",
      search: "?view=list",
    })
    expect(historyMocks.recoverHistory).toHaveBeenCalledWith({
      pathname: "/folder",
      search: "?view=list",
      syncPage: expect.any(Function),
    })
    expect(serviceMocks.handlePathChange).not.toHaveBeenCalled()
    expect(serviceMocks.handleFolder).not.toHaveBeenCalled()
  })

  it("clears the current route history before refreshing", async () => {
    storeMocks.getPagination.mockReturnValue({ type: "pagination", size: 20 })

    const runtime = createWorkspacePathRuntime({
      pathname: () => "/folder",
      search: () => "?page=3",
      to: vi.fn(),
    })

    await runtime.refresh()

    expect(historyMocks.clearHistory).toHaveBeenCalledWith({
      pathname: "/folder",
      search: "?page=3",
    })
  })

  it("uses the latest pagination settings after the runtime is created", async () => {
    let pagination: { type: "pagination" | "load_more"; size: number } = {
      type: "pagination",
      size: 20,
    }
    storeMocks.getPagination.mockImplementation(() => pagination)
    let currentPage = 3
    storeMocks.getTransientLoadMorePage.mockImplementation(() => currentPage)
    storeMocks.syncTransientLoadMorePage.mockImplementation(
      (_path: string, _search: string, page: number) => {
        currentPage = page
      },
    )
    serviceMocks.handlePathChange.mockImplementation(
      async (_path: string, page?: number) => {
        currentPage = page ?? 1
      },
    )
    serviceMocks.handleFolder.mockImplementation(
      async (_path: string, page?: number) => {
        currentPage = page ?? currentPage
      },
    )

    const runtime = createWorkspacePathRuntime({
      pathname: () => "/folder",
      search: () => "?view=list",
      to: vi.fn(),
    })

    pagination = { type: "load_more", size: 50 }
    await runtime.handlePathChange("/folder", 3)

    expect(serviceMocks.handlePathChange).toHaveBeenCalledWith(
      "/folder",
      1,
      undefined,
      undefined,
      expect.any(Function),
    )
    expect(serviceMocks.handleFolder).toHaveBeenNthCalledWith(
      1,
      "/folder",
      2,
      undefined,
      true,
      undefined,
      false,
      "?view=list",
      expect.any(Function),
    )
    expect(serviceMocks.handleFolder).toHaveBeenNthCalledWith(
      2,
      "/folder",
      3,
      undefined,
      true,
      undefined,
      false,
      "?view=list",
      expect.any(Function),
    )
  })

  it("stops replaying load-more pages after the active route changes", async () => {
    storeMocks.getPagination.mockReturnValue({ type: "load_more", size: 20 })
    let currentPage = 3
    let currentPath = "/folder"
    let currentSearch = "?view=list"
    storeMocks.getTransientLoadMorePage.mockImplementation(() => currentPage)
    storeMocks.syncTransientLoadMorePage.mockImplementation(
      (_path: string, _search: string, page: number) => {
        currentPage = page
      },
    )
    serviceMocks.handlePathChange.mockImplementation(
      async (_path: string, page?: number) => {
        currentPage = page ?? 1
        currentPath = "/other"
      },
    )

    const runtime = createWorkspacePathRuntime({
      pathname: () => currentPath,
      search: () => currentSearch,
      to: vi.fn(),
    })

    await runtime.handlePathChange("/folder", 3)

    expect(serviceMocks.handlePathChange).toHaveBeenCalledTimes(1)
    expect(serviceMocks.handleFolder).not.toHaveBeenCalled()
  })
})
