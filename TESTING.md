# Running Tests

This project includes Jest unit tests for core FODMAP logic functions.

## Setup

### 1. Install Node.js (if you haven't already)
Download from https://nodejs.org/ — use the LTS version.

### 2. Clone your repo locally
```bash
git clone https://github.com/yourusername/fodmap-tracker.git
cd fodmap-tracker
```

### 3. Initialize npm and install Jest
```bash
npm init -y
npm install --save-dev jest
```

This creates:
- `package.json` — your project dependencies
- `node_modules/` — Jest and its dependencies (ignore in git)

### 4. Update package.json
Open `package.json` and find the `"scripts"` section. Change it to:

```json
"scripts": {
  "test": "jest"
}
```

## Run Tests

```bash
npm test
```

Jest will find `fodmap-tracker.test.js` and run all tests.

### Watch mode (re-run tests on file changes)
```bash
npm test -- --watch
```

### Show coverage report
```bash
npm test -- --coverage
```

## Test Structure

The tests are organized into groups:

1. **Unit Conversion Tests** — does `toNativeQty()` correctly convert between units?
   - Grams ↔ cups, ounces ↔ grams, etc.

2. **Scoring Tests** — does `scoreForQty()` pick the right FODMAP level?
   - Green (0) → Yellow (1) → Red (2)
   - Boundary conditions

3. **Integration Tests** — do conversion + scoring work together?
   - "User enters 80g oats → should be score 0"

4. **Calorie Scaling** — does calorie math work correctly?

5. **Daily Totals** — can we count high/med/low foods?

6. **Edge Cases** — very small/large amounts, missing data, etc.

7. **Storage Tests** — do localStorage reads/writes work?

## What the Tests Cover

✅ **Unit conversion** (grams, ounces, native units)  
✅ **FODMAP scoring** at different serving sizes  
✅ **Threshold logic** (when score changes from 0→1→2)  
✅ **Calorie estimation**  
✅ **localStorage persistence**  

## Example Output

When you run `npm test`, you should see:

```
PASS  fodmap-tracker.test.js
  toNativeQty - Unit Conversion
    ✓ native unit passthrough
    ✓ grams to cups (spinach)
    ✓ grams to oz (chicken)
    ...
  scoreForQty - FODMAP Scoring
    ✓ score 0 for safe food at any amount
    ✓ score 2 for high FODMAP food (always red)
    ...

Test Suites: 1 passed, 1 total
Tests:       47 passed, 47 total
```

All 47 tests should pass. If any fail, it means there's a bug in the core logic.

## Adding More Tests

To test a new food or feature:

1. Add a test food to `testFoods`
2. Write a test function:
   ```javascript
   test("description of what you're testing", () => {
     const result = functionToTest(input);
     expect(result).toBe(expectedValue);
   });
   ```
3. Run `npm test` to verify it passes

## Continuous Integration (Optional)

If you want tests to run automatically when you push to GitHub:

1. Create `.github/workflows/test.yml` in your repo
2. Paste this:

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
```

Now tests run automatically on every push!

## Troubleshooting

**"Command 'jest' not found"**
- Run `npm install --save-dev jest` again

**"Cannot find module 'jest'"**
- Make sure you're in the repo directory with `node_modules/` present

**Tests fail unexpectedly**
- Check the error message — it usually points to the line that failed
- Common issues: typo in function name, wrong expected value, threshold logic

---

For more on Jest: https://jestjs.io/docs/getting-started
