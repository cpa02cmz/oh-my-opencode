import { describe, expect, it } from "bun:test";
import { suggestCategoryName } from "./suggest-category";

describe("suggestCategoryName", () => {
	// #given a typo with small edit distance
	// #when suggesting a category
	// #then it should return the closest match
	it("should suggest correct category for simple typo", () => {
		const result = suggestCategoryName("ultra-brain", ["ultrabrain", "quick"]);
		expect(result).toBe("ultrabrain");
	});

	// #given input with large edit distance from candidates
	// #when suggesting a category
	// #then it should return undefined
	it("should not suggest if distance is too large", () => {
		const result = suggestCategoryName("totally-wrong", ["ultrabrain"]);
		expect(result).toBeUndefined();
	});

	// #given input with different casing
	// #when suggesting a category
	// #then it should match case-insensitively
	it("should match case-insensitively", () => {
		const result = suggestCategoryName("ULTRABRAIN", ["ultrabrain"]);
		expect(result).toBe("ultrabrain");
	});

	// #given input with transposed characters
	// #when suggesting a category
	// #then it should handle transposition (Damerau-Levenshtein)
	it("should handle transposition", () => {
		const result = suggestCategoryName("quikc", ["quick"]);
		expect(result).toBe("quick");
	});
});
