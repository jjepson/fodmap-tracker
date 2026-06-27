/**
 * FODMAP Tracker Core Logic Tests
 * Tests for scoring, unit conversion, and storage functions
 */

// Mock localStorage for Node.js (Jest) environment
if (typeof global.localStorage === 'undefined') {
  global.localStorage = {
    _data: {},
    getItem(key) {
      return this._data[key] || null;
    },
    setItem(key, value) {
      this._data[key] = String(value);
    },
    removeItem(key) {
      delete this._data[key];
    },
    clear() {
      this._data = {};
    }
  };
}

// ── HELPER FUNCTIONS (copied from app) ────────────────────────────────────

const OZ_TO_G = 28.3495;

function toNativeQty(food, enteredQty, inputUnit) {
  if (inputUnit === "native" || !enteredQty) return enteredQty;
  const gpn = food.gramsPerNative;
  if (!gpn) return enteredQty;
  const enteredGrams = inputUnit === "g" ? enteredQty : enteredQty * OZ_TO_G;
  return enteredGrams / gpn;
}

function scoreForQty(food, qty) {
  for (const t of food.thresholds) {
    if (qty <= t.maxQty) return t.score;
  }
  return food.thresholds[food.thresholds.length - 1].score;
}

// ── TEST DATA ────────────────────────────────────────────────────────────

const testFoods = {
  // Safe food (score 0 at all amounts)
  spinach: {
    id: 1,
    name: "Spinach (baby)",
    serving: "1 cup",
    baseQty: 1,
    unit: "cup",
    gramsPerNative: 30,
    cal: 7,
    thresholds: [{ maxQty: 99, score: 0 }]
  },
  // Low → Medium → High (common pattern)
  oats: {
    id: 3,
    name: "Oats (rolled, dry)",
    serving: "½ cup",
    baseQty: 0.5,
    unit: "cup",
    gramsPerNative: 80,
    cal: 150,
    thresholds: [
      { maxQty: 0.5, score: 0 },
      { maxQty: 1, score: 1 },
      { maxQty: 99, score: 2 }
    ]
  },
  // High FODMAP (always avoid)
  apple: {
    id: 116,
    name: "Apple",
    serving: "1 medium",
    baseQty: 1,
    unit: "medium",
    gramsPerNative: 182,
    cal: 95,
    thresholds: [{ maxQty: 99, score: 2 }]
  },
  // With oz weight conversion
  chicken: {
    id: 150,
    name: "Chicken breast (cooked)",
    serving: "4 oz",
    baseQty: 4,
    unit: "oz",
    gramsPerNative: 28.35,
    cal: 187,
    thresholds: [{ maxQty: 99, score: 0 }]
  },
  // Metric weight
  salmon: {
    id: 164,
    name: "Salmon (cooked)",
    serving: "4 oz",
    baseQty: 4,
    unit: "oz",
    gramsPerNative: 28.35,
    cal: 236,
    thresholds: [{ maxQty: 99, score: 0 }]
  }
};

// ── UNIT CONVERSION TESTS ────────────────────────────────────────────────

describe("toNativeQty - Unit Conversion", () => {
  test("native unit passthrough", () => {
    const result = toNativeQty(testFoods.oats, 0.5, "native");
    expect(result).toBe(0.5);
  });

  test("grams to cups (spinach)", () => {
    // 30g spinach = 1 cup native
    // 60g should = 2 cups native
    const result = toNativeQty(testFoods.spinach, 60, "g");
    expect(result).toBeCloseTo(2, 1);
  });

  test("grams to oz (chicken)", () => {
    // 28.35g per oz native
    // 113.4g should = 4 oz native
    const result = toNativeQty(testFoods.chicken, 113.4, "g");
    expect(result).toBeCloseTo(4, 1);
  });

  test("oz to oz (chicken)", () => {
    // 4 oz entered in oz should stay 4 oz native
    const result = toNativeQty(testFoods.chicken, 4, "oz");
    expect(result).toBeCloseTo(4, 1);
  });

  test("oz to grams conversion (salmon)", () => {
    // 8 oz = 8 * 28.3495 = 226.796 grams
    // With gramsPerNative 28.35, should = 8 oz native
    const result = toNativeQty(testFoods.salmon, 8, "oz");
    expect(result).toBeCloseTo(8, 0);
  });

  test("handles zero quantity", () => {
    const result = toNativeQty(testFoods.oats, 0, "g");
    expect(result).toBe(0);
  });

  test("handles missing gramsPerNative (no weight conversion available)", () => {
    const foodNoWeight = { ...testFoods.spinach, gramsPerNative: undefined };
    const result = toNativeQty(foodNoWeight, 100, "g");
    expect(result).toBe(100); // fallback: treat as native
  });
});

// ── SCORING TESTS ────────────────────────────────────────────────────────

describe("scoreForQty - FODMAP Scoring", () => {
  test("score 0 for safe food at any amount", () => {
    expect(scoreForQty(testFoods.spinach, 1)).toBe(0);
    expect(scoreForQty(testFoods.spinach, 10)).toBe(0);
    expect(scoreForQty(testFoods.spinach, 99)).toBe(0);
  });

  test("score 2 for high FODMAP food (always red)", () => {
    expect(scoreForQty(testFoods.apple, 0.5)).toBe(2);
    expect(scoreForQty(testFoods.apple, 1)).toBe(2);
  });

  test("oats: low at ½ cup", () => {
    expect(scoreForQty(testFoods.oats, 0.5)).toBe(0);
  });

  test("oats: medium at 1 cup", () => {
    expect(scoreForQty(testFoods.oats, 1)).toBe(1);
  });

  test("oats: high at 2 cups", () => {
    expect(scoreForQty(testFoods.oats, 2)).toBe(2);
  });

  test("oats: medium at 0.75 cup (between thresholds)", () => {
    // 0.75 is between 0.5 (score 0) and 1 (score 1)
    // Should return score 0 since 0.75 <= 0.5? No, 0.75 > 0.5, so it returns score 1
    expect(scoreForQty(testFoods.oats, 0.75)).toBe(1);
  });

  test("chicken: score 0 at any amount (safe protein)", () => {
    expect(scoreForQty(testFoods.chicken, 4)).toBe(0);
    expect(scoreForQty(testFoods.chicken, 8)).toBe(0);
    expect(scoreForQty(testFoods.chicken, 20)).toBe(0);
  });

  test("boundary condition: exactly at threshold", () => {
    // At exactly 0.5, should be score 0
    expect(scoreForQty(testFoods.oats, 0.5)).toBe(0);
    // Just above 0.5, should be score 1
    expect(scoreForQty(testFoods.oats, 0.50001)).toBe(1);
  });
});

// ── INTEGRATION TESTS (unit conversion + scoring) ────────────────────────

describe("Integration - Convert then Score", () => {
  test("oats: 80g entered → 1 cup native → score 0", () => {
    // 80g oats = 1 cup native (gramsPerNative: 80)
    const nativeQty = toNativeQty(testFoods.oats, 80, "g");
    expect(nativeQty).toBeCloseTo(1, 1);
    // At exactly 1 cup, we're at the boundary. Since threshold is {maxQty: 0.5, score: 0}
    // and nativeQty ≈ 1.0, we're past 0.5, so we should get score 1, not 0.
    // This test expectation was wrong. Let's check the actual threshold logic:
    // At 1 cup exactly, score should be 1 (we've crossed into the next threshold)
    const score = scoreForQty(testFoods.oats, nativeQty);
    expect(score).toBe(1); // corrected: 1 cup is in the medium zone
  });

  test("oats: 40g entered → 0.5 cup native → score 0", () => {
    // 40g = 0.5 cup exactly, should be score 0
    const nativeQty = toNativeQty(testFoods.oats, 40, "g");
    expect(nativeQty).toBeCloseTo(0.5, 2);
    const score = scoreForQty(testFoods.oats, nativeQty);
    expect(score).toBe(0);
  });

  test("oats: 160g entered → 2 cups native → score 2", () => {
    const nativeQty = toNativeQty(testFoods.oats, 160, "g");
    expect(nativeQty).toBeCloseTo(2, 1);
    const score = scoreForQty(testFoods.oats, nativeQty);
    expect(score).toBe(2);
  });

  test("chicken: 8 oz entered → 8 oz native → score 0", () => {
    const nativeQty = toNativeQty(testFoods.chicken, 8, "oz");
    expect(nativeQty).toBeCloseTo(8, 1);
    const score = scoreForQty(testFoods.chicken, nativeQty);
    expect(score).toBe(0);
  });

  test("chicken: 226g entered → 8 oz native → score 0", () => {
    const nativeQty = toNativeQty(testFoods.chicken, 226, "g");
    expect(nativeQty).toBeCloseTo(8, 1);
    const score = scoreForQty(testFoods.chicken, nativeQty);
    expect(score).toBe(0);
  });

  test("spinach: 30g entered → 1 cup native → score 0", () => {
    const nativeQty = toNativeQty(testFoods.spinach, 30, "g");
    expect(nativeQty).toBeCloseTo(1, 0);
    const score = scoreForQty(testFoods.spinach, nativeQty);
    expect(score).toBe(0);
  });
});

// ── CALORIE CALCULATION (simple math test) ────────────────────────────────

describe("Calorie Scaling", () => {
  test("calories scale with multiplier", () => {
    const baseQty = 1;
    const enteredQty = 2;
    const mult = enteredQty / baseQty;
    const estCal = Math.round(testFoods.spinach.cal * mult);
    expect(estCal).toBe(14); // 7 * 2
  });

  test("calories for fractional serving", () => {
    const baseQty = 1;
    const enteredQty = 0.5;
    const mult = enteredQty / baseQty;
    const estCal = Math.round(testFoods.chicken.cal * mult);
    expect(estCal).toBe(94); // 187 * 0.5 ≈ 94
  });

  test("calories for weight conversion (chicken 6 oz)", () => {
    const nativeQty = toNativeQty(testFoods.chicken, 6, "oz");
    const mult = nativeQty / testFoods.chicken.baseQty;
    const estCal = Math.round(testFoods.chicken.cal * mult);
    expect(estCal).toBe(280); // 187 * 1.5 = 280.5 ≈ 280
  });
});

// ── DAILY TOTALS ────────────────────────────────────────────────────────

describe("Daily FODMAP Totals", () => {
  test("count low/med/high across multiple foods", () => {
    const meals = [
      { score: 0, name: "Spinach" },
      { score: 0, name: "Chicken" },
      { score: 1, name: "Oats (1 cup)" },
      { score: 1, name: "Blueberries" },
      { score: 2, name: "Apple" }
    ];

    const lowCount = meals.filter(m => m.score === 0).length;
    const medCount = meals.filter(m => m.score === 1).length;
    const highCount = meals.filter(m => m.score === 2).length;

    expect(lowCount).toBe(2);
    expect(medCount).toBe(2);
    expect(highCount).toBe(1);
  });

  test("empty meal list", () => {
    const meals = [];
    const lowCount = meals.filter(m => m.score === 0).length;
    expect(lowCount).toBe(0);
  });
});

// ── EDGE CASES & ERROR HANDLING ──────────────────────────────────────────

describe("Edge Cases", () => {
  test("very small quantity", () => {
    const result = toNativeQty(testFoods.oats, 0.001, "native");
    expect(result).toBeCloseTo(0.001, 4);
    expect(scoreForQty(testFoods.oats, result)).toBe(0);
  });

  test("very large quantity", () => {
    const nativeQty = toNativeQty(testFoods.oats, 1000, "g");
    const score = scoreForQty(testFoods.oats, nativeQty);
    expect(score).toBe(2); // should exceed all thresholds
  });

  test("negative quantity (shouldn't happen but graceful)", () => {
    const result = toNativeQty(testFoods.oats, -1, "native");
    expect(result).toBe(-1);
    // scoring would still work but give unexpected results
  });

  test("undefined food quantity", () => {
    const result = toNativeQty(testFoods.oats, undefined, "native");
    expect(result).toBe(undefined);
  });

  test("multiple threshold crossing", () => {
    // Verify threshold logic works at exact boundaries
    expect(scoreForQty(testFoods.oats, 0.5)).toBe(0);   // at first threshold
    expect(scoreForQty(testFoods.oats, 0.500001)).toBe(1); // just past
    expect(scoreForQty(testFoods.oats, 1)).toBe(1);     // at second threshold
    expect(scoreForQty(testFoods.oats, 1.00001)).toBe(2); // just past
  });
});

// ── STORAGE FUNCTIONS (mocked) ──────────────────────────────────────────

describe("Storage Functions", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("saveDays and loadDays", async () => {
    const testData = {
      "2025-01-15": {
        date: "2025-01-15",
        meals: { Breakfast: [], Lunch: [], Dinner: [], Snacks: [] }
      }
    };

    // Simulate saveDays
    localStorage.setItem("fodmap-days-v3", JSON.stringify(testData));

    // Simulate loadDays
    const retrieved = JSON.parse(localStorage.getItem("fodmap-days-v3") || "{}");

    expect(retrieved).toEqual(testData);
    expect(retrieved["2025-01-15"]).toBeDefined();
  });

  test("saveCustom and loadCustom", async () => {
    const customFoods = [
      { id: "custom-1", name: "My Smoothie", category: "Custom", baseQty: 1, unit: "bowl", cal: 250 }
    ];

    localStorage.setItem("fodmap-custom-v3", JSON.stringify(customFoods));
    const retrieved = JSON.parse(localStorage.getItem("fodmap-custom-v3") || "[]");

    expect(retrieved).toEqual(customFoods);
    expect(retrieved[0].name).toBe("My Smoothie");
  });

  test("saveSavedMeals and loadSavedMeals", async () => {
    const meals = [
      {
        name: "Breakfast Bowl",
        foods: [{ name: "Oats", serving: "½ cup" }]
      }
    ];

    localStorage.setItem("fodmap-saved-meals-v3", JSON.stringify(meals));
    const retrieved = JSON.parse(localStorage.getItem("fodmap-saved-meals-v3") || "[]");

    expect(retrieved[0].name).toBe("Breakfast Bowl");
    expect(retrieved[0].foods.length).toBe(1);
  });

  test("localStorage returns empty on missing keys", () => {
    const result = localStorage.getItem("nonexistent-key");
    expect(result).toBeNull();
  });

  test("overwrites previous data", () => {
    localStorage.setItem("test-key", "first");
    localStorage.setItem("test-key", "second");
    expect(localStorage.getItem("test-key")).toBe("second");
  });
});
