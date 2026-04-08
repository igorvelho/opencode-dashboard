import { ConfigProvider } from "./ConfigProvider";
import * as jsonc from "jsonc-parser";
import { AppError } from "../middleware/errorHandler";

export class ConfigService {
  constructor(private provider: ConfigProvider) {}

  async getRaw(): Promise<string> {
    try {
      return await this.provider.readFile("opencode.json");
    } catch {
      return "{}";
    }
  }

  async getParsed(): Promise<Record<string, unknown>> {
    const raw = await this.getRaw();
    const errors: jsonc.ParseError[] = [];
    const result = jsonc.parse(raw, errors);
    if (errors.length > 0) {
      throw new AppError(
        "PARSE_ERROR",
        `Failed to parse opencode.json: ${errors.map((e) => jsonc.printParseErrorCode(e.error)).join(", ")}`,
        400
      );
    }
    return result || {};
  }

  async saveRaw(content: string): Promise<void> {
    // Validate that content is valid JSONC before saving
    const errors: jsonc.ParseError[] = [];
    jsonc.parse(content, errors);
    if (errors.length > 0) {
      throw new AppError(
        "PARSE_ERROR",
        `Invalid JSONC: ${errors.map((e) => jsonc.printParseErrorCode(e.error)).join(", ")}`,
        400
      );
    }
    await this.provider.writeFile("opencode.json", content);
  }

  async getSection(section: string): Promise<Record<string, unknown>> {
    const config = await this.getParsed();
    return (config[section] as Record<string, unknown>) || {};
  }

  async updateSection(section: string, data: Record<string, unknown>): Promise<void> {
    const raw = await this.getRaw();
    const edits = jsonc.modify(raw, [section], data, {
      formattingOptions: { tabSize: 2, insertSpaces: true },
    });
    const updated = jsonc.applyEdits(raw, edits);
    await this.provider.writeFile("opencode.json", updated);
  }
}
