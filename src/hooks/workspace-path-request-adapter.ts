import axios, { Canceler } from "axios"
import { fsGet, fsList } from "~/utils"

let cancelObj: Canceler
let cancelList: Canceler

export const cancelPathRequests = () => {
  cancelObj?.()
  cancelList?.()
}

export const createWorkspacePathRequestAdapter = ({
  getPassword,
}: {
  getPassword: () => string
}) => ({
  getObject: (path: string) =>
    fsGet(
      path,
      getPassword(),
      new axios.CancelToken((c) => {
        cancelObj = c
      }),
    ),
  getFolder: (arg?: {
    path: string
    index?: number
    size?: number
    force?: boolean
  }) =>
    fsList(
      arg?.path,
      getPassword(),
      arg?.index,
      arg?.size,
      arg?.force,
      new axios.CancelToken((c) => {
        cancelList = c
      }),
    ),
})
