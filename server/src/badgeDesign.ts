export const badgeTiers = ['starter', 'growing', 'advanced', 'mastery'];
const options = {
    border: ['single', 'double', 'dotted', 'laurel'],
    pattern: ['solid', 'rays', 'stars', 'diamonds'],
    decoration: ['none', 'ribbon', 'wings', 'stars'],
    finish: ['classic', 'soft', 'deep'],
};
export const metricIcons: Record<string, string> = {
    completed_lessons: 'lesson', successful_practices: 'practice', total_xp: 'xp',
    streak_days: 'streak', perfect_lessons: 'trophy', completed_courses: 'lesson',
};
export type BadgeDesign = { version: 1; border: string; pattern: string; decoration: string; finish: string };
export function validBadgeDesign(value: unknown): value is BadgeDesign | null {
    if (value === null) return true;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const design = value as Record<string, unknown>;
    return Object.keys(design).length === 5 && design.version === 1 && Object.entries(options).every(
        ([key, allowed]) => typeof design[key] === 'string' && allowed.includes(design[key] as string),
    );
}
