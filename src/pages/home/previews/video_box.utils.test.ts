import { describe, expect, it, vi } from "vitest"
import { getVideoPreviewFolderLoad } from "./video_box.utils"

describe("getVideoPreviewFolderLoad", () => {
  it("reads the load-more page from the folder route instead of the file route", () => {
    const getCurrentPage = vi.fn(() => 4)

    const result = getVideoPreviewFolderLoad(
      "/folder/video.mp4",
      "?view=list",
      true,
      getCurrentPage,
    )

    expect(result).toEqual({
      folderPath: "/folder",
      folderSearch: "?view=list",
      page: 5,
    })
    expect(getCurrentPage).toHaveBeenCalledWith("/folder", "?view=list")
  })

  it("keeps the first fetch on the current folder page when not appending", () => {
    const getCurrentPage = vi.fn(() => 2)

    expect(
      getVideoPreviewFolderLoad(
        "/folder/video.mp4",
        "?view=list",
        false,
        getCurrentPage,
      ),
    ).toEqual({
      folderPath: "/folder",
      folderSearch: "?view=list",
      page: 2,
    })
  })

  it("preserves the root folder when previewing a top-level video", () => {
    const getCurrentPage = vi.fn(() => 3)

    expect(
      getVideoPreviewFolderLoad(
        "/movie.mp4",
        "?view=list",
        true,
        getCurrentPage,
      ),
    ).toEqual({
      folderPath: "/",
      folderSearch: "?view=list",
      page: 4,
    })
    expect(getCurrentPage).toHaveBeenCalledWith("/", "?view=list")
  })

  it("keeps only folder-scoped params when normalizing the file route", () => {
    const getCurrentPage = vi.fn(() => 6)

    expect(
      getVideoPreviewFolderLoad(
        "/folder/video.mp4",
        "?preview=video&type=audio&from=search&auto_fullscreen=true&pwd=secret&view=list&page=3",
        true,
        getCurrentPage,
      ),
    ).toEqual({
      folderPath: "/folder",
      folderSearch: "?page=3&view=list",
      page: 7,
    })
    expect(getCurrentPage).toHaveBeenCalledWith("/folder", "?page=3&view=list")
  })
})
