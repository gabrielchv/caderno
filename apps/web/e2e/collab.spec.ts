import { expect, test } from '@playwright/test'
import { contextWithIdentity, roomUrl } from './helpers'

const ROOM = `e2e-collab-${Date.now().toString(36)}`
const ALICE_TEXT = 'Alice writes the first draft here.'
const BOB_TEXT = 'Bob rewrites the entire document in one edit.'

test('two people share presence and converge on one document', async ({ browser }) => {
  const aliceCtx = await contextWithIdentity(browser, 'Alice', '#e11d48')
  const bobCtx = await contextWithIdentity(browser, 'Bob', '#2563eb')

  const alice = await aliceCtx.newPage()
  const bob = await bobCtx.newPage()
  try {
    await alice.goto(roomUrl(ROOM))
    await bob.goto(roomUrl(ROOM))

    const editorA = alice.getByRole('textbox', { name: 'Document body' })
    const editorB = bob.getByRole('textbox', { name: 'Document body' })

    // Presence: each side eventually lists both people.
    for (const page of [alice, bob]) {
      const roster = page.getByRole('list', { name: 'People in this room' })
      await expect(roster).toBeVisible()
      await expect(roster.locator('li')).toHaveCount(2)
      await expect(roster).toContainText('Alice')
      await expect(roster).toContainText('Bob')
    }

    // Alice types → Bob sees her edit land (deterministic: Bob rebases first).
    await editorA.fill(ALICE_TEXT)
    await expect(editorB).toHaveValue(ALICE_TEXT)
    await expect(alice.getByText('Synced', { exact: true })).toBeVisible()

    // Bob types → both converge on his edit and report Synced again.
    await editorB.fill(BOB_TEXT)
    await expect(editorA).toHaveValue(BOB_TEXT)
    await expect(editorB).toHaveValue(BOB_TEXT)
    await expect(alice.getByText('Synced', { exact: true })).toBeVisible()
    await expect(bob.getByText('Synced', { exact: true })).toBeVisible()

    // Nobody dropped from presence during the edits.
    await expect(
      alice.getByRole('list', { name: 'People in this room' }).locator('li'),
    ).toHaveCount(2)
  } finally {
    await aliceCtx.close()
    await bobCtx.close()
  }
})
