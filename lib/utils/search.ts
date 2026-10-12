/**
 * Search & Fuzzy Matching Utilities for Passi
 * Handles:
 * 1. Accent stripping (é, è, ê -> e)
 * 2. Special character & punctuation removal (quotes, hyphens, underscores)
 * 3. Space-omission tolerance ("soireeintegrale" -> "Soirée Intégrale")
 * 4. Typo-tolerance via Levenshtein edit distance & N-gram similarity
 * 5. Text match highlighting for suggestions dropdown
 */

import { Event } from "@/lib/services/api";

/**
 * Removes accents and diacritics from a string.
 * e.g., "Soirée d'été" -> "Soiree d'ete"
 */
export function removeAccents(str: string): string {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Normalizes text for search comparison:
 * - Lowercases
 * - Removes accents
 * - Replaces non-alphanumeric characters with spaces
 * - Trims and collapses multiple spaces into one
 */
export function normalizeText(str: string): string {
  if (!str) return "";
  return removeAccents(str)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Collapses text into an alphanumeric-only string without any spaces or symbols.
 * Perfect for space-omission matching: "soireeintegrale" === "soireeintegrale"
 */
export function collapseText(str: string): string {
  if (!str) return "";
  return removeAccents(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Computes standard Wagner-Fischer Levenshtein distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Generates character bigrams/trigrams for similarity comparison.
 */
function getTrigrams(str: string): Set<string> {
  const trigrams = new Set<string>();
  const padded = `  ${str} `;
  for (let i = 0; i < padded.length - 2; i++) {
    trigrams.add(padded.slice(i, i + 3));
  }
  return trigrams;
}

/**
 * Computes Trigram similarity (Sørensen-Dice coefficient) between two strings.
 * Returns a value between 0.0 and 1.0.
 */
export function trigramSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (!a || !b) return 0.0;
  const aTrigrams = getTrigrams(a);
  const bTrigrams = getTrigrams(b);

  let matches = 0;
  aTrigrams.forEach((tri) => {
    if (bTrigrams.has(tri)) matches++;
  });

  return (2 * matches) / (aTrigrams.size + bTrigrams.size);
}

export interface MatchScoreResult {
  score: number;       // Higher is better (0 to 1)
  isMatch: boolean;
  matchType: "exact" | "collapsed" | "substring" | "words" | "fuzzy" | "none";
}

/**
 * Evaluates how closely a query matches a target title or text.
 * Threshold is typically 0.35 to 0.4.
 */
export function calculateMatchScore(query: string, target: string, threshold = 0.38): MatchScoreResult {
  const normQuery = normalizeText(query);
  const normTarget = normalizeText(target);
  const collQuery = collapseText(query);
  const collTarget = collapseText(target);

  if (!normQuery || !normTarget) {
    return { score: 0, isMatch: false, matchType: "none" };
  }

  // 1. Exact Match
  if (normQuery === normTarget || collQuery === collTarget) {
    return { score: 1.0, isMatch: true, matchType: "exact" };
  }

  // 2. Space Omission Match (e.g. "soireeintegrale" inside "soireeintegrale2026" or vice-versa)
  if (collTarget.includes(collQuery)) {
    const ratio = collQuery.length / collTarget.length;
    const score = 0.85 + (0.15 * ratio);
    return { score, isMatch: true, matchType: "collapsed" };
  }

  // If query is longer than target and target is contained inside query
  if (collQuery.includes(collTarget)) {
    const ratio = collTarget.length / collQuery.length;
    const score = 0.80 + (0.15 * ratio);
    return { score, isMatch: true, matchType: "collapsed" };
  }

  // 3. Normalized Substring Match
  if (normTarget.includes(normQuery)) {
    const score = 0.80 + (0.15 * (normQuery.length / normTarget.length));
    return { score, isMatch: true, matchType: "substring" };
  }

  // 4. Word-by-Word Matching (Prefix & Levenshtein per word)
  const queryWords = normQuery.split(" ").filter(w => w.length > 0);
  const targetWords = normTarget.split(" ").filter(w => w.length > 0);

  let matchedWordsCount = 0;
  let wordScoreSum = 0;

  for (const qWord of queryWords) {
    let bestWordScore = 0;

    for (const tWord of targetWords) {
      if (tWord === qWord) {
        bestWordScore = Math.max(bestWordScore, 1.0);
        continue;
      }

      // Prefix match (e.g., "soire" in "soiree")
      if (tWord.startsWith(qWord)) {
        const prefixScore = 0.85 * (qWord.length / tWord.length);
        bestWordScore = Math.max(bestWordScore, prefixScore);
        continue;
      }

      // Levenshtein typo-tolerance:
      // Allow 1 typo for words of length 3-5, 2 typos for words > 5
      const maxAllowedDistance = qWord.length <= 4 ? 1 : 2;
      const distance = levenshteinDistance(qWord, tWord);

      if (distance <= maxAllowedDistance) {
        const maxLen = Math.max(qWord.length, tWord.length);
        const levScore = 1 - (distance / maxLen);
        bestWordScore = Math.max(bestWordScore, levScore * 0.8);
      }
    }

    if (bestWordScore >= threshold) {
      matchedWordsCount++;
      wordScoreSum += bestWordScore;
    }
  }

  if (queryWords.length > 0 && matchedWordsCount === queryWords.length) {
    const avgScore = wordScoreSum / queryWords.length;
    return { score: avgScore, isMatch: true, matchType: "words" };
  }

  // 5. Overall Trigram / Fuzzy Similarity
  const trigram = trigramSimilarity(collQuery, collTarget);
  if (trigram >= threshold) {
    return { score: trigram, isMatch: true, matchType: "fuzzy" };
  }

  // Levenshtein on whole collapsed strings (if within 2 typos)
  const wholeDistance = levenshteinDistance(collQuery, collTarget);
  const maxWholeLen = Math.max(collQuery.length, collTarget.length);
  const wholeLevRatio = 1 - (wholeDistance / maxWholeLen);

  if (wholeDistance <= 2 || wholeLevRatio >= (1 - threshold)) {
    return { score: wholeLevRatio, isMatch: true, matchType: "fuzzy" };
  }

  return { score: Math.max(trigram, wholeLevRatio), isMatch: false, matchType: "none" };
}

export interface ScoredEvent {
  event: Event;
  score: number;
  matchType: MatchScoreResult["matchType"];
}

/**
 * Searches a list of events with fault tolerance.
 * Returns sorted list of events with the most relevant first.
 */
export function searchEventsFaultTolerant(
  events: Event[],
  query: string,
  options?: {
    threshold?: number;
    maxResults?: number;
    includeLocationAndDesc?: boolean;
  }
): ScoredEvent[] {
  const q = query.trim();
  if (!q) {
    return events.map(e => ({ event: e, score: 1.0, matchType: "exact" }));
  }

  const threshold = options?.threshold ?? 0.38;
  const includeOthers = options?.includeLocationAndDesc ?? true;
  const scoredList: ScoredEvent[] = [];

  for (const event of events) {
    // Title is the primary search subject
    const titleMatch = calculateMatchScore(q, event.title || "", threshold);

    let bestScore = titleMatch.score;
    let bestType = titleMatch.matchType;

    // Optional check on location and description
    if (includeOthers) {
      if (event.location) {
        const locMatch = calculateMatchScore(q, event.location, threshold);
        if (locMatch.score * 0.85 > bestScore) {
          bestScore = locMatch.score * 0.85;
          bestType = locMatch.matchType;
        }
      }

      if (event.description) {
        const descMatch = calculateMatchScore(q, event.description, threshold);
        if (descMatch.score * 0.70 > bestScore) {
          bestScore = descMatch.score * 0.70;
          bestType = descMatch.matchType;
        }
      }
    }

    if (bestScore >= threshold) {
      scoredList.push({
        event,
        score: bestScore,
        matchType: bestType,
      });
    }
  }

  // Sort descending by score
  scoredList.sort((a, b) => b.score - a.score);

  if (options?.maxResults && options.maxResults > 0) {
    return scoredList.slice(0, options.maxResults);
  }

  return scoredList;
}

/**
 * Breaks down target text into highlighted and non-highlighted segments
 * based on query words, space-omissions, and accents.
 */
export function splitHighlightParts(text: string, query: string): Array<{ text: string; highlight: boolean }> {
  if (!text || !query.trim()) {
    return [{ text, highlight: false }];
  }

  const collQ = collapseText(query);
  if (!collQ) {
    return [{ text, highlight: false }];
  }

  // Build a character index mapping from collapsed string to original text
  const collToOrig: number[] = [];
  let collStr = "";

  for (let i = 0; i < text.length; i++) {
    const ch = removeAccents(text[i]).toLowerCase();
    if (/[a-z0-9]/.test(ch)) {
      collToOrig.push(i);
      collStr += ch;
    }
  }

  // 1. Direct Collapsed Match (handles space-omission like "soireeintegrale" -> "Soirée Intégrale")
  const collIdx = collStr.indexOf(collQ);
  if (collIdx !== -1) {
    const origStart = collToOrig[collIdx];
    const origEnd = collToOrig[collIdx + collQ.length - 1] + 1;

    const parts: Array<{ text: string; highlight: boolean }> = [];
    if (origStart > 0) {
      parts.push({ text: text.slice(0, origStart), highlight: false });
    }
    parts.push({ text: text.slice(origStart, origEnd), highlight: true });
    if (origEnd < text.length) {
      parts.push({ text: text.slice(origEnd), highlight: false });
    }
    return parts;
  }

  // 2. Word-by-word matching
  const normQuery = normalizeText(query);
  const words = normQuery.split(" ").filter(w => w.length > 0);
  if (words.length === 0) {
    return [{ text, highlight: false }];
  }

  const highlighted = new Array(text.length).fill(false);
  let hasAnyMatch = false;

  for (const word of words) {
    if (word.length < 2) continue;
    const wColl = collapseText(word);
    let searchFrom = 0;
    while (searchFrom < collStr.length) {
      const idx = collStr.indexOf(wColl, searchFrom);
      if (idx === -1) break;
      const start = collToOrig[idx];
      const end = collToOrig[idx + wColl.length - 1] + 1;
      for (let k = start; k < end; k++) {
        highlighted[k] = true;
      }
      hasAnyMatch = true;
      searchFrom = idx + 1;
    }
  }

  if (!hasAnyMatch) {
    return [{ text, highlight: false }];
  }

  // Merge consecutive true/false segments
  const segments: Array<{ text: string; highlight: boolean }> = [];
  let currentHighlight = highlighted[0];
  let currentStart = 0;

  for (let i = 1; i < text.length; i++) {
    if (highlighted[i] !== currentHighlight) {
      segments.push({
        text: text.slice(currentStart, i),
        highlight: currentHighlight,
      });
      currentHighlight = highlighted[i];
      currentStart = i;
    }
  }
  segments.push({
    text: text.slice(currentStart),
    highlight: currentHighlight,
  });

  return segments;
}
