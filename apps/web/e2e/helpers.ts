import type { Browser, BrowserContext } from '@playwright/test'

export const roomUrl = (room: string) => `/rooms/${room}`

/**
 * Open a fresh browser context with a fixed local identity. Two Caderno
 * sessions = two browser contexts — same-origin localStorage would otherwise
 * share one identity.
 */
export async function contextWithIdentity(
  browser: Browser,
  name: string,
  color: string,
): Promise<BrowserContext> {
  const ctx = await browser.newContext()
  await ctx.addInitScript(({ name, color }) => {
    const clientId = `${name.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}`
    window.localStorage.setItem(
      'caderno:identity',
      JSON.stringify({ clientId, name, color }),
    )
  }, { name, color })
  return ctx
}
