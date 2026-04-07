import { describe, expect, it, vi } from "vitest"
import { ObjType, type FsGetResp, type FsListResp, type Obj } from "~/types"
import { createWorkspacePathService } from "./workspace-path-service"

const states = {
  FetchingObj: 1,
  FetchingObjs: 2,
  FetchingMore: 3,
  Folder: 4,
  File: 5,
  NeedPassword: 6,
}

const makeObj = (name: string, isDir = false): Obj => ({
  name,
  size: 1,
  is_dir: isDir,
  created: "",
  modified: "",
  thumb: "",
  type: isDir ? ObjType.FOLDER : ObjType.UNKNOWN,
})

const makeFsGetResp = (data: Partial<FsGetResp["data"]>): FsGetResp => ({
  code: 200,
  message: "ok",
  data: {
    ...makeObj("file"),
    raw_url: "",
    readme: "",
    header: "",
    provider: "drive",
    related: [],
    ...data,
  },
})

const makeFsListResp = (data?: Partial<FsListResp["data"]>): FsListResp => ({
  code: 200,
  message: "ok",
  data: {
    content: [makeObj("child")],
    total: 1,
    readme: "readme",
    header: "header",
    write: true,
    write_content_bypass: false,
    provider: "drive",
    direct_upload_tools: ["webdav"],
    ...data,
  },
})

const createDeps = () => {
  let firstFetch = true
  const dirRecord: Record<string, boolean> = {}

  return {
    states,
    handleResponse: <T>(
      resp: { code: number; message: string; data: T },
      success?: (data: T) => void,
      fail?: (message: string, code?: number) => void,
    ) => {
      if (resp.code === 200) {
        success?.(resp.data)
        return
      }
      fail?.(resp.message, resp.code)
    },
    getSearch: () => "",
    getPathname: () => "/base/folder",
    navigateTo: vi.fn(),
    getBasePath: () => "/base",
    isFirstFetch: () => firstFetch,
    consumeFirstFetch: () => {
      firstFetch = false
    },
    log: vi.fn(),
    notifyError: vi.fn(),
    getDirRecord: () => dirRecord,
    setPathAs: vi.fn((path: string) => {
      dirRecord[path] = true
    }),
    getPagination: () => ({ type: "pagination" as const, size: 20 }),
    getObject: vi.fn(async () => makeFsGetResp({})),
    getFolder: vi.fn(async () => makeFsListResp()),
    syncFetchedPage: vi.fn(),
    objectStore: {
      appendObjects: vi.fn(),
      setError: vi.fn(),
      setState: vi.fn(),
      setObject: vi.fn(),
      setProvider: vi.fn(),
      setReadme: vi.fn(),
      setHeader: vi.fn(),
      setRelated: vi.fn(),
      setRawUrl: vi.fn(),
      setObjects: vi.fn(),
      setTotal: vi.fn(),
      setWrite: vi.fn(),
      setWriteContentBypass: vi.fn(),
      setDirectUploadTools: vi.fn(),
    },
    cancelRequests: vi.fn(),
  }
}

describe("workspace path service", () => {
  it("treats known directories as folders", async () => {
    const deps = createDeps()
    deps.getDirRecord()["/alpha"] = true
    const service = createWorkspacePathService(deps)

    await service.handlePathChange("/alpha", 3, false, true)

    expect(deps.getFolder).toHaveBeenCalledWith({
      path: "/alpha",
      index: 3,
      size: 20,
      force: true,
    })
  })

  it("loads object metadata and opens files without folder list requests", async () => {
    const deps = createDeps()
    deps.getObject.mockResolvedValue(
      makeFsGetResp({
        name: "video.mp4",
        provider: "alist",
        readme: "doc",
        header: "head",
        raw_url: "https://example.com",
        is_dir: false,
        related: [makeObj("related")],
      }),
    )
    const service = createWorkspacePathService(deps)

    await service.handlePathChange("/video.mp4")

    expect(deps.objectStore.setState).toHaveBeenCalledWith(states.FetchingObj)
    expect(deps.objectStore.setObject).toHaveBeenCalled()
    expect(deps.objectStore.setRawUrl).toHaveBeenCalledWith(
      "https://example.com",
    )
    expect(deps.objectStore.setRelated).toHaveBeenCalledWith([
      makeObj("related"),
    ])
    expect(deps.getFolder).not.toHaveBeenCalled()
    expect(deps.objectStore.setState).toHaveBeenLastCalledWith(states.File)
  })

  it("marks discovered directories and then loads their folder listing", async () => {
    const deps = createDeps()
    deps.getObject.mockResolvedValue(
      makeFsGetResp({
        name: "folder",
        is_dir: true,
      }),
    )
    const service = createWorkspacePathService(deps)

    await service.handlePathChange("/folder", 2)
    await Promise.resolve()

    expect(deps.setPathAs).toHaveBeenCalledWith("/folder")
    expect(deps.getFolder).toHaveBeenCalledWith({
      path: "/folder",
      index: 2,
      size: 20,
      force: undefined,
    })
  })

  it("updates folder state and append behavior from list responses", async () => {
    const deps = createDeps()
    const service = createWorkspacePathService(deps)

    await service.handleFolder("/alpha", 4, undefined, true, false, false)

    expect(deps.objectStore.setState).toHaveBeenCalledWith(states.FetchingMore)
    expect(deps.syncFetchedPage).toHaveBeenCalledWith("/alpha", "", 4)
    expect(deps.objectStore.appendObjects).toHaveBeenCalledWith([
      makeObj("child"),
    ])
    expect(deps.objectStore.setState).toHaveBeenLastCalledWith(states.Folder)
  })

  it("stores fetched folder pages under an explicit route search when provided", async () => {
    const deps = createDeps()
    const service = createWorkspacePathService(deps)

    await service.handleFolder(
      "/alpha",
      4,
      undefined,
      true,
      false,
      false,
      "?view=list",
    )

    expect(deps.syncFetchedPage).toHaveBeenCalledWith("/alpha", "?view=list", 4)
  })

  it("drops stale folder responses before mutating the object store", async () => {
    const deps = createDeps()
    let active = true
    deps.getFolder.mockImplementation(async () => {
      active = false
      return makeFsListResp()
    })
    const service = createWorkspacePathService(deps)

    await service.handleFolder(
      "/alpha",
      4,
      undefined,
      true,
      false,
      false,
      "",
      () => active,
    )

    expect(deps.syncFetchedPage).not.toHaveBeenCalled()
    expect(deps.objectStore.appendObjects).not.toHaveBeenCalled()
    expect(deps.objectStore.setObjects).not.toHaveBeenCalled()
  })

  it("handles password failures and first-fetch base-path redirects", async () => {
    const deps = createDeps()
    deps.getObject.mockResolvedValue({
      code: 403,
      message: "bad password",
      data: {} as never,
    })
    const service = createWorkspacePathService(deps)

    await service.handlePathChange("/alpha", 1, true)
    expect(deps.objectStore.setState).toHaveBeenCalledWith(states.NeedPassword)
    expect(deps.notifyError).toHaveBeenCalledWith("bad password")

    deps.getObject.mockResolvedValue({
      code: 500,
      message: "object not found",
      data: {} as never,
    })
    await service.handlePathChange("/alpha")

    expect(deps.navigateTo).toHaveBeenCalledWith("/folder")
  })
})
