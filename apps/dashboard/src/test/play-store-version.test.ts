import { describe, expect, it } from "vitest";
import { clearPlayStoreVersionCache, lookupPlayStoreVersion } from "@/lib/play-store-version";

describe("Play Store version lookup", () => {
  it("returns not-configured when no package name is set", async () => {
    const result = await lookupPlayStoreVersion(undefined, {
      now: Date.UTC(2026, 5, 21)
    });

    expect(result.source).toBe("not-configured");
    expect(result.version).toBeUndefined();
  });

  it("rejects invalid package names without calling Play Store", async () => {
    let calls = 0;
    const result = await lookupPlayStoreVersion("not a package", {
      now: Date.UTC(2026, 5, 21),
      lookupApp: async () => {
        calls += 1;
        return { version: "7.12" };
      }
    });

    expect(calls).toBe(0);
    expect(result.error).toBe("Invalid Android package name");
  });

  it("returns a usable version from the Play Store lookup", async () => {
    clearPlayStoreVersionCache();

    const result = await lookupPlayStoreVersion("com.squareup.rst.kds", {
      now: Date.UTC(2026, 5, 21),
      lookupApp: async () => ({
        title: "Square KDS",
        version: "7.12",
        updated: Date.UTC(2026, 5, 17)
      })
    });

    expect(result).toMatchObject({
      packageName: "com.squareup.rst.kds",
      source: "play-store",
      title: "Square KDS",
      version: "7.12",
      updatedAt: "2026-06-17T00:00:00.000Z"
    });
  });
});
