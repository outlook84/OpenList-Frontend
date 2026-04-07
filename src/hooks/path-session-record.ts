import { bus } from "~/utils/bus"

const joinPath = (...paths: string[]) => paths.join("/").replace(/\/{2,}/g, "/")

const pathSessionRecord: Record<string, Record<string, boolean>> = {}

const clearPathSessionRecord = (sessionId: string) => {
  delete pathSessionRecord[sessionId]
}

bus.on("file_session_closed", clearPathSessionRecord)
bus.on("file_session_password_changed", clearPathSessionRecord)
bus.on("file_session_cloned", ({ sourceSessionId, sessionId }) => {
  pathSessionRecord[sessionId] = {
    ...(pathSessionRecord[sourceSessionId] || {}),
  }
})

export const createPathSessionRecordController = ({
  getSessionId,
  getPathname,
}: {
  getSessionId: () => string
  getPathname: () => string
}) => {
  const getDirRecord = () => {
    const sessionId = getSessionId()
    if (!pathSessionRecord[sessionId]) {
      pathSessionRecord[sessionId] = {}
    }
    return pathSessionRecord[sessionId]
  }

  const setPathAs = (path: string, dir = true, push = false) => {
    const nextPath = push ? joinPath(getPathname(), path) : path
    const dirRecord = getDirRecord()
    if (dir) {
      dirRecord[nextPath] = true
      return
    }
    delete dirRecord[nextPath]
  }

  return {
    getDirRecord,
    setPathAs,
  }
}
