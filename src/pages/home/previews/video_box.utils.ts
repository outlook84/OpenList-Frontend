import { normalizeFileRouteToFolderRoute } from "~/store/workspace-route"

export const getVideoPreviewFolderLoad = (
  filePath: string,
  search: string,
  append: boolean,
  getCurrentPage: (pathname: string, search: string) => number,
) => {
  const folderRoute = normalizeFileRouteToFolderRoute(filePath, search)
  return {
    folderPath: folderRoute.pathname,
    folderSearch: folderRoute.search,
    page:
      getCurrentPage(folderRoute.pathname, folderRoute.search) +
      (append ? 1 : 0),
  }
}
