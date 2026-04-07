import { useRouter } from "./useRouter"
import {
  createWorkspacePathRuntime,
  getCurrentWorkspacePage,
} from "./workspace-path-runtime"

export { getCurrentWorkspacePage }

export const usePath = () => {
  const { pathname, search, to } = useRouter()
  return createWorkspacePathRuntime({
    pathname,
    search,
    to,
  })
}
