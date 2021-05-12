#!/usr/bin/env node
require('dotenv').config();
const { pull } = require('./scripts/pull');
const { push } = require('./scripts/push');
const parseArgs = require('minimist');

const allowedArgs = ['--replace-modified', '--cleanup-tokens', '--cleanup-set', '--dir-path'];

let argv = parseArgs(process.argv.slice(2), {
    string: ['--dir-path'],
    boolean: ['replace-modified', 'cleanup-tokens', 'cleanup-set'],
    unknown: (arg) => {
        return allowedArgs.includes(arg);
    },
});

if (argv['dir-path']) {
    push(argv).then(response => {}).catch(err => {console.error(err);});
} else {
    console.error('Missing: --dir-path');
}
