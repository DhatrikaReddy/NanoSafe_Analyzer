#!/bin/bash
# ci_run_tests.sh
# Android Appium E2E Runner script for CI environments.

echo "Starting Android Appium E2E Test Suite..."

# 1. Start Appium Server in the background
appium --port 4723 &
APPIUM_PID=$!

echo "Waiting for Appium server to start..."
sleep 10

# 2. Check if Appium started successfully
if ps -p $APPIUM_PID > /dev/null
then
   echo "Appium server started successfully on PID $APPIUM_PID"
else
   echo "CRITICAL: Failed to start Appium server!"
   exit 1
fi

# 3. Detect connected Android devices or emulators
echo "Checking for connected Android emulators/devices..."
adb devices

# 4. Run Mobile WebdriverIO E2E tests
npm install
npm test
TEST_EXIT_CODE=$?

# 5. Generate Excel and HTML Reports
node utils/xlsxReporter.js
node utils/generateHtmlReport.js

# 6. Tear down Appium server
echo "Stopping Appium server on PID $APPIUM_PID..."
kill -9 $APPIUM_PID

echo "E2E run completed with exit code: $TEST_EXIT_CODE"
exit $TEST_EXIT_CODE
