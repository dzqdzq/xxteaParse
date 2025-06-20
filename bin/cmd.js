#!/usr/bin/env node

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { parse, filterFiles } from '../xxteaParse.js';
import path from 'path';
import fs from 'fs';

const argv = yargs(hideBin(process.argv))
    .option('input', {
        type: 'string',
        description: '你要加密的文件夹',
        required: true
    })
    .option('xxtea_key', {
        type: 'string',
        description: 'XXTEA密钥用于解密',
        required: true
    })
    .option('parse_ext', {
        type: 'string',
        description: '要解密的扩展名, 如"jsc,tsc,png"',
        required: true
    })
    .option('replace_ext', {
        type: 'string',
        description: '要重命名的扩展名, 如"js,js,png"',
        required: true
    })
    .option('output', {
        alias: 'o',
        type: 'string',
        description: '指定解密文件的输出路径, 如果不指定，则默认解密文件在源文件同目录下',
        required: false
    })
    .option('delete', {
        alias: 'd',
        type: 'boolean',
        default: true,
        description: '是否删除加密文件,true表示删除。只有--output没有指定时生效',
        required: false
    })
    .help()
    .alias('help', 'h')
    .argv;

function processExt(filters){
    return filters.map(item => item.trim()).map(item=>{
        if(item.startsWith('.')){
            return item;
        }
        return `.${item}`;
    });
}

async function main() {
    try {
        let isDel = false;
        if(!argv.output){
            argv.output = argv.input;
            isDel = argv.delete;
        }
        let filters = processExt(argv.parse_ext.split(','));
        let replaceExts = processExt(argv.replace_ext.split(','));
        if(filters.length !== replaceExts.length){
            throw new Error('parse_ext和replace_ext的数量必须相同');
        }

        let replaceMap = {};
        for(let i = 0; i < filters.length; i++){
            replaceMap[filters[i]] = replaceExts[i];
        }
        console.log(replaceMap)
        const files = await filterFiles(argv.input, filters);
        files.forEach(file => {
            const ext = path.extname(file);
            const relativePath = path.relative(argv.input, file);
            const out_file = path.join(argv.output, relativePath.replace(ext, '')+replaceMap[ext]);
            parse(file, out_file, argv.xxtea_key);
            if(out_file!==file && isDel){
                fs.unlinkSync(file);
            }
        });

        console.log(`Successfully parsed ${files.length} files.`);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

main();