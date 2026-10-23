import { sql } from 'drizzle-orm';
import {
    boolean, check, foreignKey, index, integer, pgPolicy, pgTable,
    primaryKey, numeric, text, timestamp, unique, uniqueIndex, uuid, varchar,
} from 'drizzle-orm/pg-core';
import { anonRole, authenticatedRole, authUsers } from 'drizzle-orm/supabase';

// Source: docs/final/Data-Dictionary.md. Supabase owns auth.users.
const id = () => uuid('id').defaultRandom().primaryKey();
const instant = (name: string) => timestamp(name, { withTimezone: true }).notNull().defaultNow();
const confidence = (name: string) => numeric(name, { precision: 6, scale: 5 }).notNull();
const owner = (column: unknown) => sql`${column} = (select auth.uid())`;
const ownEnrollment = (column: unknown) => sql`exists (select 1 from public.enrollments e where e.id = ${column} and e.user_id = (select auth.uid()))`;
const publishedLesson = (column: unknown) => sql`exists (select 1 from public.lessons l join public.courses c on c.id = l.course_id where l.id = ${column} and l.is_published and c.is_published)`;

export const profiles = pgTable('profiles', {
    id: uuid('id').primaryKey().references(() => authUsers.id, { onDelete: 'cascade' }),
    displayName: varchar('display_name', { length: 100 }).notNull(),
    role: varchar('role', { length: 10 }).notNull().default('learner'),
    timezone: varchar('timezone', { length: 64 }).notNull().default('UTC'),
    createdAt: instant('created_at'), updatedAt: instant('updated_at'),
}, t => [
    check('profiles_display_name_nonblank', sql`length(btrim(${t.displayName})) > 0`),
    check('profiles_role_valid', sql`${t.role} in ('learner', 'admin')`),
    pgPolicy('profiles_read_own', { for: 'select', to: authenticatedRole, using: owner(t.id) }),
    pgPolicy('profiles_update_own', { for: 'update', to: authenticatedRole, using: owner(t.id), withCheck: owner(t.id) }),
]).enableRLS();

export const signs = pgTable('signs', {
    id: id(), gloss: varchar('gloss', { length: 100 }).notNull().unique(),
    meaning: text('meaning').notNull(), category: varchar('category', { length: 60 }),
    instructions: text('instructions'), demoPath: text('demo_path'),
    isPublished: boolean('is_published').notNull().default(false), createdAt: instant('created_at'),
}, t => [
    check('signs_gloss_nonblank', sql`length(btrim(${t.gloss})) > 0`),
    check('signs_meaning_nonblank', sql`length(btrim(${t.meaning})) > 0`),
    pgPolicy('signs_read_published', { for: 'select', to: [anonRole, authenticatedRole], using: sql`${t.isPublished}` }),
]).enableRLS();

export const courses = pgTable('courses', {
    id: id(), title: varchar('title', { length: 150 }).notNull(), description: text('description'),
    isPublished: boolean('is_published').notNull().default(false), createdAt: instant('created_at'),
}, t => [
    check('courses_title_nonblank', sql`length(btrim(${t.title})) > 0`),
    pgPolicy('courses_read_published', { for: 'select', to: [anonRole, authenticatedRole], using: sql`${t.isPublished}` }),
]).enableRLS();

export const lessons = pgTable('lessons', {
    id: id(), courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'restrict' }),
    title: varchar('title', { length: 150 }).notNull(), content: text('content'),
    sortOrder: integer('sort_order').notNull(), xpReward: integer('xp_reward').notNull().default(10),
    isPublished: boolean('is_published').notNull().default(false),
}, t => [
    unique('lessons_course_order_unique').on(t.courseId, t.sortOrder),
    check('lessons_title_nonblank', sql`length(btrim(${t.title})) > 0`),
    check('lessons_sort_order_positive', sql`${t.sortOrder} > 0`),
    check('lessons_xp_nonnegative', sql`${t.xpReward} >= 0`),
    pgPolicy('lessons_read_published', { for: 'select', to: [anonRole, authenticatedRole], using: sql`${t.isPublished} and exists (select 1 from public.courses c where c.id = ${t.courseId} and c.is_published)` }),
]).enableRLS();

export const lessonSigns = pgTable('lesson_signs', {
    lessonId: uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
    signId: uuid('sign_id').notNull().references(() => signs.id, { onDelete: 'restrict' }),
    sortOrder: integer('sort_order').notNull(),
}, t => [
    primaryKey({ columns: [t.lessonId, t.signId] }), unique('lesson_signs_order_unique').on(t.lessonId, t.sortOrder),
    index('lesson_signs_sign_idx').on(t.signId), check('lesson_signs_sort_order_positive', sql`${t.sortOrder} > 0`),
    pgPolicy('lesson_signs_read_published', { for: 'select', to: [anonRole, authenticatedRole], using: sql`${publishedLesson(t.lessonId)} and exists (select 1 from public.signs s where s.id = ${t.signId} and s.is_published)` }),
]).enableRLS();

export const exercises = pgTable('exercises', {
    id: id(), lessonId: uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'restrict' }),
    prompt: text('prompt').notNull(), signId: uuid('sign_id').references(() => signs.id, { onDelete: 'restrict' }),
    sortOrder: integer('sort_order').notNull(),
}, t => [
    unique('exercises_lesson_order_unique').on(t.lessonId, t.sortOrder), index('exercises_sign_idx').on(t.signId),
    check('exercises_prompt_nonblank', sql`length(btrim(${t.prompt})) > 0`),
    check('exercises_sort_order_positive', sql`${t.sortOrder} > 0`),
    pgPolicy('exercises_read_published', { for: 'select', to: [anonRole, authenticatedRole], using: publishedLesson(t.lessonId) }),
]).enableRLS();

// Server-only: learner responses must omit is_correct.
export const exerciseOptions = pgTable('exercise_options', {
    id: id(), exerciseId: uuid('exercise_id').notNull().references(() => exercises.id, { onDelete: 'restrict' }),
    optionText: text('option_text').notNull(), isCorrect: boolean('is_correct').notNull().default(false),
    sortOrder: integer('sort_order').notNull(),
}, t => [
    unique('exercise_options_order_unique').on(t.exerciseId, t.sortOrder),
    unique('exercise_options_exercise_id_unique').on(t.exerciseId, t.id),
    uniqueIndex('exercise_options_one_correct_idx').on(t.exerciseId).where(sql`${t.isCorrect}`),
    check('exercise_options_text_nonblank', sql`length(btrim(${t.optionText})) > 0`),
    check('exercise_options_sort_order_positive', sql`${t.sortOrder} > 0`),
]).enableRLS();

export const enrollments = pgTable('enrollments', {
    id: id(), userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'restrict' }),
    enrolledAt: instant('enrolled_at'),
}, t => [
    unique('enrollments_user_course_unique').on(t.userId, t.courseId), index('enrollments_course_idx').on(t.courseId),
    pgPolicy('enrollments_read_own', { for: 'select', to: authenticatedRole, using: owner(t.userId) }),
]).enableRLS();

export const lessonProgress = pgTable('lesson_progress', {
    enrollmentId: uuid('enrollment_id').notNull().references(() => enrollments.id, { onDelete: 'cascade' }),
    lessonId: uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'restrict' }),
    startedAt: instant('started_at'), completedAt: timestamp('completed_at', { withTimezone: true }),
    xpEarned: integer('xp_earned').notNull().default(0),
}, t => [
    primaryKey({ columns: [t.enrollmentId, t.lessonId] }), index('lesson_progress_lesson_idx').on(t.lessonId),
    check('lesson_progress_xp_nonnegative', sql`${t.xpEarned} >= 0`),
    check('lesson_progress_completion_valid', sql`(${t.completedAt} is null and ${t.xpEarned} = 0) or (${t.completedAt} is not null and ${t.completedAt} >= ${t.startedAt})`),
    pgPolicy('lesson_progress_read_own', { for: 'select', to: authenticatedRole, using: ownEnrollment(t.enrollmentId) }),
]).enableRLS();

export const exerciseAttempts = pgTable('exercise_attempts', {
    id: id(), enrollmentId: uuid('enrollment_id').notNull().references(() => enrollments.id, { onDelete: 'cascade' }),
    exerciseId: uuid('exercise_id').notNull().references(() => exercises.id, { onDelete: 'restrict' }),
    selectedOptionId: uuid('selected_option_id').notNull(), isCorrect: boolean('is_correct').notNull(),
    attemptedAt: instant('attempted_at'),
}, t => [
    foreignKey({ columns: [t.exerciseId, t.selectedOptionId], foreignColumns: [exerciseOptions.exerciseId, exerciseOptions.id], name: 'exercise_attempts_selected_option_fk' }).onDelete('restrict'),
    index('exercise_attempts_enrollment_idx').on(t.enrollmentId),
    index('exercise_attempts_exercise_option_idx').on(t.exerciseId, t.selectedOptionId),
    pgPolicy('exercise_attempts_read_own', { for: 'select', to: authenticatedRole, using: ownEnrollment(t.enrollmentId) }),
]).enableRLS();

export const modelVersions = pgTable('model_versions', {
    id: id(), version: varchar('version', { length: 50 }).notNull().unique(),
    artifactPath: text('artifact_path').notNull(), confidenceThreshold: confidence('confidence_threshold').default('0.80000'),
    createdAt: instant('created_at'),
}, t => [
    check('model_versions_version_nonblank', sql`length(btrim(${t.version})) > 0`),
    check('model_versions_artifact_nonblank', sql`length(btrim(${t.artifactPath})) > 0`),
    check('model_versions_threshold_range', sql`${t.confidenceThreshold} between 0 and 1`),
]).enableRLS();

export const practiceAttempts = pgTable('practice_attempts', {
    id: id(), userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    lessonId: uuid('lesson_id').references(() => lessons.id, { onDelete: 'restrict' }),
    targetSignId: uuid('target_sign_id').notNull().references(() => signs.id, { onDelete: 'restrict' }),
    predictedSignId: uuid('predicted_sign_id').references(() => signs.id, { onDelete: 'restrict' }),
    modelVersionId: uuid('model_version_id').notNull().references(() => modelVersions.id, { onDelete: 'restrict' }),
    confidence: confidence('confidence'), isCorrect: boolean('is_correct').notNull(), attemptedAt: instant('attempted_at'),
}, t => [
    index('practice_attempts_user_time_idx').on(t.userId, t.attemptedAt), index('practice_attempts_lesson_idx').on(t.lessonId),
    index('practice_attempts_target_idx').on(t.targetSignId), index('practice_attempts_prediction_idx').on(t.predictedSignId),
    index('practice_attempts_model_idx').on(t.modelVersionId), check('practice_attempts_confidence_range', sql`${t.confidence} between 0 and 1`),
    pgPolicy('practice_attempts_read_own', { for: 'select', to: authenticatedRole, using: owner(t.userId) }),
]).enableRLS();

export const recognitionSessions = pgTable('recognition_sessions', {
    id: id(), userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    startedAt: instant('started_at'), endedAt: timestamp('ended_at', { withTimezone: true }), finalText: text('final_text'),
}, t => [
    index('recognition_sessions_user_time_idx').on(t.userId, t.startedAt),
    check('recognition_sessions_end_valid', sql`${t.endedAt} is null or ${t.endedAt} >= ${t.startedAt}`),
    check('recognition_sessions_text_valid', sql`${t.finalText} is null or ${t.endedAt} is not null`),
    pgPolicy('recognition_sessions_read_own', { for: 'select', to: authenticatedRole, using: owner(t.userId) }),
]).enableRLS();

export const recognitionResults = pgTable('recognition_results', {
    id: id(), sessionId: uuid('session_id').notNull().references(() => recognitionSessions.id, { onDelete: 'cascade' }),
    signId: uuid('sign_id').references(() => signs.id, { onDelete: 'restrict' }),
    modelVersionId: uuid('model_version_id').notNull().references(() => modelVersions.id, { onDelete: 'restrict' }),
    sequenceNo: integer('sequence_no').notNull(), confidence: confidence('confidence'), recognizedAt: instant('recognized_at'),
}, t => [
    unique('recognition_results_session_sequence_unique').on(t.sessionId, t.sequenceNo),
    index('recognition_results_sign_idx').on(t.signId), index('recognition_results_model_idx').on(t.modelVersionId),
    check('recognition_results_sequence_positive', sql`${t.sequenceNo} > 0`),
    check('recognition_results_confidence_range', sql`${t.confidence} between 0 and 1`),
    pgPolicy('recognition_results_read_own', { for: 'select', to: authenticatedRole, using: sql`exists (select 1 from public.recognition_sessions s where s.id = ${t.sessionId} and s.user_id = (select auth.uid()))` }),
]).enableRLS();

export const achievements = pgTable('achievements', {
    id: id(), code: varchar('code', { length: 50 }).notNull().unique(), name: varchar('name', { length: 100 }).notNull(),
    description: text('description').notNull(), metric: varchar('metric', { length: 25 }).notNull(), threshold: integer('threshold').notNull(),
}, t => [
    check('achievements_code_nonblank', sql`length(btrim(${t.code})) > 0`),
    check('achievements_name_nonblank', sql`length(btrim(${t.name})) > 0`),
    check('achievements_description_nonblank', sql`length(btrim(${t.description})) > 0`),
    check('achievements_metric_valid', sql`${t.metric} in ('completed_lessons', 'successful_practices', 'total_xp', 'streak_days')`),
    check('achievements_threshold_positive', sql`${t.threshold} > 0`),
    pgPolicy('achievements_read', { for: 'select', to: [anonRole, authenticatedRole], using: sql`true` }),
]).enableRLS();

export const userAchievements = pgTable('user_achievements', {
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    achievementId: uuid('achievement_id').notNull().references(() => achievements.id, { onDelete: 'restrict' }), unlockedAt: instant('unlocked_at'),
}, t => [
    primaryKey({ columns: [t.userId, t.achievementId] }), index('user_achievements_achievement_idx').on(t.achievementId),
    pgPolicy('user_achievements_read_own', { for: 'select', to: authenticatedRole, using: owner(t.userId) }),
]).enableRLS();

export type Profile = typeof profiles.$inferSelect;
export type Sign = typeof signs.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type LessonProgress = typeof lessonProgress.$inferSelect;
export type ExerciseAttempt = typeof exerciseAttempts.$inferSelect;
export type ModelVersion = typeof modelVersions.$inferSelect;
export type PracticeAttempt = typeof practiceAttempts.$inferSelect;
export type RecognitionSession = typeof recognitionSessions.$inferSelect;
export type RecognitionResult = typeof recognitionResults.$inferSelect;
export type Achievement = typeof achievements.$inferSelect;
