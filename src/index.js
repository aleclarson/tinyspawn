'use strict'

const { spawn } = require('child_process')
const { EOL } = require('os')

const eos = (stream, listener, buffer = []) =>
  stream[listener].on('data', data => buffer.push(data)) && buffer

const clean = str => str.trim().replace(/\n$/, '')

const parse = (stream, { json } = {}) => (encoding, start, end) => {
  const data = clean(stream.toString(encoding, start, end))
  return json ? JSON.parse(data) : data
}

const extend = defaults => (input, options) => {
  const [cmd, ...args] = input.split(' ').filter(Boolean)

  return new Promise((resolve, reject) => {
    const opts = { ...defaults, ...options }
    const childProcess = spawn(cmd, args, opts)
    const stdout = eos(childProcess, 'stdout')
    const stderr = eos(childProcess, 'stderr')

    childProcess
      .on('error', reject)
      .on('exit', code => {
        Object.defineProperty(childProcess, 'stdout', { get: parse(stdout, opts) })
        Object.defineProperty(childProcess, 'stderr', { get: parse(stderr) })
        if (code === 0) return resolve(childProcess)
        let command = `The command spawned as:${EOL}${EOL}`
        command += `  ${cmd} ${args.join(' ')}${EOL}${EOL}`
        command += `failed with code ${code}:${EOL}${EOL}`
        command += String(stderr).split(EOL).map(line => `  ${line}`).join(EOL)
        const error = new Error(command)
        error.name = 'ChildProcessError'
        Object.keys(childProcess).forEach(key => { error[key] = childProcess[key] })
        reject(error)
      })
  })
}

const $ = extend()
$.extend = extend
$.json = $.extend({ json: true })

module.exports = $