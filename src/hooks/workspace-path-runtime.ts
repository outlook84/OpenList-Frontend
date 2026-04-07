import {
  appendObjs,
  activeFileSessionId,
  getPagination,
  getTransientLoadMorePage,
  me,
  ObjStore,
  objStore,
  password,
  State,
  syncTransientLoadMorePage,
} from "~/store"
import { clearHistory, hasHistory, recoverHistory } from "~/store/history"
import { bus, handleRespWithoutNotify, log, notify } from "~/utils"
import { createPathSessionRecordController } from "./path-session-record"
import {
  cancelPathRequests,
  createWorkspacePathRequestAdapter,
} from "./workspace-path-request-adapter"
import { createWorkspacePathService } from "./workspace-path-service"

const firstFetchBySession: Record<string, boolean> = {}

bus.on("file_session_closed", (sessionId) => {
  delete firstFetchBySession[sessionId]
})
bus.on("file_session_cloned", ({ sourceSessionId, sessionId }) => {
  firstFetchBySession[sessionId] = firstFetchBySession[sourceSessionId] ?? true
})

type PaginationLike = {
  type: "pagination" | "load_more" | "auto_load_more" | "all"
  size: number
}

export const getWorkspaceRoutePage = ({
  search = "",
  pagination,
  getTransientLoadMorePage,
}: {
  search?: string
  pagination: PaginationLike
  getTransientLoadMorePage: () => number
}) => {
  if (pagination.type === "pagination") {
    const query = new URLSearchParams(search.replace(/^\?/, ""))
    return parseInt(query.get("page") || "") || 1
  }
  return getTransientLoadMorePage()
}

const getRoutePage = (
  pathname = location.pathname,
  search = location.search,
) => {
  return getWorkspaceRoutePage({
    search,
    pagination: getPagination(),
    getTransientLoadMorePage: () => getTransientLoadMorePage(pathname, search),
  })
}

export const getCurrentWorkspacePage = (
  pathname = location.pathname,
  search = location.search,
) => {
  return getRoutePage(pathname, search)
}

export const createWorkspacePathRuntime = ({
  pathname,
  search,
  to,
}: {
  pathname: () => string
  search: () => string
  to: (path: string) => void
}) => {
  const pathRequestAdapter = createWorkspacePathRequestAdapter({
    getPassword: password,
  })
  const pathSessionRecord = createPathSessionRecordController({
    getSessionId: activeFileSessionId,
    getPathname: pathname,
  })
  const { getDirRecord, setPathAs } = pathSessionRecord
  const isSessionFirstFetch = () => {
    const sessionId = activeFileSessionId()
    if (!sessionId) return true
    return firstFetchBySession[sessionId] ?? true
  }
  const consumeSessionFirstFetch = () => {
    const sessionId = activeFileSessionId()
    if (!sessionId) return
    firstFetchBySession[sessionId] = false
  }

  const pathService = createWorkspacePathService({
    states: State,
    handleResponse: handleRespWithoutNotify,
    getSearch: search,
    getPathname: pathname,
    navigateTo: to,
    getBasePath: () => me().base_path,
    isFirstFetch: isSessionFirstFetch,
    consumeFirstFetch: consumeSessionFirstFetch,
    log,
    notifyError: notify.error,
    getDirRecord,
    setPathAs,
    getPagination,
    getObject: pathRequestAdapter.getObject,
    getFolder: pathRequestAdapter.getFolder,
    syncFetchedPage: syncTransientLoadMorePage,
    objectStore: {
      appendObjects: appendObjs,
      setError: ObjStore.setErr,
      setState: ObjStore.setState,
      setObject: ObjStore.setObj,
      setProvider: ObjStore.setProvider,
      setReadme: ObjStore.setReadme,
      setHeader: ObjStore.setHeader,
      setRelated: ObjStore.setRelated,
      setRawUrl: ObjStore.setRawUrl,
      setObjects: (objs) => ObjStore.setObjs(objs ?? []),
      setTotal: ObjStore.setTotal,
      setWrite: ObjStore.setWrite,
      setWriteContentBypass: ObjStore.setWriteContentBypass,
      setDirectUploadTools: ObjStore.setDirectUploadTools,
    },
    cancelRequests: cancelPathRequests,
  })

  const {
    handlePathChange: baseHandlePathChange,
    handleFolder: baseHandleFolder,
  } = pathService
  let activeRequestGeneration = 0

  const createRequestGuard = (routePath: string, routeSearch: string) => {
    const sessionId = activeFileSessionId()
    const generation = ++activeRequestGeneration
    return () =>
      activeRequestGeneration === generation &&
      activeFileSessionId() === sessionId &&
      pathname() === routePath &&
      search() === routeSearch
  }

  const loadMoreWithGuard = (
    path: string,
    currentSearch: string,
    isActive: () => boolean,
  ) => {
    if (!isActive()) {
      return
    }
    return baseHandleFolder(
      path,
      getRoutePage(path, currentSearch) + 1,
      undefined,
      true,
      undefined,
      false,
      currentSearch,
      isActive,
    )
  }

  const loadMore = (path = pathname(), currentSearch = search()) => {
    return loadMoreWithGuard(
      path,
      currentSearch,
      createRequestGuard(pathname(), search()),
    )
  }

  const replayLoadMorePath = async (
    path: string,
    currentSearch: string,
    currentPage: number,
    retryPass?: boolean,
    force?: boolean,
    isActive = createRequestGuard(path, currentSearch),
  ) => {
    syncTransientLoadMorePage(path, currentSearch, 1)
    await baseHandlePathChange(path, 1, retryPass, force, isActive)
    while (isActive() && getRoutePage(path, currentSearch) < currentPage) {
      await loadMoreWithGuard(path, currentSearch, isActive)
    }
  }

  const handlePathChange = async (
    path: string,
    index?: number,
    retryPass?: boolean,
    force?: boolean,
  ) => {
    const currentSearch = search()
    const currentPage = index ?? 1
    const pagination = getPagination()
    const isActive = createRequestGuard(path, currentSearch)
    if (hasHistory({ pathname: path, search: currentSearch })) {
      log(`handle [${path}${currentSearch}] from history, page=${currentPage}`)
      await recoverHistory({
        pathname: path,
        search: currentSearch,
        syncPage: (page) =>
          syncTransientLoadMorePage(path, currentSearch, page),
      })
      return
    }
    if (
      (pagination.type === "load_more" ||
        pagination.type === "auto_load_more") &&
      currentPage > 1
    ) {
      await replayLoadMorePath(
        path,
        currentSearch,
        currentPage,
        retryPass,
        force,
        isActive,
      )
      return
    }
    return baseHandlePathChange(path, index, retryPass, force, isActive)
  }

  const refresh = async (retryPass?: boolean, force?: boolean) => {
    const path = pathname()
    const currentSearch = search()
    const currentPage = getRoutePage(path, currentSearch)
    const pagination = getPagination()
    const scroll = window.scrollY
    clearHistory({ pathname: path, search: currentSearch })
    if (
      pagination.type === "load_more" ||
      pagination.type === "auto_load_more"
    ) {
      await replayLoadMorePath(
        path,
        currentSearch,
        currentPage,
        retryPass,
        force,
      )
    } else {
      await handlePathChange(path, currentPage, retryPass, force)
    }
    window.scroll({ top: scroll, behavior: "smooth" })
  }

  const allLoaded = () =>
    getRoutePage(pathname(), search()) >=
    Math.ceil(objStore.total / getPagination().size)

  return {
    handlePathChange,
    handleFolder: (
      path: string,
      index?: number,
      size?: number,
      append = false,
      force?: boolean,
      listOnly = false,
      routeSearch = search(),
    ) =>
      baseHandleFolder(
        path,
        index,
        size,
        append,
        force,
        listOnly,
        routeSearch,
        createRequestGuard(pathname(), search()),
      ),
    setPathAs,
    refresh,
    loadMore,
    allLoaded,
  }
}
