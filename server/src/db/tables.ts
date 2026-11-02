// Kept independent of the connection so readiness checks and tooling share one list.
export const applicationTables = [
    'profiles', 'signs', 'courses', 'lessons', 'lesson_signs', 'exercises',
    'exercise_options', 'enrollments', 'lesson_progress', 'exercise_attempts',
    'learner_hearts', 'lesson_runs', 'lesson_run_questions', 'xp_awards', 'heart_practice_rounds', 'heart_practice_questions', 'heart_practice_submissions',
    'model_versions', 'practice_attempts', 'recognition_sessions',
    'recognition_results', 'achievements', 'user_achievements',
] as const;
