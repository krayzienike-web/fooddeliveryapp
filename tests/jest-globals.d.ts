// Makes Jest globals (describe/it/expect/jest) visible to the root `tsc --noEmit` for tests/unit and tests/contract.
// Playwright specs import `test`/`expect` explicitly from tests/e2e/support/fixtures, which shadows these globals.
/// <reference types="jest" />
/// <reference types="node" />
