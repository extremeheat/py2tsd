# py2tsd

Python to TypeScript definition generator. Intended for use with JsPyBridge.

Uses the Python [astexporter lib written by fpoli](https://github.com/fpoli/python-astexport) to run Python AST to JSON.

## Install

```sh
npm install -g py2tsd
or
npx py2tsd
```

## Usage

```sh
py2tsd v0.0.1
        Each time you run this CLI tool, we'll append to the last exported TSD. To avoid this, you can use the --clear flag.
usage: py2tsd 
        <[--input | -i] python directory OR installed package name>
        <[--ts-out | -t] output tsd location> 
        [[--exclude | -x] optional regex to use to skip python files]
        [[--match | -m] require match of regex string]
        [--clear | -c] -- clear the workspace cache
```

```sh
npx py2tsd -i ./myPythonDir/ -o types.d.ts
npx py2tsd -i tensorflow -o tf.d.ts
npx py2tsd -i torch -o tf.d.ts -c
```