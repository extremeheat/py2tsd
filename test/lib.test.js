const py2json = require('py2json')
const { join } = require('path')


it('can parse folders', async function () {
  await py2json({ input: join(__dirname, '../astexport'), 'ts-out': './astexport.d.ts' })
})

it('can parse packages', async function () {
  const { com } = require('pythonia')
  com.start() // restart python process we killed

  try {
    await py2json({ input: 'urllib', 'ts-out': './urllib.d.ts' })
  } catch (e) {
    console.log(e)
  }
})