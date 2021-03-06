#!/usr/bin/env node
const { python } = require('pythonia')
const { dirname, join } = require('path')
const { getFiles } = require('./util.js')
const commandLineArgs = require('command-line-args')
const fs = require('fs')

const genInter = require('./GenInter.js')
const genTs = require('./GenTs.js')

const optionDefinitions = [
  { name: 'input', alias: 'i', type: String },
  { name: 'ts-out', alias: 'o', type: String },
  { name: 'exclude', alias: 'x', type: String },
  { name: 'match', alias: 'm', type: String },
  { name: 'clear', alias: 'c', type: String },
]
const options = commandLineArgs(optionDefinitions)
const showUsage = () => {
  console.log(`py2tsd v${require('../package.json').version}\n\tEach time you run this CLI tool, we'll append to the last exported TSD. To avoid this, you can use the --clear flag.`)  
  console.log(`usage: py2tsd \n\t<[--input | -i] python directory OR package name> \n\t<[--ts-out | -t] output tsd location> \n\t[[--exclude | -x] optional regex to use to skip python files]`)
  console.log(`\t[[--match | -m] require match of regex string]\n\t[[--clear | -c] -- clear the workspace cache]`)
  console.log(`example: py2tsd -i ./cpython/Lib/ -o index.d.ts`)
  console.log(`example: py2tsd -i torch -o tf.d.ts -c`)
}

// console.log('Opts', options)

async function main(options, shouldSkip) {
  await python.cwd(join(__dirname, '../astexport/')) // allow python to import relative to that dir
  const astexport = await python(join(__dirname, '../astexport/astexport.py'))
  const wd  = join(__dirname, '../wd/')
  let dir = options.input
  let prefix = '' // for package dirs

  let ok
  if (!fs.existsSync(wd)) {
    fs.mkdirSync(wd, { recursive: true })
    ok = true
  }
  
  if (!fs.existsSync(dir)) {
    // The path specified isn't a valid dir, see if it's a package
    if (dir && !dir.startsWith('.') && !dir.startsWith('/')) {
      const packdir = await astexport.get_python_installdir(dir)
      prefix = packdir.split(/\/|\\/).pop() + ','
      dir = packdir
    } else {
      if (!ok) {
        console.warn(`Input directory not found: ${dir}`)
        showUsage()
      }
      process.exit()
    }
  }
  if (!options['ts-out']) {
    if (!ok) {
      console.warn(`Please specify an output file for the tsd`)
      showUsage()
    }
    process.exit()
  }

  const skipRegex = new RegExp(options.exclude)
  const inclRegex = new RegExp(options.match)

  shouldSkip ??= (inp, desiredOut) => {
    const path = inp.split('/')
    // Skip files with underscores - those are internal.
    for (const sec of path) {
      if (sec.startsWith('_') && !sec.includes('__init__')) return true
      if (sec.includes('test')) return true
    }
    // Skip non-Python files
    if (!inp.endsWith('.py')) return true
    // Already done
    if (fs.existsSync(desiredOut)) return true

    // Skip files matched by the user regex
    if (options.exclude) return inp.match(skipRegex)

    // Match only what the user wants if specified
    if (options.match) return !inp.match(inclRegex)

    // If the user has no regex, don't skip this
    return false
  }

  try { fs.mkdirSync(dirname(options['ts-out']), { recursive: true }) } catch {}

  if (options.clear !== undefined) {
    console.log('clearing ws...')
    fs.rmSync(wd, { recursive: true })
    console.log('ok')
    fs.mkdirSync(wd, { recursive: true })
  }

  const pyFiles = getFiles(dir)
  const count = pyFiles.length
  let failed = []
  let i = 0
  for (const file of pyFiles) {
    const newName = prefix + file.replace(dir, '').split(/\/|\\/g).filter(f => f.length && !f.startsWith('.')).join(',')
    // console.log('New name', file, newName)
    // return
    const astFile = join(wd, newName + '.ast.json')
    const intFile = join(wd, newName + '.int.json')

    console.log(`[${i++}/${count} ${Math.floor((i/count) * 100)}%] Reading ${file}`)
    
    if (shouldSkip(file, intFile)) continue

    try {
      await astexport.export(file, astFile)
      fs.writeFileSync(intFile, JSON.stringify(genInter(require(astFile)), null, 2))
    } catch (e) {
      console.log(e)
      failed.push(file)
    }
  }

  if (failed.length) {
    console.log('Failed to parse and skipped:', failed)
  }
 
  const wdFiles = getFiles(wd)

  console.log(`Generating TSD (merging ${wdFiles.length} files)...`)
  const tsd = genTs(wd)

  fs.writeFileSync(options['ts-out'], tsd)
}

if (!module.parent) {
  main(options).then(() => python.exit())  
}
module.exports = (...a) => main(...a).then(r => (python.exit(), r))