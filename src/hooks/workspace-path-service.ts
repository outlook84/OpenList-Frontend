import type { FsGetResp, FsListResp, Obj } from "~/types"

type PaginationLike = {
  type: "pagination" | "load_more" | "auto_load_more" | "all"
  size: number
}

type WorkspacePathStates = {
  FetchingObj: number
  FetchingObjs: number
  FetchingMore: number
  Folder: number
  File: number
  NeedPassword: number
}

type WorkspacePathObjectStore = {
  appendObjects: (objs: Obj[]) => void
  setError: (message: string) => void
  setState: (state: number) => void
  setObject: (obj: FsGetResp["data"]) => void
  setProvider: (provider: string) => void
  setReadme: (readme: string) => void
  setHeader: (header: string) => void
  setRelated: (related: Obj[]) => void
  setRawUrl: (rawUrl: string) => void
  setObjects: (objs: Obj[]) => void
  setTotal: (total: number) => void
  setWrite: (write: boolean) => void
  setWriteContentBypass: (writeContentBypass: boolean) => void
  setDirectUploadTools: (tools?: string[]) => void
}

type WorkspacePathServiceDeps = {
  states: WorkspacePathStates
  handleResponse: <T>(
    resp: { code: number; message: string; data: T },
    success?: (data: T) => void,
    fail?: (message: string, code?: number) => void,
  ) => void
  getSearch: () => string
  getPathname: () => string
  navigateTo: (path: string) => void
  getBasePath: () => string
  isFirstFetch: () => boolean
  consumeFirstFetch: () => void
  log: (message: string) => void
  notifyError: (message: string) => void
  getDirRecord: () => Record<string, boolean>
  setPathAs: (path: string, dir?: boolean, push?: boolean) => void
  getPagination: () => PaginationLike
  getObject: (path: string) => Promise<FsGetResp>
  getFolder: (arg?: {
    path: string
    index?: number
    size?: number
    force?: boolean
  }) => Promise<FsListResp>
  syncFetchedPage: (path: string, search: string, page: number) => void
  objectStore: WorkspacePathObjectStore
  cancelRequests: () => void
}

type RequestGuard = () => boolean

export const createWorkspacePathService = (deps: WorkspacePathServiceDeps) => {
  let retryPass = false

  const handleErr = (msg: string, code?: number) => {
    if (code === 403) {
      deps.objectStore.setState(deps.states.NeedPassword)
      if (retryPass) {
        deps.notifyError(msg)
      }
      return
    }

    const basePath = deps.getBasePath()
    if (
      deps.isFirstFetch() &&
      basePath !== "/" &&
      deps.getPathname().includes(basePath) &&
      msg.endsWith("object not found")
    ) {
      deps.consumeFirstFetch()
      deps.navigateTo(deps.getPathname().replace(basePath, ""))
      return
    }

    if (code === undefined || code >= 0) {
      deps.objectStore.setError(msg)
    }
  }

  const handleFolder = async (
    path: string,
    index?: number,
    size?: number,
    append = false,
    force?: boolean,
    listOnly = false,
    routeSearch = deps.getSearch(),
    isActive: RequestGuard = () => true,
  ) => {
    if (!isActive()) {
      return
    }
    const pagination = deps.getPagination()
    let nextSize = size
    if (!nextSize) {
      nextSize = pagination.size
    }
    if (nextSize !== undefined && pagination.type === "all") {
      nextSize = undefined
    }
    if (!listOnly) {
      deps.objectStore.setState(
        append ? deps.states.FetchingMore : deps.states.FetchingObjs,
      )
    }
    const resp = await deps.getFolder({
      path,
      index,
      size: nextSize,
      force,
    })
    if (!isActive()) {
      return
    }
    deps.handleResponse(
      resp,
      (data) => {
        if (!isActive()) {
          return
        }
        deps.syncFetchedPage(path, routeSearch, index ?? 1)
        if (append) {
          deps.objectStore.appendObjects(data.content)
        } else {
          deps.objectStore.setObjects(data.content ?? [])
          deps.objectStore.setTotal(data.total)
        }
        if (listOnly) {
          return
        }
        deps.objectStore.setReadme(data.readme)
        deps.objectStore.setHeader(data.header)
        deps.objectStore.setWrite(data.write)
        deps.objectStore.setWriteContentBypass(data.write_content_bypass)
        deps.objectStore.setProvider(data.provider)
        deps.objectStore.setDirectUploadTools(data.direct_upload_tools)
        deps.objectStore.setState(deps.states.Folder)
      },
      (message, code) => {
        if (!isActive()) {
          return
        }
        handleErr(message, code)
      },
    )
  }

  const handleObject = async (
    path: string,
    index?: number,
    isActive: RequestGuard = () => true,
  ) => {
    if (!isActive()) {
      return
    }
    deps.objectStore.setState(deps.states.FetchingObj)
    const resp = await deps.getObject(path)
    if (!isActive()) {
      return
    }
    deps.handleResponse(
      resp,
      (data) => {
        if (!isActive()) {
          return
        }
        deps.objectStore.setObject(data)
        deps.objectStore.setProvider(data.provider)
        if (data.is_dir) {
          deps.setPathAs(path)
          void handleFolder(
            path,
            index,
            undefined,
            undefined,
            undefined,
            false,
            deps.getSearch(),
            isActive,
          )
          return
        }
        deps.objectStore.setReadme(data.readme)
        deps.objectStore.setHeader(data.header)
        deps.objectStore.setRelated(data.related ?? [])
        deps.objectStore.setRawUrl(data.raw_url)
        deps.objectStore.setState(deps.states.File)
      },
      (message, code) => {
        if (!isActive()) {
          return
        }
        handleErr(message, code)
      },
    )
  }

  const handlePathChange = (
    path: string,
    index?: number,
    nextRetryPass?: boolean,
    force?: boolean,
    isActive: RequestGuard = () => true,
  ) => {
    deps.cancelRequests()
    retryPass = nextRetryPass ?? false
    deps.objectStore.setError("")
    const page = index ?? 1
    if (deps.getDirRecord()[path]) {
      deps.log(`handle [${path}] as folder, page=${page}`)
      return handleFolder(
        path,
        index,
        undefined,
        undefined,
        force,
        false,
        deps.getSearch(),
        isActive,
      )
    }
    deps.log(`handle [${path}] as obj, page=${page}`)
    return handleObject(path, index, isActive)
  }

  return {
    handlePathChange,
    handleFolder,
  }
}
