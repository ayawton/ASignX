from pathlib import Path
import re
from docx import Document
from docx.shared import Inches,Pt,RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
root=Path.cwd();md=(root/'docs/final/Data-Dictionary.md').read_text('utf8')
auth=[['id','uuid','PK','No','Managed','Authentication identity referenced by profiles.id.'],['email','varchar(255)','-','Yes','Managed','Email address used for email-based sign-in.'],['encrypted_password','varchar(255)','-','Yes','Managed','Password hash maintained by Auth; never a readable password.'],['email_confirmed_at','timestamptz','-','Yes','Managed','Time the email address was verified.'],['last_sign_in_at','timestamptz','-','Yes','Managed','Most recent successful sign-in time.'],['raw_user_meta_data','jsonb','-','Yes','Managed','User metadata such as the initial display name; not trusted for admin roles.'],['raw_app_meta_data','jsonb','-','Yes','Managed','Auth-managed application metadata, including identity-provider information.'],['created_at','timestamptz','-','Yes','Managed','Authentication record creation time.'],['updated_at','timestamptz','-','Yes','Managed','Authentication record modification time.']]
d=Document();sec=d.sections[0];sec.page_width=Inches(8.5);sec.page_height=Inches(11);sec.top_margin=sec.bottom_margin=Inches(.65);sec.left_margin=sec.right_margin=Inches(.55)
for name in ['Normal','Title','Heading 1','Heading 2']:
 s=d.styles[name];s.font.name='Calibri';s.font.color.rgb=RGBColor(0,0,0)
d.styles['Normal'].font.size=Pt(9);d.styles['Normal'].paragraph_format.space_after=Pt(5);d.styles['Title'].font.size=Pt(25);d.styles['Heading 1'].font.size=Pt(18);d.styles['Heading 2'].font.size=Pt(11)
d.core_properties.author='';d.core_properties.last_modified_by='';d.core_properties.comments='';d.core_properties.title='ASignX Data Dictionary'
d.add_paragraph('ASignX Data Dictionary','Title');d.add_paragraph('This data dictionary describes the 23 ASignX application tables and the Supabase Auth account fields relevant to registration, sign-in, email verification and profile ownership. Each table entry lists field types, keys, nullability, defaults, descriptions and validation rules.')
d.add_heading('Reading the dictionary',2)
for s in ['PK means primary key, FK means foreign key and UK means single-column unique. Multiple PK fields form one composite key. Composite foreign keys apply to the combined field values.','A dash in Default means no explicit column default. Managed means Supabase controls the external Auth field. Null indicates whether a field permits NULL. varchar sizes are character limits; numeric(6,5) has six total digits and five fractional digits.','All application tables enable row-level security. Public content reads require publication. Protected activity is scoped to its owner or authorized administrator. Authentication database roles are separate from the learner and admin application roles.','CASCADE removes dependent records when their parent is deleted. RESTRICT prevents deletion of a referenced parent. Foreign-key updates use NO ACTION.','Supabase manages auth.users. The Auth entry documents account fields relevant to ASignX rather than every internal Auth column. Its id is the stable relationship target; account email and credentials are not duplicated in profiles.','Lesson activity, hearts and XP persist in application tables. Standalone practice persistence, saved Live history and automatic achievement awarding are schema capabilities without complete application workflows.']:d.add_paragraph(s)
def heading(s):return s.replace('_',' ').replace('auth.users','Authentication Users').title()
def table(rows):
 t=d.add_table(rows=1,cols=6);t.style='Table Grid';t.autofit=False
 for i,w in enumerate([1.3,1.0,.55,.45,.8,3.3]):t.columns[i].width=Inches(w)
 for i,h in enumerate(['Field','SQL type','Key','Null','Default','Description']):t.rows[0].cells[i].text=h
 repeat=OxmlElement('w:tblHeader');t.rows[0]._tr.get_or_add_trPr().append(repeat)
 for row in rows:
  cells=t.add_row().cells
  for c,v in zip(cells,row):c.text=v.replace('—','-').replace('timestamp with time zone','timestamptz')
 for n,row in enumerate(t.rows):
  ns=OxmlElement('w:cantSplit');row._tr.get_or_add_trPr().append(ns)
  for c in row.cells:
   if n==0:
    sh=OxmlElement('w:shd');sh.set(qn('w:fill'),'E9EDF2');c._tc.get_or_add_tcPr().append(sh)
   for p in c.paragraphs:
    p.paragraph_format.space_after=Pt(3);p.paragraph_format.space_before=Pt(3)
    for r in p.runs:r.font.size=Pt(8);r.bold=n==0
 return t
d.add_page_break();d.add_heading('1 Authentication Users',1);d.add_paragraph('Table: auth.users');d.add_paragraph('Supabase-managed authentication identities and account information used by ASignX.');table(auth);d.add_heading('Relationships and account rules',2);d.add_paragraph('Primary key: id. profiles.id references auth.users.id with ON DELETE CASCADE. An Auth identity can have at most one application profile. Pending unconfirmed registrations do not receive a profile; confirmation triggers create the learner profile.');d.add_paragraph('Supabase Auth handles password hashing, email confirmation and sign-in. The managed Auth schema is not exposed through the public data API. User-supplied metadata must not assign the administrator role.');d.add_paragraph('Reference: https://supabase.com/docs/guides/auth/managing-user-data')
count=0
for match in re.finditer(r'^## ([a-z_]+)\n\n([\s\S]*?)(?=^## |\Z)',md,re.M):
 name,body=match.groups();count+=1;d.add_page_break();d.add_heading(str(count+1)+' '+heading(name),1);d.add_paragraph('Table: '+name);d.add_paragraph(body.split('\n\n')[0]);rows=[]
 for line in body.splitlines():
  if line.startswith('| ') and not line.startswith('| Field'):
   rows.append([v.strip() for v in line.strip('|').split('|')])
 table(rows)
 rest=body.split('### Keys and database constraints',1)[-1]
 for block in rest.strip().split('\n\n'):
  if block.startswith('### '):d.add_heading(block[4:],2)
  elif block.startswith('- '):
   d.add_heading('Keys and database constraints',2)
   for l in block.splitlines():d.add_paragraph(l.removeprefix('- '))
  else:d.add_paragraph(block)
assert count==23
foot=sec.footer.paragraphs[0];foot.text='ASignX Data Dictionary';foot.add_run('    ');field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');foot._p.append(field)
out=root/'docs/final/ASignX-Data-Dictionary-With-Auth.docx';d.save(out);print(out);print('24 table sections including Auth')
