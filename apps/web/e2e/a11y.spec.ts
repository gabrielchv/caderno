import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { roomUrl } from './helpers'

const IMPACT_GATES = new Set(['serious', 'critical'])

test('room page has no serious or critical accessibility violations', async ({ page }) => {
  await page.goto(roomUrl('a11y-room'))
  const editor = page.getByRole('textbox', { name: 'Document body' })
  await expect(editor).toBeVisible()

  const results = await new AxeBuilder({ page }).analyze()
  const blocked = results.violations.filter((v) => IMPACT_GATES.has(v.impact ?? ''))

  expect(
    blocked.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      targets: v.nodes.map((n) => n.target),
    })),
    'serious/critical a11y violations found',
  ).toEqual([])
})

test('home page has no serious or critical accessibility violations', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  const results = await new AxeBuilder({ page }).analyze()
  const blocked = results.violations.filter((v) => IMPACT_GATES.has(v.impact ?? ''))

  expect(
    blocked.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      targets: v.nodes.map((n) => n.target),
    })),
    'serious/critical a11y violations found',
  ).toEqual([])
})
