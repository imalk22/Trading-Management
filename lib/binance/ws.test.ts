import { describe, it, expect, vi } from "vitest";
import { nextBackoffDelayMs, createReconnectingStream } from "./ws";

describe("nextBackoffDelayMs", () => {
  it("doubles from a 500ms base and caps at 15000ms", () => {
    expect(nextBackoffDelayMs(0)).toBe(500);
    expect(nextBackoffDelayMs(1)).toBe(1000);
    expect(nextBackoffDelayMs(2)).toBe(2000);
    expect(nextBackoffDelayMs(5)).toBe(15000);
    expect(nextBackoffDelayMs(10)).toBe(15000);
  });
});

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  close() {
    this.closed = true;
  }
}

describe("createReconnectingStream", () => {
  it("opens a socket to the given URL and forwards parsed messages", () => {
    FakeWebSocket.instances = [];
    const onMessage = vi.fn();
    createReconnectingStream({
      url: "wss://example.test/stream",
      onMessage,
      WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
    });

    const socket = FakeWebSocket.instances[0];
    expect(socket.url).toBe("wss://example.test/stream");
    socket.onmessage?.({ data: JSON.stringify({ hello: "world" }) });
    expect(onMessage).toHaveBeenCalledWith({ hello: "world" });
  });

  it("reconnects with an incrementing attempt count when the socket closes unexpectedly", () => {
    FakeWebSocket.instances = [];
    const scheduleReconnect = vi.fn((_attempt: number, reconnect: () => void) => reconnect());

    createReconnectingStream({
      url: "wss://example.test/stream",
      onMessage: () => {},
      WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
      scheduleReconnect,
    });

    FakeWebSocket.instances[0].onclose?.();
    FakeWebSocket.instances[1].onclose?.();

    expect(scheduleReconnect).toHaveBeenNthCalledWith(1, 1, expect.any(Function));
    expect(scheduleReconnect).toHaveBeenNthCalledWith(2, 2, expect.any(Function));
    expect(FakeWebSocket.instances).toHaveLength(3);
  });

  it("does not reconnect after close() is called by the caller", () => {
    FakeWebSocket.instances = [];
    const scheduleReconnect = vi.fn();

    const stream = createReconnectingStream({
      url: "wss://example.test/stream",
      onMessage: () => {},
      WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
      scheduleReconnect,
    });

    stream.close();
    FakeWebSocket.instances[0].onclose?.();

    expect(scheduleReconnect).not.toHaveBeenCalled();
    expect(FakeWebSocket.instances[0].closed).toBe(true);
  });
});
