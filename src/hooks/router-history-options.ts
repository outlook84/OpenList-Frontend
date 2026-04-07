import type { NavigateOptions } from "@solidjs/router"

export type RouterNavigateOptions = Partial<NavigateOptions> & {
  clearHistory?: boolean
}

export const splitRouterNavigateOptions = (options?: RouterNavigateOptions) => {
  const { clearHistory = true, ...navigateOptions } = options || {}
  return {
    clearHistory,
    navigateOptions,
  }
}
