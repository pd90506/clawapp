// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { startFakeGateway, setExpectedToken, type FakeGateway } from "./fakeGateway";
import { GatewayConnection } from "../connection";

let gw: FakeGateway;

beforeEach(async () => { gw = await startFakeGateway(); setExpectedToken(null); });
afterEach(async () => { await gw.close(); });

describe("GatewayConnection.handshake", () => {
  it("completes the connect handshake and resolves ready()", async () => {
    setExpectedToken("tok");
    const conn = GatewayConnection.fromConfig({ url: gw.httpUrl, token: "tok", source: "file" });
    await conn.ready();
    await conn.close();
  });

  it("rejects ready() on bad token", async () => {
    setExpectedToken("good");
    const conn = GatewayConnection.fromConfig({ url: gw.httpUrl, token: "bad", source: "file" });
    await expect(conn.ready()).rejects.toThrow(/bad-token|handshake/);
    await conn.close();
  });
});
