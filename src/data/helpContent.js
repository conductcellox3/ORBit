export const HelpContent = [
  {
    category: "ORBit の思想 (About)",
    items: [
      {
        title: "1-1. ORBit とは何か",
        description: "ORBit は、Scapple / Obsidian / OneNote / 手描きメモ / 知識カードの中間にあるような、「自由配置キャンバス型の思考・整理・接続ツール」です。\n\n単なるメモアプリではなく、以下の複合用途を狙っています。\n・思考の発散と収束\n・読書メモ / 会議メモ\n・情報の比較・構造化\n・AI に渡す前の整理、渡した後の再編集\n・過去知識の再発見\n・自分の発想と外部情報の接続",
      },
      {
        title: "1-2. ORBit の強み",
        description: "現時点の ORBit の強みは、単体機能ではなく「連なり」にあります。\n\n・ノートを書く\n・ノート同士をつなぐ\n・フレームで塊を作る\n・背景画像や image note で外部情報を取り込む\n・PDF / Markdown / AI handoff で外へ出す\n・OCR により画像中の文字を後から検索できる\n\nこの結果、ORBit は「思考を置く場所」から「思考と資料をつないで育てる場所」へと進化しています。",
      }
    ]
  },
  {
    category: "基本操作 (Basics)",
    items: [
      {
        title: "ノートの作成",
        description: "ボードの背景をダブルクリックすると、新しいテキストノートを作成できます。内容を入力したら枠外をクリックするか、ESCキーで確定します。",
      },
      {
        title: "移動・拡大縮小（パン・ズーム）",
        description: "背景をマウスでドラッグするか、トラックパッドを二本指でスクロールすると視点を移動できます。Ctrl(Cmd)を押しながらスクロールで拡大縮小します。\nキャンバスは無限に近い広さがあるため、情報を好きなだけ広げられます。",
      },
      {
        title: "複数選択",
        description: "背景を Shift + ドラッグして範囲選択するか、Shift を押しながらノートをクリックして複数選択します。選択したノート群はまとめて移動や削除、スタイルの変更が可能です。",
      },
      {
        title: "ノートの複製",
        description: "選択したノートを複製して配置します。レイアウトを保ったまま一気にコピーを作りたい時に便利です。",
        shortcuts: ["Ctrl/Cmd + D"]
      },
      {
        title: "取り消し / やり直し",
        description: "操作を1つ取り消したり、やり直したりできます。なお、ボードを切り替えると履歴はリセットされます。",
        shortcuts: ["Ctrl/Cmd + Z", "Ctrl/Cmd + Shift + Z または Y"]
      }
    ]
  },
  {
    category: "接続・レイアウト (Links & Layout)",
    items: [
      {
        title: "サクサク繋ぐ (Shift + Drag)",
        description: "ノートの中央から Shift を押しながら他のノートへドラッグすると、直感的に接続線を引けます。思考のつながりを即座に可視化できます。",
      },
      {
        title: "マインドマップ的追加",
        description: "現在選択中のノートから、キーボード操作だけで新しいノート（子・兄弟）を作成・接続できます。キーボードから手を離さずに思考ツリーを展開できます。",
        shortcuts: ["Ctrl+Alt+右 (子を追加)", "Ctrl+Alt+下 (兄弟を追加)"]
      },
      {
        title: "整列・サイズ統一 (Arrange Menu)",
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>`,
        description: "ノートを2つ以上選択して右上トップバーの「Arrangeアイコン」を押すと、左揃えや等間隔配置、サイズの統一などが可能です。整然とした思考マップ作りに役立ちます。"
      }
    ]
  },
  {
    category: "画像・背景・フレーム (Rich Content)",
    items: [
      {
        title: "画像のペースト・D&D・OCR検索",
        description: "クリップボードの画像を Ctrl+V で直接ペーストしたり、ファイルを画面にドラッグ＆ドロップできます。内部で自動的に高精度なローカルOCRが走り、画像の中の文字まで検索可能になります。",
      },
      {
        title: "キャプチャからの連続追加 (Chain Capture)",
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`,
        description: "左上やトップバーの「リンク(Chain)」のアイコンをオンにして画面キャプチャを完了し、Ctrl+Enterを押すと、自動的に下に線が繋がりながらノートを連続投下できます。",
        shortcuts: ["Ctrl/Cmd + Enter"]
      },
      {
        title: "フレームの実装 (右クリック)",
        description: "背景を範囲選択した後、右クリックメニューから「Create Frame from Selection」を選ぶと、ノートをまとめるコンテナ（枠）が作成されます。フレームのヘッダーを掴むと中のノートごと移動できます。"
      },
      {
        title: "ボード背景画像 (Underlay / Edit Background)",
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`,
        description: "トップバー右側の「背景(山と太陽)」アイコンを利用すると、手書きノートの写真を下敷きにしたり、PDFを画像化したものを敷いて上から思考を足していく使い方が可能です。"
      }
    ]
  },
  {
    category: "検索・参照・出力 (Search & Output)",
    items: [
      {
        title: "全ボード全体検索",
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
        description: "右側パネルの「Search」タブ、またはトップバーの「虫眼鏡」アイコンから、全データを通じた高速テキスト検索が行えます。OCRされた画像内の文字にもヒットします。",
        shortcuts: ["Ctrl/Cmd + F"]
      },
      {
        title: "Boards Graph View (ネットワーク全体像)",
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>`,
        description: "トップバーの「ネットワーク」アイコンで、複数のボード同士のつながり（Wikiリンク等）を俯瞰する星図（Graph）を呼び出せます。"
      },
      {
        title: "Peek (一時プレビュー機能)",
        description: "別のボードへのWikiリンクを開こうとする際「Peek」ボタンを押すと、現在の画面を維持したまま、別ボードの中身を薄いレイヤー越しに覗き見できます。Escキーですぐ元に戻れます。"
      },
      {
        title: "ボードの外部出力 (Markdown / PDF / PNG)",
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>`,
        description: "トップバーの「印刷(プリンタ)」アイコンを使用するか、右パネルの「Markdown」タブを使うことで、AIに手渡すための構造化されたMarkdownデータや、高精細な画像・PDFとして思考を外部に出力できます。"
      }
    ]
  }
];
