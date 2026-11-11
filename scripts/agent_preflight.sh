#!/usr/bin/env bash
#
# The preflight.
#
# Run this at the start of every session, and before every commit, so
# that what the tree says and what PROGRESS.md says cannot drift
# apart for long.
#
# It prints where we are, what has changed, and then it runs the
# checks. If any of them fail, it exits non-zero, so a script that
# wraps this cannot mistake a broken tree for a working one.
#
# No new dependencies. Everything it calls is already in the project.

set -uo pipefail

# The worktree this script lives in. Everything below is relative to
# it, so the script works from any directory.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FAILED=0

note_failure() {
  echo "  -> FAILED: $1"
  FAILED=1
}

echo "=============================================================="
echo " PREFLIGHT"
echo "=============================================================="
echo "worktree : $ROOT"
echo

echo "--- branch ----------------------------------------------------"
git branch --show-current
echo

echo "--- git status --short ----------------------------------------"
git status --short
echo

echo "--- last 5 commits --------------------------------------------"
git log --oneline -5
echo

echo "--- frontend lint:guard ---------------------------------------"
cd "$ROOT/frontend"
if npm run lint:guard > /tmp/preflight_lint.log 2>&1; then
  tail -3 /tmp/preflight_lint.log
  echo "  -> lint OK"
else
  tail -20 /tmp/preflight_lint.log
  note_failure "frontend lint"
fi
cd "$ROOT"
echo

echo "--- frontend unit tests ---------------------------------------"
cd "$ROOT/frontend"
FAILED_FRONTEND=0
for test_file in \
  src/i18n/__tests__/terminology.test.js \
  src/i18n/__tests__/batchParity.test.js \
  src/i18n/__tests__/scriptMix.test.js \
  src/context/__tests__/guestLogin.test.js \
  src/utils/__tests__/idFormat.test.js \
  src/utils/__tests__/featureFlags.test.js \
  src/utils/__tests__/amountInput.test.js \
  src/utils/__tests__/amountExpression.test.js \
  src/utils/__tests__/amountField.test.js \
  src/utils/__tests__/countUp.test.js \
  src/utils/__tests__/transactionSign.test.js \
  src/components/layout/__tests__/navGrouping.test.js \
  src/components/layout/__tests__/navDisclosure.test.js \
  src/utils/__tests__/abTesting.test.js \
  src/utils/__tests__/budgetRecipes.test.js \
  src/utils/__tests__/scanDismissal.test.js \
  src/utils/__tests__/scanManager.test.js \
  src/utils/__tests__/healthMetrics.test.js \
  src/utils/__tests__/gmailState.test.js \
  src/data/__tests__/privacyManifest.test.js \
  src/features/transactions/nlp/__tests__/quickEntry.test.js \
  src/features/transactions/nlp/__tests__/fuzzy.test.js \
  src/features/transactions/nlp/__tests__/golden.test.js \
  src/utils/__tests__/marketFormat.test.js \
  src/pages/__tests__/marketPage.test.js \
  src/components/common/__tests__/honestEmptyState.test.js \
  src/components/common/__tests__/emptyStateKeys.test.js \
  src/styles/__tests__/interfaceFeel.test.js \
  src/styles/__tests__/shape.test.js \
  src/styles/__tests__/openPoints.test.js \
  src/components/merchant/__tests__/merchantCapture.test.js \
  src/utils/__tests__/receiptBill.test.js \
  src/utils/__tests__/recentCombos.test.js \
  src/utils/__tests__/financialProfile.test.js \
  src/components/ai/__tests__/topBarPosition.test.js \
  src/data/__tests__/indonesiaPaymentRegistry.test.js \
  src/features/transactions/nlp/__tests__/categorySeparation.test.js \
  src/components/__tests__/settingsExportStudio.test.js \
  src/pages/__tests__/householdPage.test.js \
  src/components/__tests__/motionInPlace.test.js \
  src/utils/__tests__/fintech.test.js \
  src/components/fintech/__tests__/trustBanners.test.js \
  src/components/fintech/__tests__/dashboardTrust.test.js \
  src/components/fintech/__tests__/debtPlanner.test.js \
  src/components/fintech/__tests__/decisionWidgets.test.js \
  src/utils/__tests__/decisionWidgets.test.js \
  src/components/transactions/__tests__/itemizedBillEditor.test.js \
  src/components/transactions/__tests__/billSave.test.js \
  src/pages/__tests__/transactionsLoadFailure.test.js \
  src/pages/__tests__/loginGateway.test.js \
  src/components/merchant/__tests__/captureLandsOnShelf.test.js \
  src/components/market/__tests__/advisorKeyPoints.test.js \
  src/pages/__tests__/merchantMapAddress.test.js \
  src/components/goals/__tests__/goalPriorityKanban.test.js \
  src/components/health/__tests__/wellnessBento.test.js \
  src/utils/__tests__/eisenhowerPriority.test.js \
  src/components/ui/__tests__/confirmDialog.test.js \
  src/components/split/__tests__/splitMath.test.js \
  src/components/split/__tests__/splitAssignmentMath.test.js \
  src/components/map/__tests__/mapPins.test.js \
  src/pages/__tests__/transactionsFiltersAndItems.test.js \
  src/pages/__tests__/pageLayoutRepairs.test.js \
  src/features/transactions/nlp/__tests__/subCategories.test.js \
  src/features/transactions/nlp/__tests__/subCategoryPills.test.js \
  src/utils/__tests__/inlineMarkdown.test.js \
  src/utils/__tests__/goalIcon.test.js \
  src/components/layout/__tests__/typedPlaceLookup.test.js \
  src/components/map/__tests__/mapPinSize.test.js \
  src/components/layout/__tests__/transactionLocation.test.js \
  src/services/__tests__/receiptItemsApi.test.js \
  src/components/market/__tests__/portfolioProjection.test.js \
  src/components/shopping/__tests__/productSearch.test.js \
  src/utils/__tests__/shoppingCatalog.test.js \
  src/components/split/__tests__/smartSplit.test.js \
  src/components/split/__tests__/splitFlags.test.js \
  src/components/split/__tests__/qr.test.js \
  src/components/split/__tests__/liveStream.test.js \
  src/services/__tests__/apiContract.test.js \
  src/components/split/__tests__/addReceipt.test.js \
  src/utils/__tests__/readerFlags.test.js \
  src/pages/__tests__/healthCoachContract.test.js \
  src/styles/__tests__/contrast.test.js \
  src/components/common/__tests__/companionAndToast.test.js \
  src/utils/__tests__/textValue.test.js \
  src/components/merchant/__tests__/merchantTabs.test.js \
  src/features/shopping/__tests__/boardColumns.test.js \
  src/utils/__tests__/dataSyncBus.test.js \
  src/utils/__tests__/avatarHelper.test.js \
  src/utils/__tests__/transactionLabel.test.js \
  src/utils/__tests__/financialProfile.test.js \
  src/components/ai/__tests__/topBarPosition.test.js
do
  if [ ! -f "$test_file" ]; then
    echo "  SKIP $test_file (not present)"
    continue
  fi
  if node "$test_file" > /tmp/preflight_test.log 2>&1; then
    echo "  OK   $test_file : $(tail -1 /tmp/preflight_test.log)"
  else
    echo "  FAIL $test_file : $(tail -1 /tmp/preflight_test.log)"
    FAILED_FRONTEND=1
  fi
done
if [ "$FAILED_FRONTEND" -ne 0 ]; then
  note_failure "frontend unit tests"
fi
cd "$ROOT"
echo

echo "--- frontend build ---------------------------------------------"
cd "$ROOT/frontend"
# The same build switches the deployment uses, so the build that is
# checked here is the build that is deployed.
if VITE_UI_AURORA=1 VITE_UI_MONEY=1 VITE_UI_POLISH=1 npm run build > /tmp/preflight_build.log 2>&1; then
  tail -4 /tmp/preflight_build.log
  echo "  -> build OK"
else
  tail -25 /tmp/preflight_build.log
  note_failure "frontend build"
fi
cd "$ROOT"
echo

echo "--- route smoke test ------------------------------------------"
cd "$ROOT"
if "$ROOT/backend/venv/bin/python" "$ROOT/scripts/smoke_test_routes.py" > /tmp/preflight_smoke.log 2>&1; then
  grep -E '^  OK' /tmp/preflight_smoke.log
  echo "  -> route smoke test OK"
else
  tail -30 /tmp/preflight_smoke.log
  note_failure "route smoke test"
fi

echo "--- generated assets -----------------------------------------"
if "$ROOT/backend/venv/bin/python" "$ROOT/scripts/generate_assets.py" --check > /tmp/preflight_assets.log 2>&1; then
  grep -E '^  OK' /tmp/preflight_assets.log
  echo "  -> assets OK"
else
  tail -20 /tmp/preflight_assets.log
  note_failure "generated assets"
fi
cd "$ROOT"
echo

echo "--- backend pytest -q -----------------------------------------"
cd "$ROOT/backend"
if [ -x venv/bin/python ]; then
  PY=venv/bin/python
elif [ -x .venv/bin/python ]; then
  PY=.venv/bin/python
else
  PY=python3
fi
if "$PY" -m pytest -q > /tmp/preflight_pytest.log 2>&1; then
  tail -2 /tmp/preflight_pytest.log
  echo "  -> pytest OK"
else
  tail -30 /tmp/preflight_pytest.log
  note_failure "backend pytest"
fi
cd "$ROOT"
echo

echo "=============================================================="
if [ "$FAILED" -ne 0 ]; then
  echo " PREFLIGHT FAILED"
  echo "=============================================================="
  exit 1
fi
echo " PREFLIGHT PASSED"
echo "=============================================================="
