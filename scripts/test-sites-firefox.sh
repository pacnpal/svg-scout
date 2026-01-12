#!/bin/bash
#
# SVG Scout Test Sites (LibreWolf/Firefox)
# Opens LibreWolf with websites to test all 11 SVG extraction methods
#

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LIBREWOLF="/Applications/LibreWolf.app/Contents/MacOS/librewolf"
EDGE_CASES="file://${SCRIPT_DIR}/test-edge-cases.html"

# Check if LibreWolf exists
if [ ! -f "$LIBREWOLF" ]; then
    echo "Error: LibreWolf not found at $LIBREWOLF"
    echo "Please install LibreWolf or update the path in this script."
    exit 1
fi

echo "Opening SVG Scout test sites in LibreWolf..."
echo ""
echo "=== CORE DETECTION METHODS ==="
echo "  1. Inline SVGs        -> github.com (UI icons)"
echo "  2. Image SVGs         -> svgrepo.com (icon previews)"
echo "  3. CSS Background     -> stripe.com (decorative SVGs)"
echo "  4. Sprite SVGs        -> gitlab.com (icon sprite system)"
echo "  5. Favicon SVGs       -> dev.to (SVG favicon)"
echo "  6. Object/Embed       -> w3schools.com/graphics/svg_intro.asp"
echo ""
echo "=== EDGE CASE DETECTION ==="
echo "  7. Shadow DOM         -> shoelace.style (web components)"
echo "  8. Shadow DOM         -> youtube.com (custom elements)"
echo "  9. Data Attributes    -> iconify.design (data-icon placeholders)"
echo " 10. Template SVGs      -> lit.dev/playground (Lit templates)"
echo " 11. JSON-LD SVGs       -> nystudio107.com (structured data)"
echo ""
echo "=== LOCAL TEST FILE ==="
echo " 12. All Edge Cases     -> test-edge-cases.html (guaranteed coverage)"
echo ""

# Open LibreWolf with all test sites
"$LIBREWOLF" \
    "https://github.com" \
    "https://www.svgrepo.com" \
    "https://stripe.com" \
    "https://gitlab.com" \
    "https://dev.to" \
    "https://www.w3schools.com/graphics/svg_intro.asp" \
    "https://shoelace.style/components/icon" \
    "https://www.youtube.com" \
    "https://iconify.design" \
    "https://lit.dev/playground" \
    "https://nystudio107.com" \
    "https://heroicons.com" \
    "https://lucide.dev/icons" \
    "$EDGE_CASES" \
    &

echo "LibreWolf launched with 14 tabs."
echo ""
echo "Test checklist:"
echo "  [ ] Run SVG Scout on each tab"
echo "  [ ] Verify source labels match expected detection method"
echo "  [ ] Check edge cases page finds all 19 test SVGs"
