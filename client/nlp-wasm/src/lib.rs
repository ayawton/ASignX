use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use wasm_bindgen::prelude::*;

const HANDSHAPE_GROUPS: [&str; 3] = ["aemnst", "kruv", "dgxz"];
const PREFIX_LENGTH: usize = 7;
const MAX_DICT_EDIT_DISTANCE: usize = 2;
const MAX_WORD_LEN: usize = 20;
const BEAM_WIDTH: usize = 24;
const TOTAL_CORPUS_TOKENS: f64 = 1_024_908_267_229.0;

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct Suggestion {
    pub text: String,
    pub edits: usize,
    pub uncertain: bool,
    #[serde(rename = "joinPrevious", skip_serializing_if = "Option::is_none")]
    pub join_previous: Option<usize>,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct NlpResponse {
    pub original: String,
    pub suggestions: Vec<Suggestion>,
    pub engine: &'static str,
}

#[derive(Deserialize, Default)]
pub struct PreviousGroup {
    #[serde(default)]
    pub detected: String,
    #[serde(default)]
    pub text: String,
}

pub fn cap_repeats(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut prev: Option<char> = None;
    let mut run = 0usize;
    for ch in text.chars() {
        if Some(ch) == prev {
            run += 1;
            if run <= 2 {
                out.push(ch);
            }
        } else {
            prev = Some(ch);
            run = 1;
            out.push(ch);
        }
    }
    out
}

pub fn squeeze_repeats(text: &str) -> (String, usize) {
    let mut out = String::with_capacity(text.len());
    let mut prev: Option<char> = None;
    let mut collapsed = 0usize;
    for ch in text.chars() {
        if Some(ch) == prev {
            collapsed += 1;
        } else {
            prev = Some(ch);
            out.push(ch);
        }
    }
    (out, collapsed)
}

fn is_ascii_alpha_word(word: &str) -> bool {
    !word.is_empty() && word.bytes().all(|b| b.is_ascii_lowercase())
}

fn is_valid_dict_word(word: &str) -> bool {
    if word.is_empty() {
        return false;
    }
    let mut prev_apostrophe = true;
    for b in word.bytes() {
        if b.is_ascii_lowercase() {
            prev_apostrophe = false;
        } else if b == b'\'' && !prev_apostrophe {
            prev_apostrophe = true;
        } else {
            return false;
        }
    }
    !prev_apostrophe
}

fn is_valid_sentence_word(word: &str) -> bool {
    word.len() > 1 || word == "a" || word == "i"
}

fn same_handshape_group(a: char, b: char) -> bool {
    HANDSHAPE_GROUPS
        .iter()
        .any(|group| group.contains(a) && group.contains(b))
}

pub fn weighted_distance(source: &str, target: &str) -> f64 {
    let s: Vec<char> = source.chars().collect();
    let t: Vec<char> = target.chars().collect();
    let n = s.len();
    let m = t.len();
    let mut dp = vec![vec![0.0_f64; m + 1]; n + 1];
    for i in 0..=n {
        dp[i][0] = i as f64;
    }
    for j in 0..=m {
        dp[0][j] = j as f64;
    }
    for i in 1..=n {
        for j in 1..=m {
            let a = s[i - 1];
            let b = t[j - 1];
            let sub_cost = if a == b {
                0.0
            } else if same_handshape_group(a, b) {
                0.2
            } else {
                1.0
            };
            let mut best = (dp[i - 1][j] + 1.0)
                .min(dp[i][j - 1] + 1.0)
                .min(dp[i - 1][j - 1] + sub_cost);
            if i > 1 && j > 1 && a == t[j - 2] && b == s[i - 2] {
                best = best.min(dp[i - 2][j - 2] + 1.0);
            }
            dp[i][j] = best;
        }
    }
    dp[n][m]
}

fn damerau_levenshtein(a: &str, b: &str) -> usize {
    let s = a.as_bytes();
    let t = b.as_bytes();
    let n = s.len();
    let m = t.len();
    if n.abs_diff(m) > MAX_DICT_EDIT_DISTANCE {
        return MAX_DICT_EDIT_DISTANCE + 1;
    }
    let mut dp = vec![vec![0usize; m + 1]; n + 1];
    for i in 0..=n {
        dp[i][0] = i;
    }
    for j in 0..=m {
        dp[0][j] = j;
    }
    for i in 1..=n {
        for j in 1..=m {
            let cost = usize::from(s[i - 1] != t[j - 1]);
            let mut best = (dp[i - 1][j] + 1)
                .min(dp[i][j - 1] + 1)
                .min(dp[i - 1][j - 1] + cost);
            if i > 1 && j > 1 && s[i - 1] == t[j - 2] && s[i - 2] == t[j - 1] {
                best = best.min(dp[i - 2][j - 2] + 1);
            }
            dp[i][j] = best;
        }
    }
    dp[n][m]
}

fn generate_deletes(word: &str, max_distance: usize) -> HashSet<String> {
    let prefix: String = word.chars().take(PREFIX_LENGTH).collect();
    let mut queue = vec![prefix.clone()];
    let mut seen = HashSet::new();
    seen.insert(prefix);
    let mut depth = 0usize;
    while depth < max_distance && !queue.is_empty() {
        let mut next = Vec::new();
        for item in queue {
            if item.len() <= 1 {
                continue;
            }
            for idx in 0..item.len() {
                if !item.is_char_boundary(idx) {
                    continue;
                }
                let mut deleted = String::with_capacity(item.len() - 1);
                deleted.push_str(&item[..idx]);
                if let Some(ch) = item[idx..].chars().next() {
                    deleted.push_str(&item[idx + ch.len_utf8()..]);
                }
                if seen.insert(deleted.clone()) {
                    next.push(deleted);
                }
            }
        }
        queue = next;
        depth += 1;
    }
    seen
}

fn pack_bigram(a: u32, b: u32) -> u64 {
    ((a as u64) << 32) | (b as u64)
}

#[derive(Clone)]
struct WordCandidate {
    word: String,
    word_id: Option<u32>,
    count: u64,
    weighted_cost: f64,
    edits: usize,
    is_unknown: bool,
}

#[derive(Clone)]
struct BeamHypothesis {
    score: f64,
    total_edits: usize,
    words: Vec<(String, Option<u32>, u64)>,
}

pub struct CoreEngine {
    words: Vec<String>,
    counts: Vec<u64>,
    word_to_id: HashMap<String, u32>,
    deletes: HashMap<String, Vec<u32>>,
    bigrams: HashMap<u64, u64>,
    total_tokens: f64,
}

impl CoreEngine {
    pub fn from_dictionaries(unigram_text: &str, bigram_text: &str) -> Result<Self, String> {
        let mut words = Vec::with_capacity(85_000);
        let mut counts = Vec::with_capacity(85_000);
        let mut word_to_id = HashMap::with_capacity(85_000);
        let mut deletes: HashMap<String, Vec<u32>> = HashMap::with_capacity(600_000);
        let mut sum_tokens: u128 = 0;

        for line in unigram_text.lines() {
            let mut parts = line.split_whitespace();
            let (Some(raw_word), Some(raw_count)) = (parts.next(), parts.next()) else {
                continue;
            };
            let word = raw_word.to_ascii_lowercase();
            if !is_valid_dict_word(&word) {
                continue;
            }
            let Ok(count) = raw_count.parse::<u64>() else {
                continue;
            };
            if count == 0 {
                continue;
            }
            if let Some(&existing_id) = word_to_id.get(&word) {
                let idx = existing_id as usize;
                if count > counts[idx] {
                    counts[idx] = count;
                }
                continue;
            }
            let id = words.len() as u32;
            sum_tokens += count as u128;
            word_to_id.insert(word.clone(), id);
            words.push(word.clone());
            counts.push(count);

            for del in generate_deletes(&word, MAX_DICT_EDIT_DISTANCE) {
                deletes.entry(del).or_default().push(id);
            }
        }

        if words.is_empty() {
            return Err("English dictionary is empty".to_string());
        }

        let mut bigrams = HashMap::with_capacity(250_000);
        for line in bigram_text.lines() {
            let mut parts = line.split_whitespace();
            let (Some(w1), Some(w2), Some(raw_count)) = (parts.next(), parts.next(), parts.next())
            else {
                continue;
            };
            let Ok(count) = raw_count.parse::<u64>() else {
                continue;
            };
            if count == 0 {
                continue;
            }
            if let (Some(&id1), Some(&id2)) = (
                word_to_id.get(&w1.to_ascii_lowercase()),
                word_to_id.get(&w2.to_ascii_lowercase()),
            ) {
                bigrams.insert(pack_bigram(id1, id2), count);
            }
        }

        let total_tokens = (sum_tokens as f64).max(TOTAL_CORPUS_TOKENS);
        Ok(Self {
            words,
            counts,
            word_to_id,
            deletes,
            bigrams,
            total_tokens,
        })
    }

    fn word_count(&self, word: &str) -> u64 {
        self.word_to_id
            .get(word)
            .map(|&id| self.counts[id as usize])
            .unwrap_or(0)
    }

    fn lookup_candidates(
        &self,
        query: &str,
        max_edits: usize,
        max_weighted_cost: f64,
        limit: usize,
    ) -> Vec<WordCandidate> {
        if query.is_empty() {
            return Vec::new();
        }
        let mut seen_ids = HashSet::new();
        let mut results = Vec::new();

        if let Some(&id) = self.word_to_id.get(query) {
            seen_ids.insert(id);
            results.push(WordCandidate {
                word: self.words[id as usize].clone(),
                word_id: Some(id),
                count: self.counts[id as usize],
                weighted_cost: 0.0,
                edits: 0,
                is_unknown: false,
            });
        }

        if max_edits > 0 {
            let clamped = max_edits.min(MAX_DICT_EDIT_DISTANCE);
            let query_prefix: String = query.chars().take(PREFIX_LENGTH).collect();
            let query_deletes = generate_deletes(&query_prefix, clamped);

            for del in query_deletes {
                let Some(ids) = self.deletes.get(&del) else {
                    continue;
                };
                for &id in ids {
                    if !seen_ids.insert(id) {
                        continue;
                    }
                    let candidate = &self.words[id as usize];
                    let len_diff = candidate.len().abs_diff(query.len());
                    if len_diff > clamped {
                        continue;
                    }
                    let edits = damerau_levenshtein(query, candidate);
                    if edits == 0 || edits > clamped {
                        continue;
                    }
                    let w_cost = weighted_distance(query, candidate);
                    if w_cost <= max_weighted_cost {
                        results.push(WordCandidate {
                            word: candidate.clone(),
                            word_id: Some(id),
                            count: self.counts[id as usize],
                            weighted_cost: w_cost,
                            edits,
                            is_unknown: false,
                        });
                    }
                }
            }
        }

        results.sort_by(|a, b| {
            a.edits
                .cmp(&b.edits)
                .then_with(|| {
                    if a.edits <= 1 {
                        a.weighted_cost
                            .partial_cmp(&b.weighted_cost)
                            .unwrap_or(std::cmp::Ordering::Equal)
                    } else {
                        std::cmp::Ordering::Equal
                    }
                })
                .then_with(|| b.count.cmp(&a.count))
        });
        results.truncate(limit);
        results
    }

    pub fn suggest_word(&self, original: &str, previous: &[PreviousGroup]) -> NlpResponse {
        let trimmed = original.trim();
        let lower = trimmed.to_ascii_lowercase();
        let word = cap_repeats(&lower);
        let mut suggestions = Vec::new();

        // Test suffixes of the open sentence, matching wordLookup.js fragment joining.
        let looks_like_fragment = |part: &str| {
            self.word_count(part) < 1_000_000
                || (part.len() == 1 && part != "a" && part != "i")
        };

        let mut repair: Option<(String, u64, usize)> = None;
        if is_ascii_alpha_word(&word) {
            let mut joined = word.clone();
            let mut has_fragment = looks_like_fragment(&word);
            for (offset, group) in previous.iter().rev().enumerate() {
                let raw_prev = if !group.detected.is_empty() {
                    &group.detected
                } else {
                    &group.text
                };
                let part = cap_repeats(&raw_prev.to_ascii_lowercase());
                if !is_ascii_alpha_word(&part) {
                    break;
                }
                joined = cap_repeats(&format!("{part}{joined}"));
                if joined.len() > 32 {
                    break;
                }
                has_fragment |= looks_like_fragment(&part);
                let joined_count = self.word_count(&joined);
                if has_fragment
                    && joined_count >= 1_000_000
                    && repair
                        .as_ref()
                        .map(|(_, best_count, _)| joined_count > *best_count)
                        .unwrap_or(true)
                {
                    repair = Some((joined.to_ascii_uppercase(), joined_count, offset + 1));
                }
            }
        }

        if let Some((text, _, join_previous)) = repair {
            suggestions.push(Suggestion {
                text,
                edits: 0,
                uncertain: false,
                join_previous: Some(join_previous),
            });
        } else if self.word_count(&word) > 0 {
            suggestions.push(Suggestion {
                text: word.to_ascii_uppercase(),
                edits: 0,
                uncertain: false,
                join_previous: None,
            });
        } else if is_ascii_alpha_word(&word) && word.len() >= 4 && word.len() <= 32 {
            let max_edits = if word.len() >= 6 { 2 } else { 2 };
            let max_w_cost = if word.len() >= 6 { 2.0 } else { 1.25 };
            let ranked = self.lookup_candidates(&word, max_edits, max_w_cost, 10);
            if !ranked.is_empty() {
                let best = &ranked[0];
                let runner_up = ranked.get(1);
                let uncertain = best.count < 1_000_000
                    || runner_up
                        .map(|other| (other.weighted_cost - best.weighted_cost) < 0.5)
                        .unwrap_or(false);
                for item in ranked {
                    suggestions.push(Suggestion {
                        text: item.word.to_ascii_uppercase(),
                        edits: item.edits,
                        uncertain,
                        join_previous: None,
                    });
                }
            } else {
                let (squeezed, collapsed) = squeeze_repeats(&word);
                if collapsed > 0 && squeezed.len() >= 2 {
                    let sq_max_edits = if squeezed.len() >= 3 { 1 } else { 0 };
                    let mut sq_ranked = self.lookup_candidates(&squeezed, sq_max_edits, 1.05, 24);
                    sq_ranked.retain(|item| {
                        squeezed.len() >= 4
                            || item.edits == 0
                            || squeeze_repeats(&item.word).0 == squeezed
                            || item.count >= 5_000_000
                    });
                    for item in &mut sq_ranked {
                        if squeeze_repeats(&item.word).0 == squeezed {
                            let extra = word.len().saturating_sub(item.word.len());
                            item.edits = 0;
                            item.weighted_cost = (extra as f64) * 0.20;
                        } else {
                            item.weighted_cost += (collapsed as f64) * 0.20;
                        }
                    }
                    sq_ranked.sort_by(|a, b| {
                        a.edits
                            .cmp(&b.edits)
                            .then_with(|| {
                                a.weighted_cost
                                    .partial_cmp(&b.weighted_cost)
                                    .unwrap_or(std::cmp::Ordering::Equal)
                            })
                            .then_with(|| b.count.cmp(&a.count))
                    });
                    if !sq_ranked.is_empty() {
                        let best = &sq_ranked[0];
                        let runner_up = sq_ranked.get(1);
                        let uncertain = best.count < 1_000_000
                            || runner_up
                                .map(|other| (other.weighted_cost - best.weighted_cost) < 0.5)
                                .unwrap_or(false);
                        for item in sq_ranked.into_iter().take(5) {
                            suggestions.push(Suggestion {
                                text: item.word.to_ascii_uppercase(),
                                edits: item.edits,
                                uncertain,
                                join_previous: None,
                            });
                        }
                    }
                }
                if suggestions.is_empty() && word.len() >= 6 {
                    // Fallback: exact segmentation if word is multiple words stuck together.
                    let seg = self.syntax_sentence(&word, &word.to_ascii_uppercase());
                    if let Some(first) = seg.suggestions.into_iter().next() {
                        if first.text.contains(' ') {
                            suggestions.push(first);
                        }
                    }
                }
            }
        }

        NlpResponse {
            original: original.to_string(),
            suggestions,
            engine: "symspell-wasm",
        }
    }

    fn transition_log_prob(&self, prev: Option<(u32, u64)>, curr_id: Option<u32>, curr_count: u64) -> f64 {
        let p_uni = ((curr_count as f64) + 0.5) / self.total_tokens;
        let Some((prev_id, prev_count)) = prev else {
            return p_uni.ln();
        };
        let Some(c_id) = curr_id else {
            return p_uni.ln() - 10.0;
        };
        let bigram_count = self
            .bigrams
            .get(&pack_bigram(prev_id, c_id))
            .copied()
            .unwrap_or(0);
        if bigram_count > 0 && prev_count > 0 {
            let p_bi = (bigram_count as f64) / (prev_count as f64);
            let interp = 0.85 * p_bi + 0.15 * p_uni;
            interp.ln() + 3.0
        } else {
            (0.15 * p_uni).ln()
        }
    }

    fn candidates_for_span(
        &self,
        raw_span: &str,
        pos: usize,
        end: usize,
        group_spans: &HashMap<(usize, usize), usize>,
        provisional: &[String],
    ) -> Vec<WordCandidate> {
        let span = cap_repeats(raw_span);
        let repeat_penalty = if span != raw_span { 0.05 } else { 0.0 };
        let len = span.len();
        let mut out = Vec::new();

        if len == 1 {
            if span == "a" || span == "i" {
                if let Some(&id) = self.word_to_id.get(&span) {
                    out.push(WordCandidate {
                        word: span.clone(),
                        word_id: Some(id),
                        count: self.counts[id as usize],
                        weighted_cost: repeat_penalty,
                        edits: 0,
                        is_unknown: false,
                    });
                }
            }
            return out;
        }

        if len == 2 {
            if let Some(&id) = self.word_to_id.get(&span) {
                let count = self.counts[id as usize];
                if count >= 1_000_000 {
                    out.push(WordCandidate {
                        word: span.clone(),
                        word_id: Some(id),
                        count,
                        weighted_cost: repeat_penalty,
                        edits: 0,
                        is_unknown: false,
                    });
                }
            }
        } else if len == 3 {
            let mut found = self.lookup_candidates(&span, 1, 1.05, 4);
            found.retain(|c| c.edits == 0 || c.count >= 10_000_000);
            for mut c in found {
                if is_valid_sentence_word(&c.word) {
                    c.weighted_cost += repeat_penalty;
                    out.push(c);
                }
            }
        } else {
            let max_edits = 2;
            let max_w_cost = if len >= 6 { 2.05 } else { 1.25 };
            let found = self.lookup_candidates(&span, max_edits, max_w_cost, 6);
            for mut c in found {
                if is_valid_sentence_word(&c.word) {
                    c.weighted_cost += repeat_penalty;
                    out.push(c);
                }
            }
        }

        // Also check repeat-squeezed form (e.g. WOORRLLDD -> WORLD) when camera
        // recognition emits accidental double letters across a word.
        let (squeezed, collapsed) = squeeze_repeats(&span);
        if collapsed > 0 && squeezed.len() >= 2 && !self.word_to_id.contains_key(&span) {
            let sq_max_edits = if squeezed.len() >= 3 { 1 } else { 0 };
            let sq_found = self.lookup_candidates(&squeezed, sq_max_edits, 1.05, 24);
            for mut c in sq_found {
                if squeezed.len() == 3
                    && c.edits > 0
                    && squeeze_repeats(&c.word).0 != squeezed
                    && c.count < 5_000_000
                {
                    continue;
                }
                if is_valid_sentence_word(&c.word) {
                    if squeeze_repeats(&c.word).0 == squeezed {
                        let extra = span.len().saturating_sub(c.word.len());
                        c.edits = 0;
                        c.weighted_cost = (extra as f64) * 0.20 + repeat_penalty;
                    } else {
                        c.weighted_cost += (collapsed as f64) * 0.20 + repeat_penalty;
                    }
                    if let Some(existing) = out.iter_mut().find(|existing| existing.word == c.word) {
                        if c.weighted_cost < existing.weighted_cost {
                            *existing = c;
                        }
                    } else {
                        out.push(c);
                    }
                }
            }
        }

        // Preserve strong word-stage provisional fixes if aligned to an exact pause group.
        if let Some(&group_idx) = group_spans.get(&(pos, end)) {
            if let Some(prov) = provisional.get(group_idx) {
                let prov_lower = prov.to_ascii_lowercase();
                if prov_lower.len() >= 3
                    && !out.iter().any(|c| c.word == prov_lower)
                    && self.word_to_id.contains_key(&prov_lower)
                {
                    let id = self.word_to_id[&prov_lower];
                    let w_cost = weighted_distance(&span, &prov_lower).min(1.5) + repeat_penalty;
                    out.push(WordCandidate {
                        word: prov_lower,
                        word_id: Some(id),
                        count: self.counts[id as usize],
                        weighted_cost: w_cost,
                        edits: 1,
                        is_unknown: false,
                    });
                }
            }

            // Fallback: keep exact pause group if unknown (e.g. names like QZXQ).
            if !out.iter().any(|c| c.word == span) {
                out.push(WordCandidate {
                    word: raw_span.to_string(),
                    word_id: None,
                    count: 1,
                    weighted_cost: 0.0,
                    edits: 0,
                    is_unknown: true,
                });
            }
        }

        out
    }

    pub fn syntax_sentence(&self, text: &str, fallback: &str) -> NlpResponse {
        let raw_groups: Vec<String> = text
            .split_whitespace()
            .map(|g| cap_repeats(&g.to_ascii_lowercase()))
            .filter(|g| !g.is_empty())
            .collect();
        let provisional: Vec<String> = fallback
            .split_whitespace()
            .map(|w| w.to_ascii_uppercase())
            .collect();

        if raw_groups.is_empty() {
            return NlpResponse {
                original: text.to_string(),
                suggestions: Vec::new(),
                engine: "symspell-wasm",
            };
        }

        let aligned = raw_groups.len() == provisional.len();
        let mut stream = String::new();
        let mut boundaries = HashSet::new();
        let mut strong_boundaries = HashSet::new();
        let mut group_spans = HashMap::new();
        boundaries.insert(0usize);

        let is_known_left = |w: &str| {
            is_valid_sentence_word(w) && self.word_count(w) >= 1_000_000
        };
        let is_known_right = |w: &str| {
            let count = self.word_count(w);
            (w.len() >= 4 && count > 0)
                || (w.len() >= 3 && count >= 1_000_000)
                || (w.len() == 2 && count >= 50_000_000)
        };

        for (idx, group) in raw_groups.iter().enumerate() {
            let start = stream.len();
            if idx > 0 && is_known_left(&raw_groups[idx - 1]) && is_known_right(group) {
                strong_boundaries.insert(start);
            }
            stream.push_str(group);
            let end = stream.len();
            boundaries.insert(end);
            group_spans.insert((start, end), idx);
        }

        let n = stream.len();
        let mut beam: Vec<Vec<BeamHypothesis>> = vec![Vec::new(); n + 1];
        beam[0].push(BeamHypothesis {
            score: 0.0,
            total_edits: 0,
            words: Vec::new(),
        });

        let prov_slice: &[String] = if aligned { &provisional } else { &[] };

        for pos in 0..n {
            if beam[pos].is_empty() {
                continue;
            }
            let current_hyps = beam[pos].clone();
            let max_end = (pos + MAX_WORD_LEN).min(n);

            for end in (pos + 1)..=max_end {
                let raw_span = &stream[pos..end];
                let candidates =
                    self.candidates_for_span(raw_span, pos, end, &group_spans, prov_slice);
                if candidates.is_empty() {
                    continue;
                }

                let start_at_pause = boundaries.contains(&pos);
                let end_at_pause = boundaries.contains(&end);
                let crosses_pause = ((pos + 1)..end).any(|mid| boundaries.contains(&mid));
                let crosses_strong_pause =
                    ((pos + 1)..end).any(|mid| strong_boundaries.contains(&mid));
                let pause_bonus = if start_at_pause && end_at_pause && !crosses_pause {
                    2.6
                } else if crosses_strong_pause {
                    -6.5
                } else if crosses_pause {
                    -0.4
                } else {
                    0.0
                };
                let span_is_exact_known = start_at_pause
                    && end_at_pause
                    && !crosses_pause
                    && raw_span.len() >= 4
                    && self.word_to_id.contains_key(raw_span);

                for hyp in &current_hyps {
                    let prev_word = hyp
                        .words
                        .last()
                        .and_then(|(_, id, count)| id.map(|wid| (wid, *count)));

                    for cand in &candidates {
                        let lm_score = if cand.is_unknown {
                            -26.0
                        } else {
                            self.transition_log_prob(prev_word, cand.word_id, cand.count)
                        };
                        let exact_anchor_penalty =
                            if span_is_exact_known && cand.edits > 0 {
                                6.0
                            } else {
                                0.0
                            };
                        let edit_penalty = cand.weighted_cost * 9.5 + exact_anchor_penalty;
                        let word_penalty = 2.2;
                        let new_score =
                            hyp.score + lm_score + pause_bonus - edit_penalty - word_penalty;

                        let mut new_words = hyp.words.clone();
                        new_words.push((cand.word.clone(), cand.word_id, cand.count));

                        beam[end].push(BeamHypothesis {
                            score: new_score,
                            total_edits: hyp.total_edits + cand.edits,
                            words: new_words,
                        });
                    }
                }
            }

            // Prune reachable future buckets gently only when needed, or keep top BEAM_WIDTH when reached.
            if pos + 1 <= n && beam[pos + 1].len() > BEAM_WIDTH {
                beam[pos + 1].sort_by(|a, b| {
                    b.score
                        .partial_cmp(&a.score)
                        .unwrap_or(std::cmp::Ordering::Equal)
                });
                dedup_hypotheses(&mut beam[pos + 1]);
                beam[pos + 1].truncate(BEAM_WIDTH);
            }
        }

        let mut finals = std::mem::take(&mut beam[n]);
        finals.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        dedup_hypotheses(&mut finals);

        if finals.is_empty() {
            return NlpResponse {
                original: text.to_string(),
                suggestions: vec![Suggestion {
                    text: fallback.to_string(),
                    edits: 0,
                    uncertain: true,
                    join_previous: None,
                }],
                engine: "symspell-wasm",
            };
        }

        let top1_score = finals[0].score;
        let uncertain = finals
            .get(1)
            .map(|second| (top1_score - second.score) < 1.5)
            .unwrap_or(false);

        let suggestions = finals
            .into_iter()
            .take(3)
            .map(|hyp| {
                let text = hyp
                    .words
                    .iter()
                    .map(|(w, _, _)| w.to_ascii_uppercase())
                    .collect::<Vec<_>>()
                    .join(" ");
                Suggestion {
                    text,
                    edits: hyp.total_edits,
                    uncertain,
                    join_previous: None,
                }
            })
            .collect();

        NlpResponse {
            original: text.to_string(),
            suggestions,
            engine: "symspell-wasm",
        }
    }
}

fn dedup_hypotheses(hyps: &mut Vec<BeamHypothesis>) {
    let mut seen = HashSet::new();
    hyps.retain(|h| {
        let key = h
            .words
            .iter()
            .map(|(w, _, _)| w.as_str())
            .collect::<Vec<_>>()
            .join(" ");
        seen.insert(key)
    });
}

#[wasm_bindgen]
pub struct SpellingSyntaxEngine {
    core: CoreEngine,
}

#[wasm_bindgen]
impl SpellingSyntaxEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(unigram_text: &str, bigram_text: &str) -> Result<SpellingSyntaxEngine, JsValue> {
        let core = CoreEngine::from_dictionaries(unigram_text, bigram_text)
            .map_err(|err| JsValue::from_str(&err))?;
        Ok(Self { core })
    }

    pub fn suggest_word(&self, text: &str, previous_json: &str) -> String {
        let previous: Vec<PreviousGroup> =
            serde_json::from_str(previous_json).unwrap_or_default();
        let response = self.core.suggest_word(text, &previous);
        serde_json::to_string(&response).unwrap_or_else(|_| {
            format!(
                "{{\"original\":{},\"suggestions\":[],\"engine\":\"symspell-wasm\"}}",
                serde_json::to_string(text).unwrap_or_else(|_| "\"\"".to_string())
            )
        })
    }

    pub fn syntax_sentence(&self, text: &str, fallback: &str) -> String {
        let response = self.core.syntax_sentence(text, fallback);
        serde_json::to_string(&response).unwrap_or_else(|_| {
            format!(
                "{{\"original\":{},\"suggestions\":[],\"engine\":\"symspell-wasm\"}}",
                serde_json::to_string(text).unwrap_or_else(|_| "\"\"".to_string())
            )
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::sync::OnceLock;

    fn load_engine() -> &'static CoreEngine {
        static ENGINE: OnceLock<CoreEngine> = OnceLock::new();
        ENGINE.get_or_init(|| {
            let dict_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("..")
                .join("public")
                .join("dictionary");
            let unigrams = std::fs::read_to_string(dict_dir.join("english-frequency.txt"))
                .expect("unigram dictionary missing");
            let bigrams = std::fs::read_to_string(dict_dir.join("english-bigrams.txt"))
                .expect("bigram dictionary missing");
            CoreEngine::from_dictionaries(&unigrams, &bigrams).expect("engine init failed")
        })
    }

    fn prev(words: &[&str]) -> Vec<PreviousGroup> {
        words
            .iter()
            .map(|w| PreviousGroup {
                detected: (*w).to_string(),
                text: (*w).to_string(),
            })
            .collect()
    }

    #[test]
    fn word_stage_corrections_and_fragments() {
        let engine = load_engine();
        assert_eq!(engine.suggest_word("HXLLO", &[]).suggestions[0].text, "HELLO");
        assert_eq!(engine.suggest_word("HLELO", &[]).suggestions[0].text, "HELLO");
        assert_eq!(
            engine.suggest_word("RECOGNITN", &[]).suggestions[0].text,
            "RECOGNITION"
        );
        assert_eq!(engine.suggest_word("HELLLO", &[]).suggestions[0].text, "HELLO");
        assert_eq!(
            engine.suggest_word("HELLOWORLD", &[]).suggestions[0].text,
            "HELLO WORLD"
        );
        let joined = engine.suggest_word("LO", &prev(&["HEL"]));
        assert_eq!(joined.suggestions[0].text, "HELLO");
        assert_eq!(joined.suggestions[0].join_previous, Some(1));
        assert_eq!(
            engine.suggest_word("ME", &prev(&["THE"])).suggestions[0].join_previous,
            None
        );
        assert!(engine.suggest_word("QZXQ", &[]).suggestions.is_empty());
    }

    #[test]
    fn sentence_preserves_existing_invariants() {
        let engine = load_engine();
        for (raw, prov, expected) in [
            ("HE L LO THERE", "HE L LO THERE", "HELLO THERE"),
            ("HE L LO THERE", "HE I LO THERE", "HELLO THERE"),
            ("H EL L O THERE", "H EL I O THERE", "HELLO THERE"),
            ("HEL LO", "HEL LO", "HELLO"),
            ("THE ME", "THE ME", "THE ME"),
            ("THE RAPIST", "THE RAPIST", "THE RAPIST"),
            ("IN SIDE", "IN SIDE", "IN SIDE"),
            ("GOOD BYE", "GOOD BYE", "GOOD BYE"),
            ("A WAY", "A WAY", "A WAY"),
            ("HELLOWORLD", "HELLOWORLD", "HELLO WORLD"),
            ("HEXLO THERE", "HELLO THERE", "HELLO THERE"),
            ("QZXQ", "QZXQ", "QZXQ"),
            ("HE L LO THERE QZXQ", "HE I LO THERE QZXQ", "HELLO THERE QZXQ"),
        ] {
            let res = engine.syntax_sentence(raw, prov);
            assert_eq!(
                res.suggestions[0].text, expected,
                "failed for raw='{raw}', prov='{prov}', got {:?}",
                res.suggestions
            );
        }
    }

    #[test]
    fn sentence_handles_joint_splitting_typos_and_grammar() {
        let engine = load_engine();
        for (raw, prov, expected) in [
            ("HE L LO T HE R E", "HE L LO T HE R E", "HELLO THERE"),
            ("HELLOWROLD", "HELLOWROLD", "HELLO WORLD"),
            ("IAMGOIGN", "IAMGOIGN", "I AM GOING"),
            ("HOWAREYOU", "HOWAREYOU", "HOW ARE YOU"),
            ("THANKYOU", "THANKYOU", "THANK YOU"),
            ("HXLLO FORM WORK", "HELLO FORM WORK", "HELLO FROM WORK"),
            ("HELLO W OORRLLDD", "HELLO W OORRLLDD", "HELLO WORLD"),
            ("HELLOWOORRLLDD", "HELLOWOORRLLDD", "HELLO WORLD"),
            ("HHEELLLLOO", "HHEELLLLOO", "HELLO"),
            ("BBOOOOKK", "BBOOOOKK", "BOOK"),
        ] {
            let res = engine.syntax_sentence(raw, prov);
            assert_eq!(
                res.suggestions[0].text, expected,
                "failed for raw='{raw}', got {:?}",
                res.suggestions
            );
        }
    }

    #[test]
    fn handshape_groups_prioritize_plausible_substitutions() {
        let custom = CoreEngine::from_dictionaries("sill 2000000\nfill 9000000\nhello 3000000", "")
            .expect("custom dict failed");
        let res = custom.suggest_word("AILL", &[]);
        assert_eq!(res.suggestions[0].text, "SILL");
        assert!(!res.suggestions[0].uncertain);
    }

    #[test]
    fn random_ambiguous_words_flag_uncertainty_without_hallucinating() {
        let engine = load_engine();
        let res = engine.suggest_word("BXD", &[]);
        // 3-letter words without context shouldn't force a random guess if uncertain or empty.
        assert!(res.suggestions.is_empty() || res.suggestions[0].uncertain);
    }
}
