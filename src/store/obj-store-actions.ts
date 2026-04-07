import type { SetStoreFunction } from "solid-js/store"
import type { Obj } from "~/types"
import type { State } from "./obj"

type ObjStoreShape = {
  obj: Obj
  raw_url: string
  related: Obj[]
  objs: unknown[]
  total: number
  readme: string
  header: string
  provider: string
  direct_upload_tools?: string[]
  state: State
  err: string
  write?: boolean
  write_content_bypass?: boolean
}

export const createObjStoreActions = (
  setObjStore: SetStoreFunction<ObjStoreShape>,
  resetSelectionRange: () => void,
) => {
  const setObjs = (objs: Obj[]) => {
    resetSelectionRange()
    setObjStore("objs", objs)
    setObjStore("obj", "is_dir", true)
  }

  return {
    set: (data: object) => {
      setObjStore(data as Partial<ObjStoreShape>)
    },
    setObj: (obj: Obj) => {
      setObjStore("obj", obj)
    },
    setRawUrl: (raw_url: string) => {
      setObjStore("raw_url", raw_url)
    },
    setProvider: (provider: string) => {
      setObjStore("provider", provider)
    },
    setObjs,
    setTotal: (total: number) => {
      setObjStore("total", total)
    },
    setReadme: (readme: string) => {
      setObjStore("readme", readme)
    },
    setHeader: (header: string) => {
      setObjStore("header", header)
    },
    setRelated: (related: Obj[]) => {
      setObjStore("related", related)
    },
    setWrite: (write: boolean) => {
      setObjStore("write", write)
    },
    setWriteContentBypass: (write_content_bypass: boolean) => {
      setObjStore("write_content_bypass", write_content_bypass)
    },
    setState: (state: State) => {
      setObjStore("state", state)
    },
    setDirectUploadTools: (tools?: string[]) => {
      setObjStore("direct_upload_tools", tools)
    },
    setErr: (err: string) => {
      setObjStore("err", err)
    },
  }
}
