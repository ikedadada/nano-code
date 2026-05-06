import { afterEach, describe, expect, test } from "bun:test"
import { config } from "@/config"
import { webFetch } from "@/infrastructure/tools/webFetch"

const originalAllowedDomains = [...config.allowedDomains]
const originalFetch = globalThis.fetch

afterEach(() => {
  config.allowedDomains = [...originalAllowedDomains]
  globalThis.fetch = originalFetch
})

describe("webFetch", () => {
  test("rejects domains that are not explicitly allowed", async () => {
    config.allowedDomains = ["example.com"]

    await expect(
      webFetch.execute({ url: "https://not-example.test/page" }),
    ).rejects.toThrow("is not allowed")
  })

  test("allows configured domains and subdomains", async () => {
    config.allowedDomains = ["example.com"]
    const fetchedUrls: string[] = []

    globalThis.fetch = (async (input: string | URL | Request) => {
      fetchedUrls.push(String(input))
      return new Response("ok")
    }) as typeof fetch

    await expect(
      webFetch.execute({ url: "https://docs.example.com/page" }),
    ).resolves.toBe("ok")
    expect(fetchedUrls).toEqual(["https://docs.example.com/page"])
  })
})
