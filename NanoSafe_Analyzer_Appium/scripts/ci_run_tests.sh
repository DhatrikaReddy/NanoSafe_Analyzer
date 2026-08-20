#!/bin/bash
# ci_run_tests.sh
# Android Appium E2E Runner script for CI environments.

echo "============================================================"
echo "Starting Android Appium E2E Test Suite (450 Tests)..."
echo "============================================================"

# Run 450 Appium E2E assertions and generate Excel + HTML reports
node scripts/run_appium_tests.js
TEST_EXIT_CODE=$?

echo "Appium E2E run completed with exit code: $TEST_EXIT_CODE"
exit $TEST_EXIT_CODE
