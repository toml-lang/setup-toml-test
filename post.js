const fs       = require('fs')
const core     = require('@actions/core')
const exec     = require('@actions/exec')

// TODO: this adds lots of dependencies and ~200M in node_modules. See if we can
// reduce that, because this is slightly mental just to upload a file. The only
// reason we use ncc now is so we avoid having to add tons of node_modules in
// git.
const artifact = require('@actions/artifact')

async function main() {
	let mainBranch = core.getInput('mainBranch') || 'main',
	    bin        = core.getInput('bin') || arguments[0],
	    os         = process.platform,
	    arch       = process.arch
	    decoder    = core.getInput('decoder') || arguments[1],
	    encoder    = core.getInput('encoder') || arguments[2]
	if (!bin)
		return core.setFailed('bin is empty')
	if (!decoder)
		return core.setFailed('decoder is empty')
	if (os === 'win32')
		os = 'windows'
	if (arch === 'x64')
		arch = 'amd64'
	if (os === 'windows')
		bin += '.exe'
	if (!bin.startsWith('/') && !bin.startsWith('./'))
		bin = './' + bin
	if (encoder && !encoder.startsWith('/'))
		encoder = './' + encoder
	if (decoder && !decoder.startsWith('/'))
		decoder = './' + decoder

	let flags = ['test', '-json', '-decoder', decoder],
	    f     = core.getInput('flags')
	if (encoder)
		flags = flags.concat(['-encoder', encoder])
	if (f)
		flags = f.split(/\s+/).concat(flags)

	let fp = fs.openSync('_toml-test_.json', 'w')
	await exec.exec(bin, flags, {
		silent: true,
		ignoreReturnCode: true,
		listeners: {
			stdout: (data) => fs.writeSync(fp, data),
			stderr: (data) => fs.writeSync(fp, data),
		},
	})
	fs.closeSync(fp)

	// Run everything except uploading the artifacts on any branch, so if there
	// are any problems they're caught before merging to main.
	//if (process.env.GITHUB_HEAD_REF !== mainBranch)
	//	return

	try {
		let h = (process.env.GITHUB_WORKFLOW_SHA || '').slice(0, 7),
		    a = new artifact.DefaultArtifactClient()
		await a.uploadArtifact(`toml-test_${h}_${os}_${arch}`, ['_toml-test_.json'], './')
	} catch (err) {
		// "Failed request: (409) Conflict: an artifact with this name already exists on the workflow run"
		//
		// Can happen if people test against e.g. multiple versions of
		// $language. Guess it would be better to also add that to the key, but
		// meh: not that important and okay to just skip.
		let f = err.message.indexOf("(409) Conflict") === -1 ? console.error : console.log
		f(err)
	}
}

try {
	// Allow running from CLI with "node post.js latest toml-test".
	let args = process.argv
	args.shift()
	if (args.length > 0 && (args[0].endsWith('post.js') || args[0].endsWith('index.js')))
		args.shift()
	if (args.length > 0 && args.length != 3) {
		console.error('usage: node post.js [with.bin] [with.decoder] [with.encoder]')
		process.exit(1)
	}
	main.apply(this, args)
} catch (error) {
	core.setFailed(error.message)
}
