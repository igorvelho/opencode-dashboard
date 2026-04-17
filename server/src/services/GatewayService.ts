import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as jsonc from "jsonc-parser";

const DEFAULT_CONFIG_PATH = path.join(os.homedir(), ".config", "opencode", "opencode.json");

interface GatewayProviderOptions {
  baseURL?: string;
  apiKey?: string;
  [key: string]: unknown;
}

interface GatewayProviderConfig {
  options?: GatewayProviderOptions;
  [key: string]: unknown;
}

interface GatewayConfig {
  provider?: Record<string, GatewayProviderConfig>;
}

export interface GatewayInfo {
  providerName: string;
  baseUrl: string;
  apiKey: string;
}

export interface GatewayMetrics {
  spend: number;
  prompt_tokens: number;
  completion_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  total_tokens: number;
  successful_requests: number;
  failed_requests: number;
  api_requests: number;
}

export interface GatewayBreakdownItem {
  metrics: GatewayMetrics;
}

export interface GatewayDailyResult {
  date: string;
  metrics: GatewayMetrics;
  breakdown: {
    model_groups: Record<string, GatewayBreakdownItem>;
    providers: Record<string, GatewayBreakdownItem>;
  };
}

interface DailyActivityResponse {
  results?: GatewayDailyResult[];
}

export class GatewayService {
  private cachedGateway: GatewayInfo | null | undefined;

  constructor(private configPath: string = process.env.OPENCODE_CONFIG_PATH ?? DEFAULT_CONFIG_PATH) {
    this.cachedGateway = undefined;
  }

  private loadConfig(): GatewayConfig {
    try {
      const raw = fs.readFileSync(this.configPath, "utf8");
      const errors: jsonc.ParseError[] = [];
      const parsed = jsonc.parse(raw, errors, { allowTrailingComma: true });
      if (errors.length > 0 || !parsed || typeof parsed !== "object") {
        return {};
      }
      return parsed as GatewayConfig;
    } catch {
      return {};
    }
  }

  private normalizeBaseUrl(url: string): string {
    return url.replace(/\/v1\/?$/, "");
  }

  private isString(value: unknown): value is string {
    return typeof value === "string";
  }

  async detect(): Promise<GatewayInfo | null> {
    if (this.cachedGateway !== undefined) {
      return this.cachedGateway;
    }

    const config = this.loadConfig();
    const providers = config.provider ?? {};

    for (const [providerName, providerConfig] of Object.entries(providers)) {
      const options = (providerConfig.options ?? providerConfig) as GatewayProviderOptions;
      const baseURL = options.baseURL;
      const apiKey = options.apiKey;

      if (!this.isString(baseURL) || !this.isString(apiKey) || baseURL.length === 0 || apiKey.length === 0) {
        continue;
      }

      const baseUrl = this.normalizeBaseUrl(baseURL);

      try {
        const response = await fetch(`${baseUrl}/health`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) {
          continue;
        }
        const body = (await response.json()) as Record<string, unknown>;
        if ("litellm_version" in body) {
          const info: GatewayInfo = { providerName, baseUrl, apiKey };
          this.cachedGateway = info;
          return info;
        }
      } catch {
        // Ignore probe failures, try next provider.
      }
    }

    this.cachedGateway = null;
    return null;
  }

  async getDailyActivity(baseUrl: string, apiKey: string, startDate: string, endDate: string): Promise<GatewayDailyResult[]> {
    const url = `${baseUrl}/user/daily/activity?start_date=${startDate}&end_date=${endDate}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Gateway daily activity fetch failed: ${response.status}`);
    }

    const body = (await response.json()) as DailyActivityResponse;
    return body.results ?? [];
  }

  invalidateCache(): void {
    this.cachedGateway = undefined;
  }
}
