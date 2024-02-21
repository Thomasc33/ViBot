import * as fs from 'fs';
const args = process.argv.slice(2).reduce((acc, a) => { acc[a] = true; return acc }, {} as {[arg: string]: true});

if (args.clean) {
    fs.readdirSync('build/').forEach(f => fs.rmSync(f, { recursive: true }));
    console.log('Cleaned build folder');
}

if (args.copy) {
    fs.cp('src/', 'build/', { 
        recursive: true,
        filter: source => !source.endsWith('.ts')
    }, (err) => {});
    console.log('Copied files to build folder');
}