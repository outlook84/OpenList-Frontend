import type { FileSessionRoute } from "~/store"
import { sanitizeWorkspaceSearch } from "~/store/workspace-route"

export const isActiveSessionRouteAligned = (
  route: FileSessionRoute | undefined,
  pathname: string,
  search: string,
) => {
  return (
    !!route &&
    route.pathname === pathname &&
    route.search === sanitizeWorkspaceSearch(search)
  )
}
