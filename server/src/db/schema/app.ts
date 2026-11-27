import { sql } from 'drizzle-orm';
import {
    boolean, check, foreignKey, index, integer, pgPolicy, pgTable,
    primaryKey, numeric, text, timestamp, unique, uniqueIndex, uuid, varchar,
} from 'drizzle-orm/pg-core';
import { anonRole, authenticatedRole, authUsers } from 'drizzle-orm/supabase';

// Source: docs/final/Data-Dictionary.md. Supabase owns auth.users.
const id = () => uuid('id').defaultRandom().primaryKey();
const instant = (name: string) => timestamp(name, { withTimezone: true }).notNull().defaultNow();
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
    coverSize: integer('cover_size').notNull().default(100),
    coverAngle: integer('cover_angle').notNull().default(-18),
    coverDensity: integer('cover_density').notNull().default(5),
    coverWeight: varchar('cover_weight', { length: 3 }).notNull().default('600'),
    coverFont: varchar('cover_font', { length: 12 }).notNull().default('outfit'),
    coverText: varchar('cover_text', { length: 32 }).notNull().default(''),
    coverStyle: varchar('cover_style', { length: 12 }).notNull().default('plain'),
    coverTone: varchar('cover_tone', { length: 12 }).notNull().default('sky'),
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
    answerType: varchar('answer_type', { length: 16 }).notNull().default('choice'),
    prompt: text('prompt').notNull(), signId: uuid('sign_id').references(() => signs.id, { onDelete: 'restrict' }),
    sortOrder: integer('sort_order').notNull(),
}, t => [
    unique('exercises_lesson_order_unique').on(t.lessonId, t.sortOrder), index('exercises_sign_idx').on(t.signId),
    check('exercises_answer_type_valid', sql`${t.answerType} in ('choice','boolean','recognition')`),
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
    perfectedAt: timestamp('perfected_at', { withTimezone: true }),
    startedAt: instant('started_at'), completedAt: timestamp('completed_at', { withTimezone: true }),
}, t => [
    primaryKey({ columns: [t.enrollmentId, t.lessonId] }), index('lesson_progress_lesson_idx').on(t.lessonId),
    check('lesson_progress_completion_valid', sql`${t.completedAt} is null or ${t.completedAt} >= ${t.startedAt}`),
    pgPolicy('lesson_progress_read_own', { for: 'select', to: authenticatedRole, using: ownEnrollment(t.enrollmentId) }),
]).enableRLS();

export const exerciseAttempts = pgTable('exercise_attempts', {
    id: id(), enrollmentId: uuid('enrollment_id').notNull().references(() => enrollments.id, { onDelete: 'cascade' }),
    exerciseId: uuid('exercise_id').notNull().references(() => exercises.id, { onDelete: 'restrict' }),
    modelVersion: varchar('model_version', { length: 50 }),
    responseText: text('response_text'), recognitionConfidence: numeric('recognition_confidence', { precision: 6, scale: 5 }),
    selectedOptionId: uuid('selected_option_id'), isCorrect: boolean('is_correct').notNull(),
    attemptedAt: instant('attempted_at'),
}, t => [
    foreignKey({ columns: [t.exerciseId, t.selectedOptionId], foreignColumns: [exerciseOptions.exerciseId, exerciseOptions.id], name: 'exercise_attempts_selected_option_fk' }).onDelete('restrict'),
    index('exercise_attempts_enrollment_idx').on(t.enrollmentId),
    index('exercise_attempts_exercise_option_idx').on(t.exerciseId, t.selectedOptionId),
    pgPolicy('exercise_attempts_read_own', { for: 'select', to: authenticatedRole, using: ownEnrollment(t.enrollmentId) }),
]).enableRLS();

export const achievements = pgTable('achievements', {
    id: id(), code: varchar('code', { length: 50 }).notNull().unique(), name: varchar('name', { length: 100 }).notNull(),
    description: text('description').notNull(), metric: varchar('metric', { length: 25 }).notNull(), threshold: integer('threshold').notNull(),
    status: varchar('status', { length: 10 }).notNull().default('published'),
    icon: varchar('icon', { length: 10 }).notNull().default('trophy'),
    isSecret: boolean('is_secret').notNull().default(false),
    hint: varchar('hint', { length: 250 }).notNull().default(''),
}, t => [
    check('achievements_status_valid', sql`${t.status} in ('draft', 'published', 'retired')`),
    check('achievements_icon_valid', sql`${t.icon} in ('lesson', 'practice', 'xp', 'streak', 'trophy')`),
    check('achievements_code_nonblank', sql`length(btrim(${t.code})) > 0`),
    check('achievements_name_nonblank', sql`length(btrim(${t.name})) > 0`),
    check('achievements_description_nonblank', sql`length(btrim(${t.description})) > 0`),
    check('achievements_metric_valid', sql`${t.metric} in ('completed_lessons', 'successful_practices', 'total_xp', 'streak_days', 'perfect_lessons', 'completed_courses')`),
    check('achievements_threshold_positive', sql`${t.threshold} > 0`),
    pgPolicy('achievements_read', { for: 'select', to: [anonRole, authenticatedRole], using: sql`${t.status} = 'published' and not ${t.isSecret}` }),
]).enableRLS();

export const profileAchievements = pgTable('profile_achievements', {
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    achievementId: uuid('achievement_id').notNull().references(() => achievements.id, { onDelete: 'restrict' }), unlockedAt: instant('unlocked_at'),
}, t => [
    primaryKey({ columns: [t.userId, t.achievementId] }), index('profile_achievements_achievement_idx').on(t.achievementId),
    pgPolicy('profile_achievements_read_own', { for: 'select', to: authenticatedRole, using: owner(t.userId) }),
]).enableRLS();

export type Profile = typeof profiles.$inferSelect;
export type Sign = typeof signs.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type LessonProgress = typeof lessonProgress.$inferSelect;
export type ExerciseAttempt = typeof exerciseAttempts.$inferSelect;
export type Achievement = typeof achievements.$inferSelect;

export const learnerHearts = pgTable('learner_hearts', {
 userId: uuid('user_id').primaryKey().references(()=>profiles.id,{onDelete:'cascade'}),
 hearts: integer('hearts').notNull().default(3), regeneratedAt: instant('regenerated_at'),
},t=>[check('learner_hearts_range',sql`${t.hearts} between 0 and 3`),pgPolicy('learner_hearts_read_own',{for:'select',to:authenticatedRole,using:owner(t.userId)})]).enableRLS();
export const lessonRuns = pgTable('lesson_runs',{
 id:id(),enrollmentId:uuid('enrollment_id').notNull().references(()=>enrollments.id,{onDelete:'cascade'}),lessonId:uuid('lesson_id').notNull().references(()=>lessons.id,{onDelete:'restrict'}),
 replay:boolean('replay').notNull().default(false),startedAt:instant('started_at'),completedAt:timestamp('completed_at',{withTimezone:true}),perfect:boolean('perfect').notNull().default(false),
},t=>[uniqueIndex('lesson_runs_one_active').on(t.enrollmentId,t.lessonId).where(sql`${t.completedAt} is null`),pgPolicy('lesson_runs_read_own',{for:'select',to:authenticatedRole,using:ownEnrollment(t.enrollmentId)})]).enableRLS();
export const lessonRunQuestions = pgTable('lesson_run_questions',{
 runId:uuid('run_id').notNull().references(()=>lessonRuns.id,{onDelete:'cascade'}),exerciseId:uuid('exercise_id').notNull().references(()=>exercises.id,{onDelete:'restrict'}),xpValue:integer('xp_value').notNull(),sortOrder:integer('sort_order').notNull(),attemptId:uuid('attempt_id').references(()=>exerciseAttempts.id,{onDelete:'cascade'}),
},t=>[primaryKey({columns:[t.runId,t.exerciseId]}),unique('lesson_run_question_order').on(t.runId,t.sortOrder),check('lesson_run_question_xp_nonnegative',sql`${t.xpValue}>=0`)]).enableRLS();

export const xpAwards=pgTable('xp_awards',{
 id:id(),enrollmentId:uuid('enrollment_id').notNull().references(()=>enrollments.id,{onDelete:'cascade'}),lessonId:uuid('lesson_id').notNull().references(()=>lessons.id,{onDelete:'restrict'}),runId:uuid('run_id').references(()=>lessonRuns.id,{onDelete:'cascade'}),exerciseId:uuid('exercise_id').references(()=>exercises.id,{onDelete:'restrict'}),source:varchar('source',{length:20}).notNull(),amount:integer('amount').notNull(),awardedAt:instant('awarded_at'),
},t=>[check('xp_awards_nonnegative',sql`${t.amount}>=0`),check('xp_awards_source',sql`${t.source} in ('legacy','claim','run_import','first_question','replay','material')`),uniqueIndex('xp_awards_first_claim').on(t.enrollmentId,t.exerciseId).where(sql`${t.source} in ('claim','first_question')`),uniqueIndex('xp_awards_run_total').on(t.runId).where(sql`${t.source} in ('run_import','replay','material')`),index('xp_awards_enrollment_idx').on(t.enrollmentId),index('xp_awards_run_idx').on(t.runId)]).enableRLS();
export const practiceRounds=pgTable('practice_rounds',{
 id:id(),userId:uuid('user_id').notNull().references(()=>profiles.id,{onDelete:'cascade'}),completedAt:timestamp('completed_at',{withTimezone:true}),createdAt:instant('created_at'),heartRestored:boolean('heart_restored').notNull().default(false),
},t=>[uniqueIndex('practice_one_active').on(t.userId).where(sql`${t.completedAt} is null`)]).enableRLS();
export const practiceRoundQuestions=pgTable('practice_round_questions',{
 roundId:uuid('round_id').notNull().references(()=>practiceRounds.id,{onDelete:'cascade'}),questionIndex:integer('question_index').notNull(),exerciseId:uuid('exercise_id').notNull().references(()=>exercises.id,{onDelete:'restrict'}),
},t=>[primaryKey({columns:[t.roundId,t.questionIndex]}),check('practice_question_index',sql`${t.questionIndex} between 0 and 2`)]).enableRLS();
export const practiceSubmissions=pgTable('practice_submissions',{
 id:uuid('id').primaryKey(),roundId:uuid('round_id').notNull(),questionIndex:integer('question_index').notNull(),selectedOptionId:uuid('selected_option_id').notNull().references(()=>exerciseOptions.id,{onDelete:'restrict'}),isCorrect:boolean('is_correct').notNull(),submittedAt:instant('submitted_at'),
},t=>[foreignKey({columns:[t.roundId,t.questionIndex],foreignColumns:[practiceRoundQuestions.roundId,practiceRoundQuestions.questionIndex]}).onDelete('cascade'),uniqueIndex('practice_one_correct').on(t.roundId,t.questionIndex).where(sql`${t.isCorrect}`)]).enableRLS();
