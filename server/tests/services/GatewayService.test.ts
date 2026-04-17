import { beforeEach, describe, expect, it, vi } from "vitest";
import { GatewayService } from "../../src/services/GatewayService";

const fetchMock = vi.fn();

describe("GatewayService", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("returns null when no provider has baseURL/apiKey", async () => {
    const svc = new GatewayService("/nonexistent/path/opencode.json");
    const result = await svc.detect();
    expect(result).toBeNull();
  });

  it("detects LiteLLM provider via /health", async () => {
    const tmpPath = `/tmp/gw-test-${Date.now()}.json`;
    const content = JSON.stringify({
      provider: {
        "ryanair-gateway": {
          options: {
            baseURL: "https://gw.example.com/v1",
            apiKey: "sk-test",
          },
        },
      },
    });

    await import("fs/promises").then(fs => fs.writeFile(tmpPath, content, "utf8"));

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ litellm_version: "1.82.0" }),
    });

    const svc = new GatewayService(tmpPath);
    const result = await svc.detect();

    expect(result).not.toBeNull();
    expect(result?.providerName).toBe("ryanair-gateway");
    expect(result?.baseUrl).toBe("https://gw.example.com");
    expect(result?.apiKey).toBe("sk-test");
  });

  it("fetches daily activity results", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            date: "2026-04-17",
            metrics: {
              spend: 1,
              prompt_tokens: 2,
              completion_tokens: 3,
              cache_read_input_tokens: 4,
              cache_creation_input_tokens: 5,
              total_tokens: 6,
              successful_requests: 7,
              failed_requests: 8,
              api_requests: 9,
            },
            breakdown: {
              model_groups: {},
              providers: {},
            },
          },
        ],
      }),
    });

    const svc = new GatewayService("/nonexistent/path/opencode.json");
    const result = await svc.getDailyActivity("https://gw.example.com", "sk-test", "2026-04-17", "2026-04-18");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://gw.example.com/user/daily/activity?start_date=2026-04-17&end_date=2026-04-18",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer sk-test" }),
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].metrics.spend).toBe(1);
  });
});
