#!/usr/bin/env node
require('dotenv').config();
const { pull } = require('./scripts/pull');
const parseArgs = require('minimist');

const allowedArgs = ['--dir-path'];

let argv = parseArgs(process.argv.slice(2), {
    string: ['--dir-path'],
    unknown: (arg) => {
        return allowedArgs.includes(arg);
    },
});

if (argv['dir-path']) {
    pull(argv).then(response => {}).catch(err => {console.error(err);});
} else {
    console.error('Missing: --dir-path');
}


