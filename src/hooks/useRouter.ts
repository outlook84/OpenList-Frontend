import {
  NavigateOptions,
  SetParams,
  useLocation,
  useNavigate,
  useParams,
  _mergeSearchString,
} from "@solidjs/router"
import { createMemo, untrack } from "solid-js"
import {
  splitRouterNavigateOptions,
  type RouterNavigateOptions,
} from "./router-history-options"
import { clearHistoryByHref } from "~/store/history"
import { encodePath, joinBase, log, pathDir, pathJoin, trimBase } from "~/utils"

const useRouter = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  const pathname = createMemo(() => {
    return trimBase(decodeURIComponent(location.pathname))
  })
  const isShare = createMemo(() => {
    return pathname().startsWith("/@s")
  })
  return {
    to: (
      path: string,
      ignore_root?: boolean,
      options?: RouterNavigateOptions,
    ) => {
      if (!ignore_root && path.startsWith("/")) {
        path = joinBase(path)
      }
      const { clearHistory, navigateOptions } =
        splitRouterNavigateOptions(options)
      if (clearHistory) {
        clearHistoryByHref(path)
      }
      log("to:", path)
      navigate(path, navigateOptions)
    },
    replace: (to: string) => {
      const path = joinBase(encodePath(pathJoin(pathDir(pathname()), to), true))
      clearHistoryByHref(path)
      navigate(path)
    },
    pushHref: (to: string): string => {
      return encodePath(pathJoin(pathname(), to))
    },
    back: () => {
      navigate(-1)
    },
    forward: () => {
      navigate(1)
    },
    pathname: pathname,
    isShare: isShare,
    search: createMemo(() => location.search),
    searchParams: location.query,
    setSearchParams: (
      params: SetParams,
      options?: Partial<NavigateOptions>,
    ) => {
      const searchString = untrack(() =>
        _mergeSearchString(location.search, params),
      )
      clearHistoryByHref(pathname() + searchString)
      navigate(joinBase(pathname() + searchString), {
        scroll: false,
        ...options,
        resolve: true,
      })
    },
    params: params,
  }
}

export { useRouter }
