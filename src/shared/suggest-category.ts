/**
 * Calculates the Damerau-Levenshtein distance between two strings.
 * Handles insertions, deletions, substitutions, and adjacent transpositions.
 */
function damerauLevenshtein(source: string, target: string): number {
	const sourceLength = source.length;
	const targetLength = target.length;

	// Early exit: empty string cases
	if (sourceLength === 0) return targetLength;
	if (targetLength === 0) return sourceLength;

	// Initialize distance matrix with dimensions (sourceLength + 1) x (targetLength + 1)
	const matrix: number[][] = [];
	for (let i = 0; i <= sourceLength; i++) {
		matrix[i] = [];
		for (let j = 0; j <= targetLength; j++) {
			if (i === 0) {
				matrix[i][j] = j;
			} else if (j === 0) {
				matrix[i][j] = i;
			} else {
				matrix[i][j] = 0;
			}
		}
	}

	// Fill in the matrix
	for (let i = 1; i <= sourceLength; i++) {
		for (let j = 1; j <= targetLength; j++) {
			const substitutionCost = source[i - 1] === target[j - 1] ? 0 : 1;

			// Minimum of insertion, deletion, substitution
			matrix[i][j] = Math.min(
				matrix[i - 1][j] + 1, // deletion
				matrix[i][j - 1] + 1, // insertion
				matrix[i - 1][j - 1] + substitutionCost // substitution
			);

			// Check for transposition
			const canTranspose =
				i > 1 &&
				j > 1 &&
				source[i - 1] === target[j - 2] &&
				source[i - 2] === target[j - 1];

			if (canTranspose) {
				matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
			}
		}
	}

	return matrix[sourceLength][targetLength];
}

/**
 * Suggests the closest category name from a list of candidates.
 * Returns undefined if no candidate is within the acceptable distance threshold.
 */
export function suggestCategoryName(
	input: string,
	candidates: string[]
): string | undefined {
	// Early exit: no candidates to match
	if (candidates.length === 0) return undefined;

	const normalizedInput = input.toLowerCase();
	const threshold = Math.max(normalizedInput.length, 3) / 3;

	let closestCandidate: string | undefined;
	let smallestDistance = Infinity;

	for (const candidate of candidates) {
		const normalizedCandidate = candidate.toLowerCase();
		const distance = damerauLevenshtein(normalizedInput, normalizedCandidate);

		const isWithinThreshold = distance <= threshold;
		const isCloserThanPrevious = distance < smallestDistance;

		if (isWithinThreshold && isCloserThanPrevious) {
			smallestDistance = distance;
			closestCandidate = candidate;
		}
	}

	return closestCandidate;
}
