const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Configuration
const OUT_DIR_SVG = path.join(__dirname, 'svg_masters');
const OUT_DIR_PNG = path.join(__dirname, '../src-tauri/resources/default_backgrounds');
const W = 1920;
const H = 1080;

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&amp;family=Noto+Sans+JP:wght@400;500;700&amp;display=swap');
  text { font-family: 'Inter', 'Noto Sans JP', sans-serif; fill: #4b5563; }
  .title { font-size: 32px; font-weight: 700; fill: #9ca3af; }
  .heading { font-size: 40px; font-weight: 600; fill: #6b7280; letter-spacing: 0.1em; }
  .label { font-size: 24px; font-weight: 500; fill: #9ca3af; }
  .small { font-size: 16px; fill: #d1d5db; }
  
  .bg { fill: #f9fafb; }
  .box { fill: none; stroke: #e5e7eb; stroke-width: 2; rx: 16; }
  .box-fill { fill: #ffffff; stroke: #e5e7eb; stroke-width: 2; rx: 16; }
  .line { stroke: #e5e7eb; stroke-width: 2; }
  .dashed { stroke: #e5e7eb; stroke-width: 2; stroke-dasharray: 12 12; }
  .arrow { fill: none; stroke: #e5e7eb; stroke-width: 4; marker-end: url(#arrowhead); }
`;

const SVG_WRAP = (content, title) => `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>${STYLES}</style>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#e5e7eb" />
    </marker>
  </defs>
  <rect class="bg" width="${W}" height="${H}" />
  <text x="60" y="80" class="title">${title}</text>
  ${content}
</svg>
`;

// Helper builders
const box = (x,y,w,h, label, fill=true) => `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" class="${fill ? 'box-fill' : 'box'}" />
  ${label ? `<text x="${x+40}" y="${y+60}" class="heading">${label}</text>` : ''}
`;

const line = (x1,y1,x2,y2, dashed=false) => `
  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${dashed ? 'dashed' : 'line'}" />
`;

// ============================================
// TEMPLATE DEFINITIONS
// ============================================

const templates = [
  // Folder: 01_Meeting
  {
    folder: '01_Meeting',
    filename: '01_Meeting_Agenda_4Block',
    title: '会議アジェンダ',
    svg: box(100, 150, 800, 400, '目的') + box(100, 580, 800, 400, '論点') +
         box(1020, 150, 800, 400, '議題') + box(1020, 580, 800, 400, '次アクション')
  },
  {
    folder: '01_Meeting',
    filename: '02_Meeting_Minutes_Canvas',
    title: '議事録キャンバス',
    svg: box(100, 150, 1720, 400, '決定事項') + 
         box(100, 580, 550, 400, '保留') + 
         box(680, 580, 550, 400, '宿題') + 
         box(1270, 580, 550, 400, 'メモ')
  },
  {
    folder: '01_Meeting',
    filename: '03_OneOnOne_Talk_Map',
    title: '1on1 トークマップ',
    svg: box(100, 150, 550, 350, '最近の状況') + 
         box(680, 150, 550, 350, '困りごと') + 
         box(1270, 150, 550, 350, '相談') +
         box(100, 530, 840, 450, '次回まで') +
         box(980, 530, 840, 450, 'メモ')
  },
  {
    folder: '01_Meeting',
    filename: '04_KPT_Retrospective',
    title: 'KPT ふりかえり',
    svg: box(100, 150, 550, 600, 'Keep') + 
         box(680, 150, 550, 600, 'Problem') + 
         box(1270, 150, 550, 600, 'Try') +
         box(100, 780, 1720, 200, '次にやること')
  },
  {
    folder: '01_Meeting',
    filename: '05_Decision_Review_Sheet',
    title: '意思決定レビュー',
    svg: box(100, 150, 350, 830, '選択肢') +
         box(480, 150, 350, 830, 'メリット') +
         box(860, 150, 350, 830, '懸念') +
         box(1240, 150, 250, 830, '判断') +
         box(1520, 150, 300, 830, '担当')
  },

  // Folder: 02_Business_Frameworks
  {
    folder: '02_Business_Frameworks',
    filename: '01_SWOT_Matrix',
    title: 'SWOT分析',
    svg: box(100, 150, 840, 400, '強み', false) + box(980, 150, 840, 400, '弱み', false) +
         box(100, 580, 840, 400, '機会', false) + box(980, 580, 840, 400, '脅威', false) +
         line(960, 100, 960, 1030) + line(50, 565, 1870, 565)
  },
  {
    folder: '02_Business_Frameworks',
    filename: '02_ThreeC_Analysis',
    title: '3C分析',
    svg: box(100, 150, 1720, 400, '顧客 (Customer)') + 
         box(100, 580, 840, 400, '自社 (Company)') + 
         box(980, 580, 840, 400, '競合 (Competitor)')
  },
  {
    folder: '02_Business_Frameworks',
    filename: '03_FourP_Framework',
    title: '4P整理',
    svg: box(100, 150, 840, 400, 'Product') + box(980, 150, 840, 400, 'Price') +
         box(100, 580, 840, 400, 'Place') + box(980, 580, 840, 400, 'Promotion')
  },
  {
    folder: '02_Business_Frameworks',
    filename: '04_STP_Map',
    title: 'STP整理',
    svg: box(100, 150, 1720, 250, 'Segmentation') +
         box(100, 430, 1720, 250, 'Targeting') +
         box(100, 710, 1720, 250, 'Positioning') +
         `<path d="M 960 400 L 960 425" class="arrow" />
          <path d="M 960 680 L 960 705" class="arrow" />`
  },
  {
    folder: '02_Business_Frameworks',
    filename: '05_Customer_Value_Map',
    title: '顧客価値マップ',
    svg: box(100, 150, 550, 400, '顧客の期待') + box(100, 580, 550, 400, '顧客課題') +
         box(680, 150, 550, 830, '提供価値') + 
         box(1270, 150, 550, 400, '差別化') + box(1270, 580, 550, 400, '検証メモ') +
         `<path d="M 650 565 L 675 565" class="arrow" />`
  },

  // Folder: 03_Brainstorm
  {
    folder: '03_Brainstorm',
    filename: '01_Radial_Idea_Map',
    title: '放射状アイデアマップ',
    svg: `<circle cx="960" cy="565" r="100" class="box-fill" />` +
         `<text x="940" y="575" class="label">テーマ</text>` +
         line(960, 465, 960, 150, true) + line(960, 665, 960, 980, true) +
         line(860, 565, 100, 565, true) + line(1060, 565, 1820, 565, true) +
         line(890, 495, 300, 250, true) + line(1030, 635, 1620, 880, true) +
         line(1030, 495, 1620, 250, true) + line(890, 635, 300, 880, true)
  },
  {
    folder: '03_Brainstorm',
    filename: '02_NineGrid_Ideation',
    title: '9マス発想',
    svg: box(150, 150, 520, 276) + box(700, 150, 520, 276) + box(1250, 150, 520, 276) +
         box(150, 456, 520, 276) + box(700, 456, 520, 276, '中心テーマ', true) + box(1250, 456, 520, 276) +
         box(150, 762, 520, 276) + box(700, 762, 520, 276) + box(1250, 762, 520, 276)
  },
  {
    folder: '03_Brainstorm',
    filename: '03_Angle_Cross_Matrix',
    title: '切り口マトリクス',
    svg: box(100, 150, 350, 200, 'テーマ') + box(480, 150, 1340, 200, '切り口A') +
         box(100, 380, 350, 600, '切り口B') + box(480, 380, 1340, 600, '発想欄')
  },
  {
    folder: '03_Brainstorm',
    filename: '04_Crazy8_Ideation',
    title: 'Crazy 8',
    svg: box(100, 150, 400, 400) + box(540, 150, 400, 400) + box(980, 150, 400, 400) + box(1420, 150, 400, 400) +
         box(100, 580, 400, 400) + box(540, 580, 400, 400) + box(980, 580, 400, 400) + box(1420, 580, 400, 400)
  },
  {
    folder: '03_Brainstorm',
    filename: '05_Diverge_Converge_Canvas',
    title: '発散と収束',
    svg: box(100, 150, 1000, 830, '発散') + box(1200, 150, 620, 830, '収束') +
         `<path d="M 1110 565 L 1180 565" class="arrow" />`
  },

  // Folder: 04_Thinking_Organize
  {
    folder: '04_Thinking_Organize',
    filename: '01_Issue_Tree',
    title: '論点ツリー',
    svg: box(100, 450, 350, 230, '大論点') +
         box(550, 150, 350, 230, '中論点') + box(550, 450, 350, 230, '中論点') + box(550, 750, 350, 230, '中論点') +
         box(1000, 150, 820, 230, '具体論点') + box(1000, 450, 820, 230, '具体論点') + box(1000, 750, 820, 230, '具体論点') +
         line(450, 565, 500, 565) + line(500, 265, 500, 865) +
         line(500, 265, 545, 265) + line(500, 565, 545, 565) + line(500, 865, 545, 865) +
         line(900, 265, 995, 265) + line(900, 565, 995, 565) + line(900, 865, 995, 865)
  },
  {
    folder: '04_Thinking_Organize',
    filename: '02_Cause_Effect_Map',
    title: '因果関係マップ',
    svg: box(100, 150, 500, 830, '要因') + box(710, 150, 500, 830, '原因') + box(1320, 150, 500, 830, '結果') +
         `<path d="M 610 565 L 695 565" class="arrow" /> <path d="M 1220 565 L 1305 565" class="arrow" />`
  },
  {
    folder: '04_Thinking_Organize',
    filename: '03_Priority_Matrix',
    title: '優先順位マトリクス',
    svg: `<text x="50" y="565" class="heading" transform="rotate(-90 50,565)" text-anchor="middle">重要度</text>` +
         `<text x="960" y="1050" class="heading" text-anchor="middle">緊急度</text>` +
         box(120, 120, 830, 430, '', false) + box(970, 120, 830, 430, '', false) +
         box(120, 570, 830, 430, '', false) + box(970, 570, 830, 430, '', false) +
         line(960, 80, 960, 1000) + line(100, 560, 1820, 560)
  },
  {
    folder: '04_Thinking_Organize',
    filename: '04_Fact_Emotion_Interpretation_Action',
    title: 'もやもや整理',
    svg: box(100, 150, 400, 830, '事実') + box(540, 150, 400, 830, '感情') +
         box(980, 150, 400, 830, '解釈') + box(1420, 150, 400, 830, '次の一歩')
  },
  {
    folder: '04_Thinking_Organize',
    filename: '05_Opinion_Organize_Canvas',
    title: '意見整理',
    svg: box(100, 150, 840, 400, '賛成') + box(980, 150, 840, 400, '仮説') +
         box(100, 580, 840, 400, '反対') + box(980, 580, 840, 400, '不明点')
  },

  // Folder: 05_Study_Research
  {
    folder: '05_Study_Research',
    filename: '01_Reading_Note_Sheet',
    title: '読書ノート',
    svg: box(100, 150, 1720, 200, '要点') +
         box(100, 380, 840, 600, '引用') + box(980, 380, 840, 300, '疑問') +
         box(980, 710, 840, 270, '自分の考え')
  },
  {
    folder: '05_Study_Research',
    filename: '02_Source_Comparison_Matrix',
    title: '資料比較',
    svg: box(100, 150, 840, 400, '資料A') + box(980, 150, 840, 400, '資料B') +
         box(100, 580, 840, 400, '差分') + box(980, 580, 840, 400, '共通点')
  },
  {
    folder: '05_Study_Research',
    filename: '03_Timeline_Research',
    title: '時系列整理',
    svg: line(100, 565, 1820, 565) + 
         `<circle cx="100" cy="565" r="8" fill="#d1d5db" />` +
         `<circle cx="1820" cy="565" r="8" fill="#d1d5db" />` +
         line(440, 535, 440, 595) + line(780, 535, 780, 595) +
         line(1120, 535, 1120, 595) + line(1460, 535, 1460, 595)
  },
  {
    folder: '05_Study_Research',
    filename: '04_Hypothesis_Test_Canvas',
    title: '仮説検証',
    svg: box(100, 150, 1720, 200, '仮説') + 
         box(100, 380, 550, 600, '根拠') + 
         box(680, 380, 550, 600, '反証') + 
         box(1270, 380, 550, 600, '次に調べること')
  },
  {
    folder: '05_Study_Research',
    filename: '05_Learning_Integration_Map',
    title: '学びの統合',
    svg: box(760, 365, 400, 400, '中心テーマ', true) +
         box(100, 150, 500, 300, '知識') + box(1320, 150, 500, 300, '気づき') +
         box(100, 680, 500, 300, 'つながり') + box(1320, 680, 500, 300, '応用') +
         line(610, 340, 750, 440, true) + line(1310, 340, 1170, 440, true) +
         line(610, 790, 750, 690, true) + line(1310, 790, 1170, 690, true)
  }
];

async function main() {
  const bundle = {
    version: 1,
    folders: []
  };

  for (const t of templates) {
    // Directories
    const svgDir = path.join(OUT_DIR_SVG, t.folder);
    const pngDir = path.join(OUT_DIR_PNG, t.folder);
    fs.mkdirSync(svgDir, { recursive: true });
    fs.mkdirSync(pngDir, { recursive: true });

    // Update manifest logic
    let folderEntry = bundle.folders.find(f => f.name === t.folder);
    if (!folderEntry) {
      folderEntry = { name: t.folder, files: [] };
      bundle.folders.push(folderEntry);
    }
    
    // SVG Master
    const svgContent = SVG_WRAP(t.svg, t.title);
    const svgPath = path.join(svgDir, t.filename + '.svg');
    fs.writeFileSync(svgPath, svgContent, 'utf-8');

    // PNG Runtime
    const pngPath = path.join(pngDir, t.filename + '.png');
    
    const buffer = Buffer.from(svgContent);
    await sharp(buffer)
      .resize(W, H)
      .toFile(pngPath);
    
    console.log(`Generated ${t.folder}/${t.filename}`);
    
    folderEntry.files.push(t.filename + '.png');
  }

  // Write Manifest
  fs.writeFileSync(path.join(OUT_DIR_PNG, 'bundle.json'), JSON.stringify(bundle, null, 2), 'utf-8');
  console.log('Complete. bundle.json written.');
}

main().catch(console.error);
