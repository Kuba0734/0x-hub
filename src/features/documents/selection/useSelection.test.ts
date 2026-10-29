import { act, renderHook } from "@testing-library/react";
import { useSelection } from "./useSelection";

const order = ["a", "b", "c", "d", "e"];

describe("useSelection", () => {
  it("toggles, selects ranges with shift and clears", () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.select("b", order, { shiftKey: false }));
    act(() => result.current.select("d", order, { shiftKey: true }));
    expect([...result.current.selected].sort()).toEqual(["b", "c", "d"]);
    act(() => result.current.select("c", order, { shiftKey: false }));
    expect([...result.current.selected].sort()).toEqual(["b", "d"]);
    expect(result.current.active).toBe(true);
    act(() => result.current.clear());
    expect(result.current.active).toBe(false);
    act(() => result.current.selectAll(order));
    expect(result.current.selected.size).toBe(5);
  });
});
