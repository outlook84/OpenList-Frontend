import { describe, expect, it } from "vitest"
import { splitRouterNavigateOptions } from "./router-history-options"

describe("splitRouterNavigateOptions", () => {
  it("defaults to clearing history and strips the custom flag before navigate", () => {
    expect(splitRouterNavigateOptions()).toEqual({
      clearHistory: true,
      navigateOptions: {},
    })

    expect(
      splitRouterNavigateOptions({
        clearHistory: false,
        scroll: false,
        replace: true,
      }),
    ).toEqual({
      clearHistory: false,
      navigateOptions: {
        scroll: false,
        replace: true,
      },
    })
  })
})
