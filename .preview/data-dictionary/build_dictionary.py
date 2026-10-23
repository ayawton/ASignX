from pathlib import Path
import json
import re
import sys
from html import escape
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, LongTable, TableStyle, KeepTogether, PageBreak
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/final/Data-Dictionary.md'
PDF = ROOT / 'output/pdf/ASignX-Normalized-Data-Dictionary.pdf'
portrait_mode = '--portrait' in sys.argv
if portrait_mode:
    PDF = ROOT / 'output/pdf/ASignX-Normalized-Data-Dictionary-Portrait.pdf'
QA = ROOT / '.preview/data-dictionary'
DDL = json.loads((ROOT / 'server/drizzle/20261021161905_asignx_rules/snapshot.json').read_text(encoding='utf-8'))['ddl']
old = OUT.read_text(encoding='utf-8')
parts = re.split(r'^## ', old, flags=re.M)[1:]
descriptions = {}
purposes = {}
order = []
for part in parts:
    lines = part.splitlines()
    name = lines[0].strip()
    if not any(x['entityType'] == 'tables' and x['name'] == name for x in DDL):
        continue
    order.append(name)
    purposes[name] = next(x for x in lines[1:] if x.strip())
    descriptions[name] = {}
    for line in lines:
        if line.startswith('| ') and not line.startswith('| Column Name'):
            row = [v.strip() for v in line.strip('|').split('|')]
            if len(row) == 8:
                descriptions[name][row[0]] = row[-1]

def entities(kind, name):
    return [x for x in DDL if x['entityType'] == kind and x.get('table') == name]

rules = {
    'profiles': [
        'Database trigger validates timezone and refreshes updated_at on profile updates.',
        'An Auth signup trigger creates a learner profile. Existing Auth users are backfilled. The display name is taken from display_name or name metadata, falling back to ASL explorer; the application role is never copied from signup metadata.',
        'A signed-in learner may read their own profile and update only display_name and timezone. Role changes require the trusted backend.'
    ],
    'signs': ['Public readers see only published signs. demo_path is a Storage object path for curated learning media.'],
    'courses': ['Public readers see only published courses. A course can have no lessons or enrollments when first created.'],
    'lessons': [
        'Public readers see a lesson only when both the lesson and its parent course are published.',
        'A deferred publication trigger requires at least two choices and exactly one correct choice for each exercise. A lesson may have no exercises.',
        'The lesson identity and parent course cannot be changed by UPDATE. The configured XP is captured when the lesson is first completed.'
    ],
    'lesson_signs': ['The pair (lesson_id, sign_id) represents a many-to-many link. Public readers require a published lesson, parent course, and linked sign.'],
    'exercises': [
        'Each row is one multiple-choice question; the collection of questions in a lesson forms its quiz.',
        'The parent lesson cannot be reassigned. Definition edits are rejected while the lesson is published, after the exercise has attempts, or after its lesson has completed progress. Create a new content version for substantive changes.'
    ],
    'exercise_options': [
        'The partial unique index on exercise_id WHERE is_correct allows at most one correct option per exercise; lesson publication requires exactly one.',
        'Direct browser reads are denied. The backend exposes only id, exercise_id, option_text, and sort_order, excluding is_correct.',
        'Options follow the same published/used definition freeze as their exercise, and cannot be moved to another exercise.'
    ],
    'enrollments': [
        'One enrollment per learner and course. Learning activity reaches its owner through this row.',
        'Enrollment identity, learner, course, and enrollment time are immutable. Browser clients may read their own enrollments; creation is a backend operation.'
    ],
    'lesson_progress': [
        'A trigger verifies that the lesson belongs to the enrollment course. Progress identity and started_at are immutable.',
        'Before completion, xp_earned is forced to zero. Completion requires at least one correct attempt for every exercise and replaces supplied XP with lessons.xp_reward.',
        'Completed timestamps and XP are immutable. Completed progress cannot be independently deleted while its enrollment remains. Account/enrollment deletion may cascade.',
        'For a lesson without exercises, the backend must confirm that its material was viewed before requesting completion; the database does not observe viewing.'
    ],
    'exercise_attempts': [
        'The composite foreign key (exercise_id, selected_option_id) references exercise_options(exercise_id, id), ensuring the selected option belongs to this exercise.',
        'A trigger verifies course membership and derives is_correct from the stored answer option. Caller-supplied correctness is overwritten.',
        'Attempt rows cannot be updated. Reuse the submission UUID with conflict handling for a retried request.'
    ],
    'model_versions': [
        'All model-version updates are rejected. Register a new row when the version, artifact, or confidence threshold changes.',
        'artifact_path refers to a private model-artifacts Storage object. This table has no direct browser access.'
    ],
    'practice_attempts': [
        'For lesson practice, a trigger requires enrollment in the lesson course and target membership in lesson_signs. Standalone practice has no lesson_id.',
        'The database derives is_correct as prediction equals target and confidence meets the referenced model threshold; a missing prediction yields false.',
        'Updates are rejected. The backend supplies a trusted recognition result; storing it does not itself implement model inference.'
    ],
    'recognition_sessions': [
        'The backend creates a saved session only after explicit opt-in. Consent and authentication are application responsibilities; there is no consent column in this schema.',
        'Guest and unsaved sessions are transient. Only the owner may read saved history.',
        'When ended, a trigger composes final_text from sign meanings in sequence_no order, accepting only known signs meeting each result model threshold. With no accepted result, final_text is an empty string.',
        'The session identity, owner, and started_at are immutable; an ended session cannot be updated.'
    ],
    'recognition_results': [
        'The database rejects inserts into ended sessions and prevents UPDATE of stored results.',
        'sequence_no determines ordering. Unknown or low-confidence results remain recorded but do not contribute to final_text.',
        'The backend persists stabilized sign events, not camera frames. Only the owner of the parent session may read these rows.'
    ],
    'achievements': [
        'Supported metrics are completed_lessons, successful_practices, total_xp, and streak_days.',
        'Once any user has received the achievement, its definition cannot be updated. Use a new achievement for revised criteria.'
    ],
    'user_achievements': [
        'A trigger validates the referenced achievement metric and threshold before an award is inserted. The composite primary key prevents duplicate awards.',
        'Award records cannot be updated. Learners may read only their own awards.'
    ],
}

desc_changes = {
    ('profiles','id'): 'Same UUID as auth.users.id; supplied by the Auth profile-creation trigger, with no column default.',
    ('profiles','role'): 'ASignX authorization role: learner or admin. Separate from Supabase Auth database roles.',
    ('profiles','updated_at'): 'Profile modification time; refreshed by the validation trigger on UPDATE.',
    ('exercise_attempts','is_correct'): 'Database-trigger grading result, derived from the selected option on insert.',
    ('practice_attempts','is_correct'): 'Database-trigger result based on target match and the recorded model confidence threshold.',
    ('recognition_sessions','final_text'): 'Text assembled by the finalization trigger from accepted sign meanings; NULL while open.',
}

def type_parts(raw):
    if raw.startswith('varchar('): return 'VARCHAR', re.search(r'\d+', raw).group() + ' characters'
    return {'uuid':('UUID','128 bits'),'text':('TEXT','Variable'),'integer':('INTEGER','32 bits'),
            'boolean':('BOOLEAN','1 byte'),'timestamp with time zone':('TIMESTAMPTZ','Microseconds'),
            'numeric(6,5)':('NUMERIC','6 digits total, 5 decimal')}[raw]

def default(c):
    v = c['default']
    if v is None: return 'None' if c['notNull'] else 'NULL'
    if v == "'0.80000'": return '0.80000'
    return str(v)

headers = ['Column name','Data type','Size or precision','PK','FK reference','Null allowed','Default value','Description']
tables = []
for name in order:
    cols = entities('columns',name)
    pk = next(x for x in DDL if x['entityType']=='pks' and x['table']==name)['columns']
    fks = entities('fks',name)
    rows = []
    for c in cols:
        refs = []
        for fk in fks:
            if c['name'] in fk['columns']:
                target = fk['tableTo'] + '.' + fk['columnsTo'][fk['columns'].index(c['name'])]
                if fk['schemaTo'] != 'public': target = fk['schemaTo'] + '.' + target
                if len(fk['columns']) > 1: target += ' (composite)'
                refs.append(target)
        dtype, size = type_parts(c['type'])
        rows.append([c['name'],dtype,size,'Yes' if c['name'] in pk else '-', '; '.join(refs) or '-',
                     'No' if c['notNull'] else 'Yes',default(c),
                     desc_changes.get((name,c['name']),descriptions[name][c['name']])])
    constraints = ['Primary key: (' + ', '.join(pk) + ').']
    for u in entities('uniques', name):
        constraints.append('Unique: (' + ', '.join(u['columns']) + ').')
    for check in entities('checks', name):
        constraints.append('Check: ' + check['value'].replace('"','') + '.')
    for fk in fks:
        constraints.append('Foreign key: (' + ', '.join(fk['columns']) + ') -> ' + fk['schemaTo'] + '.' + fk['tableTo']
            + '(' + ', '.join(fk['columnsTo']) + '); ON DELETE ' + fk['onDelete'] + '; ON UPDATE ' + fk['onUpdate'] + '.')
    tables.append({'name':name,'purpose':purposes[name],'headers':headers,'rows':rows,'constraints':constraints,'rules':rules[name]})

auth_rows = [
    ['id','UUID','128 bits','Yes','-','No','Managed','Authentication identity referenced by profiles.id.'],
    ['email','VARCHAR','255 characters','-','-','Yes','Managed','Email used for email-based sign-in. Not duplicated in profiles.'],
    ['encrypted_password','VARCHAR','255 characters','-','-','Yes','Managed','Secure password hash for password-based accounts; not a readable password.'],
    ['last_sign_in_at','TIMESTAMPTZ','Microseconds','-','-','Yes','Managed','Most recent sign-in time, maintained by Supabase Auth.'],
    ['raw_user_meta_data','JSONB','Variable','-','-','Yes','Managed','User metadata; initial display name can seed profiles. Never trusted for assigning application roles.'],
    ['created_at','TIMESTAMPTZ','Microseconds','-','-','Yes','Managed','Authentication record creation time.'],
    ['updated_at','TIMESTAMPTZ','Microseconds','-','-','Yes','Managed','Authentication record modification time.'],
]
intro = [
    'This dictionary defines the 16 normalized application tables used by ASignX for ASign Learn and ASignLive. It lists all 89 application columns, their PostgreSQL types, required values, defaults, keys, relationships, and validation rules.',
    'Supabase Auth owns auth.users. A separate reference section documents the user attributes relevant to ASignX. It is not a seventeenth application table, and the application migrations do not recreate it.',
    'The tables separate account profiles, reusable learning content, enrollment activity, recognition outcomes, and achievement definitions. Junction tables represent many-to-many relationships. Total XP and streaks are derived from activity instead of being duplicated as profile balances.',
]
legend = [
    'PK means primary key; FK means foreign key. Multiple PK fields in one table form one composite primary key. A composite FK must be satisfied by the field combination, not by each field independently.',
    'None means there is no database column default. The caller must provide a required value unless a documented trigger derives it. NULL means the field is optional and has no explicit default. Managed means Supabase controls the external field default.',
    'VARCHAR sizes are character limits. NUMERIC(6,5) has six total digits and five fractional digits; score checks limit values to 0 through 1. TIMESTAMPTZ represents an instant; profile timezone is used separately for local learning dates.',
    'CASCADE removes dependent records with their parent. RESTRICT prevents deleting a referenced shared record. All application FK updates use NO ACTION. RLS means row-level security.',
]
auth_purpose = 'Selected Supabase-managed account attributes. These physical fields are reference information, not application-owned DDL. Supabase controls additional columns, indexes, and defaults; application relationships reference only its stable id primary key.'
auth_rules = [
    'One Auth identity has at most one application profile by key structure. Signup and backfill triggers create profiles with the same UUID.',
    'The encrypted_password field contains a password hash, despite its historical column name. Applications use Supabase Auth for password operations and do not copy it into profiles.',
    'Nullable email and password fields accommodate account types beyond email/password. ASignX email/password registration still requires those inputs through Auth.',
]
shared = [
    'All 16 application tables enable RLS. Public roles can read published learning content and achievement definitions. A lesson also requires a published parent course, and a lesson-sign link additionally requires a published sign.',
    'Authenticated browser users can read their own profile, enrollments, progress, attempts, practices, saved sessions and results, and earned achievements. The only browser profile writes are display_name and timezone. The backend validates caller identity, ownership, and administrator authorization for privileged operations.',
    'exercise_options and model_versions have no direct browser access. Safe answer fields are delivered through the backend; correctness and private model paths remain server-only.',
    'Guests may browse learning content and use transient practice and Live features without an application profile. Saving personal activity requires a registered account. Guest browser activity is not a trusted source of account XP, grading results, or awards.',
    'Total XP is SUM(lesson_progress.xp_earned) through the learner enrollments. Current streak uses distinct local dates with a completed lesson or successful practice; the consecutive run must end today or yesterday in profiles.timezone. A timezone change can change the derived date boundaries.',
    'Deleting an Auth user cascades to the profile and its dependent personal activity. Shared vocabulary, courses, lessons, models, and achievement definitions remain; referenced shared content should be unpublished or archived rather than removed.',
    'Saving Live history requires explicit user opt-in in the application. The schema stores stabilized events and finalized text, with no camera-frame or raw-video columns. Curated media and model files belong in Storage; database fields contain object paths.',
    'Backend services must verify viewing for no-quiz completion, validate recognition service output, enforce opt-in, and expose only authorized fields. Database constraints and triggers do not replace these application responsibilities.',
]
normalization = [
    'Identity and profile: authentication credentials remain in the managed Auth schema; application attributes depend on the profile UUID. Repeating email and password columns in application activity tables are avoided.',
    'Reusable content: signs, courses, lessons, exercises, and answer options have separate identities. lesson_signs resolves the many-to-many association between lessons and signs.',
    'Learner activity: enrollments resolves learners and courses; lesson_progress depends on an enrollment and lesson; exercise_attempts records individual submissions rather than repeating course or profile details.',
    'Prediction provenance: model_versions stores model artifact and threshold definitions once. Practice and recognition rows reference the actual model version used.',
    'Achievement definitions and awards: achievements defines criteria once; user_achievements resolves the many-to-many association and prevents duplicate awards.',
    'Historical snapshots: xp_earned and is_correct are intentional recorded outcomes. They preserve the result of an event rather than copying mutable profile totals. Unique order constraints and the option-pair foreign key enforce additional candidate keys and consistency.',
]
sources = [
    ('Application schema','../../server/src/db/schema/app.ts'),
    ('Generated table and constraint migration','../../server/drizzle/20261021161839_asignx_application/migration.sql'),
    ('Custom validation triggers and access grants','../../server/drizzle/20261021161905_asignx_rules/migration.sql'),
    ('Supabase account profile guidance','https://supabase.com/docs/guides/auth/managing-user-data'),
    ('Supabase password storage guidance','https://supabase.com/docs/guides/auth/password-security'),
    ('Supabase Auth user field definitions','https://github.com/supabase/auth/blob/master/migrations/00_init_auth_schema.up.sql'),
]

def md_table(head, rows):
    return '\n'.join(['| ' + ' | '.join(head) + ' |','|' + '|'.join(['---']*len(head)) + '|']
                     + ['| ' + ' | '.join(r) + ' |' for r in rows])

lines = ['# ASignX Normalized Data Dictionary','', 'Updated 22 October 2026','']
for p in intro: lines += [p,'']
lines += ['## Reading the dictionary','']
for p in legend: lines += ['- '+p]
lines += ['', '## Supabase Auth users reference','',auth_purpose,'',md_table(headers,auth_rows),'']
for p in auth_rules: lines += ['- '+p]
for t in tables:
    lines += ['', '## '+t['name'],'',t['purpose'],'',md_table(t['headers'],t['rows']),'','**Keys and constraints**','']
    lines += ['- '+p for p in t['constraints']]
    lines += ['', '**Validation and access rules**',''] + ['- '+p for p in t['rules']]
lines += ['', '## Relationship reference','', 'Each row describes a child-to-parent foreign key. A parent may have zero or many children unless marked one-to-zero-or-one. Optional means that the child FK may be NULL.','']
relationship_rows = []
for t in tables:
    for fk in entities('fks',t['name']):
        columns = {c['name']:c for c in entities('columns',t['name'])}
        optional = any(not columns[c]['notNull'] for c in fk['columns'])
        cardinality = 'One to zero or one' if t['name']=='profiles' else 'One to many'
        relationship_rows.append([fk['schemaTo']+'.'+fk['tableTo'],t['name']+'('+', '.join(fk['columns'])+')',
            cardinality,'Optional' if optional else 'Required',fk['onDelete']])
lines += [md_table(['Parent table','Child table and FK fields','Parent to child','Child reference','On delete'],relationship_rows),'','## Shared rules','']
lines += ['- '+p for p in shared]
lines += ['', '## Normalization notes',''] + ['- '+p for p in normalization]
lines += ['', '## References',''] + ['- ['+title+']('+url+')' for title,url in sources]
OUT.write_text('\n'.join(lines)+'\n',encoding='utf-8')

# Preserve the normalized content as data for audit and reproducible exports.
data = {'application_tables':tables,'auth_reference':auth_rows,'relationships':relationship_rows}
(QA/'dictionary-content.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
assert len(tables)==16 and sum(len(t['rows']) for t in tables)==89
assert len(relationship_rows)==25

PDF.parent.mkdir(parents=True,exist_ok=True)
regular = Path('C:/Windows/Fonts/arial.ttf')
bold = Path('C:/Windows/Fonts/arialbd.ttf')
pdfmetrics.registerFont(TTFont('Dictionary',str(regular)))
pdfmetrics.registerFont(TTFont('DictionaryBold',str(bold)))
pdfmetrics.registerFontFamily('Dictionary',normal='Dictionary',bold='DictionaryBold',italic='Dictionary',boldItalic='DictionaryBold')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='DocTitle',fontName='DictionaryBold',fontSize=22,leading=27,spaceAfter=12,textColor=colors.black))
styles.add(ParagraphStyle(name='Section',fontName='DictionaryBold',fontSize=14,leading=18,spaceBefore=13,spaceAfter=6,keepWithNext=True,textColor=colors.black))
styles.add(ParagraphStyle(name='Label',fontName='DictionaryBold',fontSize=9,leading=12,spaceBefore=6,spaceAfter=3,keepWithNext=True,textColor=colors.black))
styles.add(ParagraphStyle(name='Copy',fontName='Dictionary',fontSize=9,leading=13,spaceAfter=6))
styles.add(ParagraphStyle(name='Rule',fontName='Dictionary',fontSize=8.5,leading=12,leftIndent=9,firstLineIndent=-9,spaceAfter=3))
styles.add(ParagraphStyle(name='Cell',fontName='Dictionary',fontSize=8,leading=10.5,wordWrap='CJK'))
styles.add(ParagraphStyle(name='CenterCell',parent=styles['Cell'],alignment=TA_CENTER))
styles.add(ParagraphStyle(name='HeadCell',fontName='DictionaryBold',fontSize=8,leading=10.5,textColor=colors.white,wordWrap='CJK'))

def clean(s):
    return s.replace('→','->').replace('—','-').replace('–','-').replace('’',"'").replace('“','"').replace('”','"')
def para(s,style='Copy'):
    return Paragraph(escape(clean(s)),styles[style])
def table(head,rows,widths):
    if portrait_mode and len(head) == 8:
        # Preserve type lengths in one column and list FK targets below each
        # table, allowing the complete dictionary to stay readable in portrait.
        converted = []
        for row in rows:
            dtype = row[1]
            if dtype == 'VARCHAR': dtype += '(' + row[2].split()[0] + ')'
            elif dtype == 'NUMERIC': dtype += '(6,5)'
            key = ' '.join(k for k, include in [('PK', row[3] == 'Yes'), ('FK', row[4] != '-')] if include) or '-'
            converted.append([row[0], dtype, key, row[5], row[6], row[7]])
        head = ['Column name', 'Data type', 'Key', 'Null?', 'Default value', 'Description']
        rows = converted
        widths = [usable * w for w in [.18, .14, .06, .06, .16, .4]]
    centered = {3,5} if len(head)==8 else {2,3,4}
    if len(head) == 6: centered = {2,3}
    cells = [[para('Nullable' if s == 'Null allowed' else s,'HeadCell') for s in head]]
    cells += [[para(v,'CenterCell' if i in centered else 'Cell') for i,v in enumerate(row)] for row in rows]
    t=LongTable(cells,colWidths=widths,repeatRows=1,hAlign='LEFT',spaceBefore=3,spaceAfter=7)
    t.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),colors.HexColor('#243C53')),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#F2F5F7')]),
        ('GRID',(0,0),(-1,-1),.4,colors.HexColor('#D9D9D9')),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('LEFTPADDING',(0,0),(-1,-1),5 if portrait_mode else 6),('RIGHTPADDING',(0,0),(-1,-1),5 if portrait_mode else 6),
        ('TOPPADDING',(0,0),(-1,-1),4.5),('BOTTOMPADDING',(0,0),(-1,-1),4.5),
    ]))
    return t

width,height=A4 if portrait_mode else landscape(A4)
margin=36
usable=width-2*margin
widths=[usable*w for w in [.145,.095,.105,.035,.18,.06,.105,.275]]
# The fractions deliberately total one; fail rather than silently overrun a page.
widths=[w*usable/sum(widths) for w in widths]
story=[para('ASignX Normalized Data Dictionary','DocTitle'),para('Updated 22 October 2026')]
story += [para(p) for p in intro]
story += [para('Reading the dictionary','Section')]+[para(p) for p in legend]
if portrait_mode:
    story.append(para('The portrait field tables combine data type and length. Key identifies primary-key and foreign-key fields; exact foreign-key targets and delete rules appear under Keys and constraints below each table.'))
story += [KeepTogether([para('Supabase Auth users reference','Section'),para(auth_purpose),table(headers,auth_rows,widths)]
    + [para('- '+p,'Rule') for p in auth_rules])]
for i,t in enumerate(tables,1):
    block = [para(str(i)+' '+t['name'].replace('_',' '),'Section'),para(t['purpose']),table(t['headers'],t['rows'],widths),para('Keys and constraints','Label')]
    block += [para('- '+p,'Rule') for p in t['constraints']]
    block += [para('Validation and access rules','Label')]+[para('- '+p,'Rule') for p in t['rules']]
    story.append(KeepTogether(block))
story += [PageBreak(),para('Relationship reference','Section'),para('Parent tables may have zero or many children. Required or optional describes the child foreign key. The profile relationship allows at most one profile per Auth identity.')]
story += [table(['Parent table','Child table and FK fields','Parent to child','Child reference','On delete'],relationship_rows,[usable*w for w in [.2,.4,.15,.13,.12]])]
shared_block = [para('Shared rules','Section')]+[para('- '+p,'Rule') for p in shared]
story += [KeepTogether(shared_block)] if portrait_mode else shared_block
story += [KeepTogether([para('Normalization notes','Section')]+[para('- '+p,'Rule') for p in normalization])]
reference_block=[para('References','Section')]
for title,url in sources:
    if url.startswith('http'):
        reference_block.append(Paragraph(escape(title)+': <link href="'+url+'" color="#164A78">'+escape(url)+'</link>',styles['Copy']))
    else:
        reference_block.append(para(title+': '+url.removeprefix('../../')))
story.append(KeepTogether(reference_block))

def footer(canvas,doc):
    canvas.setFont('Dictionary',8)
    canvas.setFillColor(colors.HexColor('#53616D'))
    canvas.drawString(margin,20,'ASignX  |  Normalized database reference')
    canvas.drawRightString(width-margin,20,str(doc.page))

doc=SimpleDocTemplate(str(PDF),pagesize=(width,height),leftMargin=margin,rightMargin=margin,topMargin=30,bottomMargin=34,
    title='ASignX Normalized Data Dictionary',author='ASignX',allowSplitting=1)
doc.build(story,onFirstPage=footer,onLaterPages=footer)
reader=PdfReader(PDF)
text='\n'.join(p.extract_text() for p in reader.pages)
for t in tables:
    for row in t['rows']:
        assert row[0] in text, (t['name'],row[0])
assert 'encrypted_password' in text
(QA/'validation.json').write_text(json.dumps({'application_tables':len(tables),'application_columns':sum(len(t['rows']) for t in tables),
    'foreign_keys':len(relationship_rows),'auth_reference_fields':len(auth_rows),'pdf_pages':len(reader.pages),'all_column_names_in_pdf':True,
    'orientation':'portrait' if portrait_mode else 'landscape', 'all_pages_portrait': all(float(p.mediabox.height)>float(p.mediabox.width) for p in reader.pages)},indent=2))
print(json.dumps({'markdown':str(OUT),'pdf':str(PDF),'pages':len(reader.pages),'tables':16,'columns':89,'foreign_keys':25}))
