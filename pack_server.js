const bodyParser = require('body-parser');
const childProcess = require('child_process');
const express = require('express');
const fs = require('fs-extra');
const JSZip = require('jszip');
const path = require('path');
const util = require('util');

class StopWatch {
    start() {
        this.begin = new Date().getTime();
    }

    stop() {
        const end = new Date().getTime();
        return end - this.begin;
    }
}

/** https://gist.github.com/kethinov/6658166 */
const walkSync = (dir, filelist = []) => {
    fs.readdirSync(dir).forEach(file => {
        filelist = fs.statSync(path.join(dir, file)).isDirectory() ?
            walkSync(path.join(dir, file), filelist) :
            filelist.concat(path.join(dir, file));
    });
    return filelist;
}

async function handleRequest(request, response) {
    const watch = new StopWatch();
    const time = new Date().getTime();
    const tempDir = path.join(__dirname, `temp_${time.toString()}`);
    const inputDir = path.join(tempDir, 'input');
    const outputDir = path.join(tempDir, 'output');
    await util.promisify(fs.mkdir)(tempDir);

    const body = request.body;
    const requestId = body.sheet;
    console.log(`${requestId}: receiving request`);

    const params = [];
    params.push('texturepacker');
    params.push(...body.params);
    params.push(...['--sheet', path.join(outputDir, body.sheet)]);
    params.push(...['--data', path.join(outputDir, body.data)]);

    try {
        // Start packing.
        await util.promisify(fs.mkdir)(inputDir);
        await Promise.all(body.files.map(async item => {
            const filePath = path.join(inputDir, item.name);
            params.push(filePath);
            await util.promisify(fs.writeFile)(filePath, item.data, {
                encoding: 'base64',
                flag: 'w'
            });
        }));
        console.log(`${requestId}: start packing`);
        watch.start();
        await util.promisify(childProcess.exec)(params.join(' '));
        console.log(`${requestId}: end packing elapsed ${watch.stop()}`);

        // Compress and send response.
        console.log(`${requestId}: start compressing`);
        watch.start();
        const zip = new JSZip();
        const files = walkSync(outputDir);
        await Promise.all(files.map(async file => {
            const relativePath = path.relative(outputDir, file);
            const content = await util.promisify(fs.readFile)(file, {
                encoding: 'base64'
            });
            zip.file(relativePath, content, {
                base64: true,
                createFolders: false,
            });
        }));
        const content = await zip.generateAsync({
            compression: 'DEFLATE',
            compressionOptions: {
                level: 9
            },
            type: 'base64'
        });
        console.log(`${requestId}: end compressing elapsed ${watch.stop()}`);
        console.log(`${requestId}: reply`);
        response.send(content);
    } finally {
        await util.promisify(fs.remove)(tempDir);
    }
}

const app = express();
app.use(bodyParser.json({
    limit: 1024 * 1024 * 50 // 50MB.
}));

app.post('/', async (request, response) => {
    await handleRequest(request, response);
});

const server = app.listen(3456, function () {
    const host = server.address().address;
    const port = server.address().port;
    console.log(`TexturePacker server listening at http://${host}:${port}`);
});