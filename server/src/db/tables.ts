// Kept independent of the connection so readiness checks and tooling share one list.
export const applicationTables = [
    'profiles', 'signs', 'courses', 'lessons', 'lesson_signs', 'exercises',
    'exercise_options', 'enrollments', 'lesson_progress', 'exercise_attempts',
    'learner_hearts', 'lesson_runs', 'lesson_run_questions', 'xp_awards', 'practice_rounds', 'practice_round_questions', 'practice_submissions',
    'achievements', 'profile_achievements',
] as const;
