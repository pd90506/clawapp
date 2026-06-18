import { describe, it, expect } from "vitest";
import { agentIdFromSessionKey } from "./agentVisuals";

describe("agentIdFromSessionKey", () => {
  it("parses the gateway-namespaced app key", () => {
    expect(agentIdFromSessionKey("agent:silver-wolf:app:silver-wolf")).toBe("silver-wolf");
  });

  it("parses any namespaced agent session key", () => {
    expect(agentIdFromSessionKey("agent:stelle:telegram:direct:123")).toBe("stelle");
  });

  it("parses the bare app key (freshly-created, non-namespaced)", () => {
    expect(agentIdFromSessionKey("app:silver-wolf")).toBe("silver-wolf");
  });

  it("returns null for null/empty or unrecognized keys", () => {
    expect(agentIdFromSessionKey(null)).toBeNull();
    expect(agentIdFromSessionKey("")).toBeNull();
    expect(agentIdFromSessionKey("random-key")).toBeNull();
  });
});
