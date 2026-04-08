import { ConfigProvider } from "./ConfigProvider";
import { ConfigService } from "./ConfigService";
import { Provider, ProviderConfig } from "../../../shared/types";
import { AppError } from "../middleware/errorHandler";

export class ProviderService {
  private configService: ConfigService;

  constructor(private provider: ConfigProvider) {
    this.configService = new ConfigService(provider);
  }

  async list(): Promise<Provider[]> {
    const providerSection = await this.configService.getSection("provider");
    const providers: Provider[] = [];
    let lastModified: string;

    try {
      const mod = await this.provider.getLastModified("opencode.json");
      lastModified = mod.toISOString();
    } catch {
      lastModified = new Date().toISOString();
    }

    for (const [name, config] of Object.entries(providerSection)) {
      providers.push({
        name,
        config: config as ProviderConfig,
        lastModified,
      });
    }

    return providers;
  }

  async get(name: string): Promise<Provider | undefined> {
    const providerSection = await this.configService.getSection("provider");
    const config = providerSection[name];
    if (!config) return undefined;

    let lastModified: string;
    try {
      const mod = await this.provider.getLastModified("opencode.json");
      lastModified = mod.toISOString();
    } catch {
      lastModified = new Date().toISOString();
    }

    return {
      name,
      config: config as ProviderConfig,
      lastModified,
    };
  }

  async create(name: string, config: ProviderConfig): Promise<Provider> {
    const providerSection = await this.configService.getSection("provider");
    if (providerSection[name]) {
      throw new AppError("DUPLICATE", `Provider '${name}' already exists`, 409);
    }

    providerSection[name] = config;
    await this.configService.updateSection("provider", providerSection);

    return this.get(name) as Promise<Provider>;
  }

  async update(name: string, config: ProviderConfig): Promise<Provider> {
    const providerSection = await this.configService.getSection("provider");
    if (!providerSection[name]) {
      throw new AppError("NOT_FOUND", `Provider '${name}' not found`, 404);
    }

    providerSection[name] = config;
    await this.configService.updateSection("provider", providerSection);

    return this.get(name) as Promise<Provider>;
  }

  async delete(name: string): Promise<void> {
    const providerSection = await this.configService.getSection("provider");
    if (!providerSection[name]) {
      throw new AppError("NOT_FOUND", `Provider '${name}' not found`, 404);
    }

    delete providerSection[name];
    await this.configService.updateSection("provider", providerSection);
  }
}
