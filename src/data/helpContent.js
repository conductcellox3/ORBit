export const HelpContent = [
  {
    category: "1. はじめに (Concept)",
    items: [
      {
        title: "ようこそ ORBit へ",
        description: "ORBit（オービット）は、思いついたアイデアや情報を「無限に広がるキャンバス」にどんどん置いて、自由につなぎ合わせていくためのツールです。\n単なるメモ帳ではなく、情報を配置し、関連付け、自分だけの「思考のネットワーク」へと育てていくための【Calm Workspace（穏やかな作業空間）】を目指しています。"
      },
      {
        title: "ツールとしての強み",
        description: "「ノートを書く」「線でつなぐ」「枠でグループ化する」「別のボードへジャンプする」「画像を入れる」といった一つ一つの操作が、思考を妨げないように極めてシンプルに設計されています。「まずは出す、あとから繋ぐ、そして俯瞰する」というプロセスに最適化されています。"
      }
    ]
  },
  {
    category: "2. キャンバスの歩き方 (Navigation)",
    items: [
      {
        title: "視点の移動（パン）",
        description: "キャンバスは無限に近い広さを持っています。何もない背景をマウスでクリックしたままドラッグするか、トラックパッドを二本指でなぞると、キャンバスを見渡すように移動できます。"
      },
      {
        title: "拡大・縮小（ズーム）",
        description: "全体を俯瞰したいときや、細かい部分に寄り込みたいときは、Ctrl (macOSの場合はCmd) キーを押しながらマウスホイールを回すか、トラックパッドをスクロールしてください。"
      }
    ]
  },
  {
    category: "3. ノートの作成と基本操作 (Notes)",
    items: [
      {
        title: "ノートを書く・編集する",
        description: "キャンバスの空いている場所を「ダブルクリック」すると、そこに新しいテキストノートが作成されます。文字を入力し終わったら、ノートの外（背景）をクリックするか、ESCキーを押すと入力が確定します。\n既存のノートの文字を直したいときは、そのノートを1回クリックするだけで再び編集モードに入れます。"
      },
      {
        title: "複数選択と一まとめの操作",
        description: "複数のノートを同時に動かしたいときは、Shiftキーを押しながら背景をドラッグしてノートを四角く囲むか、Shiftキーを押しながらノートをポンポンと順番にクリックしてください。選択したノート群は、クリックしてドラッグすればまとめて移動でき、Backspace(Delete)キーで一括削除も可能です。"
      },
      {
        title: "Markdown形式での装飾 (Markdown Notes)",
        description: "テキストノートは、見出し(#)や太字(**文字**)、リスト(- または 1.)、ハイライト(==文字==)、コードブロックなどのMarkdown記法に対応しています。\nノートを選択した状態で右クリックし、「Convert to Markdown」を選ぶか、右側のプロパティパネルでFormatを「Markdown」に切り替えると、入力した書式が美しくレンダリングされます。編集したいときはダブルクリックしてください。"
      }
    ]
  },
  {
    category: "4. 履歴と複製 (History & Copy)",
    items: [
      {
        title: "操作の取り消し・やり直し",
        description: "間違ってノートを消してしまったり、変な場所に移動させてしまった場合は、焦らずにショートカットキーで元の状態に戻せます。\n※注意：別のボード（ファイル）へ移動すると、これまでの操作履歴はいったんリセットされます。",
        shortcuts: ["元に戻す：Ctrl/Cmd + Z", "やり直し：Ctrl/Cmd + Shift + Z (または Y)"]
      },
      {
        title: "ノートの複製とペースト (コピー)",
        description: "ノートを選択してショートカットキーを押すと即座に複製されます。また、ノートを選択した状態で「Alt(Option)」キーを押しながらドラッグすることでも複製が可能です。\nさらに、ノートを選択して Ctrl/Cmd + C でコピーしたあと、別のボードへ移動して Ctrl/Cmd + V を押せば、ボードをまたいだノートのコピー＆ペーストも簡単に行えます。",
        shortcuts: ["複製する：Ctrl/Cmd + D または Alt+ドラッグ", "コピー＆ペースト：Ctrl/Cmd + C / V"]
      }
    ]
  },
  {
    category: "5. 思考を繋ぐ (Linking Concepts)",
    items: [
      {
        title: "直感的に線を引く (Shift + Drag)",
        description: "ノートに書かれたアイデア同士の「関連性」を可視化します。ノートの中心付近にマウスを合わせ、Shiftキーを押したまま別のノートへ向けてドラッグしてください。これだけで2つのノートに接続線が引かれます。"
      },
      {
        title: "キーボードによるマインドマップ的展開",
        description: "現在選択しているノートから、キーボード操作だけで「次のノート」を瞬時に生み出し、線を繋ぐことができます。思考が乗っているときにマウスに持ち替える必要はありません。",
        shortcuts: ["Ctrl+Alt+右キー (子ノートを追加)", "Ctrl+Alt+下キー (兄弟ノートを追加)"]
      }
    ]
  },
  {
    category: "6. 情報の整理とマーキング (Organize)",
    items: [
      {
        title: "整列とサイズ統一 (Arrange メニュー)",
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>`,
        description: "散らかったノートをきれいに並べたいときに使います。ノートを2つ以上選んだ状態で右上トップバーの「Arrangeアイコン」を開くと、ノートの左端を綺麗に揃えたり、等間隔に配置したり、幅を同じサイズに統一したりできます。（※最後に選択した一番枠が濃いノートが基準になります）"
      },
      {
        title: "ノートのカラー変更",
        description: "種類ごとに色分けすると視認性が上がります。ノートを選択して右クリックし、コンテキストメニューの「Color」から好きな色を選んでください。複数選択して一括で色を変えることも可能です。"
      },
      {
        title: "ノートへの意味づけ (Markers)",
        description: "ノートを右クリックして「Tag as Action」等のメニューを選ぶと、ノートの下部に「Action(タスク)」や「Risk(危険)」「Decision(決定事項)」といった小さなバッジ（目印）を付けることができます。"
      }
    ]
  },
  {
    category: "7. フレームによるグループ化 (Frames)",
    items: [
      {
        title: "ノートを枠で囲む",
        description: "関連するいくつかのノートを「一つの塊」として扱いたいときにフレームを使います。対象のノートをShift+ドラッグで複数選択し、その上で右クリックして「Create Frame from Selection」を選ぶと、ノートを囲い込む半透明のコンテナ（枠）が作成されます。"
      },
      {
        title: "フレームの操作",
        description: "フレームの上部（濃いヘッダー部分）をドラッグすると、中に含まれているノートごとまとめて移動させることができます。また、ヘッダーをダブルクリックするとフレーム自体のタイトル（名前）を変更できます。"
      }
    ]
  },
  {
    category: "8. ボード間のショートカット連携 (Cross-Board Links)",
    items: [
      {
        title: "別ボードへの「どこでもドア」を作る",
        description: "今見ているボードの上に、よく使う「別のボード」や「別のノート」へのショートカットリンクを配置できます。\n・**別のボードをリンク:** 左側のExplorer（目次）で対象のボード名を右クリック ＞「Create Cross-board link」\n・**別のノートをリンク:** 任意のノートを右クリック ＞「Create Cross-board link」\nそのあと、配置したいボードの背景を右クリックし、「Insert Linked Board (Note)」を選んでください。"
      },
      {
        title: "ダブルクリックで素早くジャンプ",
        description: "キャンバス上に配置した「Linked Board」や「Linked Note」のカードをダブルクリックすると、一瞬で対象のボードへジャンプします。Linked Noteの場合は、目的のノートが画面の中央に来るように自動でスクロールされ、一時的に青く光って場所を教えてくれます。"
      }
    ]
  },
  {
    category: "9. 画像の活用と下敷き (Rich Content)",
    items: [
      {
        title: "画像の追加と自動文字起こし (ローカルOCR)",
        description: "クリップボードにある画像をCtrl+Vで貼り付けたり、画像ファイルを直接キャンバスへドラッグ＆ドロップすると、画像ノートが作られます。配置後、裏口で自動的にAI(ローカルOCR)が稼働し、画像内に書かれた文字も「テキスト検索」に引っかかるようになります。"
      },
      {
        title: "画面キャプチャの連続投下 (Chain Capture)",
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`,
        description: "Web会議中などに外部の画面を順次保存していきたいときに便利です。トップバー左上の鎖(🔗)アイコンをONにして画面キャプチャを切り取り、終了後に Ctrl+Enter を押すと、キャプチャ画像が「マインドマップのように下に繋がりながら」連続で自動配置されていきます。",
        shortcuts: ["キャプチャ確定時：Ctrl/Cmd + Enter"]
      },
      {
        title: "下敷き背景画像 (Underlay Background)",
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`,
        description: "トップバー右側の「背景画像」アイコンから、テンプレートや図面を『背景そのもの』として敷くことができます。配置後に歯車アイコン(Edit Background)を押せば、写真のサイズや透明度(Opacity)を変更して、その上から文字を書き込むのに最適な状態を作れます。"
      }
    ]
  },
  {
    category: "10. 全体俯瞰と出力 (Search & Output)",
    items: [
      {
        title: "全ボード全体検索 (Global Search)",
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
        description: "画面右側の「Search」タブから、持っている「すべてのボード」を対象に高速テキスト検索が行えます（OCRされた画像内の文字にもヒットします）。目的のノートをクリックすればその場所へ瞬時にジャンプします。",
        shortcuts: ["検索窓を出す：Ctrl/Cmd + F"]
      },
      {
        title: "ボードのネットワーク図 (Graph View)",
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>`,
        description: "トップバーの「ネットワーク」アイコンを開くと、ボード同士がどのようにつながっているか（Wikiリンク等）を俯瞰する星図（Graph）を呼び出せます。全体像を眺めたり、クリックして該当ボードへジャンプすることができます。"
      },
      {
        title: "他のアプリへの出力 (Markdown / PDF / PNG)",
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>`,
        description: "まとめた思考を整理して外に出すための機能です。右パネルの Markdown タブでは、繋いだノートをツリー構造のテキストに変換でき、そのままAI等に読ませるのに最適です。トップバー右側のプリンタアイコンを押せば、キャンバスの見た目そのままに高精細な画像やPDFとして保存できます。"
      }
    ]
  },
  {
    category: "11. オプション: Emacs風テキスト編集 (Emacs Editing)",
    items: [
      {
        title: "Emacs Liteキーバインドを利用する",
        description: "ORBitでは、テキストノート入力時にEmacs風のカーソル移動やテキスト削除を任意で有効にすることができます。\n右側の「Settings」アイコンから「Enable Emacs-style text editing in notes」をONにしてください。\n※この設定は「テキストノート」と「Markdownノートの編集モード」でのみ有効になります。Searchやタイトル入力時などは、普段通りの安全な動作が保たれます。"
      },
      {
        title: "対応している主なショートカット",
        description: "以下の基本的なコマンドによる高速なテキスト編集がサポートされています。\n" +
          "【移動】 Ctrl+A (行頭), Ctrl+E (行末), Ctrl+F (次文字), Ctrl+B (前文字), Ctrl+N (次行), Ctrl+P (前行), Alt+F (次単語), Alt+B (前単語)\n" +
          "【削除】 Ctrl+D (次文字), Ctrl+H (前文字), Alt+D (次単語), Alt+Backspace (前単語)\n" +
          "【行カット】 Ctrl+K (行末まで削除。行末にいる場合は改行を削除)"
      }
    ]
  }
];
