/**
 * Generates an intermediate representation before we pass to TypeScript generator.
 */
function read(what) {
  const fns = []
  const classes = []
  const imports = []
  const vars = []
  
  function parse(body) {
    for (const token of body) {
      if (token.ast_type == 'ClassDef') {
        classes.push(parseClass(token))
      } else if (token.ast_type == 'FunctionDef') {
        fns.push(parseFn(token))
      } else if (token.body) {
        parse(token.body)
      }
      if (token.orelse) {
        parse(token.orelse)
      }
      if (token.ast_type == 'ImportFrom') {
        imports.push({ type: 'import', mod: token.module, what: token.names, level: token.level })
      }
      if (token.ast_type === 'Assign') {
        vars.push({ value: token.value, targets: token.targets.map(k => k.id) })
      }
    }
  }
  parse(what.body)
  return [...imports, ...fns, ...classes, ...vars]
}

function parseClass(token) {
  const com = token.body[0].ast_type == 'Expr' ? token.body[0].value.value : ''
  const a = {
    type: 'class',
    name: token.name,
    extends: token.bases.map(t => t.id),
    name: token.name,
    comment: com,
    vars: [],
    methods: []
  }

  if (token.keywords.length) {
    a.extends.push('any')
  }

  for (const body of token.body) {
    if (body.ast_type === 'Assign') {
      for (const target of body.targets) {
        a.vars.push(target.id)
      }
    }
    if (body.ast_type === 'FunctionDef') {
      a.methods.push(parseFn(body))
    }
  }
  return a
}

function parseFn(body) {
  const fn = { type: 'fn', name: body.name, args: [] }
  fn.doc = body.body[0].ast_type == 'Expr' ? body.body[0].value.value : ''
  for (const arg of body.args.posonlyargs) {
    fn.args.push({ name: arg.arg, pos: true })
  }
  for (const arg of body.args.args) {
    fn.args.push({ name: arg.arg })
  }
  if (body.kwarg) {
    fn.args.push({ name: body.kwarg.arg, type: 'Record<string, any>' })
  }
  // ?? why is the args AST so odd? The args + optionals are unaligned
  if (body.args.defaults?.length) {
    const nargs = []
    for (const def of body.args.defaults.reverse()) {
      const ar = fn.args.pop()
      if (!ar) {
        console.log(body.args)
      }
      ar.def = def.value ?? def.id ?? 'something'
      nargs.push(ar)
    }

    fn.args.push(...nargs.reverse())
  }

  return fn
}

module.exports = read