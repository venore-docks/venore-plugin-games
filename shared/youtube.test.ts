import { describe, expect, it } from "vitest";
import { youtubeThumbnailUrl } from "./youtube";

describe("youtubeThumbnailUrl", () => {
  it("monta a miniatura a partir de qualquer formato de link aceito", () => {
    const expected = "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg";
    expect(youtubeThumbnailUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30")).toBe(expected);
    expect(youtubeThumbnailUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(expected);
    expect(youtubeThumbnailUrl("https://www.youtube.com/live/dQw4w9WgXcQ?si=abc")).toBe(expected);
  });

  it("sem link ou link não reconhecido não tem miniatura", () => {
    expect(youtubeThumbnailUrl(null)).toBeNull();
    expect(youtubeThumbnailUrl("https://www.youtube.com/@canaldaliga")).toBeNull();
  });
});
