import naturalSort from "typescript-natural-sort"
import { createMemo } from "solid-js"
import { createStore, produce } from "solid-js/store"
import { Obj, ObjType, StoreObj } from "~/types"
import { log } from "~/utils"
import { useT } from "~/hooks/useT"
import { createObjSelectionController } from "./obj-selection-controller"
import { createObjStoreActions } from "./obj-store-actions"
import { createObjSessionStore } from "./obj-session-store"
export type {
  FileSession,
  FileSessionRoute,
  FileSessionSummary,
  LayoutType,
} from "./obj-session-store"

export enum State {
  Initial,
  FetchingObj,
  FetchingObjs,
  FetchingMore,
  Folder,
  File,
  NeedPassword,
}

export const initialObjStore = {
  obj: {} as Obj,
  raw_url: "",
  related: [] as Obj[],

  objs: [] as StoreObj[],
  total: 0,

  readme: "",
  header: "",
  provider: "",
  direct_upload_tools: <string[] | undefined>undefined,
  state: State.Initial,
  err: "",
}

type ActiveObjStore = typeof initialObjStore & {
  write?: boolean
  write_content_bypass?: boolean
}

const [objStore, setObjStore] = createStore<ActiveObjStore>(initialObjStore)

const objSelection = createObjSelectionController({
  getObjects: () => objStore.objs,
  setSelectedAt: (index, checked) =>
    setObjStore("objs", index, { selected: checked }),
  setAllSelected: (checked) =>
    setObjStore("objs", {}, (obj) => ({ selected: checked })),
})

const resetLastChecked = () => {
  objSelection.resetSelectionRange()
}

const clearSelectionState = () => {
  objSelection.clearSelection()
}
const sessionStore = createObjSessionStore({
  clearSelection: clearSelectionState,
})

export const ObjStore = createObjStoreActions(
  setObjStore as never,
  resetLastChecked,
)

export type OrderBy = "name" | "size" | "modified"

export const sortObjs = (orderBy: OrderBy, reverse?: boolean) => {
  log("sort:", orderBy, reverse)
  setObjStore(
    "objs",
    produce((objs) =>
      objs.sort(
        (a, b) => (reverse ? -1 : 1) * naturalSort(a[orderBy], b[orderBy]),
      ),
    ),
  )
}

export const appendObjs = (objs: Obj[]) => {
  setObjStore(
    "objs",
    produce((prev) => prev.push(...objs)),
  )
}

export const selectIndex = objSelection.selectIndex
export const selectAll = objSelection.selectAll
export const selectedObjs = objSelection.selectedObjs
export const allChecked = objSelection.allChecked
export const oneChecked = objSelection.oneChecked
export const haveSelected = objSelection.haveSelected
export const isIndeterminate = objSelection.isIndeterminate

export { objStore }
export const fileSessionSummaries = sessionStore.fileSessionSummaries
export const activeFileSessionId = sessionStore.activeFileSessionId
export const activeFileSessionRoute = sessionStore.activeFileSessionRoute
export const password = sessionStore.password
export const syncWorkspaceSession = sessionStore.syncWorkspaceSession
export const openFileSession = sessionStore.openFileSession
export const createAndOpenFileSession = sessionStore.createAndOpenFileSession
export const closeFileSessionWithRoute = sessionStore.closeFileSessionWithRoute
export const getTransientLoadMorePage = sessionStore.getTransientLoadMorePage
export const syncTransientLoadMorePage = sessionStore.syncTransientLoadMorePage
export const layout = sessionStore.layout
export const setLayout = sessionStore.setLayout
export const checkboxOpen = sessionStore.checkboxOpen
export const toggleCheckbox = sessionStore.toggleCheckbox
export const setPassword = sessionStore.setPassword
export const hasFileSession = sessionStore.hasFileSession

const getCountStr = (
  objs: StoreObj[],
  prefix: string,
  filterType?: ObjType,
) => {
  const t = useT()

  if (filterType) {
    objs = objs.filter((obj) => obj.is_dir || obj.type === filterType)
  }

  if (objs.length === 0) return ""

  const folders = objs.filter((o) => o.is_dir).length
  const files = objs.length - folders
  const vars = { folders: folders.toString(), files: files.toString() }
  const key =
    folders && files
      ? `${prefix}`
      : folders
        ? `${prefix}_folders`
        : files
          ? `${prefix}_files`
          : ""
  return key ? t(`home.obj.count.${key}`, vars) : ""
}

export const countMsg = (filterType?: ObjType) =>
  getCountStr(objStore.objs, "count", filterType)

export const selectedMsg = (filterType?: ObjType) => {
  const selectedList = selectedObjs()
  const isSelected = selectedList.length > 0

  return isSelected ? getCountStr(selectedList, "selected", filterType) : ""
}

export const smartCountMsg = (filterType?: ObjType) => {
  const selectedList = selectedObjs()
  const isSelected = selectedList.length > 0

  return isSelected
    ? getCountStr(selectedList, "selected", filterType)
    : countMsg(filterType)
}

export const [uploadConfig, setUploadConfig] = createStore({
  asTask: false,
  overwrite: false,
  rapid: true,
})
