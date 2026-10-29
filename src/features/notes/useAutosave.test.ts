import { act, renderHook } from "@testing-library/react";
import { AUTOSAVE_DELAY_MS, useAutosave } from "./useAutosave";

describe("useAutosave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("debounces and merges patches", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave(save));
    act(() => {
      result.current.queue({ title: "a" });
      result.current.queue({ content: "b" });
    });
    expect(save).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ title: "a", content: "b" });
  });

  it("flushes on unmount", () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() => useAutosave(save));
    act(() => result.current.queue({ title: "x" }));
    unmount();
    expect(save).toHaveBeenCalledWith({ title: "x" });
  });
});
