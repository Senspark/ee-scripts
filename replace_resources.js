const ArgumentParser = require('argparse').ArgumentParser;
const fs = require('fs-extra');
const glob = require('glob');
const path = require('path');

/** Synchronously processes the command. */
function process(meta, input, output) {
    const files = glob.sync(path.join(meta, `*.png`));
    files.forEach(filePath => {
        const filename = path.basename(filePath, path.extname(filePath));
        const metaFilePath = `${filePath}.meta`;
        const metaContent = JSON.parse(fs.readFileSync(metaFilePath, `utf8`));
        const uuid = metaContent.uuid;
        const assetDirName = uuid.slice(0, 2);
        const assetPath = path.join(output, assetDirName, `${uuid}.png`);
        const pvrFile = `${filename}.pvr.ccz`;
        const pvrPath = path.join(input, pvrFile);
        fs.copyFileSync(pvrPath, assetPath);
    });
}

/** Parses arguments from command line. */
function parseArguments() {
    const parser = new ArgumentParser();
    parser.addArgument(['-m', '--meta'], {
        help: 'Path to .meta',
        nargs: 1,
        required: true,
    });
    parser.addArgument(['-i', '--input'], {
        help: 'Path to the input directory, i.e. where packed resources are',
        nargs: 1,
        required: true,
    });
    parser.addArgument(['-o', '--output'], {
        help: 'Path to the output directory',
        nargs: 1,
        required: true,
    });
    const args = parser.parseArgs();
    console.dir(args);
    return {
        meta: args.meta[0],
        input: args.input[0],
        output: args.output[0],
    };
}

const {
    meta,
    input,
    output
} = parseArguments();
process(meta, input, output);