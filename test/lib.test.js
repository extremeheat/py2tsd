const py2json = require('py2json')
const { join } = require('path')

it('can parse the lib', async function () {
  await py2json({ input: join(__dirname, '../astexport'), 'ts-out': './index.d.ts' })
})