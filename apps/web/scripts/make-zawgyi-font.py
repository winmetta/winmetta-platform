# Rebuilds apps/web/public/fonts/zawgyi-one.woff2 from the supplied Zawgyi-One.ttf
# (docs/myanmar-converter.md §6, "Making zawgyi-one.woff2"). Run it in an empty folder:
#
#   cp /path/to/Zawgyi-One.ttf . && uvx --with brotli --from fonttools pyftsubset Zawgyi-One.ttf \
#     --unicodes=U+0020-007E,U+00A0-00FF,U+2000-206F,U+25CC,U+1000-109F,U+A9E0-A9FF,U+AA60-AA7F \
#     --layout-features='*' --glyph-names --flavor=woff2 --output-file=zawgyi-one.woff2
#   uvx --with brotli --from fonttools python /path/to/make-zawgyi-font.py
#
# Then copy zawgyi-one.woff2 to apps/web/public/fonts/ and raise the ?v= number in
# src/styles/burmese-fonts.css.
from fontTools.ttLib import TTFont, newTable
from fontTools.ttLib.tables import otTables as ot
def tables(cls, feats):
    tab=cls(); tab.Version=0x00010000
    sl=ot.ScriptList(); sr=ot.ScriptRecord(); sr.ScriptTag='DFLT'
    s=ot.Script(); ls=ot.LangSys(); ls.LookupOrder=None; ls.ReqFeatureIndex=0xFFFF
    ls.FeatureIndex=list(range(len(feats))); ls.FeatureCount=len(feats)
    s.DefaultLangSys=ls; s.LangSysRecord=[]; s.LangSysCount=0; sr.Script=s; sl.ScriptRecord=[sr]; sl.ScriptCount=1
    fl=ot.FeatureList(); fl.FeatureRecord=[]
    for ft in feats:
        fr=ot.FeatureRecord(); fr.FeatureTag=ft; f=ot.Feature(); f.FeatureParams=None; f.LookupListIndex=[]; f.LookupCount=0; fr.Feature=f; fl.FeatureRecord.append(fr)
    fl.FeatureCount=len(feats)
    ll=ot.LookupList(); ll.Lookup=[]; ll.LookupCount=0
    tab.ScriptList=sl; tab.FeatureList=fl; tab.LookupList=ll
    return tab
f=TTFont('zawgyi-one.woff2')
for name,cls,feats in (('GSUB',ot.GSUB,[]),('GPOS',ot.GPOS,['mark','mkmk'])):
    if name in f: del f[name]
    t=newTable(name); t.table=tables(cls,feats); f[name]=t
f.flavor='woff2'; f.save('zawgyi-one.woff2')
