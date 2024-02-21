import * as fs from 'fs';

const copyFiles = async () => {
    fs.cp('src/', 'build/', { 
        recursive: true,
        filter: source => !source.endsWith('.ts')
    }, (err) => {});
}

copyFiles();