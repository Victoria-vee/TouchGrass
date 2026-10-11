import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleCheck, faPen, faStar, faTrashCan } from '@fortawesome/free-solid-svg-icons'
import { createServer } from 'vite'

test('renders imported Font Awesome icons through the client React tree', async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { default: App } = await vite.ssrLoadModule('/src/App.jsx')
    const markup = renderToStaticMarkup(React.createElement(App))
    const journalIcons = renderToStaticMarkup(React.createElement(React.Fragment, null,
      ...[faCircleCheck, faPen, faStar, faTrashCan].map((icon) => React.createElement(FontAwesomeIcon, { icon, key: icon.iconName })),
    ))
    const renderedIcons = [...`${markup}${journalIcons}`.matchAll(/data-icon="([^"]+)"/g)].map((match) => match[1])

    assert.ok(renderedIcons.includes('book-open'), 'journal navigation icon should render')
    assert.ok(renderedIcons.includes('arrow-right'), 'challenge action icon should render')
    assert.ok(renderedIcons.includes('asterisk'), 'supporting status icon should render')
    for (const name of ['circle-check', 'pen', 'star', 'trash-can']) {
      assert.ok(renderedIcons.includes(name), `${name} should render for journal and guidance controls`)
    }
  } finally {
    await vite.close()
  }
})
