/** Pack version 3 */

const ArgumentParser = require('argparse').ArgumentParser;
const childProcess = require('child_process');
const fetch = require('node-fetch');
const fs = require('fs-extra');
const glob = require('glob');
const JSZip = require('jszip');
const md5 = require('md5');
const pako = require('pako');
const path = require('path');
const util = require('util');

class Cache {
    _getCachePath() {
        return path.join(__dirname, `.pack_cache.json`);
    }

    async _readValue(key) {
        const path = this._getCachePath();
        try {
            const content = await fs.readJson(path);
            return content[key];
        } catch {
            // File not exist or not JSON.
            return undefined;
        }
    }

    async _setValue(key, value) {
        const path = this._getCachePath();
        try {
            const content = await fs.readJson(path);
            content[key] = value;
            await fs.writeJSON(path, content);
        } catch {
            // File not exist or not JSON.
            await fs.writeJSON(path, {
                [key]: value
            });
        }
    }

    /** Checks whether it is necessary to process specified command. */
    async check(data, outputDir) {
        const dataHash = md5(JSON.stringify(data));
        const files = await this._readValue(dataHash);
        if (!files) {
            return true;
        }
        for (let i = 0, n = files.length; i < n; ++i) {
            const fileName = files[i].name;
            const fileHash = files[i].hash;
            const filePath = path.join(outputDir, fileName);
            const content = await util.promisify(fs.readFile)(filePath, {
                encoding: 'base64'
            });
            const currentFileHash = md5(content);
            if (fileHash !== currentFileHash) {
                return true;
            }
            return false;
        }
    }

    /** Stores the specified command and its result to the cache. */
    async store(data, outputDir, files) {
        const dataHash = md5(JSON.stringify(data));
        const items = [];
        for (let i = 0, n = files.length; i < n; ++i) {
            const fileName = files[i];
            const filePath = path.join(outputDir, fileName);
            const content = await util.promisify(fs.readFile)(filePath, {
                encoding: 'base64'
            });
            const fileHash = md5(content);
            items.push({
                name: fileName,
                hash: fileHash
            });
        }
        await this._setValue(dataHash, items);
    }
}

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

/** Packs using remote TexturePacker. */
class RemoteProcessor extends CommandProcessor {
    constructor(address) {
        super();
        this.address = address;
        this.cache = new Cache();
    }

    async process(command, outputDir) {
        const data = {};
        data.params = command.params;
        data.sheet = command.sheet;
        data.data = command.data;

        const requestId = data.sheet;
        console.log(`${requestId}: start packing`);

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

        // Ensure the same order between packings.
        data.files.sort((lhs, rhs) => {
            return lhs.name.localeCompare(rhs.name);
        });

        if (!await this.cache.check(data, outputDir)) {
            console.log(`${requestId}: already updated.`);
            return;
        }

        // Send request.
        const stringified = JSON.stringify(data);
        // Use pako with body-parser: https://github.com/expressjs/body-parser/issues/138
        const compressed = pako.gzip(stringified, {
            level: 9,
            memLevel: 9,
            windowBits: 15,
        });
        console.log(`${requestId}: request data size = ${stringified.length} compressed to ${compressed.length}`);
        const response = await fetch(this.address, {
            body: compressed,
            headers: {
                'Content-Encoding': 'gzip',
                'Content-Type': 'application/json',
            },
            method: 'POST',
        }).then(res => res.text());
        console.log(`${requestId}: response data size = ${response.length}`);

        await util.promisify(fs.ensureDir)(outputDir);
        const archive = await JSZip.loadAsync(response, {
            base64: true,
        });
        const files = Object.keys(archive.files);
        await Promise.all(files.map(async fileName => {
            const filePath = path.join(outputDir, fileName);
            await util.promisify(fs.ensureDir)(path.dirname(filePath));
            const file = archive.files[fileName];
            const content = await file.async('base64');
            await util.promisify(fs.writeFile)(filePath, content, {
                encoding: 'base64'
            });
        }));
        await this.cache.store(data, outputDir, files);
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