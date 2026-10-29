import { acceleratorFromEvent } from "./accelerator";

const ev = (
  code: string,
  mods: Partial<Record<"ctrlKey" | "altKey" | "shiftKey" | "metaKey", boolean>> = {},
) => ({
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  code,
  ...mods,
});

describe("acceleratorFromEvent", () => {
  it("builds accelerators", () => {
    expect(acceleratorFromEvent(ev("Space", { ctrlKey: true, altKey: true }))).toBe(
      "Ctrl+Alt+Space",
    );
    expect(acceleratorFromEvent(ev("KeyN", { ctrlKey: true, shiftKey: true }))).toBe(
      "Ctrl+Shift+N",
    );
    expect(acceleratorFromEvent(ev("F5", { altKey: true }))).toBe("Alt+F5");
  });
  it("requires Ctrl or Alt and a real key", () => {
    expect(acceleratorFromEvent(ev("KeyN"))).toBeNull();
    expect(acceleratorFromEvent(ev("KeyN", { shiftKey: true }))).toBeNull();
    expect(acceleratorFromEvent(ev("ControlLeft", { ctrlKey: true }))).toBeNull();
  });
});
