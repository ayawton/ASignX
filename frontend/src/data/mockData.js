import { Hand, Hash, MessageCircle, Heart, Utensils, MapPin, Users, Languages, Sparkles, Trophy, Flame, Medal, Star } from 'lucide-react'

export const categories = [
  { title: 'Alphabet', icon: Hand, color: 'blue', description: 'Master A–Z handshapes', lessonId: 1 },
  { title: 'Numbers', icon: Hash, color: 'blue', description: 'Count confidently in ASL', lessonId: 3 },
  { title: 'Greetings', icon: MessageCircle, color: 'coral', description: 'Start every conversation', lessonId: 2 },
  { title: 'Basic Expressions', icon: Sparkles, color: 'violet', description: 'Everyday essential signs', lessonId: 3 },
  { title: 'Family', icon: Users, color: 'amber', description: 'Talk about loved ones', locked: true },
  { title: 'Food', icon: Utensils, color: 'blue', description: 'Meals, tastes, and requests', locked: true },
  { title: 'Places', icon: MapPin, color: 'blue', description: 'Navigate your world', locked: true },
  { title: 'Conversation', icon: Languages, color: 'coral', description: 'Bring it all together', locked: true },
]

export const courses = {
  Beginner: [
    { title: 'ASL Alphabet', description: 'Build your foundation with the 26 letters.', lessons: 8, progress: 62, id: 1 },
    { title: 'Numbers', description: 'Learn to sign numbers and simple quantities.', lessons: 6, progress: 20, id: 3 },
    { title: 'Greetings', description: 'Say hello and introduce yourself naturally.', lessons: 7, progress: 35, id: 2 },
    { title: 'Basic Expressions', description: 'Please, thank you, sorry, and more.', lessons: 9, progress: 0, id: 3 },
  ],
  Intermediate: [
    { title: 'Family', description: 'Describe family members and relationships.', lessons: 10, progress: 0, locked: true },
    { title: 'Food', description: 'Discuss meals, favorites, and ordering.', lessons: 9, progress: 0, locked: true },
    { title: 'Places', description: 'Ask for directions and describe locations.', lessons: 8, progress: 0, locked: true },
    { title: 'Everyday Conversation', description: 'Practice useful everyday exchanges.', lessons: 12, progress: 0, locked: true },
  ],
  Advanced: [
    { title: 'Sentences', description: 'Understand ASL grammar and structure.', lessons: 12, progress: 0, locked: true },
    { title: 'Conversations', description: 'Build fluency through guided dialogue.', lessons: 14, progress: 0, locked: true },
    { title: 'Situational Practice', description: 'Apply ASL in real-world scenarios.', lessons: 16, progress: 0, locked: true },
  ],
}

export const lessons = {
  1: { title: 'The ASL Alphabet', unit: 'Foundations', focus: 'A, B & C', meaning: 'Letter A', tip: 'Keep your thumb resting along the side of your closed fist.', next: 2 },
  2: { title: 'Friendly Greetings', unit: 'Greetings', focus: 'Hello', meaning: 'Hello', tip: 'Start with your hand near your forehead, then move it outward like a small salute.', prev: 1, next: 3 },
  3: { title: 'Everyday Essentials', unit: 'Basic Expressions', focus: 'Thank You', meaning: 'Thank you', tip: 'Touch your fingers near your chin, then move your hand forward and slightly down.', prev: 2 },
}

export const achievements = [
  { title: 'First Lesson', detail: 'Completed your first lesson', icon: Star, unlocked: true },
  { title: '5 Day Streak', detail: 'Practiced five days in a row', icon: Flame, unlocked: true },
  { title: '100 XP', detail: 'Earned your first 100 XP', icon: Trophy, unlocked: true },
  { title: 'Alphabet Master', detail: 'Master every letter', icon: Medal, unlocked: false },
  { title: 'Practice Champion', detail: 'Complete 20 practice rounds', icon: Heart, unlocked: false },
]

export const mastery = [
  { label: 'HELLO', value: 95 }, { label: 'THANK YOU', value: 90 }, { label: 'PLEASE', value: 65 },
  { label: 'SORRY', value: 52 }, { label: 'GOODBYE', value: 88 },
]
