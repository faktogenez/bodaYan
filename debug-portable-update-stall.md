# Debug Session: portable-update-stall
- **Status**: [OPEN]
- **Issue**: Portable EXE 1.0.12 did not replace itself with published 1.0.13 within five minutes.
- **Environment**: Windows 11 x64; Electron portable; source EXE SHA1 matched v1.0.12; remote Latest manifest reports v1.0.13 with matching local build SHA1/size.
- **Debug Server**: `http://127.0.0.1:7777/event`
- **Log File**: `.dbg/trae-debug-log-portable-update-stall.ndjson`

## Reproduction Steps
1. Launch the isolated `%TEMP%\AppleLauncher-update-test\AppleLauncher.exe` copy of the exact v1.0.12 release.
2. Observe self-update checking, download, validation, apply script and EXE replacement.
3. Compare the replaced file's version, SHA1 and size with the v1.0.13 release manifest.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Expected Signal |
|----|------------|------------|--------|-----------------|
| A | The portable app does not reach the `did-finish-load` self-update handler. | Medium | Low | **Rejected** — it created and launched the apply batch. |
| B | The 1.0.12 process cannot read the latest manifest or treats 1.0.13 as current. | Medium | Low | **Rejected** — observed remote 1.0.13 against current 1.0.12. |
| C | The update download or integrity check fails. | Medium | Medium | **Rejected** — source is 113310115 bytes with the manifest SHA1. |
| D | The apply batch receives the wrong target path or cannot replace/restart the portable EXE. | High | Medium | **Confirmed** — batch is live, old PID is gone, source remains and target is still 1.0.12 after five minutes. Exact `move` error still under investigation. |
| E | The old portable process exits/fails before the update routine can complete. | Low | Medium | **Rejected** — download and apply startup completed before the original process exited. |

## Log Evidence
- Initial run: source EXE was v1.0.12, size 111705014, SHA1 `b56eaa52b40fb6607a0f2994a822fbc2f8f04c78`.
- Initial run: after five minutes the test target still reported v1.0.12.
- Remote Latest manifest and v1.0.13 release asset match: size 113310115, SHA1 `4e6c930112f2ce12fd9e5e0c214e9cc56e4853ea`.
- `.dbg/trae-debug-log-portable-update-stall.ndjson`, events 1–5: apply launched; remote version differs; downloaded EXE matches; target still old; old PID is gone.
- Generated `%TEMP%\apply-launcher-update.bat`: `TARGET` is the intended test EXE path and `SOURCE` is the verified 1.0.13 file.
- `cmd.exe` hosting the BAT remains alive; `tasklist` confirms original PID 25924 no longer exists.
- Source/target are writable, non-read-only files under the same user; ACL grants the current user Full Control. The BAT suppresses `move` errors and retries forever, so its specific failure reason is not logged yet.

## Verification Conclusion
Confirmed root area: replacement stage in `applyUpdateAndRestart`, after successful version check/download/integrity verification. The exact failure reason and minimal code fix remain pending. No self-update logic fix has been applied during this debug session.
