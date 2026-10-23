from pathlib import Path
import re
import json
from collections import Counter
from html import escape
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, LongTable, TableStyle, KeepTogether, PageBreak
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path('C:/Users/Xyan/Downloads/Normalized-ERD.uml.txt')
QA = ROOT / '.preview/data-dictionary/from-erd'
QA.mkdir(parents=True, exist_ok=True)
PDF = ROOT / 'output/pdf/ASignX-Normalized-Data-Dictionary-Portrait.pdf'
MD = ROOT / 'docs/final/Data-Dictionary-From-Normalized-ERD.md'
RETAINED = ROOT / 'docs/final/Normalized-ERD.uml.txt'
source_bytes = SOURCE.read_bytes()
source = source_bytes.decode('utf-8-sig')

entities = []
for name, alias, body in re.findall(r'entity\s+"([^"]+)"\s+as\s+(\w+)\s*\{([^}]+)\}', source):
    fields = []
    for mandatory, field, dtype, flags in re.findall(
        r'^\s*(\*\s*)?(\w+)\s*:\s*([a-z][a-z0-9_]*(?:\(\d+(?:,\d+)?\))?)(?:\s*<<([^>]+)>>)?\s*$', body, re.M
    ):
        tags = [v.strip() for v in flags.split(',')] if flags else []
        fields.append({'name':field,'type':dtype,'tags':tags,'mandatory':bool(mandatory)})
    entities.append({'name':name,'alias':alias,'fields':fields})
by_alias = {t['alias']:t for t in entities}
edges = []
for parent, left, right, child, label in re.findall(r'^(\w+)\s+(\|\||\|o)--(\|\||o\{)\s+(\w+)\s*:\s*(.+)$', source, re.M):
    if parent == 'auth_users': fk = 'id'
    elif parent == 'profiles': fk = 'user_id'
    elif parent == 'signs' and child == 'practice_attempts': fk = 'predicted_sign_id' if 'predicted' in label else 'target_sign_id'
    else:
        fk = {'courses':'course_id','enrollments':'enrollment_id','lessons':'lesson_id','signs':'sign_id',
            'exercises':'exercise_id','exercise_options':'selected_option_id','achievements':'achievement_id',
            'model_versions':'model_version_id','recognition_sessions':'session_id'}[parent]
    field = next(f for f in by_alias[child]['fields'] if f['name']==fk)
    assert 'FK' in field['tags'], (child, fk)
    target = next(f['name'] for f in by_alias[parent]['fields'] if 'PK' in f['tags'])
    optional = left == '|o'
    assert ('nullable' in field['tags']) == optional, (parent, child, fk, field)
    edge = {'parent':parent,'child':child,'field':fk,'target':target,'optional':optional,
        'cardinality':'1 to 1' if right=='||' else ('0..1 to 0..many' if optional else '1 to 0..many'),'label':label.strip()}
    field['reference'] = edge
    edges.append(edge)

assert len(entities)==17 and len(edges)==25
assert sum(len(t['fields']) for t in entities if t['alias']!='auth_users')==87
assert all(('FK' in f['tags']) == ('reference' in f) for t in entities for f in t['fields'])
assert not any(f['name']=='is_correct' for t in entities if t['alias'] in ['exercise_attempts','practice_attempts'] for f in t['fields'])

purpose = {
    'auth_users':'Supabase-managed authentication entity. The ERD declares only its unique user identifier; additional Auth attributes are outside this dictionary.',
    'profiles':'Application profile associated with an authentication identity. Stores display name, application role, time zone, and profile timestamps.',
    'courses':'Learning course definitions and their publication status.',
    'enrollments':'Associates a learner profile with a course and records when the learner enrolled.',
    'lessons':'Ordered lesson material within a course, with a configured XP reward and publication status.',
    'lesson_progress':'Records a lesson within an enrollment, including its start, completion time, and earned XP.',
    'signs':'Shared ASL vocabulary, meanings, instructions, categories, and demonstration paths.',
    'lesson_signs':'Junction table connecting lessons and signs, with a display order for each linked sign.',
    'exercises':'Questions or practice prompts associated with lessons and, optionally, a sign.',
    'exercise_options':'Answer options belonging to an exercise, including the option correctness flag.',
    'exercise_attempts':'Learner submissions linking an enrollment, an exercise, and the selected answer option.',
    'achievements':'Achievement definitions, identified by a unique code, with a metric and target threshold.',
    'user_achievements':'Junction table recording which achievement a learner has unlocked and when it was unlocked.',
    'model_versions':'Model release definitions, artifact paths, and recognition confidence thresholds.',
    'practice_attempts':'Camera-practice outcomes linking a learner, target sign, optional prediction, and model version. Lesson context is optional.',
    'recognition_sessions':'Saved recognition sessions associated with a user profile, including session times and final text.',
    'recognition_results':'Ordered recognition results within a session, with an optional recognized sign, model version, confidence, and recognition time.',
}
descriptions = {
    'auth_users.id':'Unique identifier supplied by Supabase Auth.',
    'profiles.id':'Profile identifier shared with the linked authentication identity.',
    'display_name':'Name displayed for the user in the application.',
    'role':'Application role associated with the profile; permitted values are not specified in the ERD.',
    'timezone':'Time-zone identifier associated with the user profile.',
    'created_at':'Record creation timestamp.', 'updated_at':'Record modification timestamp.',
    'title':'Title displayed for the course or lesson.', 'description':'Description of the course or achievement.',
    'is_published':'Publication-status flag for the content.', 'enrolled_at':'Timestamp of enrollment in the course.',
    'content':'Instructional content of the lesson.', 'sort_order':'Relative display position within the parent record.',
    'xp_reward':'XP reward configured for the lesson.', 'started_at':'Timestamp when the lesson activity or recognition session started.',
    'completed_at':'Timestamp associated with lesson completion.', 'xp_earned':'XP recorded for this enrollment and lesson.',
    'gloss':'Unique vocabulary label identifying the sign.', 'meaning':'Meaning associated with the ASL sign.',
    'category':'Category label used to organize signs.', 'instructions':'Instructions for performing the sign.',
    'demo_path':'Path to a sign demonstration resource.', 'prompt':'Prompt displayed for the exercise.',
    'option_text':'Text displayed for an answer option.', 'is_correct':'Indicates whether this answer option is correct.',
    'attempted_at':'Timestamp of the exercise or camera-practice attempt.',
    'code':'Unique stable code identifying the achievement.', 'name':'Display name of the achievement.',
    'metric':'Metric used to assess achievement eligibility; allowed values are not specified in the ERD.',
    'threshold':'Target value associated with the achievement metric.', 'unlocked_at':'Timestamp when the user unlocked the achievement.',
    'version':'Unique label identifying the model version.', 'artifact_path':'Path to the model artifact.',
    'confidence_threshold':'Confidence threshold associated with the model version.',
    'confidence':'Confidence value recorded for a practice attempt or recognition result.',
    'ended_at':'Timestamp associated with the end of the recognition session.', 'final_text':'Final text associated with the recognition session.',
    'sequence_no':'Position of the result within the recognition session.', 'recognized_at':'Timestamp of the recognition result.',
}
fk_descriptions = {
    'user_id':'Identifies the learner or session owner.', 'course_id':'Identifies the associated course.',
    'lesson_id':'Identifies the associated lesson.', 'enrollment_id':'Identifies the learner course enrollment.',
    'sign_id':'Identifies the associated sign.', 'exercise_id':'Identifies the exercise.',
    'selected_option_id':'Identifies the selected exercise option.', 'achievement_id':'Identifies the awarded achievement.',
    'target_sign_id':'Identifies the sign the learner was asked to perform.',
    'predicted_sign_id':'Identifies the predicted sign, when one is available.',
    'model_version_id':'Identifies the model version used for the prediction.', 'session_id':'Identifies the parent recognition session.',
}

def nullability(f):
    if 'PK' in f['tags'] or f['mandatory']: return 'No'
    if 'nullable' in f['tags']: return 'Yes'
    if 'reference' in f: return 'Yes' if f['reference']['optional'] else 'No'
    return 'NS'

def describe(t,f):
    result = descriptions.get(t['alias']+'.'+f['name'], descriptions.get(f['name'], fk_descriptions.get(f['name'], 'Record identifier.')))
    if f['name']=='id' and t['alias'] not in ['profiles','auth_users']:
        result = 'Unique identifier of the '+t['alias'].replace('_',' ').rstrip('s')+' record.'
    if 'reference' in f:
        r=f['reference']
        result += ' References '+r['parent']+'.'+r['target']+'.'
    return result

notes = {
    'auth_users':['Managed authentication is external to the application tables. The ERD does not enumerate email, password, metadata, or other Supabase columns.'],
    'profiles':['The ERD specifies a mandatory one-to-one relationship between auth_users and profiles. The application must ensure each Auth identity receives its profile; the shared PK/FK prevents multiple profiles for one identity.'],
    'lesson_progress':['The pair (enrollment_id, lesson_id) is one composite primary key; neither component alone is the primary key.'],
    'lesson_signs':['The pair (lesson_id, sign_id) is one composite primary key. This junction resolves the many-to-many association between lessons and signs.'],
    'exercise_attempts':['This table has no is_correct attribute in the supplied ERD. The selected option is recorded; its correctness flag belongs to exercise_options.',
        'The ERD shows separate references to exercises and exercise_options. It does not specify a composite foreign key enforcing that the selected option belongs to the recorded exercise.'],
    'user_achievements':['The pair (user_id, achievement_id) is one composite primary key. This junction resolves the many-to-many association between profiles and achievements.'],
    'practice_attempts':['This table has no is_correct attribute in the supplied ERD. Correctness can be evaluated from the target, prediction, confidence, and referenced model threshold.',
        'The optional lesson reference allows a practice attempt without a lesson context. The predicted sign may also be NULL.'],
    'exercises':['sign_id is explicitly nullable and its parent relationship is optional.'],
    'recognition_results':['sign_id is explicitly nullable and its parent relationship is optional. The ERD does not mark (session_id, sequence_no) as unique.'],
}

table_data=[]
for t in entities:
    rows=[]
    for f in t['fields']:
        key=' '.join(k for k in ['PK','FK','UK'] if k in f['tags']) or '-'
        rows.append([f['name'],f['type'].upper(),key,nullability(f),'NS',describe(t,f)])
    pk=[f['name'] for f in t['fields'] if 'PK' in f['tags']]
    uk=[f['name'] for f in t['fields'] if 'UK' in f['tags']]
    constraints=['Primary key: ('+', '.join(pk)+').']
    constraints += ['Unique key: ('+f+').' for f in uk]
    for f in t['fields']:
        if 'reference' in f:
            r=f['reference']
            constraints.append('Foreign key: '+f['name']+' -> '+r['parent']+'.'+r['target']+'.')
    table_data.append({'name':t['name'],'purpose':purpose[t['alias']],'rows':rows,'constraints':constraints,'notes':notes.get(t['alias'],[])})

intro=[
    'This dictionary follows Normalized-ERD.uml.txt. It covers 16 application tables containing 87 attributes, plus the Supabase-managed auth_users reference containing its id attribute. The source declares 25 relationships.',
    'The table names, attributes, PostgreSQL types, explicit key markings, and relationship endpoints follow the supplied ERD. Additional fields from the application implementation are not included.',
]
legend=[
    'PK means primary key, FK means foreign key, and UK means explicitly declared unique key. Multiple PK fields in one table form a single composite primary key.',
    'NS means not specified in the ERD. All column defaults are NS because the source declares no default expressions. No UUID generator, timestamp default, role default, or XP default is assumed.',
    'Null? is No for a primary key, a starred mandatory attribute, or a foreign key with a mandatory parent relationship. It is Yes for an explicit nullable attribute or optional parent relationship. For other attributes, the SQL nullability is NS.',
    'VARCHAR(n) limits the value to n characters. NUMERIC(6,5) declares six total digits and five fractional digits. TIMESTAMPTZ is a timestamp with time zone. These types do not by themselves define domain checks or default values.',
    'The source does not specify ON DELETE or ON UPDATE actions, domain checks, indexes, triggers, or access policies. They are not presented as declared constraints in this dictionary.',
]
interpretation=[
    'auth_users is the name used in the supplied ERD for Supabase-managed authentication. Only its id is shown; no additional authentication fields are added here.',
    'The relation auth_users ||--|| profiles requires one profile per Auth identity and one Auth identity per profile in the conceptual design.',
    'The explicit unique attributes are signs.gloss, achievements.code, and model_versions.version. No additional composite uniqueness is declared.',
    'completed_at, ended_at, final_text, and descriptive fields have no explicit nullable annotation in the source. Their SQL nullability remains NS here; lifecycle-based optionality should be decided when implementing the schema.',
    'Business checks such as option/exercise consistency, lesson/enrollment course consistency, score ranges, quiz publication rules, XP award rules, and consent for saved history require separate implementation decisions.',
]
relationships=[]
for r in edges:
    relationships.append([r['parent'],r['child']+'.'+r['field'],r['cardinality'],'Optional' if r['optional'] else 'Required',r['label']])

def md_table(headers, rows):
    return '\n'.join(['| '+' | '.join(headers)+' |','|'+'|'.join(['---']*len(headers))+'|']+['| '+' | '.join(row)+' |' for row in rows])
headers=['Column name','Data type and size','Key','Null allowed','Default','Description']
md=['# ASignX Normalized Data Dictionary','', 'Source: [Normalized-ERD.uml.txt](Normalized-ERD.uml.txt)','', 'Updated 22 October 2026','']
for p in intro: md += [p,'']
md += ['## Reading the dictionary',''] + ['- '+p for p in legend]
for t in table_data:
    md += ['','## '+t['name'],'',t['purpose'],'',md_table(headers,t['rows']),'','**Declared keys and references**','']
    md += ['- '+p for p in t['constraints']]
    if t['notes']: md += ['','**Notes**','']+['- '+p for p in t['notes']]
md += ['','## Relationship reference','',md_table(['Parent','Child foreign key','Parent to child','Parent reference','Relationship label'],relationships)]
md += ['','## Details requiring implementation decisions','']+['- '+p for p in interpretation]
md += ['','## Source','', 'Normalized-ERD.uml.txt, supplied by the project owner. The file title identifies the design as Normalized ASL Learning and Recognition Database (3NF).','']
MD.write_text('\n'.join(md),encoding='utf-8')
RETAINED.write_bytes(source_bytes)

for name,file in [('Dictionary','arial.ttf'),('DictionaryBold','arialbd.ttf')]:
    pdfmetrics.registerFont(TTFont(name,'C:/Windows/Fonts/'+file))
pdfmetrics.registerFontFamily('Dictionary',normal='Dictionary',bold='DictionaryBold',italic='Dictionary',boldItalic='DictionaryBold')
styles={
    'title':ParagraphStyle('title',fontName='DictionaryBold',fontSize=21,leading=26,spaceAfter=12),
    'heading':ParagraphStyle('heading',fontName='DictionaryBold',fontSize=13,leading=17,spaceBefore=12,spaceAfter=6,keepWithNext=True),
    'label':ParagraphStyle('label',fontName='DictionaryBold',fontSize=9,leading=12,spaceBefore=6,spaceAfter=4,keepWithNext=True),
    'body':ParagraphStyle('body',fontName='Dictionary',fontSize=9,leading=13,spaceAfter=7),
    'note':ParagraphStyle('note',fontName='Dictionary',fontSize=8.5,leading=12,spaceAfter=4,leftIndent=8,firstLineIndent=-8),
    'cell':ParagraphStyle('cell',fontName='Dictionary',fontSize=8,leading=10.5,wordWrap='CJK'),
    'center':ParagraphStyle('center',fontName='Dictionary',fontSize=8,leading=10.5,alignment=TA_CENTER),
    'headcell':ParagraphStyle('headcell',fontName='DictionaryBold',fontSize=8,leading=10.5,textColor=colors.white,wordWrap='CJK'),
}
WIDTH,HEIGHT=A4
MARGIN=36
USABLE=WIDTH-2*MARGIN
def p(text,style='body'):
    return Paragraph(escape(text),styles[style])
def grid(headers, rows, widths, centered):
    body=[[p(s,'headcell') for s in headers]]
    body += [[p(s,'center' if i in centered else 'cell') for i,s in enumerate(row)] for row in rows]
    tbl=LongTable(body,colWidths=widths,repeatRows=1,hAlign='LEFT',spaceBefore=3,spaceAfter=7)
    tbl.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),colors.HexColor('#243C53')),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#F2F5F7')]),
        ('GRID',(0,0),(-1,-1),.4,colors.HexColor('#D9D9D9')),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),
        ('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5),
    ]))
    return tbl

story=[p('ASignX Normalized Data Dictionary','title'),p('Based on Normalized-ERD.uml.txt  |  Updated 22 October 2026')]
story += [p(s) for s in intro]
story += [p('Reading the dictionary','heading')]+[p('- '+s,'note') for s in legend]
field_widths=[94,78,35,29,40,USABLE-276]
for i,t in enumerate(table_data):
    heading=('Supabase managed users reference' if i==0 else str(i)+' '+t['name'].replace('_',' '))
    block=[p(heading,'heading'),p(t['purpose']),grid(['Column name','Data type','Key','Null?','Default','Description'],t['rows'],field_widths,{2,3,4}),p('Declared keys and references','label')]
    block += [p('- '+s,'note') for s in t['constraints']]
    if t['notes']: block += [p('Notes','label')]+[p('- '+s,'note') for s in t['notes']]
    story.append(KeepTogether(block))
story += [PageBreak(),p('Relationship reference','heading'),p('Parent to child is the cardinality shown in the ERD. Required or optional describes whether a child must reference a parent. Delete and update actions are not declared in the source.')]
story += [grid(['Parent','Child foreign key','Cardinality','Reference','Label'],relationships,[USABLE*w for w in [.19,.34,.14,.12,.21]],{2,3})]
story += [KeepTogether([p('Details requiring implementation decisions','heading')]+[p('- '+s,'note') for s in interpretation])]

def footer(canvas,doc):
    canvas.setFont('Dictionary',8)
    canvas.setFillColor(colors.HexColor('#53616D'))
    canvas.drawString(MARGIN,20,'ASignX  |  Data dictionary from supplied ERD')
    canvas.drawRightString(WIDTH-MARGIN,20,str(doc.page))

doc=SimpleDocTemplate(str(PDF),pagesize=A4,leftMargin=MARGIN,rightMargin=MARGIN,topMargin=30,bottomMargin=34,
    title='ASignX Normalized Data Dictionary',author='ASignX')
doc.build(story,onFirstPage=footer,onLaterPages=footer)
reader=PdfReader(PDF)
text='\n'.join(page.extract_text() for page in reader.pages)
for t in entities:
    for field in t['fields']:
        assert field['name'] in text, (t['alias'],field['name'])
assert all(float(page.mediabox.height)>float(page.mediabox.width) for page in reader.pages)
assert text.count('is_correct') <= 4
validation={'source':str(SOURCE),'application_tables':16,'application_attributes':87,'external_entities':1,
    'external_attributes':1,'relationships':len(edges),'declared_unique_attributes':sum('UK' in f['tags'] for t in entities for f in t['fields']),
    'explicitly_nullable_attributes':sum('nullable' in f['tags'] for t in entities for f in t['fields']),
    'pdf_pages':len(reader.pages),'all_pages_portrait':True,'matches_source_fields':True,'defaults_assumed':False,
    'delete_actions_assumed':False}
(QA/'validation.json').write_text(json.dumps(validation,indent=2),encoding='utf-8')
(QA/'parsed-erd.json').write_text(json.dumps({'entities':entities,'relationships':edges},indent=2),encoding='utf-8')
print(json.dumps({'pdf':str(PDF),'markdown':str(MD),**validation}))
