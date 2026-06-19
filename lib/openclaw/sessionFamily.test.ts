import { describe, it, expect } from "vitest";
import { familyAgentId, familySeq, isFamilyMember, newFamilyKey, orderFamily } from "./sessionFamily";

describe("sessionFamily", () => {
  it("resolves the agent id for namespaced and bare family keys", () => {
    expect(familyAgentId("agent:silver-wolf:app:silver-wolf")).toBe("silver-wolf");
    expect(familyAgentId("agent:silver-wolf:app:silver-wolf:1781772530000")).toBe("silver-wolf");
    expect(familyAgentId("app:silver-wolf")).toBe("silver-wolf");
    expect(familyAgentId("app:silver-wolf:1781772530000")).toBe("silver-wolf");
  });

  it("rejects non-family keys (other surfaces)", () => {
    expect(familyAgentId("agent:silver-wolf:telegram:direct:123")).toBeNull();
    expect(familyAgentId("web:abc-123")).toBeNull();
    expect(familyAgentId(null)).toBeNull();
  });

  it("reads creation-order seq from the suffix (original = 0)", () => {
    expect(familySeq("agent:silver-wolf:app:silver-wolf")).toBe(0);
    expect(familySeq("app:silver-wolf")).toBe(0);
    expect(familySeq("agent:silver-wolf:app:silver-wolf:1781772530000")).toBe(1781772530000);
    expect(familySeq("app:silver-wolf:42")).toBe(42);
  });

  it("mints a time-stamped fresh member key", () => {
    expect(newFamilyKey("silver-wolf", 1781772530000)).toBe("app:silver-wolf:1781772530000");
  });

  it("isFamilyMember scopes to the right agent", () => {
    expect(isFamilyMember("agent:silver-wolf:app:silver-wolf:9", "silver-wolf")).toBe(true);
    expect(isFamilyMember("agent:stelle:app:stelle", "silver-wolf")).toBe(false);
  });

  it("orders a family oldest→newest, dropping foreign sessions", () => {
    const sessions = [
      { id: "agent:silver-wolf:app:silver-wolf:200" },
      { id: "agent:stelle:app:stelle" },
      { id: "agent:silver-wolf:app:silver-wolf" },
      { id: "agent:silver-wolf:telegram:direct:1" },
      { id: "agent:silver-wolf:app:silver-wolf:100" },
    ];
    expect(orderFamily(sessions, "silver-wolf").map((s) => s.id)).toEqual([
      "agent:silver-wolf:app:silver-wolf",
      "agent:silver-wolf:app:silver-wolf:100",
      "agent:silver-wolf:app:silver-wolf:200",
    ]);
  });
});
