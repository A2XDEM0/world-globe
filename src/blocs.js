// Blocs: drawn as an overlay layer, and usable as one-click selections for painting. Members are map units (the custom borders
// apply: Taiwan counts with China, Kosovo with Serbia, Greenland with Denmark). Where a bloc covers only part of a unit, `regions`
// lists the first-level regions it does cover and `except` the ones it leaves out. Membership as of November 2026.
// status: frozen (membership suspended by the member) or absent (a member that takes no part); both are still drawn.
// former: members that have left, with the year; listed, not drawn.
const BLOCS = [
  {
    id: 'eu', color: '#3f63ad', zh: '欧盟', en: 'EU', full: { zh: '欧洲联盟', en: 'European Union' }, years: '1993–',
    members: 'AUT BEL BGR HRV CYP CZE DNK EST FIN FRA DEU GRC HUN IRL ITA LVA LTU LUX MLT NLD POL PRT ROU SVK SVN ESP SWE'.split(' '),
    except: { DNK: ['GL-SM', 'GL-UO', 'GL-QA', 'GL-QE', 'GL-KU'] },
    former: { GBR: 2020 },
    note: { zh: '格陵兰属于丹麦，但不在欧盟内，图上不计入。', en: 'Greenland belongs to Denmark but is outside the EU, so it is left out.' }
  },
  {
    id: 'nato', color: '#2a7a86', zh: '北约', en: 'NATO', full: { zh: '北大西洋公约组织', en: 'North Atlantic Treaty Organization' }, years: '1949–',
    members: 'ALB BEL BGR CAN HRV CZE DNK EST FIN FRA DEU GRC HUN ISL ITA LVA LTU LUX MNE NLD MKD NOR POL PRT ROU SVK SVN ESP SWE TUR GBR USA'.split(' '),
    note: { zh: '32 个成员，最近加入的是芬兰（2023）和瑞典（2024）。', en: '32 members; the newest are Finland (2023) and Sweden (2024).' }
  },
  {
    id: 'warsaw', color: '#a8473f', zh: '华约', en: 'Warsaw Pact', full: { zh: '华沙条约组织', en: 'Warsaw Treaty Organization' }, years: '1955–1991', historical: true,
    // the Soviet Union as its 15 successor states, Czechoslovakia as Czechia and Slovakia, the GDR as the eastern German states
    members: 'RUS UKR BLR MDA EST LVA LTU GEO ARM AZE KAZ UZB TKM KGZ TJK POL CZE SVK HUN ROU BGR'.split(' '),
    regions: { DEU: ['DE-MV', 'DE-BB', 'DE-BE-E', 'DE-ST', 'DE-SN', 'DE-TH', 'DE-NI-AN'] },
    former: { ALB: 1968 },
    note: {
      zh: '已于 1991 年解散。按当年的地域显示：苏联取今天的 15 个继承国，捷克斯洛伐克取捷克和斯洛伐克，东德取德国东部各州（沿 1990 年的分界线）。',
      en: 'Dissolved in 1991. Shown by the territory of the time: the Soviet Union as its 15 successor states, Czechoslovakia as Czechia and Slovakia, the GDR as the eastern German states (along the 1990 border).'
    }
  },
  {
    id: 'csto', color: '#b06a2c', zh: '集安组织', en: 'CSTO', full: { zh: '集体安全条约组织', en: 'Collective Security Treaty Organization' }, years: '2002–',
    members: 'RUS BLR KAZ KGZ TJK ARM'.split(' '),
    status: { ARM: 'frozen' },
    former: { AZE: 1999, GEO: 1999, UZB: 2012 },
    note: { zh: '亚美尼亚自 2024 年 2 月冻结成员资格，至今没有正式退出。', en: 'Armenia froze its membership in February 2024 and has not formally left.' }
  },
  {
    id: 'asean', color: '#c49a2a', zh: '东盟', en: 'ASEAN', full: { zh: '东南亚国家联盟', en: 'Association of Southeast Asian Nations' }, years: '1967–',
    members: 'BRN KHM IDN LAO MYS MMR PHL SGP THA VNM TLS'.split(' '),
    note: { zh: '东帝汶于 2025 年 10 月成为第 11 个成员。', en: 'Timor-Leste became the 11th member in October 2025.' }
  },
  {
    id: 'opec', color: '#6c5aa6', zh: '欧佩克', en: 'OPEC', full: { zh: '石油输出国组织', en: 'Organization of the Petroleum Exporting Countries' }, years: '1960–',
    members: 'DZA COG GNQ GAB IRN IRQ KWT LBY NGA SAU VEN'.split(' '),
    former: { ARE: 2026, AGO: 2024, ECU: 2020, QAT: 2019, IDN: 2016 },
    note: { zh: '阿联酋于 2026 年 5 月退出，据多方报道；欧佩克官网一度仍列 12 个成员。', en: 'The UAE left in May 2026, according to several reports; OPEC’s own site still listed 12 members for a while.' }
  },
  {
    id: 'oas', color: '#3e8a4e', zh: '美洲国家组织', en: 'OAS', full: { zh: '美洲国家组织', en: 'Organization of American States' }, years: '1948–',
    members: 'ATG ARG BHS BRB BLZ BOL BRA CAN CHL COL CRI CUB DMA DOM ECU SLV GRD GTM GUY HTI HND JAM MEX PAN PRY PER KNA LCA VCT SUR TTO USA URY'.split(' '),
    status: { CUB: 'absent' },
    former: { NIC: 2023, VEN: 2019 },
    note: {
      zh: '古巴的资格 2009 年已恢复，但一直不参加。委内瑞拉 2019 年退出，存在争议；尼加拉瓜 2023 年退出。',
      en: 'Cuba’s suspension was lifted in 2009, but it takes no part. Venezuela left in 2019, which is disputed; Nicaragua left in 2023.'
    }
  },
  {
    id: 'nam', color: '#8a6a4a', zh: '不结盟运动', en: 'NAM', full: { zh: '不结盟运动', en: 'Non-Aligned Movement' }, years: '1961–',
    members: ('DZA AGO BEN BWA BFA BDI CMR CPV CAF TCD COM COD DJI EGY GNQ ERI SWZ ETH GAB GMB GHA GIN GNB CIV KEN LSO LBR LBY MDG MWI MLI MRT MUS MAR MOZ NAM NER NGA COG RWA STP SEN SYC SLE SOM ZAF SDS SDN TZA TGO TUN UGA ZMB ZWE ' +
      'ATG BHS BRB BLZ BOL COL CUB DMA DOM ECU GRD GTM GUY HTI HND JAM NIC PAN PER KNA LCA VCT SUR TTO VEN ' +
      'AFG BHR BGD BTN BRN KHM IND IDN IRN IRQ JOR KWT LAO LBN MYS MDV MNG MMR NPL PRK OMN PAK PSX PHL QAT SAU SGP LKA SYR THA TLS TKM ARE UZB VNM YEM ' +
      'AZE BLR FJI PNG VUT').split(' '),
    former: { CYP: 2004, MLT: 2004, ARG: 1991 },
    note: { zh: '120 个成员，名单据维基百科，没有逐一核对官方名单。', en: '120 members; the list follows Wikipedia and has not been checked line by line against an official roster.' }
  }
];
