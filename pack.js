/** Pack version 3 */

const childProcess = require('child_process');
const fetch = require('node-fetch');
const fs = require('fs-extra');
const glob = require('glob');
const path = require('path');
const ArgumentParser = require('argparse').ArgumentParser;
const zip = require('jszip');
const util = require('util');

class CommandProcessor {
    /** Asynchronously process the specified options. */
    async process(command) {
        throw new Error('Abstract method.');
    }
}

/** Packs using local TexturePacker. */
class LocalProcessor extends CommandProcessor {
    async process(command, outputDir) {
        const params = [];
        params.push('texturepacker');
        params.push(...command.params);
        params.push(...['--sheet', path.join(outputDir, command.sheet)]);
        params.push(...['--data', path.join(outputDir, command.data)]);
        params.push(...command.files);
        await util.promisify(childProcess.exec)(params.join(' '));
    }
}

class RemoteProcessor extends CommandProcessor {
    constructor(address) {
        super();
        this.address = address;
    }

    async process(command, outputDir) {
        const data = {};
        data.params = command.params;
        data.sheet = command.sheet;
        data.data = command.data;

        // Basename and Base64-encoded data of files.
        await Promise.all(command.files.map(async item => {
            data.files = data.files || [];
            const content = await util.promisify(fs.readFile)(item, {
                encoding: 'base64'
            });
            data.files.push({
                name: path.basename(item),
                data: content,
            });
        }));

        // Send request.
        const stringified = JSON.stringify(data);
        console.log(stringified.length);
        const response = await fetch(this.address, {
            body: stringified,
            headers: {
                'Content-Type': 'application/json;charset=UTF-8'
            },
            method: 'POST',
        }).then(res => res.text());

        await util.promisify(fs.ensureDir)(outputDir);
        const archive = await zip.loadAsync(response, {
            base64: true,
        });
        await Promise.all(Object.keys(archive.files).map(async fileName => {
            const filePath = path.join(outputDir, fileName);
            await util.promisify(fs.ensureDir)(path.dirname(filePath));
            const file = archive.files[fileName];
            const content = await file.async('base64');
            await util.promisify(fs.writeFile)(filePath, content, {
                encoding: 'base64'
            });
        }));
    }
}

/**
 * DFS the config tree structure.
 * @param node The current node.
 * @param parentOptions The options of the parent of the current node.
 */
function dfsNode(node, parentOptions = {}) {
    // All options of this sub-tree.
    const totalOptions = [];

    // Clone parent's options.
    const options = JSON.parse(JSON.stringify(parentOptions));

    // Apply current node's settings.
    Object.keys(node.options).forEach(key => {
        if (key === 'params') {
            // Append.
            options[key] = options[key] || [];
            options[key].push(...node.options[key]);
        } else {
            // Overwrite.
            options[key] = node.options[key];
        }
    });
    totalOptions.push(options);

    // DFS children.
    if (node.children) {
        node.children.forEach(child => {
            const childOptions = dfsNode(child, options);
            totalOptions.push(...childOptions);
        })
    }

    return totalOptions;
}

/**
 * Parses the specified options and returns an array of commands.
 * @param options The desired options.
 * @param outputDir The desired output directory.
 */
function parseOptions(options, inputDir) {
    const inputFilePatterns = options.input_files;
    const outputPath = options.output_path;
    if (!inputFilePatterns || !outputPath) {
        // No input or output specified.
        return [];
    }

    const params = options.params || [];
    if (options.rotation) {
        params.push('--enable-rotation');
    } else {
        params.push('--disable-rotation');
    }
    if (options.auto_alias) {
        params.push('--disable-auto-alias');
    }
    if (options.force_identical_layout) {
        params.push('--force-identical-layout');
    }
    const sheetExtension = options.sheet_extension || 'pvr.ccz';
    const dataExtension = options.data_extension || 'plist';

    const inputFiles = [];
    inputFilePatterns.forEach(patternComponents => {
        const pattern = path.join(inputDir, ...patternComponents);
        const files = glob.sync(pattern);
        inputFiles.push(...files);
    });
    return [{
        params: params,
        files: inputFiles,
        sheet: `${path.join(...outputPath)}.${sheetExtension}`,
        data: `${path.join(...outputPath)}.${dataExtension}`,
    }];
}

/** Asynchronously process the command. */
async function process(processor, configPath, outputDir) {
    const inputDir = path.dirname(configPath);
    const root = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // Find all options.
    const totalOptions = dfsNode(root);

    // Parse options.
    const commands = totalOptions.reduce((array, options) => {
        array.push(...parseOptions(options, inputDir));
        return array;
    }, []);

    await Promise.all(commands.map(async command => {
        await processor.process(command, outputDir);
    }));
}

/** Parses arguments from command line. */
function parseArguments() {
    const parser = new ArgumentParser();
    parser.addArgument(['-t', '--type'], {
        choices: ['remote', 'local'],
        required: true,
    });
    parser.addArgument(['-a', '--address'], {
        required: false,
    });
    parser.addArgument(['-i', '--input'], {
        help: 'Path to the settings JSON file',
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
        type: args.type,
        address: args.address,
        input: args.input[0],
        output: args.output[0],
    };
}

const {
    type,
    address,
    input,
    output
} = parseArguments();

if (type === 'remote') {
    process(new RemoteProcessor(address), input, output);
} else {
    process(new LocalProcessor(), input, output);
}