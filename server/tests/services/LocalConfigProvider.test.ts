import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { LocalConfigProvider } from "../../src/services/LocalConfigProvider";

describe("LocalConfigProvider", () => {
  let tmpDir: string;
  let provider: LocalConfigProvider;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ocd-test-"));
    provider = new LocalConfigProvider(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should read a file that exists", async () => {
    await fs.writeFile(path.join(tmpDir, "test.txt"), "hello");
    const content = await provider.readFile("test.txt");
    expect(content).toBe("hello");
  });

  it("should throw when reading a file that does not exist", async () => {
    await expect(provider.readFile("nope.txt")).rejects.toThrow();
  });

  it("should write a file atomically", async () => {
    await provider.writeFile("out.txt", "world");
    const content = await fs.readFile(path.join(tmpDir, "out.txt"), "utf-8");
    expect(content).toBe("world");
  });

  it("should create parent directories on write", async () => {
    await provider.writeFile("sub/dir/file.txt", "nested");
    const content = await fs.readFile(path.join(tmpDir, "sub/dir/file.txt"), "utf-8");
    expect(content).toBe("nested");
  });

  it("should delete a file", async () => {
    await fs.writeFile(path.join(tmpDir, "del.txt"), "bye");
    await provider.deleteFile("del.txt");
    const exists = await provider.exists("del.txt");
    expect(exists).toBe(false);
  });

  it("should delete a directory recursively", async () => {
    await fs.mkdir(path.join(tmpDir, "mydir"), { recursive: true });
    await fs.writeFile(path.join(tmpDir, "mydir/f.txt"), "data");
    await provider.deleteDirectory("mydir");
    const exists = await provider.exists("mydir");
    expect(exists).toBe(false);
  });

  it("should list directory contents", async () => {
    await fs.writeFile(path.join(tmpDir, "a.txt"), "a");
    await fs.writeFile(path.join(tmpDir, "b.txt"), "b");
    const entries = await provider.listDirectory(".");
    expect(entries.sort()).toEqual(["a.txt", "b.txt"]);
  });

  it("should check if a path exists", async () => {
    expect(await provider.exists("nope")).toBe(false);
    await fs.writeFile(path.join(tmpDir, "yes.txt"), "y");
    expect(await provider.exists("yes.txt")).toBe(true);
  });

  it("should return last modified date", async () => {
    await fs.writeFile(path.join(tmpDir, "ts.txt"), "data");
    const modified = await provider.getLastModified("ts.txt");
    expect(modified).toBeInstanceOf(Date);
  });

  it("should return the base path", () => {
    expect(provider.getBasePath()).toBe(tmpDir);
  });
});
