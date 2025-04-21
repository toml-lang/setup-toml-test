const fs       = require('fs')
const promises = require('stream/promises')
const stream   = require('stream');
const zlib     = require("zlib")
const core     = require('@actions/core')
const exec     = require('@actions/exec')

async function main() {
	let version = core.getInput('version') || arguments[0],
	    bin     = core.getInput('bin') || arguments[1],
	    os      = process.platform,
	    arch    = process.arch
	if (!version)
		return core.setFailed('version is empty')
	if (!bin)
		return core.setFailed('bin is empty')
	if (os === 'win32')
		os = 'windows'
	if (arch === 'x64')
		arch = 'amd64'
	if (os === 'windows')
		bin += '.exe'
	if (!bin.startsWith('/') && !bin.startsWith('./'))
		bin = './' + bin

	if (version === 'main') {
		try {
			await exec.exec('go', ['version'])
		} catch (err) {
			return core.setFailed(`Setting the version to 'main' requires Go; 'go version' errored with: ${err}`)
		}
		await exec.exec('go', ['install', 'github.com/toml-lang/toml-test/cmd/toml-test@main'])

		let gobin = ''
		await exec.exec('go', ['env', 'GOBIN'], {
			listeners: {
				stdout: (data) => gobin += data.toString().trim()
			},
		})
		if (gobin === '') {
			let gopath = ''
			await exec.exec('go', ['env', 'GOPATH'], {
				listeners: {
					stdout: (data) => gopath += data.toString().trim()
				},
			})
			gobin = `${gopath}/bin`
		}
		// Copy rather than rename, as GitHub Actions on Windows has GOPATH on
		// C: and the code checkout on D:
		fs.copyFileSync(`${gobin}/toml-test${os === 'windows' ? '.exe' : ''}`, bin)
	} else {
		if (version === 'latest') {
			// Use the redirect header to get the latest version. If we use the API
			// it will get rate-limited/blocked quite quickly unless we provide an
			// API token, and I don't want to bother people with that.
			let r = await fetch('https://github.com/toml-lang/toml-test/releases/latest', {redirect: 'manual'})
			if (r.status !== 302)
				return core.setFailed(`unexpected status finding latest toml-test: ${r.status}`)
			let loc = r.headers.get('location')
			if (!loc)
				return core.setFailed('no Location header finding latest toml-test')
			version = loc.split('/').pop()
		}
		if (version[0] !== 'v')
			version = 'v' + version

		// TODO: I see now there's a bunch of helpers for this kind of thing:
		// https://github.com/actions/toolkit/tree/main/packages/tool-cache
		let dl  = `toml-test-${version}-${os}-${arch}${os === 'windows' ? '.exe' : ''}`,
			url = `https://github.com/toml-lang/toml-test/releases/download/${version}/${dl}.gz`
		console.log(`Fetching ${url}`)
		let fp = fs.createWriteStream(bin, {flags: 'w'}),
			gz = zlib.createGunzip(),
			r  = await fetch(url)
		await promises.finished(stream.Readable.fromWeb(r.body).pipe(gz).pipe(fp))
	}

	fs.chmodSync(bin, 0o755)
	console.log(`Done; toml-test is available at: ${bin}`)
	await exec.exec(bin, ['version'])
}

try {
	// Allow running from CLI with "node index.js latest toml-test".
	let args = process.argv
	args.shift()
	if (args.length > 0 && args[0].endsWith('index.js'))
		args.shift()
	if (args.length > 0 && args.length != 2) {
		console.error('usage: node index.js [with.version] [with.bin]')
		process.exit(1)
	}
	main.apply(this, args)
} catch (error) {
	core.setFailed(error.message)
}
