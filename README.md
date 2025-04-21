Install [toml-test] in GitHub actions.

This only installs the toml-test binary; you still need to run toml-test to
actually test stuff.

It does actually run toml-test in the "post" action for the main branch to
update [toml-test-matrix]. The result is stored as an "artifact" and the results
should be automatically updated. This should never cause a test failure.

Example usage:

    steps:
    - uses: 'actions/checkout@v4'
    - uses: 'toml-lang/setup-toml-test@v1'
    - run: './toml-test my-decoder'

Options, with their default values:

    - uses: 'toml-lang/setup-toml-test@v1'
      with:
        # Select toml-test version; one of:
        #
        # - specific tag name (e.g. "v1.6.0");
        # - "latest" for the latest tagged version, or
        # - "main" for the latest main branch. It will need to compile from
        #   source, which requires Go to be installed (e.g. add
        #   uses: 'actions/setup-go')
        version: 'latest'

        # Location to store the binary.
        bin: './toml-test'

        # Name of the "main" or "master" branch, for submitting to
        # toml-test-matrix.
        mainBranch: 'main'

        # Path to your decoder and encoder. Leave the encoder empty if writing
        # TOML files isn't supported.
        decoder: ''
        encoder: ''

[toml-test]: https://github.com/toml-lang/toml-test
[toml-test-matrix]: https://github.com/toml-lang/toml-test-matrix

Running toml-test
-----------------
In the simplest case, just `-run: 'toml-test my-decoder'` is enough.

However, many implementations don't pass all the tests, because there are "known
bugs" or by choice (especially for "invalid" tests as some are a tad pedantic).
You can use `-skip` to skip these tests. You can use `toml-test -script` to
generate a shell script which skips all currently failing tests. Abridged, it
looks something like:

    % toml-test -script my-decoder
    #!/usr/bin/env bash

    failing=(
        -skip invalid/array/extending-table
    )

    toml-test ${failing[@]} -skip-must-error "$@" -- my-decoder

The `-skip-must-error` flag causes toml-test to fail if a skipped test *doesn't*
cause an error.

The rationale for doing it like this is that people can easily run this on their
local machines, which wouldn't be so easy if all of this was in the GitHub
actions YAML.

Submitting to toml-test-matrix
------------------------------
