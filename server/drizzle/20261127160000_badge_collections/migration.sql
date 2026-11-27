ALTER TABLE public.achievements ADD COLUMN is_secret boolean NOT NULL DEFAULT false,
    ADD COLUMN hint varchar(250) NOT NULL DEFAULT '';
ALTER TABLE public.achievements DROP CONSTRAINT achievements_metric_valid;
ALTER TABLE public.achievements ADD CONSTRAINT achievements_metric_valid
    CHECK (metric IN ('completed_lessons','successful_practices','total_xp','streak_days','perfect_lessons','completed_courses'));
ALTER POLICY achievements_read ON public.achievements USING (status='published' AND NOT is_secret);
CREATE OR REPLACE FUNCTION asignx_private.achievement_metrics(learner uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = '' AS $$
    SELECT jsonb_build_object(
        'completed_lessons', (SELECT count(*) FROM public.lesson_progress p JOIN public.enrollments e ON e.id=p.enrollment_id WHERE e.user_id=learner AND p.completed_at IS NOT NULL),
        'successful_practices', (SELECT count(*) FROM public.practice_rounds r WHERE r.user_id=learner AND r.completed_at IS NOT NULL AND asignx_private.practice_round_succeeded(r.id)),
        'total_xp', (SELECT coalesce(sum(a.amount),0) FROM public.xp_awards a JOIN public.enrollments e ON e.id=a.enrollment_id WHERE e.user_id=learner),
        'streak_days', asignx_private.current_streak(learner),
        'perfect_lessons', (SELECT count(DISTINCT r.lesson_id) FROM public.lesson_runs r JOIN public.enrollments e ON e.id=r.enrollment_id WHERE e.user_id=learner AND r.completed_at IS NOT NULL AND r.perfect),
        'completed_courses', (SELECT count(*) FROM public.enrollments e JOIN public.courses c ON c.id=e.course_id WHERE e.user_id=learner AND c.is_published
            AND EXISTS (SELECT 1 FROM public.lessons l WHERE l.course_id=c.id AND l.is_published)
            AND NOT EXISTS (SELECT 1 FROM public.lessons l WHERE l.course_id=c.id AND l.is_published AND NOT EXISTS
                (SELECT 1 FROM public.lesson_progress p WHERE p.enrollment_id=e.id AND p.lesson_id=l.id AND p.completed_at IS NOT NULL)))
    )
$$;


CREATE TRIGGER achievements_on_perfect_run AFTER UPDATE OF completed_at ON public.lesson_runs
    FOR EACH ROW WHEN (OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL AND NEW.perfect)
    EXECUTE FUNCTION asignx_private.award_for_activity();

INSERT INTO public.achievements(code,name,description,metric,threshold,status,icon,is_secret,hint) VALUES
('LESSONS_10','Lesson Explorer','Complete 10 different lessons.','completed_lessons',10,'published','lesson',false,''),
('LESSONS_25','Lesson Scholar','Complete 25 different lessons.','completed_lessons',25,'published','lesson',false,''),
('PRACTICE_15','Practice Pro','Finish 15 successful Practice rounds.','successful_practices',15,'published','practice',false,''),
('PRACTICE_50','Practice Master','Finish 50 successful Practice rounds.','successful_practices',50,'published','practice',false,''),
('XP_500','Building Momentum','Earn 500 XP.','total_xp',500,'published','xp',false,''),
('STREAK_7','A Week of Learning','Reach a seven-day learning streak.','streak_days',7,'published','streak',false,''),
('COURSE_1','Course Finisher','Complete all published lessons in a course.','completed_courses',1,'published','lesson',false,''),
('CLEAN_SWEEP','Clean Sweep','Finish perfect runs in three different lessons. Replays count.','perfect_lessons',3,'published','trophy',true,'A little precision goes a long way.'),
('PERFECT_10','Steady Hands','Finish perfect runs in 10 different lessons. Replays count.','perfect_lessons',10,'draft','trophy',true,'')
ON CONFLICT (code) DO NOTHING;
