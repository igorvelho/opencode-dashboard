export interface ConfigProvider {
  readFile(relativePath: string): Promise<string>;
  writeFile(relativePath: string, content: string): Promise<void>;
  deleteFile(relativePath: string): Promise<void>;
  deleteDirectory(relativePath: string): Promise<void>;
  listDirectory(relativePath: string): Promise<string[]>;
  exists(relativePath: string): Promise<boolean>;
  getLastModified(relativePath: string): Promise<Date>;
  getBasePath(): string;
}
