import { routeDirection } from "./direction";

describe("routeDirection", () => {
  const order = ["/", "/documents", "/notes", "/settings"];
  it("is +1 going down the sidebar and -1 going up", () => {
    expect(routeDirection(order, "/", "/notes")).toBe(1);
    expect(routeDirection(order, "/settings", "/documents")).toBe(-1);
    expect(routeDirection(order, "/x", "/notes")).toBe(1);
  });
});
