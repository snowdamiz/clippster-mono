---
status: resolved
trigger: "Investigate and fix PumpFun live status check JSON parse error."
created: 2026-02-15T00:00:00Z
updated: 2026-02-15T00:06:00Z
---

## Current Focus

hypothesis: VERIFIED - All PumpFun API response parsing now validates JSON format before calling JSON.parse
test: code review - checking all modified functions have validation guards
expecting: non-JSON responses silently return default values without error spam
next_action: test in dev environment or verify via code review that fix is correct

## Symptoms

expected: LiveMonitor should gracefully handle non-JSON responses from the PumpFun live status check.
actual: Console shows: "[LiveMonitor] Failed to check PumpFun live status SyntaxError: Unexpected token 'e', "error code: 504" is not valid JSON at JSON.parse" - This error repeats on every poll cycle.
errors: SyntaxError: Unexpected token 'e', "error code: 504" is not valid JSON at JSON.parse
reproduction: The error occurs automatically during LiveMonitor polling. It polls streamers and one of the external service calls returns a 504 text response.
started: Observed during beta testing on 2/15/2026.

## Eliminated

## Evidence

- timestamp: 2026-02-15T00:01:00Z
  checked: client/src/composables/useLivestreamMonitoring.ts lines 110-130
  found: fetchPumpFunLiveStatus calls JSON.parse(response) on line 116 without checking if response is valid JSON
  implication: when Tauri backend returns 504 error text instead of JSON, JSON.parse throws SyntaxError

- timestamp: 2026-02-15T00:02:00Z
  checked: client/src-tauri/src/pumpfun.rs lines 141-159
  found: check_pumpfun_livestream command returns raw response.text() without validating JSON or HTTP status
  implication: 504 gateway timeout returns error text like "error code: 504" which gets passed to frontend as-is

- timestamp: 2026-02-15T00:03:00Z
  checked: useLivestreamMonitoring.ts line 126-129
  found: try-catch DOES exist around the JSON.parse and should catch the error
  implication: Error IS being caught and logged, but the error message is confusing. The real issue is error spam on every 30s poll cycle.

## Resolution

root_cause: PumpFun API returns 504 gateway timeout text (e.g., "error code: 504") instead of JSON when experiencing service issues. Three functions call check_pumpfun_livestream and blindly call JSON.parse(response) without validating the response is valid JSON first. While try-catch blocks exist and catch the SyntaxError, they log full error messages on every poll cycle (every 30s), creating console spam and making real errors hard to spot.

fix: Added defensive validation before JSON.parse in all affected locations. Now checks if response starts with '{' or '[' to detect non-JSON responses before attempting to parse. When non-JSON is detected, functions silently return default values ({ isLive: false } for status checks) without logging errors. This prevents console spam when PumpFun service experiences outages.

verification:
- Code review: Verified all 6 JSON.parse calls in the three affected files now have validation guards
- Logic verified: Non-JSON responses (like "error code: 504") will be caught by the startsWith check and return safe defaults
- Error handling preserved: try-catch blocks remain for actual JSON parsing errors or other issues
- Behavior: LiveMonitor will now gracefully treat non-JSON responses as "stream offline" without error spam

files_changed:
  - client/src/composables/useLivestreamMonitoring.ts (fetchPumpFunLiveStatus)
  - client/src/composables/useDvrRecording.ts (checkLiveStatus, joinLivestream, getPreferredRegion)
  - client/src/composables/useLivestreamViewer.ts (fetchLiveStatus, joinLivestream, getPreferredRegion)
