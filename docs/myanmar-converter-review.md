# Burmese text converter: reader review sheet

**Status:** prepared 2026-11-26 for the go-live review in [implementation-plan.md](implementation-plan.md) §5F stage 4. Every Zawgyi and Win Innwa line below was produced by `@winmetta/myanmar-convert` from the Unicode line; nothing here was typed by hand.

## How to review

You need a Burmese reader who knows Pāḷi, and for Part B a computer with the **Zawgyi-One** and **Win Innwa** fonts (for example in Word).

- **Part A, the interface text.** Check that the Burmese interface text (a draft written by an AI) is correct, natural and uses the right terms. Fix wording in `apps/web/src/i18n/messages/my.json`, or note it here.
- **Part B, the conversions.** For each item, copy the Zawgyi line into a document set in Zawgyi-One, and the Win Innwa line into a document set in Win Innwa. Tick the box when it looks the same as the Unicode line, and write down what looks wrong (which letter, which item). Then paste each line into the converter with its source chosen (never Auto for Win Innwa) and check that the Unicode line comes back. A "Tool says" line marks an item where the package already knows it does not come back unchanged.

Known limits that are not errors: Win Innwa types wa (ဝ) and zero (၀) with the same key, and သြ and ဩ alike; Zawgyi and Win Innwa cannot show every Unicode text exactly.

## Part A: draft interface text

| Key | English | Burmese (draft) |
| --- | --- | --- |
| `converterIntro` | Convert Burmese text between Unicode, Zawgyi and Win Innwa. Your text stays in this browser: it is not sent anywhere or stored. | မြန်မာစာကို ယူနီကုဒ်၊ ဇော်ဂျီနှင့် ဝင်းအင်းဝ တို့ကြား ပြောင်းလဲပေးပါသည်။ သင့်စာသားသည် ဤဘရောက်ဇာထဲတွင်သာ ရှိပြီး မည်သည့်နေရာသို့မျှ မပို့ပါ၊ မသိမ်းဆည်းပါ။ |
| `converterFrom` | From | မှ |
| `converterTo` | To | သို့ |
| `converterAuto` | Auto (Unicode or Zawgyi) | အလိုအလျောက် (ယူနီကုဒ် သို့မဟုတ် ဇော်ဂျီ) |
| `converterUnicode` | Unicode | ယူနီကုဒ် |
| `converterZawgyi` | Zawgyi | ဇော်ဂျီ |
| `converterWinInnwa` | Win Innwa | ဝင်းအင်းဝ |
| `converterSwap` | Swap | အပြန်အလှန်ပြောင်းရန် |
| `converterSwapLabel` | Swap From and To, and use the result as the text | မှ နှင့် သို့ ကို အပြန်အလှန်ပြောင်းပြီး ရလဒ်ကို စာသားအဖြစ် အသုံးပြုရန် |
| `converterInput` | Text to convert | ပြောင်းလဲမည့် စာသား |
| `converterInputPlaceholder` | Paste or type text here | စာသားကို ဤနေရာတွင် ကူးထည့်ပါ သို့မဟုတ် ရိုက်ထည့်ပါ |
| `converterOutput` | Result | ရလဒ် |
| `converterCopy` | Copy | ကူးယူရန် |
| `converterCopyLabel` | Copy the result | ရလဒ်ကို ကူးယူရန် |
| `converterCopied` | Copied | ကူးယူပြီး |
| `converterClear` | Clear | ဖျက်ရန် |
| `converterLoading` | Loading the converter… | ပြောင်းလဲကိရိယာကို ဖွင့်နေပါသည်… |
| `converterLoadError` | The converter could not be loaded. Check your connection and try again. | ပြောင်းလဲကိရိယာကို မဖွင့်နိုင်ပါ။ အင်တာနက်ချိတ်ဆက်မှုကို စစ်ပြီး ထပ်ကြိုးစားပါ။ |
| `converterRetry` | Try again | ထပ်ကြိုးစားရန် |
| `converterNeedsJs` | The converter needs JavaScript to run in your browser. | ပြောင်းလဲကိရိယာကို သင့်ဘရောက်ဇာတွင် လုပ်ဆောင်ရန် JavaScript လိုအပ်ပါသည်။ |
| `converterFoundUnicode` | Looks like Unicode. | ယူနီကုဒ်နှင့် တူပါသည်။ |
| `converterFoundZawgyi` | Looks like Zawgyi. | ဇော်ဂျီနှင့် တူပါသည်။ |
| `converterNoBurmese` | No Burmese letters were found, so the text is shown as it is. | မြန်မာစာလုံး မတွေ့ပါ၊ ထို့ကြောင့် စာသားကို မူလအတိုင်း ပြထားပါသည်။ |
| `converterChoose` | Cannot tell whether this is Unicode or Zawgyi (Pāḷi words with stacked letters look like both). Choose what it is in From to convert it. | ဤစာသားသည် ယူနီကုဒ်လော ဇော်ဂျီလော မခွဲခြားနိုင်ပါ (ထပ်ဆင့်အက္ခရာပါသော ပါဠိစကားလုံးများသည် နှစ်မျိုးလုံးနှင့် တူနေတတ်ပါသည်)။ ပြောင်းလဲရန် "မှ" တွင် မည်သည့်စာလုံးအမျိုးအစား ဖြစ်ကြောင်း ရွေးပါ။ |
| `converterTooLong` | This text is too long. Convert up to 200,000 characters at a time. | ဤစာသားသည် ရှည်လွန်းပါသည်။ တစ်ကြိမ်လျှင် စာလုံး ၂၀၀,၀၀၀ အထိ ပြောင်းလဲနိုင်ပါသည်။ |
| `converterSame` | From and To are the same, so the text was not changed. | "မှ" နှင့် "သို့" တူနေသောကြောင့် စာသားကို မပြောင်းလဲပါ။ |
| `converterPreviewAs` | Show the text in the font | စာသားကို ပြသမည့် ဖောင့် |
| `converterLossy` | Zawgyi and Win Innwa cannot show every Unicode text exactly. Check the result before you use it. | ဇော်ဂျီနှင့် ဝင်းအင်းဝသည် ယူနီကုဒ်စာသားတိုင်းကို တိကျစွာ မဖော်ပြနိုင်ပါ။ အသုံးမပြုမီ ရလဒ်ကို စစ်ဆေးပါ။ |
| `converterNoteUnmapped` | These letters have no Win Innwa glyph and were kept as Unicode: {chars} | ဤစာလုံးများအတွက် ဝင်းအင်းဝ ဂလစ်ဖ် မရှိသဖြင့် ယူနီကုဒ်အတိုင်း ထားခဲ့ပါသည်- {chars} |
| `converterNoteLatin` | A Win Innwa font draws Latin letters and symbols as Burmese, so they will look wrong in the result. | ဝင်းအင်းဝဖောင့်သည် အင်္ဂလိပ်အက္ခရာနှင့် သင်္ကေတများကို မြန်မာစာလုံးအဖြစ် ပြသောကြောင့် ရလဒ်တွင် မှားယွင်း၍ ပေါ်ပါမည်။ |
| `converterNoteLooksUnicode` | This text already looks like Unicode. Converting it as Zawgyi may damage it. | ဤစာသားသည် ယူနီကုဒ်နှင့် တူနေပြီးသား ဖြစ်ပါသည်။ ဇော်ဂျီအဖြစ် ပြောင်းလျှင် ပျက်စီးနိုင်ပါသည်။ |
| `converterNoteLooksZawgyi` | This text has patterns that only Zawgyi uses. If it is Zawgyi, choose Zawgyi in From. | ဤစာသားတွင် ဇော်ဂျီသာ သုံးသော ပုံစံများ ပါနေပါသည်။ ဇော်ဂျီဖြစ်ပါက "မှ" တွင် ဇော်ဂျီကို ရွေးပါ။ |
| `converterBuiltWith` | Built with | အသုံးပြုထားသည်များ |
| `converterFontsNote` | Zawgyi text is shown in the Zawgyi-One font and Win Innwa text in the Win Innwa font. | ဇော်ဂျီစာသားကို ဇော်ဂျီဝမ်းဖောင့်ဖြင့်လည်းကောင်း၊ ဝင်းအင်းဝစာသားကို ဝင်းအင်းဝဖောင့်ဖြင့်လည်းကောင်း ပြပါသည်။ |

## Part B: conversions

### Pāḷi and Dhamma words (stacked consonants and kinzi)

**1.**

```text
Unicode:   ဓမ္မ
Zawgyi:    ဓမၼ
Win Innwa: "r®
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**2.**

```text
Unicode:   ဗုဒ္ဓ
Zawgyi:    ဗုဒၶ
Win Innwa: Ak'¨
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**3.**

```text
Unicode:   သင်္ဃ
Zawgyi:    သဃၤ
Win Innwa: oCF
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**4.**

```text
Unicode:   မင်္ဂလာ
Zawgyi:    မဂၤလာ
Win Innwa: r*Fvm
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**5.**

```text
Unicode:   နိဗ္ဗာန်
Zawgyi:    နိဗၺာန္
Win Innwa: edAÁmef
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**6.**

```text
Unicode:   ကမ္မဋ္ဌာန်း
Zawgyi:    ကမၼ႒ာန္း
Win Innwa: ur®|mef;
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**7.**

```text
Unicode:   သတိပဋ္ဌာန်
Zawgyi:    သတိပ႒ာန္
Win Innwa: owdy|mef
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**8.**

```text
Unicode:   ဝိပဿနာ
Zawgyi:    ဝိပႆနာ
Win Innwa: 0dyóem
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**9.**

```text
Unicode:   ပဋိစ္စသမုပ္ပါဒ်
Zawgyi:    ပဋိစၥသမုပၸါဒ္
Win Innwa: y#dpöorkyÜg'f
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**10.**

```text
Unicode:   အနိစ္စ
Zawgyi:    အနိစၥ
Win Innwa: tedpö
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**11.**

```text
Unicode:   ဒုက္ခ
Zawgyi:    ဒုကၡ
Win Innwa: 'ku©
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**12.**

```text
Unicode:   အနတ္တ
Zawgyi:    အနတၲ
Win Innwa: tewå
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**13.**

```text
Unicode:   သမထ
Zawgyi:    သမထ
Win Innwa: orx
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**14.**

```text
Unicode:   ဈာန်
Zawgyi:    ဈာန္
Win Innwa: psmef
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**15.**

```text
Unicode:   မေတ္တာ
Zawgyi:    ေမတၲာ
Win Innwa: arwåm
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**16.**

```text
Unicode:   ဒါန
Zawgyi:    ဒါန
Win Innwa: 'ge
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**17.**

```text
Unicode:   သီလ
Zawgyi:    သီလ
Win Innwa: oDv
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**18.**

```text
Unicode:   ပညာ
Zawgyi:    ပညာ
Win Innwa: ynm
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**19.**

```text
Unicode:   ပါရမီ
Zawgyi:    ပါရမီ
Win Innwa: yg&rD
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**20.**

```text
Unicode:   သံသရာ
Zawgyi:    သံသရာ
Win Innwa: oHo&m
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**21.**

```text
Unicode:   ကုသိုလ်
Zawgyi:    ကုသိုလ္
Win Innwa: ukodkvf
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**22.**

```text
Unicode:   အကုသိုလ်
Zawgyi:    အကုသိုလ္
Win Innwa: tukodkvf
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**23.**

```text
Unicode:   ပါတိမောက္ခ
Zawgyi:    ပါတိေမာကၡ
Win Innwa: ygwdarmu©
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**24.**

```text
Unicode:   နိဒ္ဒေသ
Zawgyi:    နိေဒၵသ
Win Innwa: eda'´o
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**25.**

```text
Unicode:   အစိန္တေယျ
Zawgyi:    အစိေႏၲယ်
Win Innwa: tpdaEå,s
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**26.**

```text
Unicode:   ဓမ္မစက္ကပ္ပဝတ္တနသုတ္တ
Zawgyi:    ဓမၼစကၠပၸဝတၲနသုတၲ
Win Innwa: "r®puúyÜ0wåeokwå
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**27.**

```text
Unicode:   ဝေဒနာ
Zawgyi:    ေဝဒနာ
Win Innwa: a0'em
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**28.**

```text
Unicode:   သညာ
Zawgyi:    သညာ
Win Innwa: onm
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**29.**

```text
Unicode:   သင်္ခါရ
Zawgyi:    သခၤါရ
Win Innwa: ocFg&
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**30.**

```text
Unicode:   ဝိညာဏ်
Zawgyi:    ဝိညာဏ္
Win Innwa: 0dnmPf
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

### Everyday words (medials, tall and short letters, vowels)

**31.**

```text
Unicode:   မြန်မာ
Zawgyi:    ျမန္မာ
Win Innwa: jrefrm
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**32.**

```text
Unicode:   ကြောင်း
Zawgyi:    ေၾကာင္း
Win Innwa: aMumif;
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**33.**

```text
Unicode:   ခြင်း
Zawgyi:    ျခင္း
Win Innwa: jcif;
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**34.**

```text
Unicode:   လေ့လာခြင်း
Zawgyi:    ေလ့လာျခင္း
Win Innwa: avhvmjcif;
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**35.**

```text
Unicode:   နှင့်
Zawgyi:    ႏွင့္
Win Innwa: ESifh
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**36.**

```text
Unicode:   ရှိ
Zawgyi:    ရိွ
Win Innwa: &Sd
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**37.**

```text
Unicode:   ကျွန်တော်
Zawgyi:    ကြၽန္ေတာ္
Win Innwa: uRefawmf
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**38.**

```text
Unicode:   မြှင့်
Zawgyi:    ျမႇင့္
Win Innwa: `rSifh
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**39.**

```text
Unicode:   ကြွ
Zawgyi:    ႂကြ
Win Innwa: <u
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**40.**

```text
Unicode:   ရှုံး
Zawgyi:    ရႈံး
Win Innwa: ½IH;
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**41.**

```text
Unicode:   ချုပ်
Zawgyi:    ခ်ဳပ္
Win Innwa: csKyf
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**42.**

```text
Unicode:   ပွဲ
Zawgyi:    ပြဲ
Win Innwa: yGJ
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**43.**

```text
Unicode:   စာအုပ်
Zawgyi:    စာအုပ္
Win Innwa: pmtkyf
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**44.**

```text
Unicode:   ဆရာတော်
Zawgyi:    ဆရာေတာ္
Win Innwa: q&mawmf
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**45.**

```text
Unicode:   ဘုန်းကြီး
Zawgyi:    ဘုန္းႀကီး
Win Innwa: bkef;BuD;
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**46.**

```text
Unicode:   ကျောင်း
Zawgyi:    ေက်ာင္း
Win Innwa: ausmif;
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**47.**

```text
Unicode:   တရားထိုင်ခြင်း
Zawgyi:    တရားထိုင္ျခင္း
Win Innwa: w&m;xdkifjcif;
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**48.**

```text
Unicode:   ရက်ပေါင်း
Zawgyi:    ရက္ေပါင္း
Win Innwa: &ufaygif;
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**49.**

```text
Unicode:   နေ့
Zawgyi:    ေန့
Win Innwa: aeY
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**50.**

```text
Unicode:   သွား
Zawgyi:    သြား
Win Innwa: oGm;
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**51.**

```text
Unicode:   ဖြစ်
Zawgyi:    ျဖစ္
Win Innwa: jzpf
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**52.**

```text
Unicode:   မဖြစ်ပါ
Zawgyi:    မျဖစ္ပါ
Win Innwa: rjzpfyg
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**53.**

```text
Unicode:   ကိုယ်ကျင့်တရား
Zawgyi:    ကိုယ္က်င့္တရား
Win Innwa: udk,fusifhw&m;
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**54.**

```text
Unicode:   ပြောင်းလဲ
Zawgyi:    ေျပာင္းလဲ
Win Innwa: ajymif;vJ
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

### Numbers and punctuation

**55.**

```text
Unicode:   ၁၂၃ ၄၅၆ ၇၈၉ ၀
Zawgyi:    ၁၂၃ ၄၅၆ ၇၈၉ ၀
Win Innwa: 123 456 789 0
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged
- Tool says: Zawgyi does not come back unchanged: ၁၂၃ ၄၅၆ ၇၈၉ ဝ; Win Innwa does not come back unchanged: ၁၂၃ ၄၅၆ ၇၈၉ ဝ

**56.**

```text
Unicode:   ၂၀၂၆ ခုနှစ်
Zawgyi:    ၂၀၂၆ ခုႏွစ္
Win Innwa: 2026 ckESpf
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**57.**

```text
Unicode:   အချိန် ၃၀ မိနစ်
Zawgyi:    အခ်ိန္ ၃၀ မိနစ္
Win Innwa: tcsdef 30 rdepf
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**58.**

```text
Unicode:   ပထမအခန်း။
Zawgyi:    ပထမအခန္း။
Win Innwa: yxrtcef;/
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**59.**

```text
Unicode:   အဖြေ၊ မေးခွန်း၊ ရလဒ်။
Zawgyi:    အေျဖ၊ ေမးခြန္း၊ ရလဒ္။
Win Innwa: tajz? ar;cGef;? &v'f/
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

### Short sentences

**60.**

```text
Unicode:   မင်္ဂလာပါ ဆရာတော်
Zawgyi:    မဂၤလာပါ ဆရာေတာ္
Win Innwa: r*Fvmyg q&mawmf
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**61.**

```text
Unicode:   တရားထိုင်ချိန် ၃၀ မိနစ်
Zawgyi:    တရားထိုင္ခ်ိန္ ၃၀ မိနစ္
Win Innwa: w&m;xdkifcsdef 30 rdepf
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**62.**

```text
Unicode:   ယနေ့ ညနေ ၇ နာရီတွင် စတင်မည်။
Zawgyi:    ယေန့ ညေန ၇ နာရီတြင္ စတင္မည္။
Win Innwa: ,aeY nae 7 em&DwGif pwifrnf/
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged

**63.**

```text
Unicode:   စာအုပ်ကို ဒေါင်းလုဒ်လုပ်ပါ။
Zawgyi:    စာအုပ္ကို ေဒါင္းလုဒ္လုပ္ပါ။
Win Innwa: pmtkyfudk a'gif;vk'fvkyfyg/
```

- [ ] Zawgyi looks right  - [ ] Win Innwa looks right  - [ ] both come back unchanged
