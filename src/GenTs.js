const fs = require('fs')
const { getFiles } = require('./util')

const RESERVED = ['new', 'function', 'Function']
const REPL = { 'var': 'variable', 'function': 'func', 'new': 'New', 'default': 'def', 'super': 'superclass', 'delete': 'del', 'debugger': 'debuger', 'const': 'constant' }
const PYPRIM = ['str', 'int', 'complex', 'float', 'classmethod', 'any', 'staticmethod', 'Exception', 'property', 'object']

function fixArg(v) {
  return REPL[v] ?? v
}
function isReserved(v) {
  return !!REPL[v]
}
function fixNs(v) {
  if (['enum', 'debugger', 'this'].includes(v)) {
    return '_' + v
  }
  return v
}

function formatDoc(doc, args) {
  if (!doc || !doc.split) return []
  const lines = doc.split('\n')
  const nline = ['', '/**']
  for (const line of lines) {
    nline.push(' * ' + line.replace(/\*\//g, '*‍/'))
  }
  nline.push(' */\n')
  return nline
}

function generate(className, payload) {
  let lines = ''
  // for (const cn of className) {
  //   lines += `module "${cn}" {`
  // }
  lines += '\n'
  let comp = {}

  // let lines = `module "${className.map(fixNs).join('.')}" {\n`
  function parse(what, depth = 1) {
    const pad = w => ''.padStart(depth, '\t') + w

    function parseFn(entry, method) {
      let ret = ''
      if (method) entry.args.shift()
      if (entry.name.startsWith('_')) return ret
      if (!RESERVED.includes(entry.name)) {
        ret += formatDoc(entry.doc).map(l => pad(l)).join('\n')
        let s = method ? `${entry.name}(` : (`function ${entry.name}(`)
        let a = []
        for (const arg of entry.args) {
          if (arg.name == 'self') continue
          let typ = ''
          if (typeof arg.def == 'boolean') typ = '?: boolean'
          else if (arg.def != undefined) typ = '?'
          a.push(fixArg(arg.name) + typ)
        }
        s += a.join(', ')
        let rv = entry.returns ? 'I' + entry.returns : null
        s += `): Promise<${rv ?? 'any'}>\n`
        ret += pad(s) + ''
      }
      {
        // ret += formatDoc(entry.doc).map(l => pad(l)).join('\n')
        let s = method ? `${entry.name}$(` : (`function ${entry.name}$(`)
        if (!entry.args.length) {
          s += '$:'
        }
        s += '{'
        let a = [], b = [], hasOptional = false
        for (const arg of entry.args) {
          if (arg.name == 'self') continue
          a.push(fixArg(arg.name))
          if (arg.def != undefined) hasOptional = true
          b.push(fixArg(arg.name) + ((arg.def != undefined) ? '?' : ''))
        }

        s += a.join(', ') + '}'
        if (hasOptional) {
          s += ': {'
          s += b.join(',') + '}'
        }
        let rv = entry.returns ? 'I' + entry.returns : null
        s += `): Promise<${rv ?? 'any'}>\n`
        ret += pad(s) + ''
      }
      return ret
    }

    for (const entry of what) {
      if (entry.type === 'fn') {
        comp[entry.name] = true //dedupe
        lines += parseFn(entry)
      } else if (entry.type === 'class') {
        lines += formatDoc(entry.comment).map(l => pad(l)).join('\n')
        const ext = entry.extends.filter(k => k?.trim().length).map(k => k.trim()).filter(k => !PYPRIM.includes(k))
          .filter(k => {
            for (const entry of what) {
              if (entry.name == k) return true
            }
            return false
          }).map(k => 'I' + k)
        let s = ''
        for (const m of entry.methods) {
          if (m.name === '__init__') {
            m.name = entry.name
            m.returns = entry.name
            comp[m.name] = true
            s += parseFn(m)
            // console.log('init', m)
            m.name = '__init__'
          }
        }
        s += pad(`interface I${entry.name} ${ext.length ? 'extends ' : ''}${ext.join(', ')} {\n`)


        for (const m of entry.methods) {
          if (m.name === '__init__') continue
          depth++
          comp[m.name] = true
          s += parseFn(m, true)
          depth--
        }
        for (const v of entry.vars) {
          if (!v || v.startsWith('_')) continue
          if (comp[v]) continue //dedupe
          comp[v] = true
          s += pad(`\t` + v + '\n')
        }
        // for (const cn of className) s+='}'
        s += pad('}\n')
        lines += s + ''
      } else if (entry.targets) {
        for (let target of entry.targets) {
          if (target == null || target.startsWith('_')) continue
          if (isReserved(target)) target += '$'
          if (comp[target]) continue //dedupe
          comp[target] = true
          lines += pad('let ' + target + ': Promise<any>\n')
        }
      }
    }
    // lines+=JSON.stringify(comp)
    // lines +=';'
  }
  parse(payload)
  // lines +='}\n'
  return [lines, comp]
}

function execute(input_dir='./parsed') {
  let ret = ''
  let defs = []
  let rtypes = []

  let modMap = {}

  // Map the file names in the WD over to their class names
  const files = getFiles(input_dir).filter(file => file.endsWith('.int.json'))
    .map(file => [file, file.split('/').slice(-1)[0].replace('.py.int.json', '').split(',')])

  // Generate the bulk of the definitons
  for (const [file, cn] of files) {
    const j = require(file)

    let r = modMap//[cn[0]] ??= {})
    for (var c of cn) {
      r = (r[c] ??= {})
    }

    const className = cn.join('.')

    // console.log('cn', className)
    defs.push(className)
    // break

    // console.log(file)
    const [lines, words] = generate(cn, j)
    r.val = lines
    r.words = words
    // r.file = j
    // console.log(modMap)
  }

  // Now make the maps at the end
  for (const [file, cn] of files) {
    const j = require(file)

    let types = []
    // Build the final type map
    for (const token of j) {
      if (token.type == 'import' && !token.what[0]?.asname) {
        if (!token.mod || token.mod.startsWith('_')) continue
        token.mod = fixNs(token.mod)
        if (!token.level === 1) {
          token.mod = token.mod.split('.').slice(1).join('.')
        } else if (token.level == 0 && token.mod) {
          for (const what of token.what) {
            if (what.name == '*') {
              types.push(`${token.mod}`)
            } else {
              types.push(`${token.mod}.${fixNs(what.name)}`)
            }
          }
          continue
        }

        types.push(`${cn[0]}.${token.mod}`)
      }
    }

    // T extends "urllib" ? typeof urllib :
    let c = []

    if (types.length && cn[1] == '__init__') {
      if (!types.length) continue
      types = types.filter(k => {
        try {
          console.assert(eval(`modMap.${k}`), `modMap.${k}`)
          c.push(`modMap.${k}`)
          return true
        } catch (e) {
          // console.assert(eval(`modMap.${k}`), `modMap.${k}`)
          // console.log(e)
          return false
        }
      })
      if (!types.length) continue
      ret += `declare type ${cn[0]}_default = ${types.map(k => 'typeof ' + k).join(' & ')}\n`
      rtypes.push(cn[0])
    }
  }

  function draw(entries, depth = 0) {
    const pad = w => ''.padStart(depth, '\t') + w
    for (const key in entries) {
      const entry = entries[key]
      if (key != '__init__') ret += pad((depth == 0 ? 'declare ' : '') + `module ${fixNs(key)} {\n`)
      if (entry.val) {
        // if (entry.val.length <= 2) 
        ret += '\t var _'
        ret += entry.val
      } else {
        draw(entry, depth + 1)
      }
      if (key != '__init__') ret += pad('}\n')
    }

  }
  draw(modMap)

  // console.log(defs)

  let rt = []

  for (const def of defs) {
    // console.log('Def', def)
    try {
      // console.log(`modMap.${def}`)
      const ok = eval(`modMap.${def}`)
      if (ok && !def.includes("__init__") && !def.includes("__main__")) {
        // console.log('ok', ok)
        // process.exit(1)
        // console.log(def)
        rt.push(def)

      }
    } catch { }
  }

  for (const def of rtypes) {
    rt.push(def)
  }

  ret += `type PyObjectType<T> = \n`
  ret += rt.map(def => `T extends "${def}" ? typeof ${def} :`).join('\n')
  ret += `    object;\n`

  ret += `type PyTypeName = \n`
  ret += rt.map(k => `"${k}"`).join(' | ')
  ret += `;`

  return ret
}

module.exports = execute